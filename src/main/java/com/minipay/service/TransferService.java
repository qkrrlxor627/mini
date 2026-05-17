package com.minipay.service;

import com.minipay.domain.Account;
import com.minipay.domain.Currency;
import com.minipay.domain.Money;
import com.minipay.domain.Transaction;
import com.minipay.dto.TransferRequest;
import com.minipay.dto.TransferResponse;
import com.minipay.exception.AccountNotFoundException;
import com.minipay.exception.IdempotencyKeyConflictException;
import com.minipay.exception.InvalidTransferTargetException;
import com.minipay.repository.AccountRepository;
import com.minipay.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TransferService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final IdempotencyStore idempotencyStore;

    @Transactional
    public TransferResponse transfer(Long userId, String idempotencyKey, TransferRequest req) {
        long senderId = accountRepository.findIdByUserId(userId)
                .orElseThrow(() -> AccountNotFoundException.forUser(userId));
        long receiverId = req.counterpartyAccountId();

        if (senderId == receiverId) {
            throw new InvalidTransferTargetException("자기 자신에게 이체할 수 없습니다");
        }

        Money amount = Money.of(req.amount(), Currency.KRW);

        Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return replayIfMatches(existing.get(), senderId, receiverId, amount);
        }

        idempotencyStore.tryAcquireTransfer(idempotencyKey);

        long firstId = Math.min(senderId, receiverId);
        long secondId = Math.max(senderId, receiverId);

        Account first = accountRepository.findByIdForUpdate(firstId)
                .orElseThrow(() -> AccountNotFoundException.forAccount(firstId));
        Account second = accountRepository.findByIdForUpdate(secondId)
                .orElseThrow(() -> AccountNotFoundException.forAccount(secondId));

        Account sender = first.getId() == senderId ? first : second;
        Account receiver = first.getId() == receiverId ? first : second;

        sender.deduct(amount);
        receiver.charge(amount);

        Transaction tx = Transaction.transfer(sender.getId(), receiver.getId(),
                amount, sender.getBalance(), idempotencyKey);

        try {
            Transaction saved = transactionRepository.saveAndFlush(tx);
            return TransferResponse.from(saved);
        } catch (DataIntegrityViolationException ex) {
            return transactionRepository.findByIdempotencyKey(idempotencyKey)
                    .map(existingTx -> replayIfMatches(existingTx, senderId, receiverId, amount))
                    .orElseThrow(() -> ex);
        }
    }

    private TransferResponse replayIfMatches(Transaction existing, long senderId,
                                             long receiverId, Money amount) {
        boolean sameSender = existing.getAccountId() == senderId;
        boolean sameReceiver = existing.getCounterpartyAccountId() != null
                && existing.getCounterpartyAccountId() == receiverId;
        boolean sameAmount = existing.getAmount().equals(amount);

        if (sameSender && sameReceiver && sameAmount) {
            return TransferResponse.from(existing);
        }
        throw new IdempotencyKeyConflictException(existing.getIdempotencyKey());
    }
}
