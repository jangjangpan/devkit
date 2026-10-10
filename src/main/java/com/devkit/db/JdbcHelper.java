package com.devkit.db;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import java.sql.ResultSetMetaData;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DB dialect 간 결과 차이를 흡수하는 JdbcTemplate wrapper.
 *  - 컬럼명 케이싱 정규화: Oracle은 대문자, PG는 소문자로 와서 frontend 키가 깨짐 → 전부 lowercase 통일.
 *  - CLOB → String (Jackson 직렬화 호환).
 *  - 단일 dk_project 테이블만 쓰므로 SQL은 ANSI 포터블 문자열을 그대로 사용 (UUID PK는 Java 생성).
 */
@Component
public class JdbcHelper {

    private final JdbcTemplate jdbc;

    public JdbcHelper(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static final RowMapper<Map<String, Object>> LOWERCASE_MAP_ROW_MAPPER = (rs, rowNum) -> {
        ResultSetMetaData md = rs.getMetaData();
        int n = md.getColumnCount();
        Map<String, Object> row = new LinkedHashMap<>(n);
        for (int i = 1; i <= n; i++) {
            String label = md.getColumnLabel(i);
            if (label == null) label = md.getColumnName(i);
            String typeName = md.getColumnTypeName(i);
            Object value;
            if (typeName != null && typeName.toUpperCase().startsWith("TIMESTAMP")) {
                java.sql.Timestamp ts = rs.getTimestamp(i);
                value = (ts == null) ? null : ts.toLocalDateTime().toString().replace('T', ' ');
            } else {
                value = rs.getObject(i);
                if (value instanceof java.sql.Clob clob) {
                    long len = clob.length();
                    value = len == 0 ? "" : clob.getSubString(1, (int) Math.min(len, Integer.MAX_VALUE));
                } else if (value instanceof java.sql.Timestamp ts) {
                    value = ts.toLocalDateTime().toString().replace('T', ' ');
                }
            }
            row.put(label.toLowerCase(), value);
        }
        return row;
    };

    public List<Map<String, Object>> query(String sql, Object... args) {
        return jdbc.query(sql, LOWERCASE_MAP_ROW_MAPPER, args);
    }

    public int update(String sql, Object... args) {
        return jdbc.update(sql, args);
    }

    public JdbcTemplate raw() {
        return jdbc;
    }
}
