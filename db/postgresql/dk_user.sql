-- devkit 사용자/인증 테이블 (PostgreSQL). SeedRunner가 부팅 시 자동 생성하지만, 수동 생성도 가능.
CREATE TABLE IF NOT EXISTS dk_user (
    user_cd        VARCHAR(40)  NOT NULL PRIMARY KEY,
    user_nm        VARCHAR(100) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,   -- BCrypt
    is_admin       VARCHAR(1)   NOT NULL DEFAULT 'N',
    use_yn         VARCHAR(1)   NOT NULL DEFAULT 'Y',
    created_at     TIMESTAMP    NOT NULL
);
-- 기본 관리자: admin / admin1234 (SeedRunner가 사용자 0명일 때 자동 생성)
