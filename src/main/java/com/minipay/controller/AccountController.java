package com.minipay.controller;

import com.minipay.dto.AccountMeResponse;
import com.minipay.dto.ChargeRequest;
import com.minipay.dto.ChargeResponse;
import com.minipay.exception.MissingIdempotencyKeyException;
import com.minipay.service.AccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/accounts")
@RequiredArgsConstructor
public class AccountController {

    private static final String IDEMPOTENCY_HEADER = "Idempotency-Key";

    private final AccountService accountService;

    @GetMapping("/me")
    public ResponseEntity<AccountMeResponse> me(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(accountService.getMe(userId));
    }

    @PostMapping("/charge")
    public ResponseEntity<ChargeResponse> charge(
            @AuthenticationPrincipal Long userId,
            @RequestHeader(value = IDEMPOTENCY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody ChargeRequest request
    ) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new MissingIdempotencyKeyException();
        }
        return ResponseEntity.ok(accountService.charge(userId, idempotencyKey, request));
    }
}
