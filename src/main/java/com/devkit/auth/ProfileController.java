package com.devkit.auth;

import com.devkit.db.JdbcHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 본인 정보 수정 (이름/테마/비밀번호). */
@RestController
@RequestMapping("/api/me")
public class ProfileController {

    private final JdbcHelper db;
    private final PasswordEncoder enc;

    public ProfileController(JdbcHelper db, PasswordEncoder enc) {
        this.db = db;
        this.enc = enc;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> profile() {
        String me = UserPrincipal.currentUserCd();
        if ("system".equals(me)) return ResponseEntity.status(401).build();
        List<Map<String, Object>> rows = db.query(
            "SELECT user_cd, user_nm, is_admin, theme_color FROM dk_user WHERE user_cd = ?", me);
        if (rows.isEmpty()) return ResponseEntity.status(404).build();
        return ResponseEntity.ok(rows.get(0));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> update(@RequestBody Map<String, String> body) {
        String me = UserPrincipal.currentUserCd();
        if ("system".equals(me)) return ResponseEntity.status(401).build();
        String userNm = str(body.get("userNm"));
        String theme = str(body.get("themeColor"));
        if (userNm.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "이름은 비울 수 없습니다."));
        db.update("UPDATE dk_user SET user_nm = ?, theme_color = ? WHERE user_cd = ?",
                userNm, theme.isEmpty() ? "BLUE" : theme, me);
        return ResponseEntity.ok(Map.of("result", "OK"));
    }

    /** 테마만 변경 (빠른 스킨 전환용). */
    @PutMapping("/theme")
    public ResponseEntity<?> theme(@RequestBody Map<String, String> body) {
        String me = UserPrincipal.currentUserCd();
        if ("system".equals(me)) return ResponseEntity.status(401).build();
        String theme = str(body.get("themeColor"));
        db.update("UPDATE dk_user SET theme_color = ? WHERE user_cd = ?", theme.isEmpty() ? "BLUE" : theme, me);
        return ResponseEntity.ok(Map.of("result", "OK"));
    }

    @PostMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body) {
        String me = UserPrincipal.currentUserCd();
        if ("system".equals(me)) return ResponseEntity.status(401).build();
        String current = body.getOrDefault("currentPassword", "");
        String next = body.getOrDefault("newPassword", "");
        if (next.length() < 4) return ResponseEntity.badRequest().body(Map.of("error", "새 비밀번호는 4자 이상이어야 합니다."));
        if (next.equals(current)) return ResponseEntity.badRequest().body(Map.of("error", "현재 비밀번호와 다른 값을 입력하세요."));

        List<Map<String, Object>> rows = db.query("SELECT password_hash FROM dk_user WHERE user_cd = ?", me);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "사용자 없음"));
        String hash = (String) rows.get(0).get("password_hash");
        if (hash == null || !enc.matches(current, hash)) {
            return ResponseEntity.status(401).body(Map.of("error", "현재 비밀번호가 일치하지 않습니다."));
        }
        db.update("UPDATE dk_user SET password_hash = ?, must_change_password = 'N' WHERE user_cd = ?", enc.encode(next), me);
        return ResponseEntity.ok(Map.of("result", "OK"));
    }

    private static String str(String s) { return s == null ? "" : s.trim(); }
}
