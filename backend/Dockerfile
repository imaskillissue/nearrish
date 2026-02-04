ARG APPNAME=demo.jar

FROM maven:3.9.12 AS builder
WORKDIR /app

# Copy everything from backend folder to the container
COPY . .
RUN mvn -f demo/pom.xml clean package -DskipTests
#This will generate the jar file in <PATH_TO_MY_JARFILE>

FROM eclipse-temurin:17-jre-alpine-3.23

COPY --from=builder /app/demo/target/*.jar   /app/app.jar
# we need to change the app.jar to whatever we name the project to
ENTRYPOINT ["java", "-jar", "/app/app.jar"]