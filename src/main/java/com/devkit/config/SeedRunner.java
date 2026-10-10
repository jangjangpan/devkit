package com.devkit.config;

import com.devkit.db.JdbcHelper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.LocalDateTime;

/**
 * 부팅 시:
 *  1) dk_user 테이블이 없으면 dialect에 맞게 생성
 *  2) 사용자가 한 명도 없으면 기본 관리자(admin) seed
 * DB가 없으면 조용히 건너뛴다(무상태 도구 3종은 인증 없이도 동작하지 않지만, 앱 기동은 유지).
 */
@Component
public class SeedRunner implements CommandLineRunner {

    private static final String ADMIN_ID = "admin";
    private static final String ADMIN_PW = "admin1234";

    private final JdbcHelper db;
    private final PasswordEncoder enc;

    @Value("${app.db.dialect:postgresql}")
    private String dialect;

    public SeedRunner(JdbcHelper db, PasswordEncoder enc) {
        this.db = db;
        this.enc = enc;
    }

    /** 실제 연결된 DB 제품명으로 dialect를 보정한다. app.db.dialect 설정이 없거나 틀려도 올바른 타입(CLOB 등)을 쓰게 한다. */
    private void detectDialect() {
        javax.sql.DataSource ds = db.raw().getDataSource();
        if (ds == null) return;
        try (java.sql.Connection c = ds.getConnection()) {
            String prod = c.getMetaData().getDatabaseProductName();
            if (prod == null) return;
            String p = prod.toLowerCase();
            String detected;
            if (p.contains("oracle")) detected = "oracle";
            else if (p.contains("postgre")) detected = "postgresql";
            else if (p.contains("sql server") || p.contains("microsoft")) detected = "mssql";
            else if (p.contains("mariadb")) detected = "mariadb";
            else if (p.contains("mysql")) detected = "mysql";
            else return;
            if (!detected.equalsIgnoreCase(dialect)) {
                System.out.println("[SeedRunner] DB 자동 감지: '" + prod + "' → dialect=" + detected + " (설정값 '" + dialect + "' 대체)");
                dialect = detected;
            }
        } catch (Exception e) {
            System.err.println("[SeedRunner] DB 종류 자동 감지 실패(설정값 '" + dialect + "' 사용): " + e.getMessage());
        }
    }

    @Override
    public void run(String... args) {
        detectDialect(); // 실제 연결된 DB 종류로 dialect 보정 (서버 이전/설정 누락 대비)
        try {
            ensureTable();
        } catch (Exception e) {
            System.err.println("[SeedRunner] dk_user 테이블 준비 실패 (DB 연결/권한 확인): " + e.getMessage());
            return;
        }
        try {
            Integer cnt = db.raw().queryForObject("SELECT COUNT(*) FROM dk_user", Integer.class);
            if (cnt != null && cnt == 0) {
                db.update("INSERT INTO dk_user (user_cd, user_nm, password_hash, is_admin, use_yn, created_at) " +
                        "VALUES (?, ?, ?, 'Y', 'Y', ?)",
                        ADMIN_ID, "관리자", enc.encode(ADMIN_PW), Timestamp.valueOf(LocalDateTime.now()));
                System.out.println("[SeedRunner] 기본 관리자 계정 생성: " + ADMIN_ID + " / " + ADMIN_PW + " (최초 로그인 후 변경 권장)");
            }
        } catch (Exception e) {
            System.err.println("[SeedRunner] admin seed 실패: " + e.getMessage());
        }

        // dk_project 테이블 (없으면 생성) — 이후 마이그레이션이 안전하게 동작하도록 먼저 보장
        ensureProjectTable();

        // dk_project 소유자 컬럼 마이그레이션 (구버전 테이블 대응; 신규 생성분은 이미 컬럼 보유 → no-op)
        migrateProjectOwnership();

        // dk_project 태그 컬럼 + 즐겨찾기 테이블
        migrateProjectTags();
        ensureFavoriteTable();

        // 표준 사전 테이블
        ensureDictTables();

        // DB 실행 대상(연결) 테이블
        ensureConnectionTable();

        // 쿼리/실행 히스토리
        ensureHistoryTable();

        // 개발 메모
        ensureNoteTable();

        // 활동 로그(로그인/메뉴 클릭)
        ensureActivityLogTable();

        // 앱 전역 설정(메뉴 순서/숨김 등)
        ensureAppConfigTable();
    }

    private void ensureAppConfigTable() {
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        createIfMissing("dk_app_config",
            "CREATE TABLE dk_app_config (cfg_key " + vc + "(50) NOT NULL PRIMARY KEY, cfg_value " + clobType() + ", updated_at " + tsType() + ")" + engine);
    }

    private void ensureActivityLogTable() {
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        createIfMissing("dk_activity_log",
            "CREATE TABLE dk_activity_log (id " + vc + "(40) NOT NULL PRIMARY KEY, user_cd " + vc + "(40), " +
            "user_nm " + vc + "(100), action " + vc + "(20), menu " + vc + "(150), ip " + vc + "(64), " +
            "created_at " + tsType() + ")" + engine);
    }

    private void ensureNoteTable() {
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        createIfMissing("dk_note",
            "CREATE TABLE dk_note (id " + vc + "(40) NOT NULL PRIMARY KEY, user_cd " + vc + "(40), owner_nm " + vc + "(100), " +
            "title " + vc + "(200), lang " + vc + "(20), content " + longTextType() + ", is_shared " + vc + "(1) DEFAULT 'N', " +
            "created_at " + tsType() + ", updated_at " + tsType() + ")" + engine);
        // 구버전 dk_note 공유 컬럼 마이그레이션
        addNoteColumnIfMissing("is_shared", "is_shared " + vc + "(1) DEFAULT 'N'");
        addNoteColumnIfMissing("owner_nm", "owner_nm " + vc + "(100)");
    }

    private void addNoteColumnIfMissing(String col, String colDef) {
        try {
            db.raw().queryForObject("SELECT COUNT(" + col + ") FROM dk_note", Integer.class);
        } catch (Exception noCol) {
            String addKw = (dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria")) ? "COLUMN " : "";
            try { db.raw().execute("ALTER TABLE dk_note ADD " + addKw + colDef); System.out.println("[SeedRunner] dk_note." + col + " 추가"); }
            catch (Exception e) { System.err.println("[SeedRunner] dk_note." + col + " 추가 실패: " + e.getMessage()); }
        }
    }

    private String longTextType() {
        String d = dialect.toLowerCase();
        if (d.startsWith("ora")) return "CLOB";
        if (d.startsWith("ms") || d.startsWith("sqlserver")) return "NVARCHAR(MAX)";
        if (d.startsWith("my") || d.startsWith("maria")) return "LONGTEXT";
        return "TEXT";
    }

    private void ensureHistoryTable() {
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        String intType = (dialect.toLowerCase().startsWith("ora")) ? "NUMBER(10)" : "INTEGER";
        createIfMissing("dk_query_history",
            "CREATE TABLE dk_query_history (id " + vc + "(40) NOT NULL PRIMARY KEY, user_cd " + vc + "(40), " +
            "kind " + vc + "(10), conn_name " + vc + "(100), sql_text " + longTextType() + ", status " + vc + "(10), " +
            "result_info " + vc + "(300), ms " + intType + ", created_at " + tsType() + ")" + engine);
    }

    private void ensureConnectionTable() {
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        createIfMissing("dk_connection",
            "CREATE TABLE dk_connection (id " + vc + "(40) NOT NULL PRIMARY KEY, name " + vc + "(100) NOT NULL, " +
            "dialect " + vc + "(20), jdbc_url " + vc + "(500) NOT NULL, username " + vc + "(100), password " + vc + "(300), " +
            "created_at " + tsType() + ")" + engine);
    }

    private void migrateProjectTags() {
        try {
            db.raw().queryForObject("SELECT COUNT(tags) FROM dk_project", Integer.class);
        } catch (Exception noCol) {
            String addKw = (dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria")) ? "COLUMN " : "";
            try {
                db.raw().execute("ALTER TABLE dk_project ADD " + addKw + "tags VARCHAR(500)");
                System.out.println("[SeedRunner] dk_project.tags 컬럼 추가");
            } catch (Exception e) {
                System.err.println("[SeedRunner] tags 컬럼 추가 실패: " + e.getMessage());
            }
        }
    }

    private void ensureFavoriteTable() {
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        createIfMissing("dk_favorite",
            "CREATE TABLE dk_favorite (user_cd " + vc + "(40) NOT NULL, project_id " + vc + "(40) NOT NULL, " +
            "CONSTRAINT pk_dk_favorite PRIMARY KEY (user_cd, project_id))" + engine);
    }

    /** 표준 사전(테이블/컬럼) 테이블 생성. */
    private void ensureDictTables() {
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        // ※ comment 는 Oracle 예약어라 컬럼명으로 못 씀 → descr 사용
        createIfMissing("dk_dict_table",
            "CREATE TABLE dk_dict_table (id " + vc + "(40) NOT NULL PRIMARY KEY, table_cd " + vc + "(100) NOT NULL, " +
            "table_nm " + vc + "(200), schema_nm " + vc + "(100), descr " + vc + "(500), created_at " + tsType() + ")" + engine);
        createIfMissing("dk_dict_column",
            "CREATE TABLE dk_dict_column (id " + vc + "(40) NOT NULL PRIMARY KEY, column_cd " + vc + "(100) NOT NULL, " +
            "column_nm " + vc + "(200), col_type " + vc + "(20), col_length " + vc + "(20), descr " + vc + "(500), created_at " + tsType() + ")" + engine);
        // 기존 설치(comment 컬럼) → descr 로 마이그레이션
        renameCommentToDescr("dk_dict_table");
        renameCommentToDescr("dk_dict_column");
    }

    /** 구버전 사전 테이블의 comment 컬럼을 descr 로 rename (descr 없을 때만). */
    private void renameCommentToDescr(String table) {
        try {
            db.raw().queryForObject("SELECT COUNT(descr) FROM " + table, Integer.class);
            return; // 이미 descr 존재
        } catch (Exception noDescr) {
            // comment → descr rename 시도
        }
        String d = dialect.toLowerCase();
        String sql;
        if (d.startsWith("ms") || d.startsWith("sqlserver")) sql = "EXEC sp_rename '" + table + ".comment', 'descr', 'COLUMN'";
        else if (d.startsWith("ora")) sql = "ALTER TABLE " + table + " RENAME COLUMN \"COMMENT\" TO descr";
        else sql = "ALTER TABLE " + table + " RENAME COLUMN comment TO descr"; // pg / mysql8 / mariadb
        try {
            db.raw().execute(sql);
            System.out.println("[SeedRunner] " + table + ".comment → descr 컬럼명 마이그레이션");
        } catch (Exception e) {
            System.err.println("[SeedRunner] " + table + " descr 마이그레이션 실패(무시): " + e.getMessage());
        }
    }

    private String tsType() {
        String d = dialect.toLowerCase();
        if (d.startsWith("ms") || d.startsWith("sqlserver")) return "DATETIME2";
        if (d.startsWith("my") || d.startsWith("maria")) return "DATETIME";
        return "TIMESTAMP";
    }

    /** 대용량 텍스트(작업물 JSON content) 타입 — dialect별. */
    private String clobType() {
        String d = dialect.toLowerCase();
        if (d.startsWith("ora")) return "CLOB";
        if (d.startsWith("ms") || d.startsWith("sqlserver")) return "NVARCHAR(MAX)";
        if (d.startsWith("my") || d.startsWith("maria")) return "LONGTEXT";
        return "TEXT"; // postgresql
    }

    /** 작업물(ERD/순서도/DDL) 저장 테이블 dk_project 생성(없으면). */
    private void ensureProjectTable() {
        String vc = dialect.toLowerCase().startsWith("ora") ? "VARCHAR2" : "VARCHAR";
        boolean my = dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria");
        String engine = my ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";
        createIfMissing("dk_project",
            "CREATE TABLE dk_project (id " + vc + "(40) NOT NULL PRIMARY KEY, type " + vc + "(20), " +
            "name " + vc + "(200), content " + clobType() + ", owner_cd " + vc + "(40), owner_nm " + vc + "(100), " +
            "is_shared " + vc + "(1) DEFAULT 'N', tags " + vc + "(500), " +
            "created_at " + tsType() + ", updated_at " + tsType() + ")" + engine);
    }

    private void createIfMissing(String table, String createSql) {
        try {
            db.raw().queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
        } catch (Exception notExists) {
            try {
                db.raw().execute(createSql);
                System.out.println("[SeedRunner] " + table + " 테이블 생성");
            } catch (Exception e) {
                System.err.println("[SeedRunner] " + table + " 생성 실패: " + e.getMessage());
            }
        }
    }

    /** dk_project에 owner_cd/owner_nm/is_shared 컬럼 추가(없으면). 기존 행은 공유(Y) 처리. */
    private void migrateProjectOwnership() {
        boolean colExists;
        try {
            db.raw().queryForObject("SELECT COUNT(owner_cd) FROM dk_project", Integer.class);
            colExists = true;
        } catch (Exception e) {
            colExists = false;
        }
        if (colExists) return;
        String addKw = (dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria")) ? "COLUMN " : "";
        try {
            db.raw().execute("ALTER TABLE dk_project ADD " + addKw + "owner_cd VARCHAR(40)");
            db.raw().execute("ALTER TABLE dk_project ADD " + addKw + "owner_nm VARCHAR(100)");
            db.raw().execute("ALTER TABLE dk_project ADD " + addKw + "is_shared VARCHAR(1) DEFAULT 'N'");
            // 기존(소유자 없는) 작업물은 공유로 전환해 누구나 접근 가능하게
            db.update("UPDATE dk_project SET is_shared = 'Y' WHERE owner_cd IS NULL");
            System.out.println("[SeedRunner] dk_project 소유자 컬럼 추가 + 기존 작업물 공유 전환");
        } catch (Exception e) {
            System.err.println("[SeedRunner] dk_project 소유자 마이그레이션 실패: " + e.getMessage());
        }
    }

    private void ensureTable() {
        boolean exists;
        try {
            db.raw().queryForObject("SELECT COUNT(*) FROM dk_user", Integer.class);
            exists = true;
        } catch (Exception notExists) {
            exists = false;
        }
        if (!exists) {
            db.raw().execute(createSql());
            System.out.println("[SeedRunner] dk_user 테이블 생성 (dialect=" + dialect + ")");
        }
        // 컬럼 마이그레이션 (구버전 테이블 대응)
        addColumnIfMissing("theme_color", "theme_color VARCHAR(20) DEFAULT 'BLUE'");
        addColumnIfMissing("must_change_password", "must_change_password VARCHAR(1) DEFAULT 'N'");
        addColumnIfMissing("status_cd", "status_cd VARCHAR(10) DEFAULT 'APPROVED'"); // 기존 사용자는 승인 상태로
    }

    private void addColumnIfMissing(String col, String colDef) {
        try {
            db.raw().queryForObject("SELECT COUNT(" + col + ") FROM dk_user", Integer.class);
        } catch (Exception noCol) {
            String addKw = (dialect.toLowerCase().startsWith("my") || dialect.toLowerCase().startsWith("maria")) ? "COLUMN " : "";
            try {
                db.raw().execute("ALTER TABLE dk_user ADD " + addKw + colDef);
                System.out.println("[SeedRunner] dk_user." + col + " 컬럼 추가");
            } catch (Exception e) {
                System.err.println("[SeedRunner] " + col + " 컬럼 추가 실패: " + e.getMessage());
            }
        }
    }

    private String createSql() {
        switch (dialect.toLowerCase()) {
            case "oracle":
                return "CREATE TABLE dk_user (" +
                        "user_cd VARCHAR2(40) NOT NULL PRIMARY KEY, user_nm VARCHAR2(100) NOT NULL, " +
                        "password_hash VARCHAR2(100) NOT NULL, is_admin VARCHAR2(1) DEFAULT 'N' NOT NULL, " +
                        "use_yn VARCHAR2(1) DEFAULT 'Y' NOT NULL, created_at TIMESTAMP NOT NULL)";
            case "mssql":
            case "sqlserver":
                return "CREATE TABLE dk_user (" +
                        "user_cd VARCHAR(40) NOT NULL PRIMARY KEY, user_nm NVARCHAR(100) NOT NULL, " +
                        "password_hash VARCHAR(100) NOT NULL, is_admin VARCHAR(1) NOT NULL DEFAULT 'N', " +
                        "use_yn VARCHAR(1) NOT NULL DEFAULT 'Y', created_at DATETIME2 NOT NULL)";
            case "mysql":
            case "mariadb":
                return "CREATE TABLE dk_user (" +
                        "user_cd VARCHAR(40) NOT NULL PRIMARY KEY, user_nm VARCHAR(100) NOT NULL, " +
                        "password_hash VARCHAR(100) NOT NULL, is_admin VARCHAR(1) NOT NULL DEFAULT 'N', " +
                        "use_yn VARCHAR(1) NOT NULL DEFAULT 'Y', created_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            default: // postgresql
                return "CREATE TABLE dk_user (" +
                        "user_cd VARCHAR(40) NOT NULL PRIMARY KEY, user_nm VARCHAR(100) NOT NULL, " +
                        "password_hash VARCHAR(100) NOT NULL, is_admin VARCHAR(1) NOT NULL DEFAULT 'N', " +
                        "use_yn VARCHAR(1) NOT NULL DEFAULT 'Y', created_at TIMESTAMP NOT NULL)";
        }
    }
}
