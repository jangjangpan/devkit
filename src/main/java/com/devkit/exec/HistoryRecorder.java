package com.devkit.exec;

import com.devkit.auth.UserPrincipal;
import com.devkit.db.JdbcHelper;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;

/** 쿼리/실행 이력 기록 (실패해도 본 흐름에 영향 주지 않음). */
@Component
public class HistoryRecorder {

    private final JdbcHelper db;

    public HistoryRecorder(JdbcHelper db) {
        this.db = db;
    }

    public void record(String kind, String connName, String sql, String status, String info, long ms) {
        try {
            String s = sql == null ? "" : (sql.length() > 100000 ? sql.substring(0, 100000) : sql);
            db.update("INSERT INTO dk_query_history (id, user_cd, kind, conn_name, sql_text, status, result_info, ms, created_at) " +
                    "VALUES (?,?,?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString().replace("-", ""), UserPrincipal.currentUserCd(), kind,
                    connName, s, status, info == null ? "" : (info.length() > 290 ? info.substring(0, 290) : info),
                    (int) ms, Timestamp.valueOf(LocalDateTime.now()));
        } catch (Exception ignore) {
            // 이력 기록 실패는 무시
        }
    }
}
