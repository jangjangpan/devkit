package com.devkit.config;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Spring Boot Whitelabel Error Page 대체.
 *  - 브라우저 요청: SPA의 /error-page?code=XXX 로 리다이렉트 → React ErrorPage가 렌더
 *  - API/JSON 요청: 원래 상태 코드 + 간단한 JSON body 반환 (프론트 axios interceptor가 처리)
 */
@Controller
public class SpaErrorController implements ErrorController {

    @RequestMapping("/error")
    public Object handleError(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        int code = 500;
        Object statusObj = req.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (statusObj != null) {
            try { code = Integer.parseInt(String.valueOf(statusObj)); } catch (Exception ignore) { /* keep 500 */ }
        }

        // API 요청 판별 — 원본 URI가 /api 로 시작하거나, Accept 헤더가 JSON
        Object origUri = req.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        String uri = origUri != null ? String.valueOf(origUri) : req.getRequestURI();
        String accept = req.getHeader("Accept");
        boolean isApi = (uri != null && uri.contains("/api/"))
                || (accept != null && accept.contains("application/json") && !accept.contains("text/html"));

        if (isApi) {
            resp.setStatus(code);
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write("{\"status\":" + code + ",\"error\":\"" + reason(code) + "\"}");
            return null;
        }

        // 브라우저: SPA의 에러 페이지로 리다이렉트 (context path는 Spring이 자동 prefix)
        String from = uri != null ? uri : "";
        StringBuilder location = new StringBuilder("redirect:/error-page?code=").append(code);
        if (!from.isEmpty()) {
            location.append("&from=").append(java.net.URLEncoder.encode(from, java.nio.charset.StandardCharsets.UTF_8));
        }
        return location.toString();
    }

    private String reason(int code) {
        switch (code) {
            case 400: return "Bad Request";
            case 401: return "Unauthorized";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 405: return "Method Not Allowed";
            case 500: return "Internal Server Error";
            case 502: return "Bad Gateway";
            case 503: return "Service Unavailable";
            default:  return "Error";
        }
    }
}
