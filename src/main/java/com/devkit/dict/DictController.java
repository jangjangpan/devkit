package com.devkit.dict;

import com.devkit.db.JdbcHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 표준 사전(naming standard): 테이블명/컬럼명을 별도 관리하고 DDL 생성 시 매핑 선택에 사용.
 * 조직 공통 표준이므로 소유자 구분 없이 인증 사용자 전체가 공유/관리한다.
 *  - dk_dict_table : table_cd(물리), table_nm(논리), schema_nm, descr
 *  - dk_dict_column: column_cd(물리), column_nm(논리), col_type, col_length, descr
 *
 * ※ DB 컬럼명은 `descr`. (`comment`는 Oracle 예약어라 SELECT/CREATE 실패)
 *   프론트 호환을 위해 API JSON 필드는 그대로 `comment`를 사용 — 응답 시 descr→comment 키 매핑.
 */
@RestController
@RequestMapping("/api/dict")
public class DictController {

    private final JdbcHelper db;

    public DictController(JdbcHelper db) {
        this.db = db;
    }

    // ── 테이블 사전 ──
    @GetMapping("/tables")
    public List<Map<String, Object>> tables() {
        return descrToComment(db.query("SELECT id, table_cd, table_nm, schema_nm, descr FROM dk_dict_table ORDER BY table_cd"));
    }

    @PostMapping("/tables")
    public Map<String, Object> addTable(@RequestBody Map<String, String> b) {
        String id = uid();
        db.update("INSERT INTO dk_dict_table (id, table_cd, table_nm, schema_nm, descr, created_at) VALUES (?,?,?,?,?,?)",
                id, s(b.get("tableCd")), s(b.get("tableNm")), s(b.get("schemaNm")), s(b.get("comment")), now());
        return Map.of("id", id);
    }

    @PutMapping("/tables/{id}")
    public ResponseEntity<?> updTable(@PathVariable String id, @RequestBody Map<String, String> b) {
        int n = db.update("UPDATE dk_dict_table SET table_cd=?, table_nm=?, schema_nm=?, descr=? WHERE id=?",
                s(b.get("tableCd")), s(b.get("tableNm")), s(b.get("schemaNm")), s(b.get("comment")), id);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.ok(Map.of("id", id));
    }

    @DeleteMapping("/tables/{id}")
    public ResponseEntity<?> delTable(@PathVariable String id) {
        int n = db.update("DELETE FROM dk_dict_table WHERE id=?", id);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.noContent().build();
    }

    /** 일괄 등록 (붙여넣기/엑셀). table_cd 비어있는 행은 무시. */
    @PostMapping("/tables/bulk")
    public Map<String, Object> bulkTables(@RequestBody List<Map<String, String>> rows) {
        int n = 0;
        for (Map<String, String> b : rows) {
            String cd = s(b.get("tableCd"));
            if (cd.isEmpty()) continue;
            db.update("INSERT INTO dk_dict_table (id, table_cd, table_nm, schema_nm, descr, created_at) VALUES (?,?,?,?,?,?)",
                    uid(), cd, s(b.get("tableNm")), s(b.get("schemaNm")), s(b.get("comment")), now());
            n++;
        }
        return Map.of("inserted", n);
    }

    // ── 컬럼 사전 ──
    @GetMapping("/columns")
    public List<Map<String, Object>> columns() {
        return descrToComment(db.query("SELECT id, column_cd, column_nm, col_type, col_length, descr FROM dk_dict_column ORDER BY column_cd"));
    }

    @PostMapping("/columns")
    public Map<String, Object> addColumn(@RequestBody Map<String, String> b) {
        String id = uid();
        db.update("INSERT INTO dk_dict_column (id, column_cd, column_nm, col_type, col_length, descr, created_at) VALUES (?,?,?,?,?,?,?)",
                id, s(b.get("columnCd")), s(b.get("columnNm")), s(b.getOrDefault("colType", "VARCHAR")), s(b.get("colLength")), s(b.get("comment")), now());
        return Map.of("id", id);
    }

    @PutMapping("/columns/{id}")
    public ResponseEntity<?> updColumn(@PathVariable String id, @RequestBody Map<String, String> b) {
        int n = db.update("UPDATE dk_dict_column SET column_cd=?, column_nm=?, col_type=?, col_length=?, descr=? WHERE id=?",
                s(b.get("columnCd")), s(b.get("columnNm")), s(b.getOrDefault("colType", "VARCHAR")), s(b.get("colLength")), s(b.get("comment")), id);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.ok(Map.of("id", id));
    }

    @DeleteMapping("/columns/{id}")
    public ResponseEntity<?> delColumn(@PathVariable String id) {
        int n = db.update("DELETE FROM dk_dict_column WHERE id=?", id);
        return n == 0 ? ResponseEntity.notFound().build() : ResponseEntity.noContent().build();
    }

    /** 일괄 등록 (붙여넣기/엑셀). column_cd 비어있는 행은 무시. */
    @PostMapping("/columns/bulk")
    public Map<String, Object> bulkColumns(@RequestBody List<Map<String, String>> rows) {
        int n = 0;
        for (Map<String, String> b : rows) {
            String cd = s(b.get("columnCd"));
            if (cd.isEmpty()) continue;
            db.update("INSERT INTO dk_dict_column (id, column_cd, column_nm, col_type, col_length, descr, created_at) VALUES (?,?,?,?,?,?,?)",
                    uid(), cd, s(b.get("columnNm")), s(b.getOrDefault("colType", "VARCHAR")), s(b.get("colLength")), s(b.get("comment")), now());
            n++;
        }
        return Map.of("inserted", n);
    }

    /** 응답 키 descr → comment 로 매핑 (프론트 호환). */
    private static List<Map<String, Object>> descrToComment(List<Map<String, Object>> rows) {
        for (Map<String, Object> r : rows) {
            if (r.containsKey("descr")) {
                r.put("comment", r.remove("descr"));
            }
        }
        return rows;
    }

    private static String uid() { return UUID.randomUUID().toString().replace("-", ""); }
    private static String s(String v) { return v == null ? "" : v.trim(); }
    private static Timestamp now() { return Timestamp.valueOf(LocalDateTime.now()); }
}
