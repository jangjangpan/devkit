package com.devkit.config;

import com.devkit.db.JdbcHelper;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 앱 전역 설정(dk_app_config) 키-값 접근. 시스템 플래그/메뉴설정 등 공용.
 */
@Service
public class AppConfigService {

    private final JdbcHelper db;

    public AppConfigService(JdbcHelper db) {
        this.db = db;
    }

    public String get(String key) {
        List<Map<String, Object>> rows = db.query("SELECT cfg_value FROM dk_app_config WHERE cfg_key = ?", key);
        return rows.isEmpty() || rows.get(0).get("cfg_value") == null ? null : rows.get(0).get("cfg_value").toString();
    }

    public boolean getBool(String key, boolean def) {
        String v = get(key);
        if (v == null) return def;
        return "Y".equalsIgnoreCase(v) || "true".equalsIgnoreCase(v) || "1".equals(v);
    }

    public int getInt(String key, int def) {
        String v = get(key);
        if (v == null) return def;
        try { return Integer.parseInt(v.trim()); } catch (Exception e) { return def; }
    }

    public void set(String key, String value) {
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        int n = db.update("UPDATE dk_app_config SET cfg_value = ?, updated_at = ? WHERE cfg_key = ?", value, now, key);
        if (n == 0) db.update("INSERT INTO dk_app_config (cfg_key, cfg_value, updated_at) VALUES (?,?,?)", key, value, now);
    }
}
