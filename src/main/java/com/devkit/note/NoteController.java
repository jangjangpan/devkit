package com.devkit.note;

import com.devkit.auth.UserPrincipal;
import com.devkit.config.AppConfigService;
import com.devkit.config.SystemConfigController;
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
 * 개발 메모 — 사용자별 코드/텍스트 메모(언어별 편집기).
 * 소유자별 저장 + 공유(is_shared='Y') 옵션. 공유 메모는 다른 사용자가 조회 가능하나 수정은 소유자만.
 */
@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final JdbcHelper db;
    private final AppConfigService appConfig;

    public NoteController(JdbcHelper db, AppConfigService appConfig) {
        this.db = db;
        this.appConfig = appConfig;
    }

    private UserPrincipal me() {
        Object p = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal() : null;
        return (p instanceof UserPrincipal) ? (UserPrincipal) p : null;
    }

    /** 목록. scope=mine(내것) | shared(다른 사용자 공유) | all(내것+공유). 기본 all. */
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "all") String scope) {
        String meCd = UserPrincipal.currentUserCd();
        String cols = "SELECT id, title, lang, user_cd, owner_nm, is_shared, updated_at FROM dk_note ";
        if ("mine".equals(scope)) {
            return db.query(cols + "WHERE user_cd = ? ORDER BY updated_at DESC", meCd);
        }
        if ("shared".equals(scope)) {
            // 공유된 모든 메모 (내가 공유한 것 + 다른 사용자가 공유한 것)
            return db.query(cols + "WHERE is_shared = 'Y' ORDER BY updated_at DESC");
        }
        return db.query(cols + "WHERE user_cd = ? OR is_shared = 'Y' ORDER BY updated_at DESC", meCd);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String id) {
        String meCd = UserPrincipal.currentUserCd();
        List<Map<String, Object>> rows = db.query(
            "SELECT id, title, lang, content, user_cd, owner_nm, is_shared, created_at, updated_at FROM dk_note WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        Map<String, Object> r = rows.get(0);
        boolean mine = meCd.equals(r.get("user_cd"));
        if (!mine && !"Y".equals(r.get("is_shared"))) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(r);
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, String> b) {
        UserPrincipal me = me();
        String meCd = me != null ? me.getUserCd() : "system";
        String meNm = me != null ? me.getUserNm() : "";
        String id = UUID.randomUUID().toString().replace("-", "");
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        db.update("INSERT INTO dk_note (id, user_cd, owner_nm, title, lang, content, is_shared, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                id, meCd, meNm, s(b.get("title"), "제목 없음"), s(b.get("lang"), "text"), s(b.get("content"), ""), sharedFlag(b.get("isShared")), now, now);
        return Map.of("id", id);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, String> b) {
        UserPrincipal me = me();
        String meCd = me != null ? me.getUserCd() : UserPrincipal.currentUserCd();
        boolean admin = me != null && me.isAdmin();
        List<Map<String, Object>> rows = db.query("SELECT user_cd, is_shared FROM dk_note WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        Map<String, Object> row = rows.get(0);
        boolean mine = meCd.equals(row.get("user_cd"));
        // 시스템 설정(admin_edit_shared=Y)이 켜져 있으면, 관리자는 공유된 남의 메모도 수정 가능
        boolean adminSharedEdit = admin && "Y".equals(row.get("is_shared"))
                && appConfig.getBool(SystemConfigController.ADMIN_EDIT_SHARED, false);
        if (!mine && !adminSharedEdit) {
            return ResponseEntity.status(403).body(Map.of("error", "본인 메모만 수정할 수 있습니다. (공유 메모 수정은 시스템 설정에서 허용 필요)"));
        }
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        db.update("UPDATE dk_note SET title = ?, lang = ?, content = ?, is_shared = ?, updated_at = ? WHERE id = ?",
                s(b.get("title"), "제목 없음"), s(b.get("lang"), "text"), s(b.get("content"), ""), sharedFlag(b.get("isShared")), now, id);
        return ResponseEntity.ok(Map.of("id", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        UserPrincipal me = me();
        String meCd = me != null ? me.getUserCd() : UserPrincipal.currentUserCd();
        boolean admin = me != null && me.isAdmin();
        List<Map<String, Object>> rows = db.query("SELECT user_cd, is_shared FROM dk_note WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        Map<String, Object> r = rows.get(0);
        boolean mine = meCd.equals(r.get("user_cd"));
        boolean adminShared = admin && "Y".equals(r.get("is_shared"));  // 관리자는 공유된 글이면 남의 것도 삭제 가능
        if (!mine && !adminShared) return ResponseEntity.status(403).body(Map.of("error", "본인 메모 또는 공유된 메모(관리자)만 삭제할 수 있습니다."));
        db.update("DELETE FROM dk_note WHERE id = ?", id);
        return ResponseEntity.noContent().build();
    }

    private static String sharedFlag(String v) {
        return ("Y".equalsIgnoreCase(v) || "true".equalsIgnoreCase(v)) ? "Y" : "N";
    }

    private static String s(String v, String def) { return v == null ? def : v; }
}
