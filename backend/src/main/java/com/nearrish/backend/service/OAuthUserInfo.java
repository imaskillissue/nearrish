package com.nearrish.backend.service;

/**
 * Normalised user info returned by any OAuth provider.
 *
 * @param id        Provider-specific user ID (stable, used for account linking)
 * @param email     Email address (may be null if provider doesn't share it)
 * @param name      Full display name
 * @param login     Short login/handle (42 login, or null for Google)
 * @param avatarUrl Remote avatar URL from the provider (optional, may be null)
 */
public record OAuthUserInfo(String id, String email, String name, String login, String avatarUrl) {}
