package com.minipay.service;

import com.minipay.domain.Account;
import com.minipay.domain.Currency;
import com.minipay.domain.Money;
import com.minipay.domain.Transaction;
import com.minipay.dto.PaymentRequest;
import com.minipay.dto.PaymentResponse;
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
public class PaymentService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final IdempotencyStore idempotencyStore;

    @Transactional
    public PaymentResponse pay(Long userId, String idempotencyKey, PaymentRequest req) {
        Account account = accountRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new AccountNotFoundException(userId));

        Money amount = Money.of(req.amount(), Currency.KRW);

        Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return replayIfMatches(existing.get(), account.getId(), req, amount);
        }

        idempotencyStore.tryAcquirePayment(idempotencyKey);

        account.deduct(amount);
        Transaction tx = Transaction.payment(account.getId(), amount, account.getBalance(),
                req.merchantId(), idempotencyKey);

        try {
            Transaction saved = transactionRepository.saveAndFlush(tx);
            return PaymentResponse.from(saved);
        } catch (DataIntegrityViolationException ex) {
            return transactionRepository.findByIdempotencyKey(idempotencyKey)
                    .map(existingTx -> replayIfMatches(existingTx, account.getId(), req, amount))
                    .orElseThrow(() -> ex);
        }
    }

    private PaymentResponse replayIfMatches(Transaction existing, Long accountId,
                                            PaymentRequest req, Money amount) {
        boolean sameAccount = existing.getAccountId().equals(accountId);
        boolean sameAmount = existing.getAmount().equals(amount);
        boolean sameMerchant = req.merchantId().equals(existing.getMerchantId());

        if (sameAccount && sameAmount && sameMerchant) {
            return PaymentResponse.from(existing);
        }
        throw new IdempotencyKeyConflictException(existing.getIdempotencyKey());
    }
}
