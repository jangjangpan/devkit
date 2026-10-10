-- devkit 작업물 저장 테이블 (PostgreSQL)
CREATE TABLE IF NOT EXISTS dk_project (
    id          VARCHAR(40)  NOT NULL PRIMARY KEY,
    type        VARCHAR(20)  NOT NULL,          -- erd | flowchart | ddl
    name        VARCHAR(200) NOT NULL,
    content     TEXT         NOT NULL,          -- JSON
    owner_cd    VARCHAR(40),                    -- 소유자 ID (NULL=레거시/공유)
    owner_nm    VARCHAR(100),                   -- 소유자 이름(비정규화)
    is_shared   VARCHAR(1)   DEFAULT 'N',       -- 공유 여부 Y/N
    created_at  TIMESTAMP    NOT NULL,
    updated_at  TIMESTAMP    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_dk_project_type ON dk_project (type, updated_at DESC);
