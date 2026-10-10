package com.devkit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

/**
 * devkit — 개발자 편의 도구 모음 webapp.
 * 외부 Tomcat에 WAR(devkit.war)로 배포되어 /devkit 컨텍스트로 구동된다.
 * (자매 프로젝트 devkit_taskhub 와 동일한 배포 패턴)
 */
@SpringBootApplication
public class DevkitApplication extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder application) {
        return application.sources(DevkitApplication.class);
    }

    public static void main(String[] args) {
        SpringApplication.run(DevkitApplication.class, args);
    }
}
