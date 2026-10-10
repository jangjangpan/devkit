package com.devkit.project;

import com.devkit.auth.UserPrincipal;
import com.devkit.db.JdbcHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 다이어그램/DDL 작업물 저장소 (type = erd | flowchart | ddl).
 * 소유자(owner_cd) 기준으로 접근을 제한한다.
 *  - 목록/조회: 본인 작업 + 공유(is_shared='Y') 작업
 *  - 수정/삭제/공유토글: 소유자 또는 관리자만
 *  - 레거시(owner_cd IS NULL) 작업물은 SeedRunner가 공유로 전환
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final JdbcHelper db;

    public ProjectController(JdbcHelper db) {
        this.db = db;
    }

    private UserPrincipal principal() {
        Object p = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal() : null;
        return (p instanceof UserPrincipal) ? (UserPrincipal) p : null;
    }

    /** 목록 (content 제외). 본인 것 + 공유된 것. 즐겨찾기 우선 정렬. */
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required = false) String type) {
        UserPrincipal me = principal();
        String meCd = me != null ? me.getUserCd() : "";
        String base = "SELECT p.id, p.type, p.name, p.owner_cd, p.owner_nm, p.is_shared, p.tags, " +
                "p.created_at, p.updated_at, " +
                "CASE WHEN f.project_id IS NULL THEN 'N' ELSE 'Y' END AS is_favorite " +
                "FROM dk_project p LEFT JOIN dk_favorite f ON f.project_id = p.id AND f.user_cd = ? " +
                "WHERE (p.owner_cd = ? OR p.is_shared = 'Y') ";
        String order = "ORDER BY is_favorite DESC, p.updated_at DESC";
        if (type != null && !type.isBlank()) {
            return db.query(base + "AND p.type = ? " + order, meCd, meCd, type);
        }
        return db.query(base + order, meCd, meCd);
    }

    /** 즐겨찾기 토글 (사용자별). body: { favorite: true|false } */
    @PostMapping("/{id}/favorite")
    public ResponseEntity<?> favorite(@PathVariable String id, @RequestBody Map<String, Object> body) {
        UserPrincipal me = principal();
        if (me == null) return ResponseEntity.status(401).build();
        boolean fav = "true".equalsIgnoreCase(String.valueOf(body.get("favorite")))
                || Boolean.TRUE.equals(body.get("favorite"));
        db.update("DELETE FROM dk_favorite WHERE user_cd = ? AND project_id = ?", me.getUserCd(), id);
        if (fav) db.update("INSERT INTO dk_favorite (user_cd, project_id) VALUES (?, ?)", me.getUserCd(), id);
        return ResponseEntity.ok(Map.of("favorite", fav));
    }

    /** 단건 (content 포함). 소유자/공유/관리자만. */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String id) {
        List<Map<String, Object>> rows = db.query(
            "SELECT id, type, name, content, owner_cd, owner_nm, is_shared, tags, created_at, updated_at FROM dk_project WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        Map<String, Object> r = rows.get(0);
        if (!canRead(r)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(r);
    }

    /** 생성. body: { type, name, content, isShared? } */
    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        UserPrincipal me = principal();
        String id = UUID.randomUUID().toString().replace("-", "");
        String type = str(body.get("type"), "erd");
        String name = str(body.get("name"), "Untitled");
        String content = str(body.get("content"), "{}");
        String shared = "Y".equalsIgnoreCase(str(body.get("isShared"), "N")) || "true".equalsIgnoreCase(str(body.get("isShared"), "")) ? "Y" : "N";
        String tags = str(body.get("tags"), "");
        String ownerCd = me != null ? me.getUserCd() : null;
        String ownerNm = me != null ? me.getUserNm() : null;
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        db.update(
            "INSERT INTO dk_project (id, type, name, content, owner_cd, owner_nm, is_shared, tags, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, type, name, content, ownerCd, ownerNm, shared, tags, now, now);
        return Map.of("id", id, "type", type, "name", name);
    }

    /** 수정 (소유자/관리자만). body: { name?, content?, isShared? } */
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable String id,
                                                      @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> rows = db.query("SELECT owner_cd FROM dk_project WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        if (!canWrite(rows.get(0))) return ResponseEntity.status(403).build();

        String name = str(body.get("name"), null);
        String content = str(body.get("content"), null);
        Object sharedObj = body.get("isShared");
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());

        if (name != null) db.update("UPDATE dk_project SET name = ?, updated_at = ? WHERE id = ?", name, now, id);
        if (content != null) db.update("UPDATE dk_project SET content = ?, updated_at = ? WHERE id = ?", content, now, id);
        if (sharedObj != null) {
            String shared = "Y".equalsIgnoreCase(sharedObj.toString()) || "true".equalsIgnoreCase(sharedObj.toString()) ? "Y" : "N";
            db.update("UPDATE dk_project SET is_shared = ?, updated_at = ? WHERE id = ?", shared, now, id);
        }
        if (body.containsKey("tags")) {
            db.update("UPDATE dk_project SET tags = ?, updated_at = ? WHERE id = ?", str(body.get("tags"), ""), now, id);
        }
        return ResponseEntity.ok(Map.of("id", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        List<Map<String, Object>> rows = db.query("SELECT owner_cd FROM dk_project WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        if (!canWrite(rows.get(0))) return ResponseEntity.status(403).build();
        db.update("DELETE FROM dk_favorite WHERE project_id = ?", id);
        db.update("DELETE FROM dk_project WHERE id = ?", id);
        return ResponseEntity.noContent().build();
    }

    private boolean canRead(Map<String, Object> row) {
        UserPrincipal me = principal();
        if (me == null) return false;
        if (me.isAdmin()) return true;
        Object owner = row.get("owner_cd");
        if (owner == null) return true; // 레거시
        return me.getUserCd().equals(owner) || "Y".equals(row.get("is_shared"));
    }

    private boolean canWrite(Map<String, Object> row) {
        UserPrincipal me = principal();
        if (me == null) return false;
        if (me.isAdmin()) return true;
        Object owner = row.get("owner_cd");
        if (owner == null) return true; // 레거시는 누구나 정리 가능
        return me.getUserCd().equals(owner);
    }

    private static String str(Object o, String def) {
        return o == null ? def : o.toString();
    }
}
