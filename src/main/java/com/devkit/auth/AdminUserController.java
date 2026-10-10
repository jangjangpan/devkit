package com.devkit.auth;

import com.devkit.db.JdbcHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 관리자 전용 사용자 관리. */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private static final String CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
    private static final SecureRandom RNG = new SecureRandom();

    private final JdbcHelper db;
    private final PasswordEncoder enc;

    public AdminUserController(JdbcHelper db, PasswordEncoder enc) {
        this.db = db;
        this.enc = enc;
    }

    private UserPrincipal me() {
        Object p = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal() : null;
        return (p instanceof UserPrincipal) ? (UserPrincipal) p : null;
    }

    private void requireAdmin() {
        UserPrincipal me = me();
        if (me == null || !me.isAdmin()) throw new AccessDenied();
    }

    @ExceptionHandler(AccessDenied.class)
    public ResponseEntity<?> denied() {
        return ResponseEntity.status(403).body(Map.of("error", "관리자만 가능합니다."));
    }

    static class AccessDenied extends RuntimeException {}

    @GetMapping
    public List<Map<String, Object>> list() {
        requireAdmin();
        // 승인 대기(PENDING)를 먼저, 그 다음 생성일순
        return db.query("SELECT user_cd, user_nm, is_admin, use_yn, status_cd, created_at FROM dk_user " +
                "ORDER BY CASE WHEN status_cd = 'PENDING' THEN 0 ELSE 1 END, created_at");
    }

    @PostMapping("/{userCd}/approve")
    public ResponseEntity<?> approve(@PathVariable String userCd) {
        requireAdmin();
        int n = db.update("UPDATE dk_user SET status_cd = 'APPROVED', use_yn = 'Y' WHERE user_cd = ?", userCd);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.ok(Map.of("result", "OK"));
    }

    @PostMapping("/{userCd}/reject")
    public ResponseEntity<?> reject(@PathVariable String userCd) {
        requireAdmin();
        if (userCd.equals(me().getUserCd())) return ResponseEntity.badRequest().body(Map.of("error", "본인은 거부할 수 없습니다."));
        int n = db.update("UPDATE dk_user SET status_cd = 'REJECTED' WHERE user_cd = ?", userCd);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.ok(Map.of("result", "OK"));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body) {
        requireAdmin();
        String userCd = str(body.get("userCd"));
        String userNm = str(body.get("userNm"));
        boolean isAdmin = "Y".equalsIgnoreCase(body.get("isAdmin")) || "true".equalsIgnoreCase(body.get("isAdmin"));
        if (userCd.isEmpty() || userNm.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "ID와 이름은 필수"));
        if (!userCd.matches("[A-Za-z0-9_.]{2,20}")) return ResponseEntity.badRequest().body(Map.of("error", "ID는 2~20자 영문/숫자/_/. 만 가능"));
        if (!db.query("SELECT user_cd FROM dk_user WHERE user_cd = ?", userCd).isEmpty()) {
            return ResponseEntity.status(409).body(Map.of("error", "이미 존재하는 ID"));
        }
        String tempPwd = tempPassword();
        // 관리자가 만든 계정은 자동 승인(APPROVED)
        db.update("INSERT INTO dk_user (user_cd, user_nm, password_hash, is_admin, use_yn, theme_color, must_change_password, status_cd, created_at) " +
                "VALUES (?, ?, ?, ?, 'Y', 'BLUE', 'Y', 'APPROVED', ?)",
                userCd, userNm, enc.encode(tempPwd), isAdmin ? "Y" : "N", Timestamp.valueOf(LocalDateTime.now()));
        Map<String, Object> r = new HashMap<>();
        r.put("result", "OK");
        r.put("userCd", userCd);
        r.put("tempPassword", tempPwd);
        return ResponseEntity.ok(r);
    }

    @PutMapping("/{userCd}")
    public ResponseEntity<?> update(@PathVariable String userCd, @RequestBody Map<String, String> body) {
        requireAdmin();
        String userNm = str(body.get("userNm"));
        boolean isAdmin = "Y".equalsIgnoreCase(body.get("isAdmin")) || "true".equalsIgnoreCase(body.get("isAdmin"));
        if (userNm.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "이름은 필수"));
        // 본인의 관리자 권한 해제 방지
        if (userCd.equals(me().getUserCd()) && !isAdmin) {
            return ResponseEntity.badRequest().body(Map.of("error", "본인의 관리자 권한은 해제할 수 없습니다."));
        }
        db.update("UPDATE dk_user SET user_nm = ?, is_admin = ? WHERE user_cd = ?", userNm, isAdmin ? "Y" : "N", userCd);
        return ResponseEntity.ok(Map.of("result", "OK"));
    }

    @PostMapping("/{userCd}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String userCd) {
        requireAdmin();
        String tempPwd = tempPassword();
        int n = db.update("UPDATE dk_user SET password_hash = ?, must_change_password = 'Y' WHERE user_cd = ?", enc.encode(tempPwd), userCd);
        if (n == 0) return ResponseEntity.notFound().build();
        Map<String, Object> r = new HashMap<>();
        r.put("result", "OK");
        r.put("tempPassword", tempPwd);
        return ResponseEntity.ok(r);
    }

    @PostMapping("/{userCd}/active")
    public ResponseEntity<?> setActive(@PathVariable String userCd, @RequestBody Map<String, String> body) {
        requireAdmin();
        boolean active = "Y".equalsIgnoreCase(body.get("useYn")) || "true".equalsIgnoreCase(body.get("active"));
        if (userCd.equals(me().getUserCd()) && !active) {
            return ResponseEntity.badRequest().body(Map.of("error", "본인은 비활성화할 수 없습니다."));
        }
        db.update("UPDATE dk_user SET use_yn = ? WHERE user_cd = ?", active ? "Y" : "N", userCd);
        return ResponseEntity.ok(Map.of("result", "OK"));
    }

    @DeleteMapping("/{userCd}")
    public ResponseEntity<?> delete(@PathVariable String userCd) {
        requireAdmin();
        if (userCd.equals(me().getUserCd())) {
            return ResponseEntity.badRequest().body(Map.of("error", "본인 계정은 삭제할 수 없습니다."));
        }
        int n = db.update("DELETE FROM dk_user WHERE user_cd = ?", userCd);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.ok(Map.of("result", "OK"));
    }

    private String tempPassword() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) sb.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
        return sb.toString();
    }

    private static String str(String s) { return s == null ? "" : s.trim(); }
}
