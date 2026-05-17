package com.minipay.exception;

public class InvalidTransferTargetException extends RuntimeException {

    public InvalidTransferTargetException(String message) {
        super(message);
    }
}
