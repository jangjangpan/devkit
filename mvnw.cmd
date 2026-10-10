@echo off
setlocal

set "DIRNAME=%~dp0"
if "%DIRNAME:~-1%"=="\" set "DIRNAME=%DIRNAME:~0,-1%"

set "WRAPPER_JAR=%DIRNAME%\.mvn\wrapper\maven-wrapper.jar"
set "WRAPPER_URL=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"

if not exist "%WRAPPER_JAR%" (
    echo Downloading Maven Wrapper...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%WRAPPER_URL%' -OutFile '%WRAPPER_JAR%'"
    if errorlevel 1 (
        echo ERROR: Wrapper download failed.
        exit /b 1
    )
)

if "%JAVA_HOME%"=="" (
    set "JAVA_EXE=java.exe"
) else (
    set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
)

"%JAVA_EXE%" -Dmaven.multiModuleProjectDirectory="%DIRNAME%" -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
