export interface PolicyWarning {
  code: string;
  message: string;
}

export interface PolicyCheckResult {
  warnings: PolicyWarning[];
}
