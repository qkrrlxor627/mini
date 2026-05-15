package com.minipay.service;

import com.minipay.domain.Account;
import com.minipay.domain.Currency;
import com.minipay.domain.User;
import com.minipay.dto.SignupRequest;
import com.minipay.dto.SignupResponse;
import com.minipay.exception.DuplicateEmailException;
import com.minipay.repository.AccountRepository;
import com.minipay.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public SignupResponse signup(SignupRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new DuplicateEmailException(req.email());
        }

        String passwordHash = passwordEncoder.encode(req.password());
        String pinHash = passwordEncoder.encode(req.pin());

        User user = User.register(req.email(), passwordHash, req.name(), pinHash);
        userRepository.save(user);

        Account account = Account.openFor(user.getId(), Currency.KRW);
        accountRepository.save(account);

        return SignupResponse.from(user);
    }
}
