// 백엔드 거래 도메인 타입 (M2에서 OpenAPI 생성 타입으로 대체/정합 예정).
export type TransactionType = 'CHARGE' | 'PAYMENT' | 'TRANSFER';
export type TransactionStatus = 'SUCCESS' | 'FAILED';
export type TransactionDirection = 'SELF' | 'SENT' | 'RECEIVED';

export interface TransactionItem {
  transactionId: number;
  type: TransactionType;
  direction: TransactionDirection;
  amount: number;
  balanceAfter: number | null;
  currency: string;
  merchantId: string | null;
  counterpartyAccountId: number | null;
  status: TransactionStatus;
  createdAt: string;
}
