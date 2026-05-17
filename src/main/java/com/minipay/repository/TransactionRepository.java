package com.minipay.repository;

import com.minipay.domain.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    Optional<Transaction> findByIdempotencyKey(String idempotencyKey);

    Page<Transaction> findByAccountIdOrCounterpartyAccountIdOrderByCreatedAtDesc(
            Long accountId, Long counterpartyAccountId, Pageable pageable);
}
