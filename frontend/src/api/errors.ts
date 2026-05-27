export interface ApiErrorBody {
  errorCode: string;
  message: string;
  timestamp: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

// errorCode → 사용자 노출 메시지. message 텍스트가 아니라 errorCode로 분기.
// MISSING/CONFLICT 는 프론트 버그라 일반 메시지(원인 비노출) + 콘솔 로깅.
const UI_MESSAGE: Record<string, string> = {
  DUPLICATE_EMAIL: '이미 가입된 이메일입니다',
  VALIDATION_FAILED: '입력값을 확인해주세요',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해주세요',
  UNAUTHORIZED: '로그인이 필요합니다',
  ACCOUNT_NOT_FOUND: '계좌를 찾을 수 없습니다',
  INSUFFICIENT_BALANCE: '잔액이 부족합니다',
  INVALID_TRANSFER_TARGET: '자기 자신에게는 이체할 수 없습니다',
  INVALID_ARGUMENT: '요청 값을 확인해주세요',
  NOT_FOUND: '요청한 정보를 찾을 수 없습니다',
  MISSING_IDEMPOTENCY_KEY: '잠시 후 다시 시도해주세요',
  IDEMPOTENCY_KEY_CONFLICT: '잠시 후 다시 시도해주세요',
  INTERNAL_ERROR: '잠시 후 다시 시도해주세요',
};

// 클라 측 버그 신호 — 사용자에게 원인 노출 금지, 로깅만.
const CLIENT_BUG_CODES = new Set(['MISSING_IDEMPOTENCY_KEY', 'IDEMPOTENCY_KEY_CONFLICT']);

export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (CLIENT_BUG_CODES.has(error.errorCode)) {
      console.error('[frontend bug] idempotency contract violated:', error.errorCode, error.message);
    }
    return UI_MESSAGE[error.errorCode] ?? '오류가 발생했습니다. 다시 시도해주세요';
  }
  return '네트워크 오류입니다. 연결을 확인해주세요';
}
