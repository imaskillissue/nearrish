package com.nearrish.backend.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
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
        User user = null;
        String jwt = request.getHeader("AUTH");
        DecodedJWT decoded;
        try {
            decoded = JWT.require(Algorithm.HMAC256(secret))
                    .build().verify(jwt);
        } catch (JWTVerificationException e) {
            throw new BadCredentialsException("Invalid jwt");
        }
        user = userRepository.getByIdAndUsername(
                decoded.getClaim("userId").asString(),
                decoded.getClaim("username").asString()
        );
        if (user == null) {
            throw new BadCredentialsException("Invalid session");
        }
        return new ApiAuthentication(decoded, user, AuthorityUtils.createAuthorityList(user.getRoles()));
    }

    public String createJwtForUser(User user, boolean mfa) {
        return JWT.create()
                .withClaim("username", user.getUsername())
                .withClaim("userId", user.getId())
                .withClaim("mfa", user.getSecondFactor() == null || user.getSecondFactor().isEmpty() || mfa)
//                .withExpiresAt(new java.util.Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24 * 7)) // 7 days
                .sign(Algorithm.HMAC256(secret));
    }
}
