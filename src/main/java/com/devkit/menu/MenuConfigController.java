package com.devkit.menu;

import com.devkit.auth.UserPrincipal;
import com.devkit.db.JdbcHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 대메뉴 전역 설정(순서/숨김). 사이트 단위 1개 설정(dk_app_config, cfg_key='menu').
 *  - GET: 인증 사용자 누구나 조회(사이드바 렌더용)
 *  - PUT: 관리자만 저장
 * 값은 JSON 문자열을 그대로 보관/반환한다(프론트가 파싱): {"order":[...],"hidden":[...]}.
 */
@RestController
@RequestMapping("/api/menu-config")
public class MenuConfigController {

    private static final String KEY = "menu";

    private final JdbcHelper db;

    public MenuConfigController(JdbcHelper db) {
        this.db = db;
    }

    @GetMapping
    public ResponseEntity<?> get() {
        List<Map<String, Object>> rows = db.query("SELECT cfg_value FROM dk_app_config WHERE cfg_key = ?", KEY);
        String json = rows.isEmpty() ? null : str(rows.get(0).get("cfg_value"));
        return ResponseEntity.ok(Map.of("config", json == null ? "" : json));
    }

    @PutMapping
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body) {
        Object p = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal() : null;
        UserPrincipal me = (p instanceof UserPrincipal) ? (UserPrincipal) p : null;
        if (me == null || !me.isAdmin()) return ResponseEntity.status(403).body(Map.of("error", "관리자만 가능합니다."));

        String json = body.get("config") == null ? "" : String.valueOf(body.get("config"));
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        int n = db.update("UPDATE dk_app_config SET cfg_value = ?, updated_at = ? WHERE cfg_key = ?", json, now, KEY);
        if (n == 0) db.update("INSERT INTO dk_app_config (cfg_key, cfg_value, updated_at) VALUES (?,?,?)", KEY, json, now);
        return ResponseEntity.ok(Map.of("result", "OK"));
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
}
