package com.devkit.activity;

import com.devkit.db.JdbcHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 사용자 활동 로그(로그인 / 대메뉴 클릭) 적재.
 * 로깅 실패가 본 기능을 막지 않도록 모든 예외를 흡수한다.
 */
@Service
public class ActivityLogService {

    private final JdbcHelper db;

    public ActivityLogService(JdbcHelper db) {
        this.db = db;
    }

    public void record(String userCd, String userNm, String action, String menu, String ip) {
        try {
            db.update("INSERT INTO dk_activity_log (id, user_cd, user_nm, action, menu, ip, created_at) VALUES (?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString().replace("-", ""),
                    trim(userCd, 40), trim(userNm, 100), trim(action, 20), trim(menu, 150), trim(ip, 64),
                    Timestamp.valueOf(LocalDateTime.now()));
        } catch (Exception ignore) {
            // 로깅 실패는 무시 (본 흐름 영향 없음)
        }
    }

    /** 프록시 환경 고려: X-Forwarded-For 우선, 없으면 remoteAddr. */
    public static String clientIp(HttpServletRequest req) {
        if (req == null) return null;
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();
        return req.getRemoteAddr();
    }

    private static String trim(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
