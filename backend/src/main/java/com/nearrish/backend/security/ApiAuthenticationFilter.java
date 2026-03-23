package com.nearrish.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.io.PrintWriter;

@Component
public class ApiAuthenticationFilter extends OncePerRequestFilter {
    private final ApiAuthenticationService authenticationService;

    public ApiAuthenticationFilter(ApiAuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        try {
            HttpServletRequest httpRequest = request;
            ApiAuthentication authentication = authenticationService.getAuthentication(httpRequest);
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            filterChain.doFilter(request, response);
        } catch (BadCredentialsException exp) {
            writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, exp.getMessage());
        } catch (ServletException | IOException exp) {
            throw exp;
        } catch (Exception exp) {
            if (!response.isCommitted()) {
                writeJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Internal server error");
            }
        }
    }

    private void writeJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        PrintWriter writer = response.getWriter();
        writer.print("{\"message\":\"" + message + "\"}");
        writer.flush();
        writer.close();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        return path.startsWith("/api/public/") ||
                path.startsWith("/api/auth/") ||
                path.startsWith("/uploads/") ||
                path.startsWith("/swagger-ui/") ||
                path.startsWith("/v3/api-docs") ||
                path.equals("/swagger-ui.html") ||
                path.startsWith("/ws");
    }
}