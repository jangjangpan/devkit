package com.devkit.config;

import com.devkit.auth.UserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 시스템 설정. 현재 항목:
 *  - admin_edit_shared: 관리자가 공유된 남의 메모를 수정할 수 있는지(Y/N)
 *  - session_hours: 로그인 세션(JWT) 유지 시간(시간 단위). 로그인 시 이 값으로 토큰 만료가 정해짐.
 * GET: 인증 사용자 / PUT: 관리자만.
 */
@RestController
@RequestMapping("/api/system-config")
public class SystemConfigController {

    public static final String ADMIN_EDIT_SHARED = "admin_edit_shared";
    public static final String SESSION_HOURS = "session_hours";
    private static final int MIN_HOURS = 1;
    private static final int MAX_HOURS = 8760; // 최대 1년

    private final AppConfigService cfg;
    private final int defaultHours;

    public SystemConfigController(AppConfigService cfg, @Value("${devkit.jwt.expiration-hours:24}") int defaultHours) {
        this.cfg = cfg;
        this.defaultHours = defaultHours;
    }

    @GetMapping
    public ResponseEntity<?> get() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("adminEditShared", cfg.getBool(ADMIN_EDIT_SHARED, false));
        resp.put("sessionHours", cfg.getInt(SESSION_HOURS, defaultHours));
        return ResponseEntity.ok(resp);
    }

    @PutMapping
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body) {
        Object p = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal() : null;
        UserPrincipal me = (p instanceof UserPrincipal) ? (UserPrincipal) p : null;
        if (me == null || !me.isAdmin()) return ResponseEntity.status(403).body(Map.of("error", "관리자만 가능합니다."));

        if (body.containsKey("adminEditShared")) {
            Object v = body.get("adminEditShared");
            boolean on = Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v)) || "Y".equalsIgnoreCase(String.valueOf(v));
            cfg.set(ADMIN_EDIT_SHARED, on ? "Y" : "N");
        }
        if (body.containsKey("sessionHours")) {
            int hours;
            try { hours = (int) Math.round(Double.parseDouble(String.valueOf(body.get("sessionHours")))); }
            catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", "세션 시간이 올바르지 않습니다.")); }
            hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, hours));
            cfg.set(SESSION_HOURS, String.valueOf(hours));
        }
        return get();
    }
}
