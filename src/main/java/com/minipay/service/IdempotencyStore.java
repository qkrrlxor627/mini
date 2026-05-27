package com.minipay.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Slf4j
@Component
@RequiredArgsConstructor
public class IdempotencyStore {

    private static final String CHARGE_PREFIX = "idem:charge:";
    private static final String PAYMENT_PREFIX = "idem:payment:";
    private static final String TRANSFER_PREFIX = "idem:transfer:";
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(10);
    private static final String IN_PROGRESS = "in-progress";

    private final StringRedisTemplate redisTemplate;

    public boolean tryAcquireCharge(String key) {
        return tryAcquire(CHARGE_PREFIX + key);
    }

    public boolean tryAcquirePayment(String key) {
        return tryAcquire(PAYMENT_PREFIX + key);
    }

    public boolean tryAcquireTransfer(String key) {
        return tryAcquire(TRANSFER_PREFIX + key);
    }

    private boolean tryAcquire(String redisKey) {
        try {
            Boolean acquired = redisTemplate.opsForValue()
                    .setIfAbsent(redisKey, IN_PROGRESS, DEFAULT_TTL);
            return acquired == null || acquired;
        } catch (DataAccessException ex) {
            log.warn("Redis SETNX failed, falling back to DB UNIQUE only: {}", ex.getMessage());
            return true;
        }
    }
}
