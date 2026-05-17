package com.minipay.domain;

public enum TransactionStatus {
    SUCCESS, FAILED
}

/*
[주석 목적]
1. 내가 작성한 주석
   - (없음 — 의도적으로 0개)

2. 평가
   - 주석 0개가 정답.
   - enum 이름(TransactionStatus) + 값 이름(SUCCESS/FAILED)이 자명.
   - CLAUDE.md "WHAT 금지, WHY만, 명백하면 생략" 원칙에 부합.

3. 좋은 주석 룰
   - 이름이 의도를 다 설명하면 주석 안 쓴다.
   - 굳이 쓴다면 "왜 SUCCESS/FAILED만 있고 PENDING은 없나" 같은 결정 배경 — 그건 주석보다 ADR이 적합.

4. 면접 답변용 메모
   Q1. "거래 상태를 왜 enum으로? String이 아니라?"
       → ① 컴파일 타임 안전성 (오타 시 컴파일 에러)
          ② IDE 자동완성
          ③ switch 문에서 누락 케이스 경고
          ④ 가능한 값 집합이 코드에 명시 → 문서화 효과
       String이면 "Success", "success", "SUCCESS" 다 다른 값으로 들어와 데이터 오염.

   Q2. "왜 PENDING을 지금 안 넣었나?"
       → YAGNI (You Aren't Gonna Need It).
          현재 결제 흐름은 동기 처리(요청 → 비관적 락 → 즉시 응답)라 PENDING 상태가 존재할 시간이 없음.
          외부 PG 연동(비동기 콜백)이 들어오면 그때 V_n 마이그레이션으로 추가.

   Q3. "엔티티에서 @Enumerated(EnumType.STRING) 안 붙이면?"
       → 디폴트가 ORDINAL. SUCCESS=0, FAILED=1로 DB에 저장됨.
          나중에 enum 순서를 바꾸거나 PENDING을 SUCCESS와 FAILED 사이에 끼우면 → 기존 데이터 의미가 깨짐 (SUCCESS였던 row가 PENDING으로 해석됨).
          그래서 CLAUDE.md에 "STRING 무조건"으로 못박혀 있음.
*/
