package com.minipay.service;

import com.minipay.domain.Account;
import com.minipay.domain.Transaction;
import com.minipay.dto.PageResponse;
import com.minipay.dto.TransactionResponse;
import com.minipay.exception.AccountNotFoundException;
import com.minipay.repository.AccountRepository;
import com.minipay.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TransactionQueryService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> list(Long userId, Pageable pageable) {
        Account account = accountRepository.findByUserId(userId)
                .orElseThrow(() -> AccountNotFoundException.forUser(userId));

        Long accountId = account.getId();
        Page<Transaction> page = transactionRepository
                .findByAccountIdOrCounterpartyAccountIdOrderByCreatedAtDesc(
                        accountId, accountId, pageable);

        return PageResponse.of(page, tx -> TransactionResponse.from(tx, accountId));
    }
}
