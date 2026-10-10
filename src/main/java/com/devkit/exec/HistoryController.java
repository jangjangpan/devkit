package com.devkit.exec;

import com.devkit.auth.UserPrincipal;
import com.devkit.db.JdbcHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 본인 쿼리/실행 이력 조회·삭제. */
@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final JdbcHelper db;

    public HistoryController(JdbcHelper db) {
        this.db = db;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "50") int limit) {
        String me = UserPrincipal.currentUserCd();
        int lim = Math.max(1, Math.min(limit, 200));
        // dialect 무관 정렬+제한: 전부 받지 않도록 ms 내림차순 created_at — 간단히 created_at DESC 후 앱에서 자름
        List<Map<String, Object>> rows = db.query(
            "SELECT id, kind, conn_name, sql_text, status, result_info, ms, created_at " +
            "FROM dk_query_history WHERE user_cd = ? ORDER BY created_at DESC", me);
        return rows.size() > lim ? rows.subList(0, lim) : rows;
    }

    @DeleteMapping
    public ResponseEntity<?> clear() {
        String me = UserPrincipal.currentUserCd();
        db.update("DELETE FROM dk_query_history WHERE user_cd = ?", me);
        return ResponseEntity.noContent().build();
    }
}
