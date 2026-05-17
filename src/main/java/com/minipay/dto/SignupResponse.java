package com.minipay.dto;

import com.minipay.domain.User;

public record SignupResponse(Long userId, String email) {

    public static SignupResponse from(User user) {
        return new SignupResponse(user.getId(), user.getEmail());
    }
}
