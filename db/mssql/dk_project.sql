-- devkit 작업물 저장 테이블 (MS SQL Server)
IF OBJECT_ID('dbo.dk_project', 'U') IS NULL
CREATE TABLE dbo.dk_project (
    id          VARCHAR(40)    NOT NULL PRIMARY KEY,
    type        VARCHAR(20)    NOT NULL,        -- erd | flowchart | ddl
    name        NVARCHAR(200)  NOT NULL,
    content     NVARCHAR(MAX)  NOT NULL,        -- JSON
    owner_cd    VARCHAR(40)    NULL,            -- 소유자 ID (NULL=레거시/공유)
    owner_nm    NVARCHAR(100)  NULL,            -- 소유자 이름(비정규화)
    is_shared   VARCHAR(1)     DEFAULT 'N',     -- 공유 여부 Y/N
    created_at  DATETIME2      NOT NULL,
    updated_at  DATETIME2      NOT NULL
);
GO
CREATE INDEX ix_dk_project_type ON dbo.dk_project (type, updated_at DESC);
GO
