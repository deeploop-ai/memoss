import { consola } from 'consola';
import { MemossError } from '@memoss/core';
import { ExitCode, type ExitCodeValue } from '../exit-codes.js';

export function handleCommandError(error: unknown): never {
  if (error instanceof MemossError) {
    consola.error(`[${error.code}] ${error.message}`);
    const code = mapMemossErrorToExit(error);
    process.exit(code);
  }

  if (error instanceof Error) {
    consola.error(error.message);
    process.exit(ExitCode.RUNTIME_ERROR);
  }

  consola.error(String(error));
  process.exit(ExitCode.RUNTIME_ERROR);
}

function mapMemossErrorToExit(error: MemossError): ExitCodeValue {
  switch (error.code) {
    case 'VAULT_NOT_FOUND':
    case 'OKF_VALIDATION_ERROR':
    case 'POLICY_VIOLATION':
      return ExitCode.USER_ERROR;
    case 'MISSING_API_KEY':
    case 'GIT_ERROR':
    case 'FETCH_ERROR':
    case 'SOURCE_ERROR':
    case 'OKF_DOCUMENT_ERROR':
      return ExitCode.RUNTIME_ERROR;
    case 'AGENT_INCOMPLETE':
      return ExitCode.AGENT_INCOMPLETE;
    default:
      return ExitCode.RUNTIME_ERROR;
  }
}

export function logAgentStep(toolName: string, input: unknown): void {
  consola.info(`→ ${toolName}`, input ?? '');
}
