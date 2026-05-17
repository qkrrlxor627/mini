# Step 11 — Swagger E2E 시나리오 12종 검증 (2026-05-18)

> ready.md §4의 골든 패스 6개 + 엣지 케이스 6개를 모두 통과시키는 게 Mini Pay 프로젝트 종결 조건.
> 본 문서는 curl 자동 검증 + Swagger UI 수동 검증 둘 다 가능한 흔적.

---

## 🔑 사전 준비: Swagger UI Bearer 인증

`SwaggerConfig`에 OpenAPI 빈 + `SecurityScheme(type=HTTP, scheme=bearer, bearerFormat=JWT)` 박힘.
Swagger UI(`http://localhost:8080/swagger`)에 들어가면 우측 상단 **Authorize 🔓** 버튼 활성화.
로그인 응답의 `accessToken`을 거기에 한 번 붙여넣으면 protected API 호출 시 자동으로 `Authorization: Bearer ...` 헤더 부착.

---

## ✅ 12종 결과 요약 (curl 자동 검증)

| # | 시나리오 | 기대 | 실제 | 결과 |
|---|---------|------|------|------|
| 1 | Alice signup | 201 | 201 `{userId, email}` | ✅ |
| 2 | Alice login | 200 + JWT | 200 `{accessToken, expiresIn:3600}` | ✅ |
| 3 | charge 10000 | 200 + 잔액 10000 | 200 `balanceAfter=10000.0000` | ✅ |
| 4 | payment 2000 | 200 + 잔액 8000 | 200 `balanceAfter=8000.0000` | ✅ |
| 5 | transfer 3000 → Bob | 200 + 잔액 5000 | 200 `balanceAfter=5000.0000` | ✅ |
| 6 | transactions (Alice) | 200 + 3건 | 200 `totalElements=3` (TRANSFER SENT + PAYMENT SELF + CHARGE SELF) | ✅ |
| 6b | transactions (Bob) | RECEIVED 1건, balanceAfter=null | 200 `direction:RECEIVED, balanceAfter:null` | ✅ |
| 7 | payment 잔액 초과 | 400 INSUFFICIENT_BALANCE | 400 `INSUFFICIENT_BALANCE "잔액이 부족합니다"` | ✅ |
| 8 | payment 동일 Idempotency-Key | 200 + 첫 응답 동일 | 200, 두 응답 `transactionId=927` 일치 | ✅ |
| 9 | transfer 자기 자신 | 400 INVALID_TRANSFER_TARGET | 400 `INVALID_TRANSFER_TARGET "자기 자신에게..."` | ✅ |
| 10 | transfer 잔액 초과 | 400 INSUFFICIENT_BALANCE | 400 `INSUFFICIENT_BALANCE` | ✅ |
| 11 | payment JWT 누락 | 401 | 401 `UNAUTHORIZED "인증이 필요합니다"` | ✅ |
| 12 | signup 중복 이메일 | 409 DUPLICATE_EMAIL | 409 `DUPLICATE_EMAIL "이미 등록된..."` | ✅ |

**결과: 12/12 전부 통과**

---

## 📌 핵심 검증된 보이지 않는 동작

- 시나리오 6에서 **이체 1건이 Alice 시점 SENT + Bob 시점 RECEIVED로 양쪽에 보임** — ADR 0006(단일 행 + counterparty) + Step 9 direction enum 정합.
- 시나리오 6b에서 **수신자 시점 `balanceAfter=null`** — ADR 0006의 "수신자 잔액 행에 없음" 트레이드오프가 응답에 정직 표현.
- 시나리오 8에서 **두 응답의 `transactionId`가 동일** (927) — ADR 0010의 idempotent replay 동작 실증.
- 시나리오 11에서 **401 UNAUTHORIZED** — ADR 0008의 `JwtAuthenticationEntryPoint`가 403이 아닌 401로 명시 응답.
- 시나리오 12에서 **DUPLICATE_EMAIL 메시지에 이메일 그대로 노출**되지만 비밀번호/PIN 등 민감 정보는 응답에 없음 — ADR 0007 보안 룰 정합.

---

## 🔐 Swagger UI 수동 검증 가이드

같은 시나리오를 사람이 직접 클릭으로 통과시키는 경로:

1. `http://localhost:8080/swagger` 접속 → Authorize 버튼 확인
2. `POST /api/v1/auth/signup` Try it out → 본문 입력 → 201 확인
3. `POST /api/v1/auth/login` → 200, `accessToken` 복사
4. 우측 상단 **Authorize 🔓** → `Value: <accessToken>` 붙여넣기 → Authorize → Close
5. 이후 `POST /api/v1/accounts/charge`, `/payments`, `/transfers`, `/transactions` 모두 자동으로 Bearer 헤더 부착
6. 엣지 케이스(잘못된 본문/멱등키)도 Try it out에서 직접 입력해보며 응답 코드/본문 관찰

면접관 시연 시 가장 시각적 — Swagger UI가 곧 API 카탈로그 + E2E 실험실.

---

## 🎓 면접 답변지 활용

| 질문 | 답변 출발점 |
|------|------------|
| "이 프로젝트 한 줄 요약" | 결제·이체 학습용. 동시성/멱등성/JWT/이체 모델링 깊이 있게. ADR 11장 + 통합 테스트 3종 + Swagger E2E 12종 |
| "가장 의미 있던 결정은?" | ADR 0011 두 계정 락 정렬 (데드락 회피) + Step 10에서 발견한 JPA 1차 캐시 함정 |
| "가장 어려웠던 버그는?" | TransferService 첫 실행에서 잔액 합 불일치 (17,000 차이). 데드락도 예외도 없음. → JPA 1차 캐시가 PESSIMISTIC_WRITE 무력화. ID projection으로 해결 |
| "테스트는 어떻게?" | 단위 테스트 + 동시성/멱등성은 `@SpringBootTest` 통합 (실제 DB/Redis) + Swagger E2E 12종 |
| "API 명세는?" | Swagger UI (`/swagger`) + ready.md API 명세 + `docs/swagger-e2e-0518.md` 검증 흔적 |

---

## 📂 관련 파일

- 코드: `src/main/java/com/minipay/config/SwaggerConfig.java`
- 설정: `application.yml` (`springdoc.swagger-ui.path: /swagger`, `api-docs.path: /api-docs`)
- 명세: `docs/ready.md` §4 시나리오 12종 / §5 API 명세
- ADR: `docs/adr/0001~0011` (전체 결정 11장)
- 통합 테스트: `src/test/java/com/minipay/service/ConcurrencyTest.java` (Step 10)
