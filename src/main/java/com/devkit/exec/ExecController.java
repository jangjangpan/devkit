package com.devkit.exec;

import com.devkit.conn.ConnectionResolver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 생성한 INSERT/UPDATE 등을 선택한 DB에 직접 실행한다(내부 개발자 도구).
 *  - connectionId 미지정: 앱이 연결된 기본 DataSource
 *  - connectionId 지정: dk_connection에 등록된 JDBC 연결
 * 수동 트랜잭션으로 묶어 하나라도 실패하면 전체 롤백한다. 인증 사용자만 가능.
 */
@RestController
@RequestMapping("/api/exec")
public class ExecController {

    private final ConnectionResolver resolver;
    private final HistoryRecorder history;

    public ExecController(ConnectionResolver resolver, HistoryRecorder history) {
        this.resolver = resolver;
        this.history = history;
    }

    @PostMapping
    public ResponseEntity<?> run(@RequestBody Map<String, Object> body) {
        String sql = String.valueOf(body.getOrDefault("sql", ""));
        String connId = body.get("connectionId") == null ? "" : String.valueOf(body.get("connectionId")).trim();
        String connName = resolver.nameOf(connId);
        long t0 = System.currentTimeMillis();
        List<String> stmts = splitStatements(sql);
        if (stmts.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "실행할 SQL이 없습니다."));

        Connection conn = null;
        try {
            conn = resolver.resolve(connId);
        } catch (Exception e) {
            String msg = "DB 연결 실패: " + rootMessage(e);
            history.record("exec", connName, sql, "error", msg, System.currentTimeMillis() - t0);
            return ResponseEntity.status(400).body(Map.of("error", msg));
        }

        try {
            conn.setAutoCommit(false);
            int total = 0;
            try (Statement st = conn.createStatement()) {
                for (String s : stmts) total += st.executeUpdate(s);
            }
            conn.commit();
            history.record("exec", connName, sql, "ok", stmts.size() + "문 / " + total + "건", System.currentTimeMillis() - t0);
            return ResponseEntity.ok(Map.of("statements", stmts.size(), "affected", total));
        } catch (Exception e) {
            try { conn.rollback(); } catch (Exception ignore) {}
            history.record("exec", connName, sql, "error", rootMessage(e), System.currentTimeMillis() - t0);
            return ResponseEntity.status(400).body(Map.of("error", rootMessage(e)));
        } finally {
            try { conn.close(); } catch (Exception ignore) {}
        }
    }

    private static String rootMessage(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null && c.getCause() != c) c = c.getCause();
        return c.getMessage() != null ? c.getMessage() : t.toString();
    }

    /** 작은따옴표 문자열을 인지하는 ';' 분리기 (문자열 내부 ';'은 무시, '' 이스케이프 처리). */
    private static List<String> splitStatements(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inStr = false;
        for (int i = 0; i < sql.length(); i++) {
            char ch = sql.charAt(i);
            if (ch == '\'') {
                if (inStr && i + 1 < sql.length() && sql.charAt(i + 1) == '\'') {
                    cur.append("''");
                    i++;
                    continue;
                }
                inStr = !inStr;
                cur.append(ch);
            } else if (ch == ';' && !inStr) {
                String s = cur.toString().trim();
                if (!s.isEmpty()) out.add(s);
                cur.setLength(0);
            } else {
                cur.append(ch);
            }
        }
        String last = cur.toString().trim();
        if (!last.isEmpty()) out.add(last);
        return out;
    }
}
