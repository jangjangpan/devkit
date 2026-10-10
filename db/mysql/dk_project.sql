-- devkit 작업물 저장 테이블 (MySQL / MariaDB)
CREATE TABLE IF NOT EXISTS dk_project (
    id          VARCHAR(40)   NOT NULL PRIMARY KEY,
    type        VARCHAR(20)   NOT NULL,         -- erd | flowchart | ddl
    name        VARCHAR(200)  NOT NULL,
    content     LONGTEXT      NOT NULL,         -- JSON
    owner_cd    VARCHAR(40),                    -- 소유자 ID (NULL=레거시/공유)
    owner_nm    VARCHAR(100),                   -- 소유자 이름(비정규화)
    is_shared   VARCHAR(1)    DEFAULT 'N',       -- 공유 여부 Y/N
    created_at  DATETIME      NOT NULL,
    updated_at  DATETIME      NOT NULL,
    INDEX ix_dk_project_type (type, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
