export type ErrorCode =
  | 'OKF_DOCUMENT_ERROR'
  | 'OKF_VALIDATION_ERROR'
  | 'MISSING_API_KEY'
  | 'VAULT_NOT_FOUND'
  | 'POLICY_VIOLATION';

export class MemossError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MemossError';
  }
}

export class OKFDocumentError extends MemossError {
  constructor(message: string) {
    super('OKF_DOCUMENT_ERROR', message);
    this.name = 'OKFDocumentError';
  }
}

export class OKFValidationError extends MemossError {
  constructor(message: string) {
    super('OKF_VALIDATION_ERROR', message);
    this.name = 'OKFValidationError';
  }
}
