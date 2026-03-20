export const ERROR_CODES = [
  "UNSUPPORTED_FILE_TYPE",
  "FILE_TOO_LARGE",
  "INVALID_EXCEL_FILE",
  "EMPTY_WORKBOOK",
  "FILE_NOT_FOUND",
  "SHEET_NOT_FOUND",
  "INVALID_LIMIT",
  "EMPTY_USER_REQUEST",
  "INVALID_AI_RESPONSE",
  "INVALID_AI_PLAN",
  "UNKNOWN_OPERATION",
  "COLUMN_NOT_FOUND",
  "AI_REQUEST_FAILED",
  "TASK_NOT_FOUND",
  "OUTPUT_NOT_FOUND",
  "EXPORT_FAILED",
  "INTERNAL_SERVER_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
