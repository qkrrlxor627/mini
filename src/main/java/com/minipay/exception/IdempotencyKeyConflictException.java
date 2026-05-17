package com.minipay.exception;

public class IdempotencyKeyConflictException extends RuntimeException {

    public IdempotencyKeyConflictException(String key) {
        super("동일한 Idempotency-Key로 다른 요청이 이미 처리되었습니다: " + key);
    }
}
