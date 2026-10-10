package com.devkit.conn;

import com.devkit.db.JdbcHelper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * connectionId → java.sql.Connection 해석 (앱 기본 DataSource 또는 dk_connection 등록 연결).
 *
 * 등록 연결은 매 요청마다 새 물리 연결을 만들지 않도록 connectionId 별 HikariCP 풀로 재사용한다.
 * (Oracle 등 원격 DB는 연결 수립 비용이 커서, 풀링 없이 매번 새로 열면 스키마 탐색·쿼리 실행이 매번 느려진다.)
 * 연결 정보(URL/계정/비번)가 바뀌면 시그니처가 달라져 풀을 자동 재생성한다.
 */
@Component
public class ConnectionResolver {

    private final JdbcHelper db;
    private final DataSource dataSource;
    private final CryptoUtil crypto;

    /** 등록 연결별 커넥션 풀 캐시. */
    private final Map<String, Pool> pools = new ConcurrentHashMap<>();

    private static final class Pool {
        final String sig;
        final HikariDataSource ds;
        Pool(String sig, HikariDataSource ds) { this.sig = sig; this.ds = ds; }
    }

    public ConnectionResolver(JdbcHelper db, DataSource dataSource, CryptoUtil crypto) {
        this.db = db;
        this.dataSource = dataSource;
        this.crypto = crypto;
    }

    /** 표시용 연결명 (히스토리 기록 등). */
    public String nameOf(String connId) {
        if (connId == null || connId.isBlank()) return "앱 기본 DB";
        List<Map<String, Object>> rows = db.query("SELECT name FROM dk_connection WHERE id=?", connId.trim());
        return rows.isEmpty() ? connId : str(rows.get(0).get("name"));
    }

    public Connection resolve(String connId) throws Exception {
        if (connId == null || connId.isBlank()) return dataSource.getConnection();
        String id = connId.trim();
        List<Map<String, Object>> rows = db.query(
            "SELECT jdbc_url, username, password FROM dk_connection WHERE id=?", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("연결을 찾을 수 없습니다: " + connId);
        Map<String, Object> r = rows.get(0);
        String url = str(r.get("jdbc_url"));
        String user = str(r.get("username"));
        String pw = crypto.decrypt(str(r.get("password")));
        String sig = url + "" + user + "" + pw.hashCode();

        Pool pool = pools.compute(id, (k, cur) -> {
            if (cur != null && cur.sig.equals(sig)) return cur;   // 변경 없음 → 기존 풀 재사용
            if (cur != null) { try { cur.ds.close(); } catch (Exception ignore) {} }  // 연결정보 변경 → 폐기 후 재생성
            return new Pool(sig, buildPool(url, user, pw));
        });
        return pool.ds.getConnection();
    }

    private HikariDataSource buildPool(String url, String user, String pw) {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(url);
        cfg.setUsername(user);
        cfg.setPassword(pw);
        cfg.setMaximumPoolSize(3);      // 내부 도구 — 소규모 동시성으로 충분
        cfg.setMinimumIdle(0);          // 안 쓰면 0으로 수축 (드물게 쓰는 연결의 유휴 점유 방지)
        cfg.setConnectionTimeout(10000);
        cfg.setIdleTimeout(60000);
        cfg.setMaxLifetime(600000);
        cfg.setPoolName("dk-ext-" + Integer.toHexString(url.hashCode()));
        return new HikariDataSource(cfg);
    }

    /** 등록 연결 수정/삭제 시 캐시된 풀 폐기 (다음 resolve 때 새 정보로 재생성). */
    public void invalidate(String connId) {
        if (connId == null) return;
        Pool p = pools.remove(connId.trim());
        if (p != null) { try { p.ds.close(); } catch (Exception ignore) {} }
    }

    @PreDestroy
    public void shutdown() {
        for (Pool p : pools.values()) { try { p.ds.close(); } catch (Exception ignore) {} }
        pools.clear();
    }

    private static String str(Object o) { return o == null ? "" : o.toString(); }
}
