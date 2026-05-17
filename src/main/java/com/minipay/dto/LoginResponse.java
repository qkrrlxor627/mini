package com.minipay.dto;

public record LoginResponse(String accessToken, long expiresIn) {

    public static LoginResponse of(String accessToken, long expiresInSeconds) {
        return new LoginResponse(accessToken, expiresInSeconds);
    }
}
