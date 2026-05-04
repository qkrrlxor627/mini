package com.minipay.domain;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {


}



// ============================================================
// User.java 작성 가이드 (스텝 1~4)
// 참고: 같은 패키지의 Account.java가 좋은 본보기. 자주 비교하면서 짤 것.
// ============================================================

// ------------------------------------------------------------
// Step 1: import 문 작성
// ------------------------------------------------------------
// 필요한 import (Account.java와 거의 동일, Money/Embedded만 빠짐):
//   - jakarta.persistence.Column
//   - jakarta.persistence.Entity
//   - jakarta.persistence.GeneratedValue
//   - jakarta.persistence.GenerationType
//   - jakarta.persistence.Id
//   - jakarta.persistence.Table
//   - lombok.AccessLevel
//   - lombok.Getter
//   - lombok.NoArgsConstructor
//   - java.time.OffsetDateTime
//
// ↓ 여기에 import 작성


// ------------------------------------------------------------
// Step 2: 클래스 선언 + 어노테이션 4개
// ------------------------------------------------------------
// (a) @Entity
//     이 클래스가 JPA 엔티티(=DB 테이블에 매핑되는 객체)임을 알림
// (b) @Table(name = "?")
//     ? 자리에 실제 테이블명. 자바 클래스명(User)과 테이블명(users)이 다르면 필수.
// (c) @Getter
//     Lombok이 모든 필드의 getter 메서드 자동 생성
// (d) @NoArgsConstructor(access = AccessLevel.PROTECTED)
//     JPA가 리플렉션으로 객체 만들 때 필요한 기본 생성자.
//     PROTECTED라 외부에서 `new User()` 못함 → 정적 팩토리만 입구로 강제
//
// ↓ 여기에 어노테이션 4개 + class 선언


// public class User {

    // --------------------------------------------------------
    // Step 3: 필드 6개 작성
    // --------------------------------------------------------
    // 매핑 규칙: DB 컬럼 snake_case, 자바 필드 camelCase
    //   → 이름 다르면 @Column(name = "...") 으로 명시

    // (1) id : BIGSERIAL → Long
    //     어노테이션: @Id, @GeneratedValue(strategy = GenerationType.IDENTITY)
    //     ↓


    // (2) email : VARCHAR(255) NOT NULL UNIQUE → String
    //     @Column(nullable = false, unique = true, length = 255)
    //     ↓


    // (3) passwordHash : password_hash VARCHAR(255) NOT NULL → String
    //     @Column(name = "password_hash", nullable = false, length = 255)
    //     ↓


    // (4) name : VARCHAR(100) NOT NULL → String
    //     @Column(nullable = false, length = 100)
    //     ↓


    // (5) pinHash : pin_hash VARCHAR(255) NOT NULL → String
    //     @Column(name = "pin_hash", nullable = false, length = 255)
    //     ↓


    // (6) createdAt : created_at TIMESTAMPTZ NOT NULL → OffsetDateTime
    //     @Column(name = "created_at", nullable = false, updatable = false)
    //     updatable = false: 한 번 저장된 뒤엔 UPDATE에서 절대 안 바뀜
    //     ↓


    // --------------------------------------------------------
    // Step 4: 정적 팩토리 메서드
    // --------------------------------------------------------
    // 룰 (CLAUDE.md):
    //   - setter 금지, 정적 팩토리만 노출
    //   - 이름은 도메인 동사 (예: signUp, register, openFor 등)
    //   - 외부 입력 매핑은 from, 단순 변환은 of
    //
    // 받을 인자: email, passwordHash, name, pinHash (전부 String)
    //   ※ 평문 password/pin은 받지 않음 — 해싱은 service 레이어 책임
    //
    // 안에서 할 일:
    //   1. User user = new User();        // PROTECTED 생성자 (같은 클래스라 호출 가능)
    //   2. user.email = email;            // 각 필드에 인자 대입
    //   3. user.passwordHash = ...        // ...
    //   4. user.createdAt = OffsetDateTime.now();
    //   5. return user;
    //
    // 시그니처 힌트:
    //   public static User signUp(String email, String passwordHash,
    //                              String name, String pinHash) { ... }
    //
    // ↓ 여기에 정적 팩토리 작성


// }
