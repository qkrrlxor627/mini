package com.minipay.exception;

public class AccountNotFoundException extends RuntimeException {

    private AccountNotFoundException(String message) {
        super(message);
    }

    public static AccountNotFoundException forUser(Long userId) {
        return new AccountNotFoundException("계좌를 찾을 수 없습니다: userId=" + userId);
    }

    public static AccountNotFoundException forAccount(Long accountId) {
        return new AccountNotFoundException("계좌를 찾을 수 없습니다: accountId=" + accountId);
    }
}
