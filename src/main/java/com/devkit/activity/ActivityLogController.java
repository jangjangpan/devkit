package com.devkit.activity;

import com.devkit.auth.UserPrincipal;
import com.devkit.db.JdbcHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 활동 로그 — 적재(POST, 인증 사용자) / 조회·통계(GET, 관리자 전용).
 */
@RestController
@RequestMapping("/api/activity")
public class ActivityLogController {

    private final JdbcHelper db;
    private final ActivityLogService log;

    public ActivityLogController(JdbcHelper db, ActivityLogService log) {
        this.db = db;
        this.log = log;
    }

    private UserPrincipal me() {
        Object p = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal() : null;
        return (p instanceof UserPrincipal) ? (UserPrincipal) p : null;
    }

    static class AccessDenied extends RuntimeException {}

    @ExceptionHandler(AccessDenied.class)
    public ResponseEntity<?> denied() {
        return ResponseEntity.status(403).body(Map.of("error", "관리자만 가능합니다."));
    }

    private void requireAdmin() {
        UserPrincipal m = me();
        if (m == null || !m.isAdmin()) throw new AccessDenied();
    }

    /** 메뉴 클릭 등 활동 적재 (현재 로그인 사용자 기준). */
    @PostMapping
    public ResponseEntity<?> record(@RequestBody Map<String, String> body, HttpServletRequest req) {
        UserPrincipal m = me();
        if (m == null) return ResponseEntity.status(401).build();
        String action = body.getOrDefault("action", "menu");
        String menu = body.getOrDefault("menu", "");
        log.record(m.getUserCd(), m.getUserNm(), action, menu, ActivityLogService.clientIp(req));
        return ResponseEntity.noContent().build();
    }

    /** 로그 목록 (관리자). 필터: action, userCd, limit(기본 200, 최대 2000). */
    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String action,
                                  @RequestParam(required = false) String userCd,
                                  @RequestParam(defaultValue = "200") int limit) {
        requireAdmin();
        int lim = Math.max(1, Math.min(limit, 2000));
        StringBuilder sql = new StringBuilder(
            "SELECT user_cd, user_nm, action, menu, ip, created_at FROM dk_activity_log WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (action != null && !action.isBlank()) { sql.append(" AND action = ?"); args.add(action.trim()); }
        if (userCd != null && !userCd.isBlank()) { sql.append(" AND user_cd = ?"); args.add(userCd.trim()); }
        sql.append(" ORDER BY created_at DESC");
        List<Map<String, Object>> rows = db.query(sql.toString(), args.toArray());
        if (rows.size() > lim) rows = rows.subList(0, lim);
        return ResponseEntity.ok(rows);
    }

    /** 로그 정리 (관리자). beforeDays>0 이면 N일 이전 삭제, 아니면 전체 삭제. */
    @DeleteMapping
    public ResponseEntity<?> clear(@RequestParam(defaultValue = "0") int beforeDays) {
        requireAdmin();
        int deleted;
        if (beforeDays > 0) {
            Timestamp cutoff = Timestamp.valueOf(LocalDateTime.now().minusDays(beforeDays));
            deleted = db.update("DELETE FROM dk_activity_log WHERE created_at < ?", cutoff);
        } else {
            deleted = db.update("DELETE FROM dk_activity_log");
        }
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    /** 통계 (관리자). 최근 days일 데이터를 Java에서 집계 → dialect 무관. */
    @GetMapping("/stats")
    public ResponseEntity<?> stats(@RequestParam(defaultValue = "14") int days) {
        requireAdmin();
        int d = Math.max(1, Math.min(days, 365));
        Timestamp since = Timestamp.valueOf(LocalDateTime.now().minusDays(d - 1).toLocalDate().atStartOfDay());
        List<Map<String, Object>> rows = db.query(
            "SELECT user_cd, user_nm, action, menu, created_at FROM dk_activity_log WHERE created_at >= ? ORDER BY created_at", since);

        Map<String, Integer> byDay = new LinkedHashMap<>();
        // 날짜 버킷 초기화 (빈 날도 0으로)
        LocalDateTime start = LocalDateTime.now().minusDays(d - 1);
        for (int i = 0; i < d; i++) byDay.put(start.plusDays(i).toLocalDate().toString(), 0);

        Map<String, Integer> byMenu = new HashMap<>();
        Map<String, Integer> byAction = new LinkedHashMap<>();
        byAction.put("login", 0);
        byAction.put("menu", 0);
        Map<String, int[]> byUser = new HashMap<>();          // user_cd -> [count]
        Map<String, String> userNames = new HashMap<>();

        for (Map<String, Object> r : rows) {
            String dayKey = dayOf(r.get("created_at"));
            if (dayKey != null && byDay.containsKey(dayKey)) byDay.merge(dayKey, 1, Integer::sum);

            String action = str(r.get("action"));
            byAction.merge(action.isEmpty() ? "menu" : action, 1, Integer::sum);

            String menu = str(r.get("menu"));
            if (!menu.isEmpty()) byMenu.merge(menu, 1, Integer::sum);

            String uc = str(r.get("user_cd"));
            if (!uc.isEmpty()) {
                byUser.computeIfAbsent(uc, k -> new int[1])[0]++;
                userNames.putIfAbsent(uc, str(r.get("user_nm")));
            }
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("total", rows.size());
        resp.put("days", d);
        resp.put("daily", toDailyList(byDay));
        resp.put("byAction", toKvList(byAction, "action"));
        resp.put("topMenus", topN(byMenu, "menu", 10));
        resp.put("topUsers", topUsers(byUser, userNames, 10));
        return ResponseEntity.ok(resp);
    }

    private static List<Map<String, Object>> toDailyList(Map<String, Integer> byDay) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : byDay.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("day", e.getKey());
            m.put("count", e.getValue());
            out.add(m);
        }
        return out;
    }

    private static List<Map<String, Object>> toKvList(Map<String, Integer> map, String keyName) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : map.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put(keyName, e.getKey());
            m.put("count", e.getValue());
            out.add(m);
        }
        return out;
    }

    private static List<Map<String, Object>> topN(Map<String, Integer> map, String keyName, int n) {
        return map.entrySet().stream()
                .sorted((a, b) -> b.getValue() - a.getValue())
                .limit(n)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put(keyName, e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .collect(java.util.stream.Collectors.toList());
    }

    private static List<Map<String, Object>> topUsers(Map<String, int[]> byUser, Map<String, String> names, int n) {
        return byUser.entrySet().stream()
                .sorted((a, b) -> b.getValue()[0] - a.getValue()[0])
                .limit(n)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("userCd", e.getKey());
                    m.put("userNm", names.getOrDefault(e.getKey(), ""));
                    m.put("count", e.getValue()[0]);
                    return m;
                })
                .collect(java.util.stream.Collectors.toList());
    }

    /** created_at 값(Timestamp 또는 문자열)에서 YYYY-MM-DD 추출. */
    private static String dayOf(Object createdAt) {
        if (createdAt == null) return null;
        if (createdAt instanceof Timestamp) {
            return ((Timestamp) createdAt).toLocalDateTime().toLocalDate().toString();
        }
        String s = createdAt.toString();
        return s.length() >= 10 ? s.substring(0, 10) : s;
    }

    private static String str(Object o) { return o == null ? "" : o.toString(); }
}
