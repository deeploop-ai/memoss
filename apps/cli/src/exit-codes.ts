export const ExitCode = {
  SUCCESS: 0,
  USER_ERROR: 1,
  RUNTIME_ERROR: 2,
  AGENT_INCOMPLETE: 3,
  LINT_ERRORS: 4,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
