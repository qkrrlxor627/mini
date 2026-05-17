package com.minipay.service;

import com.minipay.domain.Account;
import com.minipay.domain.Currency;
import com.minipay.domain.Money;
import com.minipay.domain.Transaction;
import com.minipay.dto.ChargeRequest;
import com.minipay.dto.ChargeResponse;
import com.minipay.exception.AccountNotFoundException;
import com.minipay.repository.AccountRepository;
import com.minipay.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    @Transactional
    public ChargeResponse charge(Long userId, ChargeRequest req) {
        Account account = accountRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> AccountNotFoundException.forUser(userId));

        Money amount = Money.of(req.amount(), Currency.KRW);
        account.charge(amount);

        Transaction tx = Transaction.charge(account.getId(), amount, account.getBalance(), null);
        Transaction saved = transactionRepository.save(tx);

        return ChargeResponse.from(saved);
    }
}
