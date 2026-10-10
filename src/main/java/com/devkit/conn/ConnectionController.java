package com.devkit.conn;

import com.devkit.db.JdbcHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DB 실행 대상(JDBC 연결) 관리. 데이터 생성 SQL을 어느 DB에 적용할지 선택할 수 있게 한다.
 * 내부 개발자 도구 — 비밀번호는 평문 저장하되 목록 응답에서는 제외한다.
 */
@RestController
@RequestMapping("/api/connections")
public class ConnectionController {

    private final JdbcHelper db;
    private final CryptoUtil crypto;
    private final ConnectionResolver resolver;

    public ConnectionController(JdbcHelper db, CryptoUtil crypto, ConnectionResolver resolver) {
        this.db = db;
        this.crypto = crypto;
        this.resolver = resolver;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        // password 제외
        return db.query("SELECT id, name, dialect, jdbc_url, username, created_at FROM dk_connection ORDER BY name");
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, String> b) {
        String id = UUID.randomUUID().toString().replace("-", "");
        db.update("INSERT INTO dk_connection (id, name, dialect, jdbc_url, username, password, created_at) VALUES (?,?,?,?,?,?,?)",
                id, s(b.get("name")), s(b.get("dialect")), s(b.get("jdbcUrl")), s(b.get("username")), crypto.encrypt(s(b.get("password"))),
                Timestamp.valueOf(LocalDateTime.now()));
        return Map.of("id", id);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, String> b) {
        String pw = b.get("password");
        int n;
        if (pw != null && !pw.isEmpty()) {
            n = db.update("UPDATE dk_connection SET name=?, dialect=?, jdbc_url=?, username=?, password=? WHERE id=?",
                    s(b.get("name")), s(b.get("dialect")), s(b.get("jdbcUrl")), s(b.get("username")), crypto.encrypt(pw), id);
        } else {
            n = db.update("UPDATE dk_connection SET name=?, dialect=?, jdbc_url=?, username=? WHERE id=?",
                    s(b.get("name")), s(b.get("dialect")), s(b.get("jdbcUrl")), s(b.get("username")), id);
        }
        resolver.invalidate(id);   // 변경된 연결정보로 풀 재생성되도록 캐시 폐기
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.ok(Map.of("id", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        int n = db.update("DELETE FROM dk_connection WHERE id=?", id);
        resolver.invalidate(id);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.noContent().build();
    }

    /** 연결 테스트. 저장 전 body로 직접 테스트하거나, 저장된 연결을 id로 테스트. */
    @PostMapping("/test")
    public ResponseEntity<?> test(@RequestBody Map<String, String> b) {
        String url = s(b.get("jdbcUrl"));
        String user = s(b.get("username"));
        String pw = b.getOrDefault("password", "");
        String id = b.get("id");
        if (url.isEmpty() && id != null && !id.isBlank()) {
            List<Map<String, Object>> rows = db.query("SELECT jdbc_url, username, password FROM dk_connection WHERE id=?", id);
            if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "연결을 찾을 수 없습니다."));
            url = str(rows.get(0).get("jdbc_url"));
            user = str(rows.get(0).get("username"));
            pw = crypto.decrypt(str(rows.get(0).get("password")));
        }
        if (url.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "JDBC URL이 필요합니다."));
        try (Connection c = DriverManager.getConnection(url, user, pw)) {
            boolean ok = c.isValid(5);
            return ResponseEntity.ok(Map.of("ok", ok));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.toString()));
        }
    }

    private static String s(String v) { return v == null ? "" : v.trim(); }
    private static String str(Object o) { return o == null ? "" : o.toString(); }
}
