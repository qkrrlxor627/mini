# Swagger 500 → 정상 동작 트러블슈팅 (2026-05-15)

> Step 4 회원가입 API 검증 후 Swagger UI로 수동 테스트 시도 시 발생.
> `springdoc-openapi 2.6.0 + Spring Boot 3.5.14` 호환성 문제가 원인.
> 본 문서는 "증상 → 진단 → 원인 → 해결 → 영구 개선" 흐름을 면접 답변지 포맷으로 정리한다.

---

## 한 줄 결론

**`springdoc-openapi` 버전이 Spring Boot 3.5의 Spring Framework 6.2와 호환되지 않아 OpenAPI JSON 생성 시 예외 → `2.6.0 → 2.8.13` 업그레이드로 해결.** 더불어 `GlobalExceptionHandler.handleUnexpected`가 stacktrace를 삼키고 있어 디버깅이 어려웠고, **`log.error` 한 줄을 영구 추가**해 운영 안전성을 보강.

---

## 증상

1. `.\gradlew bootRun --args='--server.port=8081'` 정상 부팅, `curl POST /api/v1/auth/signup` 4 시나리오 모두 통과.
2. 브라우저로 `http://localhost:8081/swagger` 접속.
3. Swagger UI는 떴으나 화면 상단에 빨간 박스로:
   ```
   Errors
   Fetch error
   response status is 500 /api-docs
   ```
4. 컨트롤러는 멀쩡한데 OpenAPI 명세 JSON만 못 만드는 상황.

---

## 진단

### Step 1 — 응답 본문을 직접 본다

브라우저 에러 메시지만으론 부족. `curl`로 직접 호출.

```powershell
curl.exe -s -i http://localhost:8081/api-docs
```

응답:
```
HTTP/1.1 500
Content-Type: application/json
...

{"errorCode":"INTERNAL_ERROR","message":"예기치 못한 오류가 발생했습니다","timestamp":"..."}
```

### Step 2 — 응답 본문의 정체를 식별

본문 형식이 우리가 만든 **`ErrorResponse` record + `errorCode:"INTERNAL_ERROR"`** 그대로.
→ `GlobalExceptionHandler.handleUnexpected(Exception.class)` fallback이 잡았다는 뜻.
→ 즉 springdoc 내부에서 **`Exception`을 던졌고** 그게 우리 handler까지 도달함.

### Step 3 — 콘솔에 stacktrace가 없다는 사실 자체가 단서

서버 콘솔 로그를 확인했지만 `ERROR` 라인이 안 보임.
→ **이건 우리 fallback이 stacktrace를 안 남기게 짰기 때문**.
```java
// 기존 (문제)
@ExceptionHandler(Exception.class)
public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
    return ResponseEntity.status(500).body(ErrorResponse.of("INTERNAL_ERROR", "..."));
}
```
→ 응답만 가로채고 로그는 안 남김. 미지의 예외 발생 시 디버깅 불가능한 구조.

### Step 4 — 가설: `springdoc 2.6.0 + Boot 3.5.14` 호환성

| 컴포넌트 | 버전 | Spring Framework 호환 |
|---|---|---|
| `springdoc-openapi-starter-webmvc-ui` | **2.6.0** | 6.1.x까지 검증 |
| Spring Boot | **3.5.14** | Spring Framework **6.2.x** 사용 |

→ springdoc 2.6이 알지 못하는 Spring Framework 6.2 클래스 시그니처 변경에 부딪쳐 NPE 또는 `NoSuchMethodError` 류 예외 발생 추정. springdoc은 컨트롤러를 리플렉션으로 스캔해서 OpenAPI 명세를 동적 생성하므로 내부 API 변화에 민감.

---

## 원인 (확정)

**`springdoc-openapi 2.6.0`이 Spring Boot 3.5.14에서 사용하는 Spring Framework 6.2와 호환되지 않음.**
- springdoc 2.6.x 시리즈는 Spring Boot 3.3까지 공식 검증.
- Spring Boot 3.4+ / 3.5+ 사용 시 springdoc 2.7.x 또는 2.8.x 필요.

---

## 해결

### 1. 버전 업그레이드

`build.gradle`:
```diff
- implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0'
+ implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.13'
```

### 2. 재빌드 + 재기동

```powershell
.\gradlew clean compileJava
.\gradlew bootRun --args='--server.port=8081'
```

### 3. 검증

| 경로 | 이전 | 픽스 후 |
|---|---|---|
| `GET /api-docs` | 500 INTERNAL_ERROR | **200** + 정상 OpenAPI 3.1.0 JSON |
| `GET /swagger-ui/index.html` | 200 (UI는 떴지만 명세 못 가져옴) | **200** + UI에서 명세 정상 표시 |
| `POST /api/v1/auth/signup` | 정상 (영향 없음) | 정상 |

OpenAPI JSON에 `paths.["/api/v1/auth/signup"].post` + `components.schemas.SignupRequest/SignupResponse` 자동 생성 확인.

---

## 영구 개선 — fallback 핸들러에 로깅 추가

이번 사건에서 가장 시간 잡아먹은 부분은 **"진짜 예외가 뭔지 모르는 상태"**. 우리 fallback이 stacktrace를 삼키니 콘솔도, 응답 본문도 도움 안 됨. 운영 환경에서 같은 일이 일어나면 진단 자체 불가.

`GlobalExceptionHandler`에 한 줄 추가:

```diff
+ import lombok.extern.slf4j.Slf4j;

+ @Slf4j
  @RestControllerAdvice
  public class GlobalExceptionHandler {

      @ExceptionHandler(Exception.class)
      public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
+         log.error("Unhandled exception", ex);
          return ResponseEntity
                  .status(HttpStatus.INTERNAL_SERVER_ERROR)
                  .body(ErrorResponse.of("INTERNAL_ERROR", "예기치 못한 오류가 발생했습니다"));
      }
  }
```

**원칙**: fallback 핸들러는 응답을 가공해도 **로그는 반드시 남긴다**. 응답은 클라이언트에 안전한 정보만, 로그는 운영자에게 진단 가능한 전체 정보.

> CLAUDE.md "보안" 룰 ("로그에 JWT 토큰/세션 ID/PIN/평문 비번 출력 금지") 위배 우려는 없음 — `ex` 객체 자체엔 사용자 비밀이 없고, 만약 들어간다면 그 핸들러가 따로 잡고 마스킹할 책임.

---

## 학습 메모 / 면접 답변지

### Q1. "Swagger 500 어떻게 디버깅했어요?"

> "응답 본문이 INTERNAL_ERROR로 우리 GlobalExceptionHandler 형식이라 fallback이 삼킨 걸 알았고, 콘솔에 stacktrace가 없다는 사실 자체가 다음 단서였습니다. fallback 핸들러에 로깅이 없어 진단이 어렵다는 점이 본질 문제였고, 영구 개선으로 `log.error` 한 줄 추가했습니다. 근본 원인은 `springdoc 2.6.0`이 Spring Boot 3.5의 Spring Framework 6.2와 호환되지 않은 점이고, 2.8.13으로 올려 해결했습니다."

### Q2. "fallback 핸들러를 만든 이유는?"

> "도메인 예외(`DuplicateEmailException`)와 검증 실패(`MethodArgumentNotValidException`)는 명시 핸들러로 잡지만, 그 외 예측 못한 예외도 응답 형식을 일관되게 유지해야 클라이언트가 통일된 에러 핸들링을 짤 수 있습니다. 다만 fallback은 **반드시 로그를 남겨야** 운영에서 추적 가능합니다. 이번에 그 룰을 어겼다가 한 번 다친 케이스입니다."

### Q3. "왜 의존성 버전을 올리는 게 첫 번째 시도였나요?"

> "Spring Boot 메이저 마이너 버전이 올라가면 내부 Spring Framework 버전이 따라 올라가고, 그러면 리플렉션 기반 라이브러리(springdoc, MapStruct, QueryDSL 등)는 호환성이 깨질 가능성이 큽니다. 의존성 버전과 Spring Boot 버전이 어긋난 상태에서 의문의 500이 나면 호환성부터 의심합니다."

### Q4. "왜 stacktrace 거꾸로 읽나요?"

> "스택 가장 위는 도미노로 무너진 결과고, 진짜 원인은 가장 안쪽 `Caused by`에 있습니다. 위쪽은 `WebServerException → LifecycleException → ...` 식으로 추상화된 wrapper들이라 진단 가치가 낮습니다. SQLState 같은 표준 코드도 같은 원리로 가장 안쪽 코드를 봅니다 (08xxx 연결, 23xxx 무결성, 42xxx 문법)."

### Q5. "버전 충돌이 또 일어나면 어떻게 예방?"

> "(1) Dependabot/Renovate 같은 의존성 업데이트 봇으로 호환 버전 자동 추적, (2) Spring Boot `dependencyManagement` BOM 사용해서 검증된 조합 강제, (3) CI에서 `gradle dependencies --refresh-dependencies`로 transitive 충돌 사전 감지. 학습 프로젝트라 (2)에 가까운 방식이 적합합니다."

---

## 변경된 파일

- `build.gradle` — springdoc 버전 `2.6.0 → 2.8.13`
- `src/main/java/com/minipay/exception/GlobalExceptionHandler.java` — `@Slf4j` + `log.error("Unhandled exception", ex)`

## References

- [springdoc-openapi compatibility matrix](https://springdoc.org/#what-is-the-compatibility-matrix-of-springdoc-openapi-with-spring-boot)
- `CLAUDE.md` "에러 핸들링" 섹션 — `@ControllerAdvice` 일괄 매핑 룰
- `CLAUDE.md` "보안" 섹션 — 로그 출력 금지 항목 (스택트레이스는 비밀 정보 아님, 출력 OK)
- `docs/progress.md` "📚 학습 메모" — 스택트레이스 거꾸로 읽기 / SQLState 코드 분류
