import { z } from "zod";

export const excelRowSchema = z
  .object({
    __rowIndex: z.number().int().nonnegative(),
  })
  .catchall(z.unknown());

export const previewDataSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(excelRowSchema),
  total: z.number().int().nonnegative(),
});

export const trimOperationSchema = z.object({
  type: z.literal("trim"),
  column: z.string().min(1),
});

export const formatNumberOperationSchema = z.object({
  type: z.literal("format_number"),
  column: z.string().min(1),
  digits: z.number().int().min(0).max(10),
});

export const deriveColumnOperationSchema = z.object({
  type: z.literal("derive_column"),
  sourceColumn: z.string().min(1),
  targetColumn: z.string().min(1),
  method: z.enum(["regex", "mapping", "ai_extract"]),
  instruction: z.string().min(1),
});

export const deleteRowsOperationSchema = z.object({
  type: z.literal("delete_rows"),
  condition: z.object({
    column: z.string().min(1),
    operator: z.enum(["is_empty", "equals", "not_equals"]),
    value: z.string().optional(),
  }),
});

export const deduplicateOperationSchema = z.object({
  type: z.literal("deduplicate"),
  column: z.string().min(1),
  keep: z.enum(["first", "last"]),
});

export const mapValuesOperationSchema = z.object({
  type: z.literal("map_values"),
  column: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
});

export const aiTransformOperationSchema = z.object({
  type: z.literal("ai_transform"),
  sourceColumn: z.string().min(1),
  targetColumn: z.string().min(1),
  instruction: z.string().min(1),
});

export const operationSchema = z.discriminatedUnion("type", [
  trimOperationSchema,
  formatNumberOperationSchema,
  deriveColumnOperationSchema,
  deleteRowsOperationSchema,
  deduplicateOperationSchema,
  mapValuesOperationSchema,
  aiTransformOperationSchema,
]);

export const aiPlanSchema = z.object({
  summary: z.string().min(1),
  operations: z.array(operationSchema),
  warnings: z.array(z.string()),
});

export const taskStatusSchema = z.enum([
  "pending",
  "running",
  "success",
  "partial_success",
  "failed",
]);

export const planGenerationRequestSchema = z.object({
  fileId: z.string().min(1),
  sheetName: z.string().min(1),
  userRequest: z.string().trim().min(1),
});

export const executeTaskRequestSchema = z.object({
  fileId: z.string().min(1),
  sheetName: z.string().min(1),
  plan: aiPlanSchema,
  userRequest: z.string().trim().min(1).optional(),
});

export const taskSummarySchema = z.object({
  operationCount: z.number().int().nonnegative(),
  changedRows: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export const changedPreviewRowSchema = z.object({
  __rowIndex: z.number().int().nonnegative(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
});

export const taskFailureSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  operationType: z.string().min(1),
  reason: z.string().min(1),
});

export type ExcelRow = z.infer<typeof excelRowSchema>;
export type PreviewData = z.infer<typeof previewDataSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type AiPlan = z.infer<typeof aiPlanSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type PlanGenerationRequest = z.infer<typeof planGenerationRequestSchema>;
export type ExecuteTaskRequest = z.infer<typeof executeTaskRequestSchema>;
export type TaskSummary = z.infer<typeof taskSummarySchema>;
export type ChangedPreviewRow = z.infer<typeof changedPreviewRowSchema>;
export type TaskFailure = z.infer<typeof taskFailureSchema>;
