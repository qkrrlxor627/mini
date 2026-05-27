package com.minipay.service;

import com.minipay.domain.TransactionType;
import com.minipay.dto.ChargeRequest;
import com.minipay.dto.PaymentRequest;
import com.minipay.dto.PaymentResponse;
import com.minipay.dto.SignupRequest;
import com.minipay.dto.SignupResponse;
import com.minipay.dto.TransferRequest;
import com.minipay.repository.AccountRepository;
import com.minipay.repository.TransactionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ConcurrencyTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private TransferService transferService;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Test
    @DisplayName("ADR-0009: 결제 100건 동시 — 비관적 락이 직렬화해 잔액 정확히 0, 거래 100건")
    void payment_100_concurrent_serializedByPessimisticLock() throws Exception {
        Long userId = setupUserWithBalance(new BigDecimal("100000"));
        Long accountId = accountId(userId);

        int n = 100;
        ExecutorService executor = Executors.newFixedThreadPool(50);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(n);
        AtomicInteger success = new AtomicInteger();
        List<Throwable> failures = new CopyOnWriteArrayList<>();

        for (int i = 0; i < n; i++) {
            final int idx = i;
            executor.submit(() -> {
                try {
                    start.await();
                    paymentService.pay(userId, "pay-c1-" + System.nanoTime() + "-" + idx,
                            new PaymentRequest("M-001", new BigDecimal("1000")));
                    success.incrementAndGet();
                } catch (Throwable t) {
                    failures.add(t);
                } finally {
                    done.countDown();
                }
            });
        }

        start.countDown();
        boolean finished = done.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(finished).as("60초 안에 모든 작업이 끝나야 함").isTrue();
        assertThat(failures).as("실패가 한 건도 없어야 함").isEmpty();
        assertThat(success.get()).isEqualTo(n);

        BigDecimal finalBalance = currentBalance(accountId);
        assertThat(finalBalance).isEqualByComparingTo(BigDecimal.ZERO);

        long paymentCount = countByAccountAndType(accountId, TransactionType.PAYMENT);
        assertThat(paymentCount).isEqualTo(n);
    }

    @Test
    @DisplayName("ADR-0010: 같은 멱등키 10번 동시 — PAYMENT 1건만 생성, 모두 같은 transactionId로 200")
    void payment_sameIdempotencyKey_10_concurrent_replayed() throws Exception {
        Long userId = setupUserWithBalance(new BigDecimal("100000"));
        Long accountId = accountId(userId);
        String key = "idem-c2-" + System.nanoTime();

        int n = 10;
        ExecutorService executor = Executors.newFixedThreadPool(n);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(n);
        AtomicInteger success = new AtomicInteger();
        List<Long> txIds = Collections.synchronizedList(new java.util.ArrayList<>());
        List<Throwable> failures = new CopyOnWriteArrayList<>();

        for (int i = 0; i < n; i++) {
            executor.submit(() -> {
                try {
                    start.await();
                    PaymentResponse resp = paymentService.pay(userId, key,
                            new PaymentRequest("M-001", new BigDecimal("1000")));
                    txIds.add(resp.transactionId());
                    success.incrementAndGet();
                } catch (Throwable t) {
                    failures.add(t);
                } finally {
                    done.countDown();
                }
            });
        }

        start.countDown();
        boolean finished = done.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(finished).isTrue();
        assertThat(failures).as("모두 200 (1건 신규 + 9건 replay)").isEmpty();
        assertThat(success.get()).isEqualTo(n);

        assertThat(new HashSet<>(txIds))
                .as("모든 응답이 같은 transactionId를 반환해야 함")
                .hasSize(1);

        BigDecimal finalBalance = currentBalance(accountId);
        assertThat(finalBalance).isEqualByComparingTo(new BigDecimal("99000"));

        long paymentCount = countByAccountAndType(accountId, TransactionType.PAYMENT);
        assertThat(paymentCount).isEqualTo(1);
    }

    @Test
    @DisplayName("ADR-0011: A↔B 양방향 이체 각 100건 동시 — 데드락 없음, 잔액 합 보존")
    void transfer_bidirectional_200_concurrent_noDeadlock() throws Exception {
        Long userA = setupUserWithBalance(new BigDecimal("1000000"));
        Long userB = setupUserWithBalance(new BigDecimal("1000000"));
        Long accountA = accountId(userA);
        Long accountB = accountId(userB);

        int n = 100;
        int total = n * 2;
        ExecutorService executor = Executors.newFixedThreadPool(50);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(total);
        AtomicInteger success = new AtomicInteger();
        List<Throwable> failures = new CopyOnWriteArrayList<>();

        for (int i = 0; i < n; i++) {
            final int idx = i;
            executor.submit(() -> {
                try {
                    start.await();
                    transferService.transfer(userA, "ab-" + System.nanoTime() + "-" + idx,
                            new TransferRequest(accountB, new BigDecimal("1000")));
                    success.incrementAndGet();
                } catch (Throwable t) {
                    failures.add(t);
                } finally {
                    done.countDown();
                }
            });
            executor.submit(() -> {
                try {
                    start.await();
                    transferService.transfer(userB, "ba-" + System.nanoTime() + "-" + idx,
                            new TransferRequest(accountA, new BigDecimal("1000")));
                    success.incrementAndGet();
                } catch (Throwable t) {
                    failures.add(t);
                } finally {
                    done.countDown();
                }
            });
        }

        start.countDown();
        boolean finished = done.await(120, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(finished).as("데드락 없이 120초 안에 끝나야 함").isTrue();
        assertThat(failures).as("데드락/예외 0건 — 락 순서 정렬이 작동").isEmpty();
        assertThat(success.get()).isEqualTo(total);

        BigDecimal balanceA = currentBalance(accountA);
        BigDecimal balanceB = currentBalance(accountB);
        assertThat(balanceA.add(balanceB))
                .as("이체는 zero-sum — 합이 보존되어야 함")
                .isEqualByComparingTo(new BigDecimal("2000000"));

        long transferCountA = countByAccountAndType(accountA, TransactionType.TRANSFER);
        long transferCountB = countByAccountAndType(accountB, TransactionType.TRANSFER);
        assertThat(transferCountA + transferCountB)
                .as("TRANSFER 행은 송금자 시점 1행씩 — 총 200건")
                .isEqualTo(total);
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────

    private Long setupUserWithBalance(BigDecimal balance) {
        String email = "concur-" + System.nanoTime() + "@test.com";
        SignupResponse signup = authService.signup(
                new SignupRequest(email, "Abc12345!", "ConcurTest", "1234"));
        accountService.charge(signup.userId(), "charge-setup-" + System.nanoTime(),
                new ChargeRequest(balance));
        return signup.userId();
    }

    private Long accountId(Long userId) {
        return accountRepository.findByUserId(userId).orElseThrow().getId();
    }

    private BigDecimal currentBalance(Long accountId) {
        return accountRepository.findById(accountId).orElseThrow()
                .getBalance().getAmount();
    }

    private long countByAccountAndType(Long accountId, TransactionType type) {
        return transactionRepository.findAll().stream()
                .filter(tx -> tx.getAccountId().equals(accountId) && tx.getType() == type)
                .count();
    }
}
