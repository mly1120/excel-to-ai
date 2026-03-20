import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import type { FastifyInstance } from "fastify";
import type { AiPlan, TaskResultResponse } from "@shared";
import XLSX from "xlsx";

import { ensureMetadataStore, readMetadataStore, writeMetadataStore } from "./db/database";
import { insertFile, insertTask } from "./db/repository";
import {
  buildPreview,
  parseWorkbook,
  writeParsedWorkbookArtifact,
  type ParsedSheet
} from "./lib/excel";
import { ensureWorkspaceDirs, paths } from "./lib/paths";

ensureWorkspaceDirs();

function sleep(ms: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function waitForTaskResult(app: FastifyInstance, taskId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/api/tasks/${taskId}/result`
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as {
      data: TaskResultResponse;
    };

    if (payload.data.status === "success" || payload.data.status === "partial_success") {
      return payload.data;
    }

    if (payload.data.status === "failed") {
      assert.fail(payload.data.failures[0]?.reason ?? "任务执行失败");
    }

    await sleep(50);
  }

  assert.fail("任务未在预期时间内完成");
}

test("parseWorkbook rejects duplicate headers", () => {
  const filePath = resolve(paths.uploadsDir, `duplicate-headers-${randomUUID()}.xlsx`);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["手机号", "手机号"],
    ["13800138000", "13900139000"]
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);

  try {
    assert.throws(() => parseWorkbook(filePath), /存在重复表头/);
  } finally {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
});

test("parseWorkbook rejects sheets exceeding workbook boundaries", () => {
  const filePath = resolve(paths.uploadsDir, `sheet-boundary-${randomUUID()}.xlsx`);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([["ID"]]);
  worksheet["!ref"] = "A1:ZZ1";
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);

  try {
    assert.throws(() => parseWorkbook(filePath), /列数超过服务端限制/);
  } finally {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
});

test("parseWorkbook rejects malformed merge ranges beyond service limits", () => {
  const filePath = resolve(paths.uploadsDir, `merge-boundary-${randomUUID()}.xlsx`);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([["ID"]]);
  worksheet["!merges"] = [XLSX.utils.decode_range("A1:ZZ1")];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);

  try {
    assert.throws(() => parseWorkbook(filePath), /合并单元格范围超过服务端限制/);
  } finally {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
});

test("tasks execute asynchronously and can be polled for final result", { concurrency: false }, async (t) => {
  ensureMetadataStore();
  const originalStore = readMetadataStore();
  const originalAiProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "mock";
  const { buildApp } = await import("./app");
  const app = buildApp();

  const fileId = `file_${randomUUID()}`;
  const sheetName = "Sheet1";
  const artifactPath = resolve(paths.parsedDir, `${fileId}.json`);
  let outputPath = "";

  t.after(async () => {
    await app.close();
    writeMetadataStore(originalStore);
    if (originalAiProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalAiProvider;
    }

    if (existsSync(artifactPath)) {
      rmSync(artifactPath);
    }

    if (outputPath && existsSync(outputPath)) {
      rmSync(outputPath);
    }
  });

  const sheet: ParsedSheet = {
    sheetName,
    columns: ["Phone", "Amount"],
    rows: [
      {
        __rowIndex: 2,
        Phone: " 13800138000 ",
        Amount: "12.3"
      }
    ],
    total: 1
  };

  writeParsedWorkbookArtifact(artifactPath, {
    sheets: {
      [sheetName]: sheet
    },
    sheetOrder: [sheetName]
  });

  insertFile({
    id: fileId,
    original_name: "contacts.xlsx",
    stored_path: resolve(paths.uploadsDir, `${fileId}.xlsx`),
    parse_artifact_path: artifactPath,
    file_ext: ".xlsx",
    file_size: 1024,
    sheets_json: JSON.stringify([sheetName]),
    default_sheet: sheetName,
    preview_json: JSON.stringify(buildPreview(sheet)),
    created_at: new Date().toISOString()
  });

  const plan: AiPlan = {
    summary: "清理手机号并格式化金额",
    warnings: [],
    operations: [
      {
        type: "trim",
        column: "Phone"
      },
      {
        type: "format_number",
        column: "Amount",
        digits: 2
      }
    ]
  };

  const userRequest = "清洗手机号并格式化金额";
  const executeResponse = await app.inject({
    method: "POST",
    url: "/api/tasks/execute",
    payload: {
      fileId,
      sheetName,
      plan,
      userRequest
    }
  });

  assert.equal(executeResponse.statusCode, 200);
  const executePayload = executeResponse.json() as {
    data: {
      taskId: string;
      status: string;
      changedRows: number;
      failedRows: number;
      createdAt: string;
    };
  };

  assert.equal(executePayload.data.status, "pending");
  assert.equal(executePayload.data.changedRows, 0);
  assert.equal(executePayload.data.failedRows, 0);

  outputPath = resolve(paths.outputsDir, `${executePayload.data.taskId}-contacts.xlsx`);

  const result = await waitForTaskResult(app, executePayload.data.taskId);
  assert.equal(result.status, "success");
  assert.equal(result.summary.changedRows, 1);
  assert.equal(result.summary.failedRows, 0);
  assert.equal(result.preview.rows[0]?.Phone, "13800138000");
  assert.equal(result.preview.rows[0]?.Amount, "12.30");
  assert.equal(existsSync(outputPath), true);

  assert.equal(result.fileId, fileId);
  assert.equal(result.fileName, "contacts.xlsx");
  assert.equal(result.sheetName, sheetName);
  assert.deepEqual(result.sheets, [sheetName]);
  assert.equal(result.userRequest, userRequest);
  assert.equal(result.createdAt, executePayload.data.createdAt);
  assert.ok(result.finishedAt);

  const tasksResponse = await app.inject({
    method: "GET",
    url: "/api/tasks"
  });

  assert.equal(tasksResponse.statusCode, 200);
  const recentTasks = (tasksResponse.json() as {
    data: { tasks: Array<{ taskId: string; fileName: string; userRequest: string; status: string; createdAt: string; finishedAt: string | null }> };
  }).data.tasks;

  assert(recentTasks.length >= 1);
  const recordedTask = recentTasks.find((item) => item.taskId === executePayload.data.taskId);
  assert(recordedTask, "找不到刚才执行的任务");
  assert.equal(recordedTask?.fileName, "contacts.xlsx");
  assert.equal(recordedTask?.userRequest, userRequest);
  assert.equal(recordedTask?.status, "success");
  assert.equal(recordedTask?.createdAt, executePayload.data.createdAt);
  assert.equal(recordedTask?.finishedAt !== null, true);
});

test("GET /api/tasks returns the latest 20 tasks in descending createdAt order", { concurrency: false }, async (t) => {
  ensureMetadataStore();
  const originalStore = readMetadataStore();
  const { buildApp } = await import("./app");
  const app = buildApp();

  t.after(async () => {
    await app.close();
    writeMetadataStore(originalStore);
  });

  const fileId = `file_${randomUUID()}`;
  const baseTime = Date.UTC(2026, 2, 19, 0, 0, 0);

  insertFile({
    id: fileId,
    original_name: "history.xlsx",
    stored_path: resolve(paths.uploadsDir, `${fileId}.xlsx`),
    parse_artifact_path: resolve(paths.parsedDir, `${fileId}.json`),
    file_ext: ".xlsx",
    file_size: 256,
    sheets_json: JSON.stringify(["Sheet1"]),
    default_sheet: "Sheet1",
    preview_json: JSON.stringify({ columns: [], rows: [], total: 0 }),
    created_at: new Date(baseTime).toISOString()
  });

  for (let index = 0; index < 25; index += 1) {
    insertTask({
      id: `task_${String(index + 1).padStart(2, "0")}`,
      file_id: fileId,
      sheet_name: "Sheet1",
      user_request: `任务 ${index + 1}`,
      plan_json: JSON.stringify({ summary: `任务 ${index + 1}`, operations: [], warnings: [] }),
      status: index % 2 === 0 ? "success" : "running",
      created_at: new Date(baseTime + index * 1000).toISOString()
    });
  }

  const response = await app.inject({
    method: "GET",
    url: "/api/tasks?limit=100"
  });

  assert.equal(response.statusCode, 200);
  const tasks = (response.json() as {
    data: {
      tasks: Array<{
        taskId: string;
        fileId: string;
        fileName: string;
        createdAt: string;
      }>;
    };
  }).data.tasks;

  const ownTasks = tasks.filter((task) => task.fileId === fileId);

  assert.equal(ownTasks.length, 25);
  assert.equal(ownTasks[0]?.taskId, "task_25");
  assert.equal(ownTasks[0]?.fileName, "history.xlsx");
  assert.equal(ownTasks[24]?.taskId, "task_01");

  for (let index = 1; index < ownTasks.length; index += 1) {
    const previousCreatedAt = ownTasks[index - 1]?.createdAt ?? "";
    const currentCreatedAt = ownTasks[index]?.createdAt ?? "";
    assert.equal(previousCreatedAt >= currentCreatedAt, true);
  }

  const defaultLimitResponse = await app.inject({
    method: "GET",
    url: "/api/tasks"
  });

  assert.equal(defaultLimitResponse.statusCode, 200);
  const defaultTasks = (defaultLimitResponse.json() as {
    data: {
      tasks: Array<{ taskId: string; fileId: string }>;
    };
  }).data.tasks;
  const defaultOwnTasks = defaultTasks.filter((task) => task.fileId === fileId);

  assert.equal(defaultTasks.length, 20);
  assert.equal(defaultOwnTasks.some((task) => task.taskId === "task_01"), false);
});

test("GET /api/tasks/:taskId/result returns sheets for restore context", { concurrency: false }, async (t) => {
  ensureMetadataStore();
  const originalStore = readMetadataStore();
  const { buildApp } = await import("./app");
  const app = buildApp();

  t.after(async () => {
    await app.close();
    writeMetadataStore(originalStore);
  });

  const fileId = `file_${randomUUID()}`;
  const taskId = `task_${randomUUID()}`;

  insertFile({
    id: fileId,
    original_name: "restore.xlsx",
    stored_path: resolve(paths.uploadsDir, `${fileId}.xlsx`),
    parse_artifact_path: resolve(paths.parsedDir, `${fileId}.json`),
    file_ext: ".xlsx",
    file_size: 512,
    sheets_json: JSON.stringify(["Sheet1", "Sheet2"]),
    default_sheet: "Sheet1",
    preview_json: JSON.stringify({ columns: ["A"], rows: [], total: 0 }),
    created_at: new Date().toISOString()
  });

  insertTask({
    id: taskId,
    file_id: fileId,
    sheet_name: "Sheet1",
    user_request: "恢复测试",
    plan_json: JSON.stringify({ summary: "恢复测试", operations: [], warnings: [] }),
    status: "pending",
    created_at: new Date().toISOString()
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/tasks/${taskId}/result`
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { data: TaskResultResponse };
  assert.deepEqual(payload.data.sheets, ["Sheet1", "Sheet2"]);
});
