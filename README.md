# DevKit (`devkit`)

개발자 편의 도구 모음 웹앱. 자매 프로젝트 **devkit_taskhub**(일정관리)와 동일한 배포 패턴으로,
외부 Tomcat에 WAR로 배포되어 `/devkit` 컨텍스트로 함께 구동된다.

## 제공 도구 (5종)

| 메뉴 | 설명 | 백엔드 |
|------|------|--------|
| **순서도** | React Flow 기반 플로우차트 에디터 (시작/종료·처리·분기·입출력 도형, 연결선 라벨, PNG 내보내기) | DB 저장 |
| **ERD** | 엔티티 관계도 에디터. 그린 테이블을 그대로 4개 DB DDL로 내보내기 | DB 저장 |
| **DDL 생성** | 테이블·컬럼 정의 → Oracle / MSSQL / PostgreSQL / MySQL CREATE TABLE 생성 | 불필요 |
| **SQL 정렬** | i-AUD 보고서(REP94454857…)의 SQL 자동 정렬기 로직을 그대로 포팅. 바인딩 변수(`:VS_`, `@:`, `%:`, `$`) 보존 | 불필요 |
| **색상 팔레트** | flatuicolors.com 공식 팔레트(10종 200색) 조회 + HEX/RGB 클립보드 복사 | 불필요 |

> SQL 정렬 / 색상 팔레트 / DDL 생성은 **클라이언트 단독** 동작 — DB가 없어도 사용 가능.
> 순서도 / ERD의 작업물 저장만 DB(`dk_project` 테이블)를 사용한다.

## 기술 스택

- **백엔드**: Spring Boot 3.2.5 (Java 17), WAR 패키징, JDBC (4 dialect 드라이버 번들)
- **프론트엔드**: React 18 + Vite + TypeScript + Tailwind + @xyflow/react (React Flow)
- **빌드**: Maven (frontend-maven-plugin이 node/npm 설치 → SPA 빌드 → `src/main/resources/static`)

## 빌드 & 배포

```bash
# JDK 17 필요 (예: C:/AUDPlatform_7/apps/openjdk)
export JAVA_HOME=/c/AUDPlatform_7/apps/openjdk
./mvnw -DskipTests package
# → target/devkit.war

# Tomcat webapps에 복사 (자동 배포)
cp target/devkit.war /c/AUDPlatform_7/apps/tomcat/webapps/
```

접속: `http://localhost:8087/devkit/`

## DB 설정 (ERD/순서도 저장용)

기본값은 PostgreSQL `jdbc:postgresql://127.0.0.1:5433/matrixdb` (env로 override 가능):

```
DB_URL, DB_USER, DB_PASSWORD
```

저장 테이블 생성 — 사용 DB에 맞는 스크립트 1개 실행:

```
db/postgresql/dk_project.sql
db/oracle/dk_project.sql
db/mssql/dk_project.sql
db/mysql/dk_project.sql
```

> URL prefix(`postgresql`/`oracle`/`sqlserver`/`mariadb`)로 드라이버 자동 감지.
> DB가 없어도 앱은 기동되며 무상태 도구 3종은 정상 동작한다(`initialization-fail-timeout: -1`).

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects?type=erd\|flowchart\|ddl` | 목록(메타) |
| GET | `/api/projects/{id}` | 단건(content 포함) |
| POST | `/api/projects` | 생성 `{type,name,content}` |
| PUT | `/api/projects/{id}` | 수정 `{name?,content?}` |
| DELETE | `/api/projects/{id}` | 삭제 |

## 개발 모드

```bash
# 백엔드 (8087)
./mvnw spring-boot:run    # 또는 Tomcat 배포본 사용

# 프론트 (5174, /devkit/api → 8087 프록시)
cd frontend && npm run dev
```
