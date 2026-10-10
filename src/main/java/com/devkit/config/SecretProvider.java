package com.devkit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.EnumSet;
import java.util.Set;

/**
 * 앱 시크릿(JWT 서명 / 민감값 암호화 공용)을 해석한다.
 *
 *  1) devkit.jwt.secret(=환경변수 JWT_SECRET)이 명시되면 그것을 사용한다(여러 인스턴스 공유 배포 시).
 *  2) 없으면 시크릿 파일(&lt;dir&gt;/devkit.secret)에서 로드, 파일이 없으면 랜덤 생성 후 저장한다.
 *
 * → 배포는 WAR만 올리면 되고(추가 설정 0), 설치마다 고유·예측 불가한 시크릿을 갖는다.
 *   (공개된 하드코딩 기본 시크릿으로 admin 토큰을 위조하는 공격이 불가능해진다.)
 *
 * ※ 시크릿을 DB가 아닌 파일에 두는 이유: devkit의 SQL 실행 도구로 로그인 사용자가 DB를 조회할 수 있어,
 *   DB에 저장하면 시크릿이 노출될 수 있다. 파일은 앱(웹) 표면으로 노출되지 않는다.
 */
@Component
public class SecretProvider {

    /** 구버전(하드코딩 공개 기본값). 이 키로 암호화돼 저장된 기존 연결 비밀번호의 복호화 호환용. */
    public static final String LEGACY_SECRET =
        "devkit-default-secret-change-me-in-production-must-be-at-least-256-bits-long-string";

    private final String configuredJwt;
    private final String configuredCrypto;
    private final String secretDir;

    private String secret;

    public SecretProvider(
            @Value("${devkit.jwt.secret:}") String configuredJwt,
            @Value("${devkit.crypto.secret:}") String configuredCrypto,
            @Value("${devkit.secret-dir:}") String secretDir) {
        this.configuredJwt = configuredJwt;
        this.configuredCrypto = configuredCrypto;
        this.secretDir = secretDir;
    }

    @PostConstruct
    public void init() {
        if (configuredJwt != null && !configuredJwt.isBlank()) {
            secret = configuredJwt.trim();
            System.out.println("[SecretProvider] 설정된 JWT_SECRET 사용");
        } else {
            secret = loadOrCreate();
        }
    }

    /** JWT 서명 키 시크릿. */
    public String jwtSecret() { return secret; }

    /** 민감값(연결 비밀번호 등) 암호화 시크릿. 명시 설정이 없으면 공용 시크릿을 사용. */
    public String cryptoSecret() {
        return (configuredCrypto != null && !configuredCrypto.isBlank()) ? configuredCrypto.trim() : secret;
    }

    private Path secretFile() {
        String dir = (secretDir != null && !secretDir.isBlank())
                ? secretDir.trim()
                : System.getProperty("user.home") + "/.devkit";
        return Paths.get(dir, "devkit.secret");
    }

    private String loadOrCreate() {
        Path file = secretFile();
        try {
            if (Files.exists(file)) {
                String s = new String(Files.readAllBytes(file), StandardCharsets.UTF_8).trim();
                if (!s.isEmpty()) {
                    System.out.println("[SecretProvider] 시크릿 파일 로드: " + file);
                    return s;
                }
            }
        } catch (Exception e) {
            System.err.println("[SecretProvider] 시크릿 파일 읽기 실패(" + file + "), 재생성 시도: " + e.getMessage());
        }
        byte[] buf = new byte[48];
        new SecureRandom().nextBytes(buf);
        String generated = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
        try {
            Files.createDirectories(file.getParent());
            Files.write(file, generated.getBytes(StandardCharsets.UTF_8),
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            restrictPerms(file);
            System.out.println("[SecretProvider] 새 시크릿 생성·저장: " + file);
        } catch (Exception e) {
            // 저장 실패 시에도 메모리 시크릿으로 동작은 하되, 재기동 시 토큰이 무효화됨을 경고
            System.err.println("[SecretProvider] 시크릿 파일 저장 실패(" + file
                + "). 메모리 시크릿 사용 — 재기동 시 발급 토큰이 무효화됩니다: " + e.getMessage());
        }
        return generated;
    }

    /** 유닉스 계열에서 소유자만 읽기/쓰기로 제한. 윈도우(비-POSIX)는 생략. */
    private void restrictPerms(Path file) {
        try {
            Set<PosixFilePermission> perms = EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(file, perms);
        } catch (UnsupportedOperationException ignore) {
            // 윈도우 등 비-POSIX 파일시스템: 권한 설정 미지원 → 생략(사용자 홈 하위라 기본 격리)
        } catch (Exception ignore) {
        }
    }
}
