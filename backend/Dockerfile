# Use Gradle for building the application
FROM gradle:9.3.1-jdk25 AS builder
WORKDIR /app

# Copy only the Gradle wrapper and build files to leverage caching
COPY gradle gradle
COPY gradlew .
COPY build.gradle .
COPY settings.gradle .

# Download dependencies
RUN ./gradlew dependencies --no-daemon

# Copy the rest of the source code
COPY . .

# Build the application
RUN ./gradlew bootJar --no-daemon

# Use a lightweight JRE image for running the application
FROM eclipse-temurin:25-alpine
WORKDIR /app

# Copy the built JAR file from the builder stage
COPY --from=builder /app/build/libs/*.jar /app/app.jar

# Expose the debugger port
EXPOSE 5005

# Enable live reload by mounting the source code as a volume
VOLUME /app

# Set the entrypoint with debugger options
ENTRYPOINT ["java", "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005", "-jar", "/app/app.jar"]