package com.minipay.service;

import com.minipay.domain.Account;
import com.minipay.domain.Currency;
import com.minipay.domain.Money;
import com.minipay.domain.Transaction;
import com.minipay.dto.AccountMeResponse;
import com.minipay.dto.ChargeRequest;
import com.minipay.dto.ChargeResponse;
import com.minipay.exception.AccountNotFoundException;
import com.minipay.exception.IdempotencyKeyConflictException;
import com.minipay.repository.AccountRepository;
import com.minipay.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final IdempotencyStore idempotencyStore;

    @Transactional(readOnly = true)
    public AccountMeResponse getMe(Long userId) {
        Account account = accountRepository.findByUserId(userId)
                .orElseThrow(() -> AccountNotFoundException.forUser(userId));
        return AccountMeResponse.from(account);
    }

    @Transactional
    public ChargeResponse charge(Long userId, String idempotencyKey, ChargeRequest req) {
        Account account = accountRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> AccountNotFoundException.forUser(userId));

        Money amount = Money.of(req.amount(), Currency.KRW);

        Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return replayIfMatches(existing.get(), account.getId(), amount);
        }

        idempotencyStore.tryAcquireCharge(idempotencyKey);

        account.charge(amount);
        Transaction tx = Transaction.charge(account.getId(), amount, account.getBalance(), idempotencyKey);

        try {
            Transaction saved = transactionRepository.saveAndFlush(tx);
            return ChargeResponse.from(saved);
        } catch (DataIntegrityViolationException ex) {
            return transactionRepository.findByIdempotencyKey(idempotencyKey)
                    .map(existingTx -> replayIfMatches(existingTx, account.getId(), amount))
                    .orElseThrow(() -> ex);
        }
    }

    private ChargeResponse replayIfMatches(Transaction existing, Long accountId, Money amount) {
        boolean sameAccount = existing.getAccountId().equals(accountId);
        boolean sameAmount = existing.getAmount().equals(amount);

        if (sameAccount && sameAmount) {
            return ChargeResponse.from(existing);
        }
        throw new IdempotencyKeyConflictException(existing.getIdempotencyKey());
    }
}
