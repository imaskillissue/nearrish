package com.nearrish.backend.security;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.entity.User;
import org.jspecify.annotations.Nullable;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

public class ApiAuthentication extends AbstractAuthenticationToken {
    private DecodedJWT jwt;
    private User user;

    public ApiAuthentication(DecodedJWT jwt, User user, @Nullable Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.jwt = jwt;
        this.user = user;
        setAuthenticated(true);
    }

    @Override
    public @Nullable Object getCredentials() {
        return this.user;
    }

    @Override
    public @Nullable Object getPrincipal() {
        return this.jwt;
    }
}
