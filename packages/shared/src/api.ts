import { z } from "zod";

import {
  aiPlanSchema,
  changedPreviewRowSchema,
  previewDataSchema,
  taskFailureSchema,
  taskStatusSchema,
  taskSummarySchema,
} from "./ai-plan";

export const uploadFileResponseSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  fileExt: z.string(),
  sheets: z.array(z.string()),
  defaultSheet: z.string(),
  defaultPreview: previewDataSchema,
  createdAt: z.string(),
});

export const getPreviewResponseSchema = z.object({
  fileId: z.string(),
  sheetName: z.string(),
  preview: previewDataSchema,
});

export const executeTaskResponseSchema = z.object({
  taskId: z.string(),
  status: taskStatusSchema,
  changedRows: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
  downloadUrl: z.string(),
  createdAt: z.string(),
});

export const taskContextSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
  sheetName: z.string(),
  userRequest: z.string(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const taskResultResponseSchema = taskContextSchema.extend({
  taskId: z.string(),
  sheets: z.array(z.string()),
  status: taskStatusSchema,
  summary: taskSummarySchema,
  preview: previewDataSchema,
  changedOnlyPreview: z.object({
    columns: z.array(z.string()),
    rows: z.array(changedPreviewRowSchema),
  }),
  failures: z.array(taskFailureSchema),
  downloadUrl: z.string(),
});

export const recentTaskItemSchema = taskContextSchema.extend({
  taskId: z.string(),
  status: taskStatusSchema,
  changedRows: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
});

export const recentTasksResponseSchema = z.object({
  tasks: z.array(recentTaskItemSchema),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  time: z.string(),
});

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type UploadFileResponse = z.infer<typeof uploadFileResponseSchema>;
export type GetPreviewResponse = z.infer<typeof getPreviewResponseSchema>;
export type ExecuteTaskResponse = z.infer<typeof executeTaskResponseSchema>;
export type TaskResultResponse = z.infer<typeof taskResultResponseSchema>;
export type RecentTaskItem = z.infer<typeof recentTaskItemSchema>;
export type RecentTasksResponse = z.infer<typeof recentTasksResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type PlanResponse = z.infer<typeof aiPlanSchema>;
