package com.devkit.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * React Router(BrowserRouter)의 deep link 지원.
 * /api 와 정적 자원이 아닌 SPA 라우트 GET 요청은 index.html로 forward → 클라이언트가 라우팅한다.
 */
@Controller
public class SpaFallbackController {

    @GetMapping(value = {
            "/",
            "/home",
            "/error-page",
            "/login",
            "/signup",
            "/flowchart",
            "/erd",
            "/ddl",
            "/sql-format",
            "/palette",
            "/profile",
            "/admin/users",
            "/admin/logs",
            "/admin/menu",
            "/admin/settings",
            "/dict",
            "/connections",
            "/query",
            "/mock",
            "/varname",
            "/case",
            "/format",
            "/crypt",
            "/compare",
            "/notes"
    })
    public String spa() {
        return "forward:/index.html";
    }
}
