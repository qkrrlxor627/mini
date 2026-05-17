package com.minipay.controller;

import com.minipay.dto.ChargeRequest;
import com.minipay.dto.ChargeResponse;
import com.minipay.service.AccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @PostMapping("/charge")
    public ResponseEntity<ChargeResponse> charge(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody ChargeRequest request
    ) {
        return ResponseEntity.ok(accountService.charge(userId, request));
    }
}
