package com.devkit.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = extractToken(req);
        if (token != null) {
            try {
                Claims claims = jwtUtil.parse(token);
                Boolean admin = claims.get("admin", Boolean.class);
                UserPrincipal principal = new UserPrincipal(
                        claims.getSubject(), claims.get("name", String.class), Boolean.TRUE.equals(admin));
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(principal, null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException ignored) {
                // 유효하지 않은 토큰 → 미인증 상태로 진행 (SecurityConfig가 401 반환)
            }
        }
        chain.doFilter(req, res);
    }

    private String extractToken(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) return header.substring(7);
        String q = req.getParameter("token");
        return (q != null && !q.isBlank()) ? q : null;
    }
}
