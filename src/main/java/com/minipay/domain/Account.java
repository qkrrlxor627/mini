package com.minipay.domain;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(name = "accounts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "amount",
                    column = @Column(name = "balance_amount",
                            nullable = false, precision = 19, scale = 4)),
            @AttributeOverride(name = "currency",
                    column = @Column(name = "balance_currency",
                            nullable = false, length = 3))
    })
    private Money balance;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public static Account openFor(Long userId, Currency currency) {
        if (userId == null) {
            throw new IllegalArgumentException("userId는 null일 수 없습니다");
        }
        Account account = new Account();
        account.userId = userId;
        account.balance = Money.zero(currency);
        account.createdAt = OffsetDateTime.now();
        return account;
    }

    public void charge(Money amount) {
        validateAmount(amount);
        this.balance = this.balance.add(amount);
    }

    public void deduct(Money amount) {
        validateAmount(amount);
        if (this.balance.isLessThan(amount)) {
            throw new InsufficientBalanceException();
        }
        this.balance = this.balance.subtract(amount);
    }

    private void validateAmount(Money amount) {
        if (amount == null || !amount.isPositive()) {
            throw new IllegalArgumentException("금액은 0보다 커야 합니다");
        }
    }
}
