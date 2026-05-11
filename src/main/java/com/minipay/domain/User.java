package com.minipay.domain;

import jakarta.persistence.Column;
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
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "pin_hash", nullable = false, length = 255)
    private String pinHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public static User register(String email, String passwordHash,
                                String name, String pinHash) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email은 필수입니다");
        }
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new IllegalArgumentException("passwordHash는 필수입니다");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name은 필수입니다");
        }
        if (pinHash == null || pinHash.isBlank()) {
            throw new IllegalArgumentException("pinHash는 필수입니다");
        }

        User user = new User();
        user.email = email;
        user.passwordHash = passwordHash;
        user.name = name;
        user.pinHash = pinHash;
        user.createdAt = OffsetDateTime.now();
        return user;
    }
}

/*
[주석 목적]
1. 내가 작성한 주석
   - // updatable = false 한 번 저장된 뒤엔 UPDATE에서 절대 안 바뀜
   - // OffsetDateTime이란
   - // java.time.OffsetDateTime — 날짜 + 시간 + UTC 오프셋을 함께 가진 타입.

2. 오답 수정 및 정리
   - 셋 다 WHAT 설명 — 어노테이션/타입의 동작을 한국어로 다시 풀어쓴 것.
     운영 코드의 좋은 주석은 "WHY만, 명백하면 생략" (CLAUDE.md 룰).
     어노테이션 이름(updatable=false)과 타입 이름(OffsetDateTime)이 이미 동작을
     말해주므로 모두 제거 대상.

   - 만약 진짜 가치 있는 주석을 적는다면 결정의 "왜":
     · "LocalDateTime이 아닌 OffsetDateTime인 이유: 사용자/서버 타임존이 다를 수
        있어 오프셋 보존 필요. DB는 TIMESTAMPTZ."
     · "createdAt이 updatable=false인 이유: 정산/감사 추적에서 생성 시각이 사후
        변경되면 안 됨 — 도메인 불변식."
     이런 건 코드에 적힌 것만으로는 모르는 정보라 주석 가치가 있음.

   - 좋은 주석 룰 요약 (CLAUDE.md):
     · 기본은 무주석.
     · WHAT(코드를 한국어로 번역) 금지. 잘 지은 이름이 WHAT을 대신함.
     · WHY가 비자명할 때만 주석 — 숨은 제약, 도메인 불변식, 특정 버그 우회,
       독자가 놀랄 만한 동작.
     · 현재 작업/티켓/호출자 언급 금지 ("issue #123 때문에 추가" 같은 거)
       → PR 설명에 적고 코드는 진화에 맡긴다.

3. 코드 자체 이슈 (주석 외)
   - OffsetDate → OffsetDateTime 오타 수정. 자바 표준에 OffsetDate는 없음.
     자동 import는 "존재하는 심볼"에 대해서만 동작하므로 오타 상태에서는
     IntelliJ가 import를 제안하지 못한다 — 자동 import가 안 됐던 진짜 이유.
   - 누락 import 보충: @Id, @Table, OffsetDateTime.
   - 정적 팩토리 메서드(User.register 등) 미작성 — CLAUDE.md 컨벤션상 필수.
     채점 범위 밖이라 다음 단계에서 추가 예정.

---

2차 채점 — 정적 팩토리 작성

1. 내가 작성한 주석
   - // 1. 검증
   - // 2. 인스턴스
   - // 3. 필드 세팅
   - // 4. 생성 시각
   - // 5. 반환

2. 오답 수정 및 정리
   - 가이드 스켈레톤의 단계 번호를 그대로 코드에 옮김. 학습 흐름 잡을 땐 도움이
     되지만 운영 코드에선 WHAT 주석 — 코드 구조(검증 if문들 → new → 필드 대입 →
     return)가 이미 자명. 익숙해지면 모두 제거 대상이라 이번에 정리.

   - 만약 이 메서드에서 진짜 가치 있는 주석을 적는다면:
     · "비밀번호 해싱은 서비스 레이어 책임. 엔티티는 이미 해시된 값을 받음 —
        그래서 파라미터 이름이 password가 아니라 passwordHash."
     · "검증을 정적 팩토리에서만 하는 이유: JPA가 DB 조회 시 리플렉션으로
        기본 생성자를 호출하므로, 생성자에 검증을 넣으면 조회만 해도 터짐."
     이런 건 구조만 봐선 모르는 정보라 주석 가치 있음. 다만 둘 다 가이드 문서로
     충분하므로 코드에는 안 넣음.

3. 코드 자체 평가
   - 검증 → 인스턴스 → 세팅 → createdAt → return 순서 정확. 검증 실패 시
     객체가 만들어지지 않음 → 잘못된 상태의 User 인스턴스 누수 차단.
   - createdAt = OffsetDateTime.now()가 정적 팩토리 안에 있음 (CLAUDE.md 룰).
   - 빈 줄 들쭉날쭉(검증 사이 1줄, 검증/인스턴스 사이 2줄)이라 1줄로 통일.
*/
