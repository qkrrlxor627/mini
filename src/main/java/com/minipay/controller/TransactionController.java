package com.minipay.controller;

import com.minipay.dto.PageResponse;
import com.minipay.dto.TransactionResponse;
import com.minipay.service.TransactionQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private static final int MAX_PAGE_SIZE = 100;

    private final TransactionQueryService transactionQueryService;

    @GetMapping
    public ResponseEntity<PageResponse<TransactionResponse>> list(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        if (page < 0) {
            throw new IllegalArgumentException("page는 0 이상이어야 합니다");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size는 1 이상 " + MAX_PAGE_SIZE + " 이하여야 합니다");
        }

        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(transactionQueryService.list(userId, pageable));
    }
}
