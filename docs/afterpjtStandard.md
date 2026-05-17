# 다음 백엔드 프로젝트 표준 가이드 — Mini Pay 회고 + 업계 표준 보강

> **출처**: Mini Pay 학습 프로젝트(Spring Boot + PostgreSQL + Redis, Step 0~11) 완주 후 회고를 일반화하고, 업계 표준 라이프사이클(요구사항 → API-First → CI/CD/관측성 → 테스트 동행)에서 빠졌던 7개를 보강한 v2.
>
> **사용법**: 다음 백엔드 프로젝트(팀 프로젝트·실서비스) 시작 시 이 문서를 펴서 "지금 Phase 어디고 다음에 뭘 만들지" 즉시 파악. 각 Phase가 끝날 때마다 체크리스트로 회귀.
>
> **참조 표준**: 12-Factor App, DDD (Eric Evans), ADR (Michael Nygard), "Accelerate" (Forsgren), Spring Boot 공식 가이드, OWASP.

---

## 적용 도메인 가이드 (먼저 읽을 것)

이 가이드는 **동시 변경 자원 / 외부 콜백 재시도 / 금전·한정 자원** 중 하나라도 있는 도메인을 가정한다. 그 외 도메인은 Phase 3-3·3-4를 스킵하거나 단순 CRUD로 갈아끼울 것.

| 프로젝트 유형 | 적합도 | 사용 방법 |
|---|---|---|
| 결제/금융/포인트/송금 | ⭐⭐⭐⭐⭐ | 그대로 |
| 이커머스 (재고/주문) | ⭐⭐⭐⭐ | Phase 3 락·멱등성 그대로 |
| 예약 (좌석/슬롯/티켓팅) | ⭐⭐⭐⭐ | Phase 3-2 락 강조 |
| 쿠폰/이벤트/한정 발급 | ⭐⭐⭐⭐ | Phase 3-2·3-3 핵심 |
| 매칭/채팅 | ⭐⭐⭐ | Phase 3-4 양쪽 락 활용 |
| SNS/게시판/블로그 | ⭐⭐ | Phase 3-3·3-4 스킵, 캐시·페이지네이션 중심 |
| 관리자 대시보드 | ⭐⭐ | CRUD 중심, Phase 3 단순화 |
| 챗봇/검색/추천/ML 파이프라인 | ⭐ | 가이드 범위 밖, 비동기·캐시·파이프라인 별도 설계 |

---

## 큰 흐름 한눈에

```
Phase -1: 요구사항·도메인 이해 (1~2일)  →  유스케이스·용어집·핵심 시나리오
Phase 0:  환경 + CI/CD + 로깅       (2~3일) →  부팅되는 깡통 + 자동 빌드/테스트 + 구조화 로그
Phase 1:  데이터 모델 (+ 단위 테스트) (3~5일) →  스키마·엔티티·VO·도메인 테스트
Phase 2 시작: OpenAPI Contract-First (반나절) → API 스펙 먼저
Phase 2:  인증/인가                  (3~4일) →  회원가입·로그인·JWT 필터
Phase 3:  핵심 비즈니스              (1~2주) →  주력 API + 트랜잭션·락·멱등성 (도메인 따라)
Phase 4:  부수 기능                  (3~5일) →  조회·페이지네이션·이벤트
Phase 5:  통합 테스트 + 관측성 + 문서 (3~5일) →  동시성 검증 + Prometheus/Sentry + Swagger E2E
```

각 Phase는 이전 Phase가 끝나야 시작 가능. 건너뛰면 뒤에서 2배로 갚는다.

---

## Phase −1 — 요구사항·도메인 이해

**목표**: 코드 한 줄 쓰기 전에 "누가, 왜 쓰는가"와 "도메인 용어"를 합의한다.

| 만들 것 | 산출물 |
|---|---|
| 핵심 액터·유스케이스 | 1~2페이지 문서 (사용자 / 관리자 / 외부 시스템) |
| 도메인 용어집 (Glossary) | "주문 vs 결제 vs 거래" 같은 단어 정의 |
| 골든 패스 시나리오 3~5개 | "회원가입 → 로그인 → 핵심 작업" 흐름 텍스트 |
| 비기능 요구사항 | 동시 사용자 수·응답 시간·데이터 보관 기간 등 |
| 이벤트 스토밍 (선택) | 포스트잇 시뮬레이션, 도메인 이벤트 추출 |

**왜 필요한가**: 엔티티 설계가 도메인 용어와 다르면 **Phase 1~3을 다 갈아엎게 됨**. 학습 프로젝트에선 도메인이 자명해 생략 가능했지만, 팀 프로젝트에선 이 단계 없이 코딩 시작 = 재작업 예약.

**참조 방법론**: Event Storming (Alberto Brandolini), DDD Strategic Design.

---

## Phase 0 — 환경 세팅 + CI/CD + 로깅

**목표**: 빈 프로젝트가 부팅되고, 푸시할 때마다 자동 빌드/테스트가 돌고, 구조화 로그가 찍힌다.

### 0-1. 인프라/빌드
| 만들 것 | 도구 / 파일 |
|---|---|
| 의존성·인프라 컨테이너 정의 | `docker-compose.yml` (DB + Redis/캐시) |
| 빌드 도구 + 의존성 | `build.gradle` 또는 `pom.xml` |
| 애플리케이션 설정 | `application.yml` (`open-in-view: false`, `ddl-auto: validate` 고정) |
| 비밀값 분리 | `.env` + `${VAR:default}` 패턴 |
| 환경 프로파일 분리 | `application-{local,dev,prod}.yml` + `SPRING_PROFILES_ACTIVE` |

### 0-2. CI/CD 파이프라인 (반나절)
- GitHub Actions `.github/workflows/build.yml` 1개 — push/PR 시 `./gradlew build` 자동.
- 메인 브랜치 보호 규칙 (PR 머지 시 CI 통과 필수).
- 이거 하나로 "메인이 깨진 채 머지"가 원천 차단됨.

### 0-3. 로깅 / 헬스체크 (반나절)
- `spring-boot-starter-actuator` 의존성 — `/actuator/health` 노출.
- Logback JSON encoder (또는 `logstash-logback-encoder`) — 운영에서 로그 파싱·검색이 표준.
- Trace ID 필터 (`MDC` + `X-Request-Id` 헤더) — 요청 하나가 로그 어디서 어떻게 흐르는지 추적.
- 로그 레벨 표준화: DEBUG / INFO / WARN / ERROR.

**검증**: 빈 컨트롤러 + `curl localhost:8080/actuator/health` 200 + GitHub Actions 빌드 녹색.

**핵심 결정 후보(ADR)**: ORM(JPA vs MyBatis), 빌드 도구, Java 버전, 로깅 포맷, CI 도구.

---

## Phase 1 — 데이터 모델 (스키마 + 엔티티 + 단위 테스트)

**목표**: DB 스키마와 도메인 객체가 1:1로 맞고, `ddl-auto: validate`로 부팅 시 정합성 검증되며, 도메인 메서드는 단위 테스트로 보호된다.

### 1-1. 마이그레이션 도구 + V1 스키마
- Flyway/Liquibase. 단방향 정책 (V1 절대 수정 금지).
- V1에 핵심 테이블 3~5개. PK/FK/UNIQUE/CHECK/NOT NULL 다 박을 것.
- 금액 `NUMERIC(N,4)`, 시간 `TIMESTAMPTZ`, ID `BIGSERIAL` 타입 선택을 일찍 결정.

### 1-2. 도메인 엔티티 + Value Object
- `@NoArgsConstructor(PROTECTED)`, setter 금지, 정적 팩토리만 노출.
- 정적 팩토리 이름은 도메인 동사 (`User.register`, `Order.place`).
- 검증 → `new` → 필드 → 시간 → return 5단계.
- VO는 식별자 없고 값으로 동일성 (Money, Email, Address).
- enum은 `@Enumerated(EnumType.STRING)` 무조건.

### 1-3. 도메인 예외 클래스
- `InsufficientBalanceException` 같이 이름이 의미를 가진 예외.
- 익명 `RuntimeException` 던지지 말 것.

### 1-4. 도메인 단위 테스트
- 각 엔티티 핵심 메서드 1~2개씩 JUnit 테스트.
  - `AccountTest.deduct_잔액부족시_InsufficientBalanceException_던진다`
  - `MoneyTest.add_다른통화면_예외`
  - `User.register_이메일형식_검증`
- 외부 의존 없는 순수 단위 테스트 → 빠르고 회귀 잡기 좋음.
- 이 테스트가 Phase 3 동시성 테스트 비용을 줄여줌.

### 1-5. 빌드 검증
- `./gradlew clean test build` → Hibernate validate + 도메인 테스트 둘 다 통과.

**핵심 결정 후보(ADR)**: VO 도입 / Enum 매핑 / 정적 팩토리 vs Builder / 마이그레이션 정책 / 애그리거트 경계.

---

## Phase 2 시작 — OpenAPI Contract-First (반나절)

**목표**: 인증 API를 짜기 전에 API 스펙(OpenAPI YAML)을 먼저 합의한다. 프론트가 같은 시점에 mock 서버로 개발 시작 가능.

- `docs/openapi.yaml` 또는 `src/main/resources/openapi/api.yaml` — 핵심 엔드포인트 6~10개 정의.
- 요청/응답 스키마 + 에러 코드 미리 정의.
- `springdoc-openapi`로 코드와 동기화 검증 (또는 `swagger-codegen`으로 stub 생성).
- 프론트와 1시간 회의로 합의 → 이후 변경은 PR 리뷰.

**왜 먼저인가**: 코드부터 짜고 Swagger를 마지막에 뽑으면, 프론트는 백엔드 완성까지 대기. Contract-First면 병행 개발 가능. 표준 백엔드 워크플로의 합의된 best practice.

---

## Phase 2 — 인증/인가

**목표**: 회원가입·로그인이 동작하고, 보호된 API는 JWT 없이는 401.

### 2-1. 회원가입 API
- Repository: `existsByEmail`, `findByEmail`.
- DTO: `record` + `jakarta.validation`.
- Service: `@Transactional` + BCrypt 해싱. 같은 트랜잭션에서 부수 리소스 생성.
- Controller: `POST /api/v1/auth/signup`, 201 Created.
- `GlobalExceptionHandler`(`@ControllerAdvice`)에서 도메인 예외 → HTTP 매핑.
- 임시 SecurityConfig: `csrf disable` + STATELESS + `/api/v1/auth/**` permitAll.
- 컨트롤러 슬라이스 테스트 (`@WebMvcTest`) 1~2건.

### 2-2. JWT 토큰 발급/검증 필터
- `JwtTokenProvider` (HS256, `sub=userId`, 만료 클레임).
- `JwtAuthenticationFilter` (`OncePerRequestFilter`).
- `JwtAuthenticationEntryPoint` (401 + JSON 에러).
- SecurityConfig 확장: `addFilterBefore` + `exceptionHandling`.

### 2-3. 로그인 API
- `InvalidCredentialsException`으로 "이메일 없음" vs "비번 틀림" 응답 통일.
- Service는 `readOnly = true`.

### 2-4. 검증 (curl 시나리오)
- 정상 가입 201 / 중복 이메일 409 / 검증 실패 400 / 로그인 200 + JWT / 잘못된 비번 401 / 없는 이메일 401(동일) / 토큰 없는 protected API 401.

**핵심 결정 후보(ADR)**: 인증 방식(JWT stateless vs 세션), Refresh Token 도입/미도입, 에러 응답 포맷, 비밀번호 해싱.

---

## Phase 3 — 핵심 비즈니스 로직

**목표**: 프로젝트의 "왜 존재하는가"에 해당하는 주력 기능. 여기서 트랜잭션·락·멱등성이 다 등장.

> 이 Phase는 **기능 1개씩** [Repository → DTO → Service → Controller → curl/통합 검증] 5단계 사이클.

### 3-1. 단순 변경 API (락 없이 충분한 것부터)
- 예: 프로필 수정, 게시글 작성.
- `@Transactional` 기본 + Bean Validation.
- 외부 I/O는 트랜잭션 밖으로.

### 3-2. 동시 변경 위험 있는 API → 비관적 락 (**해당 도메인일 때만**)
- 적용 도메인: 재고 차감 / 좌석 예약 / 쿠폰 발급 / 잔액 변경 / 한정 자원 점유.
- 비적용 도메인 (SNS·블로그·관리자 도구): 이 단계 스킵 또는 단순 UPDATE.
- `@Lock(LockModeType.PESSIMISTIC_WRITE)` + 별도 Repository 메서드 (`findByIdForUpdate`).
- 트랜잭션 안에서 외부 호출 절대 금지.

### 3-3. 중복 요청 방지 → 멱등성 (**해당 도메인일 때만**)
- 적용 도메인: 결제 / 송금 / 알림 발송 / 외부 콜백 수신 / 재시도 가능 클라이언트.
- 비적용 도메인: 일반 CRUD, 게시판 — PUT의 자연 멱등성으로 충분.
- 이중 방어: Redis SETNX(빠른 1차) + DB UNIQUE 제약(최후 방어선).
- `Idempotency-Key` 헤더 의무화.
- DB UNIQUE violation은 `DataIntegrityViolationException` self-heal로 잡아서 기존 결과 반환.
- TTL 10분 디폴트.

### 3-4. 다중 자원 동시 변경 → 락 획득 순서 표준화 (**해당 도메인일 때만**)
- 적용 도메인: 이체(두 계정) / 매칭(두 사용자) / 그룹 예약.
- 비적용 도메인 — 단일 자원만 만지는 모든 케이스는 이 단계 불필요.
- 데드락 회피: 자원 ID 오름차순으로 정렬 후 락 획득.
- ⚠️ JPA 1차 캐시 함정: 같은 트랜잭션에서 비락 조회 후 락 조회 시 캐시 hit으로 `SELECT FOR UPDATE` 미발동. 락 대상은 ID projection으로만.

### 3-5. ADR 1장씩
- "왜 비관적 락인가" "왜 SETNX+UNIQUE 둘 다인가" "왜 ID 정렬인가".
- 면접 답변지의 본체이자 신입 합류 시 1페이지 설명서.

---

## Phase 4 — 부수 기능 (조회/이벤트)

**목표**: 핵심 비즈니스를 둘러싼 보조 기능. 안정된 구조 위에 얹기만.

### 4-1. 조회 API + 페이지네이션
- 공용 `PageResponse<T>` record.
- Repository에 `Page<T>` 반환 메서드.
- 입력 검증: `page >= 0`, `size 1~100`.
- 조회는 `@Transactional(readOnly = true)`.
- 정렬·필터는 `Sort` 파라미터로.

### 4-2. 응답 DTO 정적 팩토리
- `XxxResponse.from(entity)` 또는 `from(entity, context)`.
- 예: 거래내역에서 "내 시점"에 따라 SENT/RECEIVED 분기.

### 4-3. 이벤트 기반 부수 작업 (선택)
- 결제 성공 후 알림/포인트/통계 → `@TransactionalEventListener(phase = AFTER_COMMIT)`.
- 트랜잭션과 분리해 락 점유 시간 최소화.

---

## Phase 5 — 통합 테스트 + 관측성 + 알람 + 문서화

**목표**: 동시성 함정을 잡고, 실서비스 운영 가능한 관측성을 갖추고, API 명세를 외부에 공개한다.

### 5-1. 동시성 통합 테스트 (**Phase 3-2~3-4 적용한 경우만 필수**)
- `@SpringBootTest` + 실제 DB/Redis.
- 테스트 메서드에 `@Transactional` 절대 금지 (롤백 자동화가 동시성 깸).
- 시나리오 3종:
  1. 같은 자원 100건 동시 변경 → 정합성 (락 검증)
  2. 같은 멱등키 N번 동시 호출 → 한 번만 실행
  3. 두 자원 양방향 동시 작업 → 데드락/누락 없는지
- 여기서 못 잡는 버그는 운영에서 잡는다. 운영 비용은 1000배.

### 5-2. 관측성 (Observability)
- **메트릭**: Actuator + Micrometer + Prometheus exporter — `/actuator/prometheus`로 메트릭 노출.
  - 핵심 메트릭: 요청 수, 응답 시간 p50/p95/p99, 에러율, DB 커넥션 풀 사용량.
- **로그**: Phase 0의 구조화 로그를 ELK/Loki/CloudWatch 등으로 수집 (운영 환경).
- **트레이싱(선택)**: OpenTelemetry — 분산 환경이면 필수, 모놀리식이면 선택.

### 5-3. 에러 알람
- Sentry 또는 Slack webhook — 5xx 에러 + 도메인 critical 예외 발생 시 즉시 알람.
- 에러 코드 체계 (`AUTH_001` 같이) — 운영팀이 빠르게 분류.
- 사용자 메시지 vs 개발자 메시지 분리 — 응답엔 사용자용, 로그엔 개발자용.

### 5-4. Swagger / OpenAPI 최종화
- Phase 2 시작 때 만든 스펙과 실제 코드 동기화 검증.
- `SecurityScheme` Bearer 등록 → Authorize 버튼으로 모든 protected API에 토큰 자동 부착.
- E2E 시나리오 자동화: `signup → login → 핵심API → 조회` 스크립트.
- 엣지 케이스 6~10개 자동 검증.

### 5-5. 문서 자산
- `docs/progress.md`: 단계별 진행 상황.
- `docs/adr/`: 결정 기록.
- `README.md`: 부팅 방법 + 핵심 결정 4~5개 한 줄 요약 + 아키텍처 다이어그램.
- `docs/runbook.md`: 운영 중 자주 일어나는 사고 대응 절차 (DB 커넥션 고갈/Redis 장애/JWT 키 노출 등).

---

## 매 단계 진입 전 체크리스트

새 Step 들어갈 때마다 30초 자문:

1. 이전 Step의 빌드/테스트가 다 통과하는가? (안 통과하면 새 일 더하지 말 것)
2. 이번 Step에 새로 등장하는 결정이 N개? N=0이면 컨벤션, N≥1이면 짧게 토론 + ADR.
3. 이번 Step의 검증 방법(curl/테스트)을 미리 적었는가? "끝났다"의 정의가 있어야 끝남.
4. 이번 작업이 트랜잭션에 영향 주는가? Y면 락·격리수준·외부 I/O 분리 확인.
5. 이번 작업이 외부 입력을 받는가? Y면 Bean Validation + DB 제약 둘 다.
6. 이번 변경의 메트릭/로그가 운영에서 보이는가? Y면 Phase 5의 메트릭 항목에 추가.

---

## 자주 빠지는 함정 모음

| 함정 | 증상 | 예방 |
|---|---|---|
| `LocalDateTime` 사용 | 시간대 사고, 서버 이전 시 폭발 | `OffsetDateTime` + `TIMESTAMPTZ` |
| 금액에 `double` | 0.1+0.2=0.30000004 | `BigDecimal` + VO + `NUMERIC(19,4)` |
| `@Enumerated` 누락 | DB에 0/1/2 저장 → enum 순서 바뀌면 데이터 손상 | `EnumType.STRING` 무조건 |
| 컨트롤러에서 엔티티 직접 리턴 | N+1, 순환 직렬화, 내부 구조 노출 | DTO record 변환 |
| 트랜잭션 안 외부 I/O | 락 점유 길어짐, 롤백 어려움 | `@TransactionalEventListener(AFTER_COMMIT)` |
| JPA 1차 캐시로 락 무력화 | `SELECT FOR UPDATE` 발동 안 함 | 락 대상은 ID projection으로만 |
| 통합 테스트에 `@Transactional` | 자동 롤백이 동시성 깸 | 떼고 setup/teardown 수동 |
| Flyway down으로 회복 | 운영 시뮬레이션 박살 | V_n 추가만, V1 절대 수정 X |
| 로그인 실패 메시지 분기 | "이메일 없음/비번 틀림" 노출 → 계정 열거 | 통합된 `InvalidCredentialsException` |
| Idempotency-Key 단일 방어 | Redis 장애 시 이중 처리 | Redis SETNX + DB UNIQUE 이중 |
| 비밀번호·JWT 키 코드에 박음 | 깃 노출 사고 1순위 | `.env` + `${VAR}`, 운영은 비밀 관리 서비스 |
| 로그에 토큰/PIN/비번 평문 | 사고 시 책임 추적 + 컴플라이언스 위반 | 로그 마스킹 필터 |
| 헬스체크 = `/health` 200만 | 실제로는 DB 끊겨도 200 | Actuator `/actuator/health`의 DB·Redis indicator 사용 |
| 메인 브랜치 직접 푸시 | 깨진 코드 머지 | 브랜치 보호 + PR + CI 통과 강제 |

---

## 결정 기록(ADR) 습관

`docs/adr/0001-<제목>.md` 형식. 6섹션 고정 (Michael Nygard 원본):

1. **Status** — Accepted / Superseded / Deprecated
2. **Context** — 어떤 상황·제약 때문에 결정이 필요한가
3. **Decision** — 무엇을 결정했는가 (한 문장)
4. **Rationale** — 대안과 비교, 왜 이걸 골랐나
5. **Consequences** — 좋은 결과 / 감수해야 할 결과
6. **References** — 코드 위치, 외부 문서

매 ADR이 그대로 면접 답변 1개 + 신입 합류 시 1페이지.

---

## 일반 프로젝트별 매핑 예시

| 프로젝트 | Phase 3-2 락 자원 | Phase 3-3 멱등성 대상 | Phase 3-4 다중 자원 |
|---|---|---|---|
| 이커머스 | 재고 차감 | 주문 생성 | 다중 상품 동시 주문 |
| 예약 시스템 | 좌석/슬롯 | 예약 요청 | 그룹 예약 |
| 게시판 | (해당 없음) | (해당 없음) | (해당 없음) |
| 송금/포인트 | 잔액 | 송금 요청 | 양방향 송금 |
| 쿠폰/이벤트 | 발급 카운트 | 발급 요청 | (보통 없음) |
| 매칭/채팅 | 매칭 슬롯 | 매칭 요청 | 양쪽 사용자 동시 락 |

각 칸이 비어 있다면 그 Phase는 그 프로젝트엔 불필요.

---

## 추가 학습 후보 (이 가이드 다음 단계)

- **Outbox 패턴**: 결제 성공 → 외부 알림을 DB 안 메시지 테이블에 적고 워커가 발사 (트랜잭션 안 외부 I/O 룰 + at-least-once 동시 달성).
- **Saga 패턴**: 여러 서비스 걸친 트랜잭션 (보상 트랜잭션).
- **분산 락 / Redisson**: 단일 DB 전제가 깨질 때.
- **CQRS / Event Sourcing**: 조회·쓰기 모델 분리. 트래픽 차원이 다를 때.
- **Feature Flag**: 배포 ≠ 노출 분리 (LaunchDarkly, GrowthBook).
- **부하 테스트**: k6 / Gatling / JMeter — 동시성 100건이 아니라 10000건일 때 안 깨지나.
- **카오스 엔지니어링**: Redis kill / DB 지연 주입 / 네트워크 단절 시 시스템 거동.

---

## 검증 방법 (이 가이드 자체의)

다음 프로젝트에서 이 가이드를 따라 진행할 때:

1. Phase −1~1 단계까지 1주 내 도달 → 초반 부담 적정.
2. Phase 0의 CI/CD가 첫 PR부터 작동 → 자동화 기반 완료.
3. Phase 2 시작 시 OpenAPI 스펙이 프론트와 합의됨 → Contract-First 정착.
4. Phase 3 진입 시 ADR 작성이 자연스러운가 → 결정 토론 습관.
5. Phase 5 동시성 테스트에서 새로운 함정 1개 이상 발견 → 통합 테스트가 일을 한다는 신호.
6. 프로젝트 끝나고 README + ADR + Swagger + 메트릭 대시보드 4개로 외부인이 1시간 내 이해 가능.

이 6개가 충족되면 이 가이드는 그 프로젝트에서도 유효. 안 되면 가이드를 수정.

---

## 핵심 파일 참조 (Mini Pay에서 — 패턴 베끼기용)

- 정적 팩토리 패턴: `src/main/java/com/minipay/domain/User.java`, `Account.java`, `Transaction.java`
- Money VO: `src/main/java/com/minipay/domain/Money.java`, `Currency.java`
- 비관적 락 + ID projection: `src/main/java/com/minipay/repository/AccountRepository.java`
- 멱등성 이중 방어: `src/main/java/com/minipay/service/PaymentService.java`, `IdempotencyStore.java`
- 락 정렬: `src/main/java/com/minipay/service/TransferService.java`
- JWT 필터: `src/main/java/com/minipay/security/JwtAuthenticationFilter.java`
- GlobalExceptionHandler: `src/main/java/com/minipay/exception/GlobalExceptionHandler.java`
- 동시성 테스트: `src/test/java/com/minipay/service/ConcurrencyTest.java`
- Swagger 설정: `src/main/java/com/minipay/config/SwaggerConfig.java`
- 마이그레이션: `src/main/resources/db/migration/V*.sql`
- ADR 11장: `docs/adr/`
- 컨벤션: `CLAUDE.md`

---

## v1 → v2 변경 이력

v1 (Mini Pay 회고만)에서 v2(표준 보강)로 추가된 7개:

1. **Phase −1 신설** — 요구사항·유스케이스·도메인 용어집.
2. **Phase 0에 CI/CD** — GitHub Actions 빌드/테스트 자동화.
3. **Phase 0에 로깅/관측성 기반** — 구조화 로그·Trace ID·Actuator 헬스체크.
4. **Phase 1에 단위 테스트** — 도메인 메서드 JUnit.
5. **Phase 2 시작에 OpenAPI Contract-First** — API 스펙 먼저.
6. **Phase 3-2~3-4에 "해당 도메인일 때만" 명시** — 결제 도메인 편향 완화.
7. **Phase 5에 관측성 + 알람** — Prometheus·Sentry·에러 코드 체계·runbook.

또한 §"적용 도메인 가이드" 표 신설 — 가이드가 만능이 아니라 동시성/금전/외부콜백 도메인 최적화임을 명시.
