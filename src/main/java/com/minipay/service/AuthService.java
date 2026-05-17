package com.minipay.service;

import com.minipay.domain.Account;
import com.minipay.domain.Currency;
import com.minipay.domain.User;
import com.minipay.dto.LoginRequest;
import com.minipay.dto.LoginResponse;
import com.minipay.dto.SignupRequest;
import com.minipay.dto.SignupResponse;
import com.minipay.exception.DuplicateEmailException;
import com.minipay.exception.InvalidCredentialsException;
import com.minipay.repository.AccountRepository;
import com.minipay.repository.UserRepository;
import com.minipay.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${jwt.expiration-ms}")
    private long jwtExpirationMs;

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

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        String token = jwtTokenProvider.issue(user.getId());
        return LoginResponse.of(token, jwtExpirationMs / 1000);
    }
}
