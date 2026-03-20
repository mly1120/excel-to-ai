import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { stat, unlink } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";

import {
  aiPlanSchema,
  AppError,
  executeTaskRequestSchema,
  planGenerationRequestSchema,
  recentTasksResponseSchema,
  taskResultResponseSchema,
  type PreviewData
} from "@shared";

import { config } from "./config";
import {
  failTask,
  findFileById,
  findTaskById,
  insertFile,
  insertTask,
  listTasks,
  setTaskStatus,
  updateTask
} from "./db/repository";
import {
  buildPreview,
  exportWorkbook,
  parseWorkbook,
  readParsedWorkbookArtifact,
  writeParsedWorkbookArtifact,
  type ParsedSheet
} from "./lib/excel";
import { ensureWorkspaceDirs, paths } from "./lib/paths";
import { createAiProvider } from "./modules/ai/provider";
import { executePlan } from "./modules/executor";

function sendSuccess<T>(data: T) {
  return {
    success: true as const,
    data
  };
}

function normalizeFileExt(filename: string) {
  return extname(filename).toLowerCase();
}

function ensureExcelExt(filename: string) {
  const ext = normalizeFileExt(filename);
  if (![".xlsx", ".xls"].includes(ext)) {
    throw new AppError(
      "UNSUPPORTED_FILE_TYPE",
      "仅支持上传 .xlsx 和 .xls 文件。",
      400
    );
  }
  return ext;
}

function getFileOrThrow(fileId: string) {
  const file = findFileById(fileId);
  if (!file) {
    throw new AppError("FILE_NOT_FOUND", "文件不存在。", 404);
  }
  return file;
}

function getTaskOrThrow(taskId: string) {
  const task = findTaskById(taskId);
  if (!task) {
    throw new AppError("TASK_NOT_FOUND", "任务不存在。", 404);
  }
  return task;
}

function getSheetFromFile(fileId: string, sheetName: string) {
  const file = getFileOrThrow(fileId);
  const artifact = readParsedWorkbookArtifact(file.parse_artifact_path);
  const sheet = artifact.sheets[sheetName];

  if (!sheet) {
    throw new AppError("SHEET_NOT_FOUND", `Sheet 不存在：${sheetName}`, 404);
  }

  return { file, sheet };
}

function pickSampleRows(sheet: ParsedSheet, count: number) {
  return sheet.rows.slice(0, count);
}

function createDownloadUrl(taskId: string) {
  return `/api/tasks/${taskId}/download`;
}

function parseTaskSheets(
  file: ReturnType<typeof findFileById>,
  fallbackSheetName: string
) {
  if (!file) {
    return [fallbackSheetName];
  }

  try {
    const parsed = JSON.parse(file.sheets_json) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string" && item.trim().length > 0)
    ) {
      return parsed;
    }
  } catch {
    // ignore invalid historical data and fallback below.
  }

  return [fallbackSheetName];
}

function buildExecutionReportSummary(options: {
  operationCount: number;
  changedRows: number;
  failedRows: number;
  warnings: string[];
}) {
  return [
    `操作数量：${options.operationCount}`,
    `变更行数：${options.changedRows}`,
    `失败条数：${options.failedRows}`,
    `警告：${options.warnings.join(" | ") || "无"}`
  ];
}

function buildTaskFailurePayload(operationCount: number, reason: string) {
  return {
    summary: {
      operationCount,
      changedRows: 0,
      failedRows: 1,
      warnings: [reason]
    },
    failures: [
      {
        rowIndex: 0,
        operationType: "system",
        reason
      }
    ]
  };
}

export function buildApp() {
  ensureWorkspaceDirs();
  const aiProvider = createAiProvider();
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: config.corsOrigin
  });

  app.register(multipart, {
    limits: {
      fileSize: config.maxUploadSizeMb * 1024 * 1024,
      files: 1
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    const multipartError = error as { code?: string };
    if (multipartError.code === "FST_REQ_FILE_TOO_LARGE") {
      reply.status(413).send({
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: `文件大小不能超过 ${config.maxUploadSizeMb}MB。`
        }
      });
      return;
    }

    const message =
      error instanceof Error ? error.message : "服务端发生未知错误。";
    app.log.error(error);
    reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message
      }
    });
  });

app.get("/api/health", async () =>
  sendSuccess({
    status: "ok" as const,
    time: new Date().toISOString()
  })
);

app.get<{
  Querystring: {
    limit?: string;
  };
}>("/api/tasks", async (request) => {
  let limit: number | undefined;
  if (request.query.limit) {
    const parsedLimit = Number(request.query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
      throw new AppError("INVALID_LIMIT", "limit 必须是 1 到 100 的整数", 400);
    }
    limit = parsedLimit;
  }

  const tasks = listTasks({ limit });
  return sendSuccess(recentTasksResponseSchema.parse({ tasks }));
});

  app.post("/api/files/upload", async (request) => {
    const filePart = await request.file();
    if (!filePart) {
      throw new AppError("INVALID_EXCEL_FILE", "未接收到上传文件。", 400);
    }

    const originalName = filePart.filename ?? "upload.xlsx";
    const fileExt = ensureExcelExt(originalName);
    const fileId = `file_${randomUUID()}`;
    const storedPath = resolve(paths.uploadsDir, `${fileId}${fileExt}`);
    const parseArtifactPath = resolve(paths.parsedDir, `${fileId}.json`);

    await pipeline(filePart.file, createWriteStream(storedPath));

    try {
      const artifact = parseWorkbook(storedPath);
      const defaultSheet = artifact.sheetOrder[0];
      if (!defaultSheet) {
        throw new AppError("EMPTY_WORKBOOK", "工作簿为空。", 400);
      }

      const defaultSheetData = artifact.sheets[defaultSheet];
      if (!defaultSheetData) {
        throw new AppError(
          "INVALID_EXCEL_FILE",
          "默认 Sheet 解析失败。",
          400
        );
      }

      writeParsedWorkbookArtifact(parseArtifactPath, artifact);

      const defaultPreview = buildPreview(defaultSheetData, 20);
      const createdAt = new Date().toISOString();
      const fileStats = await stat(storedPath);

      insertFile({
        id: fileId,
        original_name: originalName,
        stored_path: storedPath,
        parse_artifact_path: parseArtifactPath,
        file_ext: fileExt,
        file_size: fileStats.size,
        sheets_json: JSON.stringify(artifact.sheetOrder),
        default_sheet: defaultSheet,
        preview_json: JSON.stringify(defaultPreview),
        created_at: createdAt
      });

      return sendSuccess({
        fileId,
        fileName: originalName,
        fileSize: fileStats.size,
        fileExt,
        sheets: artifact.sheetOrder,
        defaultSheet,
        defaultPreview,
        createdAt
      });
    } catch (error) {
      await unlink(storedPath).catch(() => undefined);
      await unlink(parseArtifactPath).catch(() => undefined);

      throw new AppError(
        "INVALID_EXCEL_FILE",
        error instanceof Error ? error.message : "Excel 文件解析失败。",
        400
      );
    }
  });

  app.get<{
    Params: {
      fileId: string;
      sheetName: string;
    };
    Querystring: {
      limit?: string;
    };
  }>("/api/files/:fileId/sheets/:sheetName/preview", async (request) => {
    const limit = Number(request.query.limit ?? 20);
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      throw new AppError("INVALID_LIMIT", "limit 必须是 1 到 100 之间的整数。", 400);
    }

    const { sheet } = getSheetFromFile(request.params.fileId, request.params.sheetName);

    return sendSuccess({
      fileId: request.params.fileId,
      sheetName: request.params.sheetName,
      preview: buildPreview(sheet, limit)
    });
  });

  app.post("/api/ai/plan", async (request) => {
    const body = planGenerationRequestSchema.parse(request.body);
    const { sheet } = getSheetFromFile(body.fileId, body.sheetName);

    const plan = await aiProvider.generatePlan({
      sheetName: body.sheetName,
      totalRows: sheet.total,
      columns: sheet.columns,
      sampleRows: pickSampleRows(sheet, config.planSampleRowCount),
      userRequest: body.userRequest,
      allowedOperations: [
        "trim",
        "format_number",
        "delete_rows",
        "deduplicate",
        "map_values",
        "derive_column",
        "ai_transform"
      ]
    });

    return sendSuccess(aiPlanSchema.parse(plan));
  });

app.post("/api/tasks/execute", async (request) => {
  const body = executeTaskRequestSchema.parse(request.body);
  const { file, sheet } = getSheetFromFile(body.fileId, body.sheetName);
  const taskId = `task_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const userRequest = body.userRequest?.trim() || body.plan.summary;

  insertTask({
    id: taskId,
    file_id: body.fileId,
    sheet_name: body.sheetName,
    user_request: userRequest,
    plan_json: JSON.stringify(body.plan),
    status: "pending",
    created_at: createdAt
  });

    const executeInBackground = async () => {
      setTaskStatus({
        id: taskId,
        status: "running"
      });

      try {
        const executionResult = await executePlan({
          sheet,
          plan: body.plan,
          provider: aiProvider,
          batchSize: config.cellBatchSize
        });

        const outputName = `${taskId}-${basename(file.original_name, extname(file.original_name))}.xlsx`;
        const outputPath = resolve(paths.outputsDir, outputName);

        exportWorkbook({
          outputPath,
          sheetName: body.sheetName,
          columns: executionResult.columns,
          rows: executionResult.rows,
          report: {
            summaryLines: buildExecutionReportSummary({
              operationCount: executionResult.summary.operationCount,
              changedRows: executionResult.summary.changedRows,
              failedRows: executionResult.summary.failedRows,
              warnings: executionResult.summary.warnings
            }),
            failures: executionResult.failures
          }
        });

        const preview: PreviewData = {
          columns: executionResult.columns,
          rows: executionResult.rows.slice(0, 20),
          total: executionResult.rows.length
        };
        const status =
          executionResult.summary.failedRows > 0 ? "partial_success" : "success";

        updateTask({
          id: taskId,
          status,
          changed_rows: executionResult.summary.changedRows,
          failed_rows: executionResult.summary.failedRows,
          output_path: outputPath,
          summary_json: JSON.stringify(executionResult.summary),
          preview_json: JSON.stringify(preview),
          changed_preview_json: JSON.stringify(executionResult.changedOnlyPreview),
          failures_json: JSON.stringify(executionResult.failures),
          finished_at: new Date().toISOString()
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "任务执行失败";
        const failure = buildTaskFailurePayload(body.plan.operations.length, reason);

        app.log.error({ err: error, taskId }, "任务执行失败");
        failTask({
          id: taskId,
          status: "failed",
          failed_rows: 1,
          summary_json: JSON.stringify(failure.summary),
          failures_json: JSON.stringify(failure.failures),
          finished_at: new Date().toISOString()
        });
      }
    };

    void executeInBackground();

    return sendSuccess({
      taskId,
      status: "pending" as const,
      changedRows: 0,
      failedRows: 0,
      downloadUrl: createDownloadUrl(taskId),
      createdAt
    });
  });

app.get<{
  Params: {
    taskId: string;
  };
}>("/api/tasks/:taskId/result", async (request) => {
  const task = getTaskOrThrow(request.params.taskId);
  const file = findFileById(task.file_id);
  const sheets = parseTaskSheets(file, task.sheet_name);
  const summary = task.summary_json
    ? JSON.parse(task.summary_json)
    : {
        operationCount: 0,
        changedRows: 0,
        failedRows: 0,
        warnings: []
      };
    const preview = task.preview_json
      ? JSON.parse(task.preview_json)
      : {
          columns: [],
          rows: [],
          total: 0
        };

    return sendSuccess(taskResultResponseSchema.parse({
      taskId: task.id,
      fileId: task.file_id,
      fileName: file ? file.original_name : task.file_id,
      sheetName: task.sheet_name,
      sheets,
      userRequest: task.user_request,
      createdAt: task.created_at,
      status: task.status,
      summary,
      preview,
      changedOnlyPreview: task.changed_preview_json
        ? JSON.parse(task.changed_preview_json)
        : { columns: ["__rowIndex", "before", "after"], rows: [] },
      failures: task.failures_json ? JSON.parse(task.failures_json) : [],
      downloadUrl: createDownloadUrl(task.id),
      finishedAt: task.finished_at
    }));
  });

  app.get<{
    Params: {
      taskId: string;
    };
  }>("/api/tasks/:taskId/download", async (request, reply) => {
    const task = getTaskOrThrow(request.params.taskId);
    if (!task.output_path || !existsSync(task.output_path)) {
      throw new AppError("OUTPUT_NOT_FOUND", "导出文件不存在。", 404);
    }

    reply.header(
      "Content-Disposition",
      `attachment; filename="${basename(task.output_path)}"`
    );
    reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return reply.send(createReadStream(task.output_path));
  });

  return app;
}
