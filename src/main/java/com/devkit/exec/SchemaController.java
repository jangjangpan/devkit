package com.devkit.exec;

import com.devkit.conn.ConnectionResolver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 스키마 브라우저 — 선택한 DB의 스키마/테이블/컬럼을 JDBC 메타데이터로 조회. */
@RestController
@RequestMapping("/api/schema")
public class SchemaController {

    private static final Set<String> SYS = Set.of(
        "information_schema", "pg_catalog", "pg_toast", "sys", "mysql", "performance_schema");

    private final ConnectionResolver resolver;

    public SchemaController(ConnectionResolver resolver) {
        this.resolver = resolver;
    }

    @GetMapping("/schemas")
    public ResponseEntity<?> schemas(@RequestParam(required = false) String connectionId) {
        try (Connection c = resolver.resolve(connectionId)) {
            DatabaseMetaData md = c.getMetaData();
            // 현재(로그인) 스키마 — Oracle 등에서 기본 선택해 전체 스캔을 피한다
            String current = null;
            try { current = c.getSchema(); } catch (Exception ignore) {}
            if (current == null || current.isBlank()) {
                try { current = md.getUserName(); } catch (Exception ignore) {}
            }
            Set<String> out = new LinkedHashSet<>();
            try (ResultSet rs = md.getSchemas()) {
                while (rs.next()) {
                    String s = rs.getString("TABLE_SCHEM");
                    if (s != null && !SYS.contains(s.toLowerCase())) out.add(s);
                }
            }
            try (ResultSet rs = md.getCatalogs()) {
                while (rs.next()) {
                    String s = rs.getString("TABLE_CAT");
                    if (s != null && !SYS.contains(s.toLowerCase())) out.add(s);
                }
            }
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("current", current == null ? "" : current);
            resp.put("schemas", new ArrayList<>(out));
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", root(e)));
        }
    }

    @GetMapping("/tables")
    public ResponseEntity<?> tables(@RequestParam(required = false) String connectionId,
                                    @RequestParam(required = false) String schema) {
        String sch = (schema == null || schema.isBlank()) ? null : schema;
        // 스키마 미지정 시 전체 인스턴스 스캔(Oracle에서 수만 건 → 매우 느림)을 막는다
        if (sch == null) return ResponseEntity.ok(new ArrayList<>());
        try (Connection c = resolver.resolve(connectionId)) {
            DatabaseMetaData md = c.getMetaData();
            List<Map<String, Object>> list = readTables(md, null, sch);
            if (list.isEmpty()) list = readTables(md, sch, null); // MySQL: catalog 기반 폴백
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", root(e)));
        }
    }

    @GetMapping("/columns")
    public ResponseEntity<?> columns(@RequestParam(required = false) String connectionId,
                                     @RequestParam(required = false) String schema,
                                     @RequestParam String table) {
        try (Connection c = resolver.resolve(connectionId)) {
            DatabaseMetaData md = c.getMetaData();
            String sch = (schema == null || schema.isBlank()) ? null : schema;
            List<Map<String, Object>> list = readColumns(md, null, sch, table);
            if (list.isEmpty() && sch != null) list = readColumns(md, sch, null, table);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", root(e)));
        }
    }

    /** 기존 테이블 → DDL 모델(BaseType/length/pk/notNull) 역생성. */
    @GetMapping("/ddl")
    public ResponseEntity<?> tableDef(@RequestParam(required = false) String connectionId,
                                      @RequestParam(required = false) String schema,
                                      @RequestParam String table) {
        try (Connection c = resolver.resolve(connectionId)) {
            DatabaseMetaData md = c.getMetaData();
            String sch = (schema == null || schema.isBlank()) ? null : schema;
            Map<String, Object> def = buildDef(md, null, sch, table);
            if (((List<?>) def.get("columns")).isEmpty() && sch != null) def = buildDef(md, sch, null, table);
            return ResponseEntity.ok(def);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", root(e)));
        }
    }

    /** 여러 테이블 → ERD(테이블 정의 + FK 관계). tables=쉼표구분. */
    @GetMapping("/erd")
    public ResponseEntity<?> erd(@RequestParam(required = false) String connectionId,
                                 @RequestParam(required = false) String schema,
                                 @RequestParam String tables) {
        List<String> names = new ArrayList<>();
        for (String s : tables.split(",")) { String n = s.trim(); if (!n.isEmpty()) names.add(n); }
        if (names.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "테이블을 선택하세요."));
        Set<String> nameSet = new LinkedHashSet<>();
        for (String n : names) nameSet.add(n.toLowerCase());

        try (Connection c = resolver.resolve(connectionId)) {
            DatabaseMetaData md = c.getMetaData();
            String sch = (schema == null || schema.isBlank()) ? null : schema;
            List<Map<String, Object>> defs = new ArrayList<>();
            List<Map<String, Object>> relations = new ArrayList<>();
            for (String name : names) {
                Map<String, Object> def = buildDef(md, null, sch, name);
                if (((List<?>) def.get("columns")).isEmpty() && sch != null) def = buildDef(md, sch, null, name);
                defs.add(def);
                List<Map<String, Object>> fks = readFks(md, null, sch, name, nameSet);
                if (fks.isEmpty() && sch != null) fks = readFks(md, sch, null, name, nameSet);
                relations.addAll(fks);
            }
            return ResponseEntity.ok(Map.of("tables", defs, "relations", relations));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", root(e)));
        }
    }

    /** FK(자식 table → 부모) 관계. PK대상이 nameSet에 있는 것만. FK_NAME으로 묶어 복합키 지원. */
    private List<Map<String, Object>> readFks(DatabaseMetaData md, String catalog, String schema, String table, Set<String> nameSet) throws Exception {
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        try (ResultSet rs = md.getImportedKeys(catalog, schema, table)) {
            while (rs.next()) {
                String pkTable = rs.getString("PKTABLE_NAME");
                if (pkTable == null || !nameSet.contains(pkTable.toLowerCase())) continue;
                String fkName = rs.getString("FK_NAME");
                String key = (fkName != null ? fkName : pkTable) + "#" + pkTable;
                Map<String, Object> rel = byName.computeIfAbsent(key, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("fromTable", table);
                    m.put("toTable", pkTable);
                    m.put("fromColumns", new ArrayList<String>());
                    m.put("toColumns", new ArrayList<String>());
                    return m;
                });
                @SuppressWarnings("unchecked") List<String> fc = (List<String>) rel.get("fromColumns");
                @SuppressWarnings("unchecked") List<String> tc = (List<String>) rel.get("toColumns");
                fc.add(rs.getString("FKCOLUMN_NAME"));
                tc.add(rs.getString("PKCOLUMN_NAME"));
            }
        }
        return new ArrayList<>(byName.values());
    }

    private Map<String, Object> buildDef(DatabaseMetaData md, String catalog, String schema, String table) throws Exception {
        Set<String> pk = new LinkedHashSet<>();
        try (ResultSet rs = md.getPrimaryKeys(catalog, schema, table)) {
            while (rs.next()) pk.add(rs.getString("COLUMN_NAME"));
        }
        List<Map<String, Object>> cols = new ArrayList<>();
        String schemaName = schema == null ? "" : schema;
        try (ResultSet rs = md.getColumns(catalog, schema, table, "%")) {
            while (rs.next()) {
                String name = rs.getString("COLUMN_NAME");
                int dataType = rs.getInt("DATA_TYPE");
                int size = rs.getInt("COLUMN_SIZE");
                int scale = rs.getInt("DECIMAL_DIGITS");
                boolean nullable = "YES".equalsIgnoreCase(rs.getString("IS_NULLABLE"));
                String remarks = null;
                try { remarks = rs.getString("REMARKS"); } catch (Exception ignore) {}
                String ts = rs.getString("TABLE_SCHEM");
                if (ts != null && !ts.isBlank()) schemaName = ts;

                String[] tl = mapType(dataType, size, scale);
                Map<String, Object> col = new LinkedHashMap<>();
                col.put("name", name);
                col.put("type", tl[0]);
                col.put("length", tl[1]);
                col.put("pk", pk.contains(name));
                col.put("notNull", !nullable || pk.contains(name));
                col.put("comment", remarks == null ? "" : remarks);
                cols.add(col);
            }
        }
        Map<String, Object> def = new LinkedHashMap<>();
        def.put("name", table);
        def.put("schema", schemaName);
        def.put("columns", cols);
        return def;
    }

    /** JDBC 타입 → [BaseType, length]. */
    private static String[] mapType(int t, int size, int scale) {
        switch (t) {
            case Types.CHAR: case Types.NCHAR:
                return new String[]{"CHAR", size > 0 ? String.valueOf(size) : ""};
            case Types.VARCHAR: case Types.NVARCHAR:
                // PG TEXT / MSSQL NVARCHAR(MAX) 등은 거대 size로 보고 → TEXT 처리
                if (size <= 0 || size > 65535) return new String[]{"TEXT", ""};
                return new String[]{"VARCHAR", String.valueOf(size)};
            case Types.LONGVARCHAR: case Types.LONGNVARCHAR: case Types.CLOB: case Types.NCLOB:
                return new String[]{"TEXT", ""};
            case Types.INTEGER: case Types.SMALLINT: case Types.TINYINT:
                return new String[]{"INT", ""};
            case Types.BIGINT:
                return new String[]{"BIGINT", ""};
            case Types.NUMERIC: case Types.DECIMAL:
                if (scale <= 0) {
                    if (size > 0 && size <= 9) return new String[]{"INT", ""};
                    if (size > 0 && size <= 18) return new String[]{"BIGINT", ""};
                    return new String[]{"DECIMAL", size > 0 ? size + ",0" : ""};
                }
                return new String[]{"DECIMAL", size > 0 ? size + "," + scale : ""};
            case Types.FLOAT: case Types.DOUBLE: case Types.REAL:
                return new String[]{"FLOAT", ""};
            case Types.DATE:
                return new String[]{"DATE", ""};
            case Types.TIMESTAMP: case Types.TIME: case Types.TIMESTAMP_WITH_TIMEZONE:
                return new String[]{"DATETIME", ""};
            case Types.BOOLEAN: case Types.BIT:
                return new String[]{"BOOLEAN", ""};
            default:
                return new String[]{"VARCHAR", size > 0 ? String.valueOf(size) : ""};
        }
    }

    private List<Map<String, Object>> readTables(DatabaseMetaData md, String catalog, String schema) throws Exception {
        List<Map<String, Object>> list = new ArrayList<>();
        try (ResultSet rs = md.getTables(catalog, schema, "%", new String[]{"TABLE", "VIEW"})) {
            while (rs.next()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", rs.getString("TABLE_NAME"));
                m.put("type", rs.getString("TABLE_TYPE"));
                m.put("schema", rs.getString("TABLE_SCHEM"));
                list.add(m);
            }
        }
        return list;
    }

    private List<Map<String, Object>> readColumns(DatabaseMetaData md, String catalog, String schema, String table) throws Exception {
        List<Map<String, Object>> list = new ArrayList<>();
        try (ResultSet rs = md.getColumns(catalog, schema, table, "%")) {
            while (rs.next()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", rs.getString("COLUMN_NAME"));
                m.put("type", rs.getString("TYPE_NAME"));
                m.put("size", rs.getInt("COLUMN_SIZE"));
                m.put("nullable", "YES".equalsIgnoreCase(rs.getString("IS_NULLABLE")));
                String rem = null;
                try { rem = rs.getString("REMARKS"); } catch (Exception ignore) {}
                m.put("remarks", rem);
                list.add(m);
            }
        }
        return list;
    }

    private static String root(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null && c.getCause() != c) c = c.getCause();
        return c.getMessage() != null ? c.getMessage() : t.toString();
    }
}
