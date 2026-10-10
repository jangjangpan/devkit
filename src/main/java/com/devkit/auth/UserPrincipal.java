package com.devkit.auth;

import org.springframework.security.core.context.SecurityContextHolder;

public class UserPrincipal {
    private final String userCd;
    private final String userNm;
    private final boolean admin;

    public UserPrincipal(String userCd, String userNm, boolean admin) {
        this.userCd = userCd;
        this.userNm = userNm;
        this.admin = admin;
    }

    public String getUserCd() { return userCd; }
    public String getUserNm() { return userNm; }
    public boolean isAdmin() { return admin; }

    public static String currentUserCd() {
        Object p = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal() : null;
        if (p instanceof UserPrincipal) return ((UserPrincipal) p).getUserCd();
        return "system";
    }
}
