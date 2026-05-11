package com.minipay.domain;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(name = "transactions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionType type;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "amount",
                    column = @Column(name = "amount_amount",
                            nullable = false, precision = 19, scale = 4)),
            @AttributeOverride(name = "currency",
                    column = @Column(name = "amount_currency",
                            nullable = false, length = 3))
    })
    private Money amount;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "amount",
                    column = @Column(name = "balance_after_amount",
                            nullable = false, precision = 19, scale = 4)),
            @AttributeOverride(name = "currency",
                    column = @Column(name = "balance_after_currency",
                            nullable = false, length = 3))
    })
    private Money balanceAfter;

    @Column(name = "merchant_id", length = 50)
    private String merchantId;

    @Column(name = "idempotency_key", length = 100, unique = true)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public static Transaction charge(Long accountId, Money amount,
                                     Money balanceAfter, String idempotencyKey) {
        if (accountId == null) {
            throw new IllegalArgumentException("accountId는 필수입니다");
        }
        if (amount == null || balanceAfter == null) {
            throw new IllegalArgumentException("amount/balanceAfter는 필수입니다");
        }

        Transaction tx = new Transaction();
        tx.accountId = accountId;
        tx.type = TransactionType.CHARGE;
        tx.amount = amount;
        tx.balanceAfter = balanceAfter;
        tx.idempotencyKey = idempotencyKey;
        tx.status = TransactionStatus.SUCCESS;
        tx.createdAt = OffsetDateTime.now();
        return tx;
    }

    public static Transaction payment(Long accountId, Money amount,
                                      Money balanceAfter, String merchantId,
                                      String idempotencyKey) {
        if (accountId == null) {
            throw new IllegalArgumentException("accountId는 필수입니다");
        }
        if (amount == null || balanceAfter == null) {
            throw new IllegalArgumentException("amount/balanceAfter는 필수입니다");
        }

        Transaction tx = new Transaction();
        tx.accountId = accountId;
        tx.type = TransactionType.PAYMENT;
        tx.amount = amount;
        tx.balanceAfter = balanceAfter;
        tx.merchantId = merchantId;
        tx.idempotencyKey = idempotencyKey;
        tx.status = TransactionStatus.SUCCESS;
        tx.createdAt = OffsetDateTime.now();
        return tx;
    }
}

/*
[주석 목적]
1. 내가 작성한 주석
   - // ──────────────────────────────────────────────────── (구분선)
   - // 정적 팩토리 1: 충전(CHARGE)
   - // 정적 팩토리 2: 결제(PAYMENT)
   - // 1. 검증
   - // 2. 인스턴스
   - // 3. 필드 세팅 (충전이라 merchantId는 null로 둠)
   - // 3. 필드 세팅
   - // CHARGE 또는 PAYMENT 중 어느 것?
   - // 동기 처리라 SUCCESS / FAILED 중 정상 케이스
   - // 4. 반환

2. 오답 수정 및 정리
   - 메서드 헤더 구분선 + "정적 팩토리 1/2" 라벨은 WHAT — 메서드 이름(charge,
     payment)이 이미 충전/결제를 말함. 구분선은 시각적 장식일 뿐 정보 없음. 제거.

   - 단계 번호(1.검증 / 2.인스턴스 / 3.필드 세팅 / 4.반환)는 정적 팩토리 5단계
     스캐폴드를 옮긴 것 — User.register 2차 채점과 동일 패턴. 학습 흐름엔
     유용하지만 운영 코드의 메서드 구조(if문 → new → 대입 → return)는 이미
     자명. 제거 대상.

   - "// 충전이라 merchantId는 null로 둠" — WHAT에 가깝다. charge 시그니처에
     merchantId 파라미터가 없는 것만 봐도 자명. 제거.

   - "// CHARGE 또는 PAYMENT 중 어느 것?" — 스캐폴드에서 자기 자신에게 던진
     선택 질문. 값을 채운 순간 의미 소멸. 운영 코드에 절대 남기면 안 됨.

   - "// 동기 처리라 SUCCESS / FAILED 중 정상 케이스" — 반쪽 WHY. "왜 PENDING이
     없는가"는 가치 있는 정보지만, 그건 TransactionStatus.java 하단 [주석 목적]
     블록에 이미 정리됨. 본 코드에 중복으로 적을 필요 없음.

   - 만약 이 메서드에서 진짜 가치 있는 주석을 적는다면:
     · "balanceAfter는 호출자(서비스)가 차감 후 잔액을 계산해 넘긴다 — 엔티티는
        잔액 계산 책임이 없음. Account.deduct가 잔액을 바꾸고, 그 결과를
        Transaction.payment에 함께 넘기는 게 서비스 책임 분리."
     · "idempotencyKey가 nullable인 이유: 엔티티 레벨에선 옵셔널. 결제 API
        진입점(Controller)에서 헤더 필수 + Redis SETNX로 1차 차단, DB UNIQUE로
        최후 방어 (CLAUDE.md 멱등성 룰, ADR 0008 예정)."
     이런 건 코드만 봐선 모르는 도메인 결정/책임 경계 정보라 가치 있음. 다만
     ADR/가이드로 충분히 커버되므로 코드 안엔 안 넣음.

3. 코드 자체 평가
   - charge/payment 둘 다 정적 팩토리 5단계(검증 → 인스턴스 → 필드 세팅 →
     시간 → 반환) 순서 정확. User.register와 동일한 패턴.

   - 1차 채점에서 지적한 컴파일 에러(`tx.type = CHARGE`) 두 곳 다
     `TransactionType.CHARGE` / `TransactionStatus.SUCCESS`로 정상화. ✅

   - charge/payment 모두 idempotencyKey, merchantId 검증을 의도적으로 생략 —
     컬럼 자체가 nullable이라 엔티티 레벨에선 옵셔널로 둠. 결제 API 단계
     (Step 8)에서 Controller 진입점이 책임지는 구조. 책임 분리 OK.

   - createdAt = OffsetDateTime.now()가 정적 팩토리 안 (CLAUDE.md 시간 룰
     준수). DB DEFAULT에 의존하지 않고 도메인이 시각을 결정.

   - tx.type / tx.status는 enum 타입 한정자(TransactionType., TransactionStatus.)
     붙임 — 같은 패키지여도 enum 상수는 타입명으로 한정해야 컴파일 통과.
     static import는 컨벤션상 미사용 (명료성 우선).

   - charge는 7줄 세팅, payment는 8줄 세팅(merchantId만 차이). 두 메서드의
     중복 비율 높지만 헬퍼 추출 안 함 — User.register 2차 채점 결정과 동일
     기조(반복 4회까지는 인라인 유지가 가독성에 더 좋다).
*/
