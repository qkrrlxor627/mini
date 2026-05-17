package com.minipay.exception;

public class MissingIdempotencyKeyException extends RuntimeException {

    public MissingIdempotencyKeyException() {
        super("Idempotency-Key 헤더는 필수입니다");
    }
}
