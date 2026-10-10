package com.devkit.auth;

import com.devkit.config.SecretProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private final long expirationHours;
    private final Key key;

    public JwtUtil(SecretProvider secrets, @Value("${devkit.jwt.expiration-hours}") long expirationHours) {
        this.expirationHours = expirationHours;
        // SecretProvider가 환경변수 또는 시크릿 파일에서 해석한 시크릿으로 서명 키 구성
        this.key = Keys.hmacShaKeyFor(secrets.jwtSecret().getBytes(StandardCharsets.UTF_8));
    }

    /** 기본(설정 파일) 세션 유지 시간(시간 단위). 시스템 설정 미지정 시 폴백. */
    public long defaultExpirationHours() { return expirationHours; }

    public String generate(String userCd, String userNm, boolean isAdmin) {
        return generate(userCd, userNm, isAdmin, expirationHours);
    }

    /** 세션 유지 시간(hours)을 지정해 토큰 발급. hours<=0 이면 기본값 사용. */
    public String generate(String userCd, String userNm, boolean isAdmin, long hours) {
        long h = hours > 0 ? hours : expirationHours;
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(userCd)
                .claim("name", userNm)
                .claim("admin", isAdmin)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + h * 3600_000L))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }
}
