#!/bin/sh
# Maven Wrapper - Unix
DIRNAME=$(dirname "$0")
WRAPPER_JAR="$DIRNAME/.mvn/wrapper/maven-wrapper.jar"
WRAPPER_PROPS="$DIRNAME/.mvn/wrapper/maven-wrapper.properties"

if [ ! -f "$WRAPPER_JAR" ]; then
  echo "Downloading Maven Wrapper..."
  WRAPPER_URL=$(grep "^wrapperUrl=" "$WRAPPER_PROPS" | cut -d'=' -f2-)
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$WRAPPER_JAR" "$WRAPPER_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$WRAPPER_JAR" "$WRAPPER_URL"
  else
    echo "ERROR: curl 또는 wget 필요"; exit 1
  fi
fi

JAVA_EXE="java"
if [ -n "$JAVA_HOME" ]; then JAVA_EXE="$JAVA_HOME/bin/java"; fi

exec "$JAVA_EXE" \
  -Dmaven.multiModuleProjectDirectory="$DIRNAME" \
  -classpath "$WRAPPER_JAR" \
  org.apache.maven.wrapper.MavenWrapperMain "$@"
