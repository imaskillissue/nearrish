package com.nearrish.backend.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.user.Session;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.stereotype.Service;

@Service
public class ApiAuthenticationService {
//    @Value("${jwt.secret256bit}")
    private final String secret = "a-string-secret-at-least-256-bits-long-to-be-secure";

    private final UserRepository userRepository;

    public ApiAuthenticationService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public ApiAuthentication getAuthentication(HttpServletRequest request) {
        System.out.println("Getting authentication for request: " + request.getRequestURI() + " with secret " + secret);
        User user = null;
        String jwt = request.getHeader("AUTH");
        Session session;
        DecodedJWT decoded;
        try {
//            decoded = JWT.require(Algorithm.HMAC256(Base64.getEncoder().encode(secret.getBytes(StandardCharsets.UTF_8))))
            decoded = JWT.require(Algorithm.HMAC256(secret))
                    .build().verify(jwt);
            session = new Session(
                    decoded.getClaim("username").asString(),
                    decoded.getClaim("userId").asString(),
                    decoded.getClaim("expiresAt").asLong()
            );
        } catch (JWTVerificationException e) {
            throw new BadCredentialsException("Invalid session");
        }
        user = userRepository.getByIdAndUsername(
                session.getUserId(),
                session.getUsername()
        );
        if (user == null) {
            throw new BadCredentialsException("Invalid session");
        }
        if (decoded.getClaim("expiresAt").asLong() < System.currentTimeMillis()) {
            throw new CredentialsExpiredException("Session has expired");
        }
        return new ApiAuthentication(decoded, user, AuthorityUtils.NO_AUTHORITIES);
    }

    public String createJwtForUser(User user, boolean mfa) {
        long expiresAt = System.currentTimeMillis() + (1000 * 60 * 60 * 24 * 7);
        return JWT.create()
                .withClaim("username", user.getUsername())
                .withClaim("userId", user.getId())
                .withClaim("mfa", user.getSecondFactor() == null || user.getSecondFactor().isEmpty() || mfa)
                .withClaim("expiresAt", expiresAt)
                .sign(Algorithm.HMAC256(secret));
    }
}
