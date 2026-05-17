package com.minipay.security;

import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtTokenProviderTest {

    private static final String VALID_SECRET = "a".repeat(32);

    @Test
    void issue_then_parse_returns_same_userId() {
        JwtTokenProvider provider = new JwtTokenProvider(VALID_SECRET, 60_000L);

        String token = provider.issue(42L);

        assertEquals(42L, provider.parseUserId(token));
    }

    @Test
    void parse_expired_token_throws_ExpiredJwtException() {
        JwtTokenProvider provider = new JwtTokenProvider(VALID_SECRET, -1_000L);

        String expiredToken = provider.issue(1L);

        assertThrows(ExpiredJwtException.class, () -> provider.parseUserId(expiredToken));
    }
}
