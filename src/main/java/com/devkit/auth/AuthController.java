package com.devkit.auth;

import com.devkit.activity.ActivityLogService;
import com.devkit.config.AppConfigService;
import com.devkit.config.SystemConfigController;
import com.devkit.db.JdbcHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 간단 JWT 인증 (내부 개발자 도구).
 *  - 단일 테이블 dk_user (user_cd PK, user_nm, password_hash(BCrypt), is_admin, use_yn).
 *  - 가입은 즉시 활성(승인 절차 없음). 관리자는 SeedRunner가 seed.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JdbcHelper db;
    private final PasswordEncoder enc;
    private final JwtUtil jwt;
    private final ActivityLogService activity;
    private final AppConfigService appConfig;

    public AuthController(JdbcHelper db, PasswordEncoder enc, JwtUtil jwt, ActivityLogService activity, AppConfigService appConfig) {
        this.db = db;
        this.enc = enc;
        this.jwt = jwt;
        this.activity = activity;
        this.appConfig = appConfig;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpServletRequest req) {
        String userCd = str(body.get("userCd"));
        String password = body.getOrDefault("password", "");
        if (userCd.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(error("ID/PW를 입력하세요."));
        }
        List<Map<String, Object>> rows = db.query(
            "SELECT user_cd, user_nm, password_hash, is_admin, use_yn, theme_color, must_change_password, status_cd FROM dk_user WHERE user_cd = ?", userCd);
        if (rows.isEmpty()) return ResponseEntity.status(401).body(error("계정을 찾을 수 없습니다."));

        Map<String, Object> r = rows.get(0);
        String status = r.get("status_cd") == null ? "APPROVED" : r.get("status_cd").toString();
        if ("PENDING".equals(status)) {
            return ResponseEntity.status(403).body(error("관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다."));
        }
        if ("REJECTED".equals(status)) {
            return ResponseEntity.status(403).body(error("가입이 거부된 계정입니다."));
        }
        if ("N".equals(r.get("use_yn"))) {
            return ResponseEntity.status(403).body(error("비활성화된 계정입니다."));
        }
        String hash = (String) r.get("password_hash");
        if (hash == null || !enc.matches(password, hash)) {
            return ResponseEntity.status(401).body(error("비밀번호가 일치하지 않습니다."));
        }
        boolean admin = "Y".equals(r.get("is_admin"));
        String userNm = (String) r.get("user_nm");
        // 시스템 설정의 세션 유지 시간으로 토큰 만료 결정 (미설정 시 기본값)
        long sessionHours = appConfig.getInt(SystemConfigController.SESSION_HOURS, (int) jwt.defaultExpirationHours());
        String token = jwt.generate(userCd, userNm, admin, sessionHours);
        activity.record(userCd, userNm, "login", null, ActivityLogService.clientIp(req));

        Map<String, Object> resp = new HashMap<>();
        resp.put("token", token);
        resp.put("user", userInfo(userCd, userNm, admin, (String) r.get("theme_color"), "Y".equals(r.get("must_change_password"))));
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        String userCd = UserPrincipal.currentUserCd();
        if ("system".equals(userCd)) return ResponseEntity.status(401).body(error("Not authenticated"));
        List<Map<String, Object>> rows = db.query(
            "SELECT user_cd, user_nm, is_admin, theme_color, must_change_password FROM dk_user WHERE user_cd = ?", userCd);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(error("User not found"));
        Map<String, Object> r = rows.get(0);
        return ResponseEntity.ok(userInfo(userCd, (String) r.get("user_nm"), "Y".equals(r.get("is_admin")),
                (String) r.get("theme_color"), "Y".equals(r.get("must_change_password"))));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body) {
        String userCd = str(body.get("userCd"));
        String userNm = str(body.get("userNm"));
        String password = body.getOrDefault("password", "");

        if (userCd.isEmpty() || userNm.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(error("ID, 이름, 비밀번호는 필수입니다."));
        }
        if (!userCd.matches("[A-Za-z0-9_.]{2,20}")) {
            return ResponseEntity.badRequest().body(error("ID는 2~20자 영문/숫자/_/. 만 가능합니다."));
        }
        if (password.length() < 4) {
            return ResponseEntity.badRequest().body(error("비밀번호는 4자 이상이어야 합니다."));
        }
        List<Map<String, Object>> dup = db.query("SELECT user_cd FROM dk_user WHERE user_cd = ?", userCd);
        if (!dup.isEmpty()) return ResponseEntity.status(409).body(error("이미 사용 중인 ID입니다."));

        // 가입은 승인 대기(PENDING) 상태로 생성 — 관리자 승인 후 로그인 가능
        db.update("INSERT INTO dk_user (user_cd, user_nm, password_hash, is_admin, use_yn, status_cd, created_at) " +
                "VALUES (?, ?, ?, 'N', 'Y', 'PENDING', ?)",
                userCd, userNm, enc.encode(password), Timestamp.valueOf(LocalDateTime.now()));

        Map<String, Object> resp = new HashMap<>();
        resp.put("result", "OK");
        resp.put("message", "가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
        return ResponseEntity.ok(resp);
    }

    private Map<String, Object> userInfo(String userCd, String userNm, boolean admin, String themeColor, boolean mustChange) {
        Map<String, Object> u = new HashMap<>();
        u.put("userCd", userCd);
        u.put("userNm", userNm);
        u.put("isAdmin", admin);
        u.put("themeColor", themeColor == null || themeColor.isBlank() ? "BLUE" : themeColor);
        u.put("mustChangePassword", mustChange);
        return u;
    }

    private static String str(String s) { return s == null ? "" : s.trim(); }

    private Map<String, String> error(String msg) {
        Map<String, String> m = new HashMap<>();
        m.put("error", msg);
        return m;
    }
}
