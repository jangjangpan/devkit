-- devkit 작업물 저장 테이블 (Oracle)
CREATE TABLE dk_project (
    id          VARCHAR2(40)   NOT NULL,
    type        VARCHAR2(20)   NOT NULL,        -- erd | flowchart | ddl
    name        VARCHAR2(200)  NOT NULL,
    content     CLOB           NOT NULL,        -- JSON
    owner_cd    VARCHAR2(40),                   -- 소유자 ID (NULL=레거시/공유)
    owner_nm    VARCHAR2(100),                  -- 소유자 이름(비정규화)
    is_shared   VARCHAR2(1)    DEFAULT 'N',      -- 공유 여부 Y/N
    created_at  TIMESTAMP      NOT NULL,
    updated_at  TIMESTAMP      NOT NULL,
    CONSTRAINT pk_dk_project PRIMARY KEY (id)
);
CREATE INDEX ix_dk_project_type ON dk_project (type, updated_at);
