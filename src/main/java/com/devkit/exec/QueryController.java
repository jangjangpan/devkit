package com.devkit.exec;

import com.devkit.conn.ConnectionResolver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 단일 SQL을 선택한 DB에 실행해 결과를 조회한다(조회 도구).
 *  - SELECT 등 결과셋이면 columns + rows 반환(최대 limit행)
 *  - DML/DDL이면 affected 반환 (조회 도구지만 편의상 허용, 자동커밋)
 */
@RestController
@RequestMapping("/api/query")
public class QueryController {

    private static final int MAX_LIMIT = 2000;

    private final ConnectionResolver resolver;
    private final HistoryRecorder history;

    public QueryController(ConnectionResolver resolver, HistoryRecorder history) {
        this.resolver = resolver;
        this.history = history;
    }

    @PostMapping
    public ResponseEntity<?> query(@RequestBody Map<String, Object> body) {
        String sql = String.valueOf(body.getOrDefault("sql", "")).trim();
        while (sql.endsWith(";")) sql = sql.substring(0, sql.length() - 1).trim();
        if (sql.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "SQL을 입력하세요."));
        String connId = body.get("connectionId") == null ? "" : String.valueOf(body.get("connectionId"));
        int limit = parseLimit(body.get("limit"));
        String connName = resolver.nameOf(connId);
        long t0 = System.currentTimeMillis();

        Connection conn;
        try {
            conn = resolver.resolve(connId);
        } catch (Exception e) {
            String msg = "DB 연결 실패: " + rootMessage(e);
            history.record("query", connName, sql, "error", msg, System.currentTimeMillis() - t0);
            return ResponseEntity.status(400).body(Map.of("error", msg));
        }

        try (Connection c = conn; Statement st = c.createStatement()) {
            st.setMaxRows(limit);
            boolean hasRs = st.execute(sql);
            if (!hasRs) {
                int aff = st.getUpdateCount();
                history.record("query", connName, sql, "ok", aff + "건 반영", System.currentTimeMillis() - t0);
                return ResponseEntity.ok(Map.of("affected", aff));
            }
            try (ResultSet rs = st.getResultSet()) {
                ResultSetMetaData md = rs.getMetaData();
                int n = md.getColumnCount();
                List<String> columns = new ArrayList<>(n);
                for (int i = 1; i <= n; i++) {
                    String label = md.getColumnLabel(i);
                    columns.add(label != null ? label : md.getColumnName(i));
                }
                List<List<Object>> rows = new ArrayList<>();
                boolean truncated = false;
                while (rs.next()) {
                    if (rows.size() >= limit) { truncated = true; break; }
                    List<Object> row = new ArrayList<>(n);
                    for (int i = 1; i <= n; i++) {
                        Object v = rs.getObject(i);
                        if (v == null) row.add(null);
                        else if (v instanceof byte[]) row.add("[binary]");
                        else row.add(v.toString());
                    }
                    rows.add(row);
                }
                history.record("query", connName, sql, "ok", rows.size() + "행 조회", System.currentTimeMillis() - t0);
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("columns", columns);
                out.put("rows", rows);
                out.put("rowCount", rows.size());
                out.put("truncated", truncated);
                return ResponseEntity.ok(out);
            }
        } catch (Exception e) {
            history.record("query", connName, sql, "error", rootMessage(e), System.currentTimeMillis() - t0);
            return ResponseEntity.status(400).body(Map.of("error", rootMessage(e)));
        }
    }

    private static int parseLimit(Object o) {
        if (o == null) return 500;
        try {
            int v = Integer.parseInt(o.toString());
            return Math.max(1, Math.min(v, MAX_LIMIT));
        } catch (Exception e) {
            return 500;
        }
    }

    private static String rootMessage(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null && c.getCause() != c) c = c.getCause();
        return c.getMessage() != null ? c.getMessage() : t.toString();
    }
}
