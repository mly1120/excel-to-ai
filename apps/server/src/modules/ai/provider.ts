import { aiPlanSchema, type AiPlan, AppError, type Operation } from "@shared";

import { config } from "../../config";
import { extractProvince } from "../../lib/province";
import {
  buildCellSystemPrompt,
  buildCellUserPrompt,
  buildPlanSystemPrompt,
  buildPlanUserPrompt,
  type GeneratePlanInput,
  type TransformCellsInput
} from "./prompts";

export type TransformCellsResult = {
  results: Array<{ rowIndex: number; result: string; error: string }>;
};

export interface AiProvider {
  generatePlan(input: GeneratePlanInput): Promise<AiPlan>;
  transformCells(input: TransformCellsInput): Promise<TransformCellsResult>;
}

type ChatCompletionContent =
  | string
  | Array<{
      type?: string;
      text?: string;
    }>;

const CN_SPACE = "\u7a7a\u683c";
const CN_TRIM = "\u53bb\u7a7a";
const CN_PHONE = "\u624b\u673a";
const CN_TEL = "\u7535\u8bdd";
const CN_NAME = "\u59d3\u540d";
const CN_AMOUNT = "\u91d1\u989d";
const CN_TWO_DIGITS = "\u4e24\u4f4d";
const CN_PROVINCE = "\u7701\u4efd";
const CN_ADDRESS = "\u5730\u5740";
const CN_DELETE = "\u5220\u9664";
const CN_EMPTY = "\u4e3a\u7a7a";
const CN_DEDUPLICATE = "\u53bb\u91cd";
const CN_EMAIL = "\u90ae\u7bb1";
const CN_TITLE = "\u6807\u9898";
const CN_CHAR = "\u5b57";

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeContent(content: ChatCompletionContent | undefined) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text ?? "")
      .join("")
      .trim();
  }

  return "";
}

function stripMarkdownFences(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractBalancedJson(text: string) {
  const cleaned = stripMarkdownFences(text);
  const startIndexes = [cleaned.indexOf("{"), cleaned.indexOf("[")]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  for (const startIndex of startIndexes) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < cleaned.length; index += 1) {
      const char = cleaned[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{" || char === "[") {
        depth += 1;
      } else if (char === "}" || char === "]") {
        depth -= 1;
        if (depth === 0) {
          return cleaned.slice(startIndex, index + 1);
        }
      }
    }
  }

  return cleaned;
}

function safeJsonParse<T>(text: string): T {
  return JSON.parse(extractBalancedJson(text)) as T;
}

function isRetryableStatus(status: number | undefined) {
  return status !== undefined && [408, 409, 429, 500, 502, 503, 504].includes(status);
}

function buildColumnIndex(columns: string[]) {
  return columns.map((column) => ({
    original: column,
    lower: column.toLowerCase()
  }));
}

function requestIncludesAny(request: string, patterns: string[]) {
  return patterns.some((pattern) => request.includes(pattern));
}

function findColumnByPatterns(
  columns: Array<{ original: string; lower: string }>,
  patterns: string[]
) {
  return columns.find(({ original, lower }) =>
    patterns.some((pattern) => original.includes(pattern) || lower.includes(pattern))
  )?.original;
}

function findColumnsMentionedInRequest(
  request: string,
  columns: Array<{ original: string; lower: string }>
) {
  return columns
    .filter(({ original, lower }) => {
      return request.includes(original.toLowerCase()) || request.includes(lower);
    })
    .map((item) => item.original);
}

function operationKey(operation: Operation) {
  switch (operation.type) {
    case "trim":
      return `trim:${operation.column}`;
    case "format_number":
      return `format_number:${operation.column}:${operation.digits}`;
    case "derive_column":
      return `derive_column:${operation.sourceColumn}:${operation.targetColumn}`;
    case "delete_rows":
      return `delete_rows:${operation.condition.column}:${operation.condition.operator}:${operation.condition.value ?? ""}`;
    case "deduplicate":
      return `deduplicate:${operation.column}:${operation.keep}`;
    case "map_values":
      return `map_values:${operation.column}:${JSON.stringify(operation.mapping)}`;
    case "ai_transform":
      return `ai_transform:${operation.sourceColumn}:${operation.targetColumn}:${operation.instruction}`;
  }
}

const DERIVED_COLUMN_REJECTION_PATTERNS = [
  "not present",
  "not in the provided columns",
  "not in the existing columns",
  "cannot create a new column",
  "cannot create",
  "can't create",
  "target column does not exist",
  "column does not exist",
  "\u5217\u4e0d\u5b58\u5728",
  "\u76ee\u6807\u5217\u4e0d\u5b58\u5728",
  "\u65e0\u6cd5\u521b\u5efa\u65b0\u5217",
  "\u4e0d\u80fd\u521b\u5efa\u65b0\u5217",
  "\u4e0d\u5728\u63d0\u4f9b\u7684\u5217\u4e2d",
  "\u4e0d\u5728\u73b0\u6709\u5217\u4e2d"
];

function supportsDerivedColumns(operations: Operation[]) {
  return operations.some(
    (operation) => operation.type === "derive_column" || operation.type === "ai_transform"
  );
}

function isDerivedColumnRejectionText(text: string, operations: Operation[]) {
  if (!supportsDerivedColumns(operations)) {
    return false;
  }

  const lower = text.toLowerCase();
  return (
    (lower.includes("column") || text.includes("\u5217")) &&
    DERIVED_COLUMN_REJECTION_PATTERNS.some((pattern) => lower.includes(pattern))
  );
}

function buildGeneratedSummary(operations: Operation[]) {
  if (operations.length === 0) {
    return "已生成处理计划";
  }

  return `已生成处理计划，共 ${operations.length} 个操作。`;
}

function mergeOperations(existing: Operation[], supplements: Operation[]) {
  const result = [...existing];
  const keys = new Set(existing.map(operationKey));

  for (const operation of supplements) {
    const key = operationKey(operation);
    if (!keys.has(key)) {
      result.push(operation);
      keys.add(key);
    }
  }

  return result;
}

export function sanitizeWarnings(warnings: string[], operations: Operation[]) {
  return warnings
    .map((warning) => warning.trim())
    .filter(Boolean)
    .filter((warning) => !isDerivedColumnRejectionText(warning, operations));
}

export function sanitizeSummary(summary: string, operations: Operation[]) {
  const trimmed = summary.trim();

  if (!trimmed) {
    return buildGeneratedSummary(operations);
  }

  const segments =
    trimmed
      .match(/[^.!?;\u3002\uFF01\uFF1F\uFF1B\r\n]+[.!?;\u3002\uFF01\uFF1F\uFF1B]?/g)
      ?.map((segment) => segment.trim())
      .filter(Boolean) ?? [];

  const cleanedSegments = (segments.length > 0 ? segments : [trimmed]).filter(
    (segment) => !isDerivedColumnRejectionText(segment, operations)
  );

  return cleanedSegments.join(" ").trim() || buildGeneratedSummary(operations);
}

function sanitizePlan(plan: AiPlan): AiPlan {
  return {
    ...plan,
    summary: sanitizeSummary(plan.summary, plan.operations),
    warnings: sanitizeWarnings(plan.warnings, plan.operations)
  };
}

function normalizeOperation(rawOperation: Record<string, unknown>): Operation[] {
  const type = String(rawOperation.type ?? rawOperation.operation ?? "").trim();

  if (!type) {
    return [];
  }

  if (type === "trim") {
    const columns = Array.isArray(rawOperation.targetColumns)
      ? rawOperation.targetColumns
      : rawOperation.column
        ? [rawOperation.column]
        : [];

    return columns
      .map((column) => String(column ?? "").trim())
      .filter(Boolean)
      .map((column) => ({
        type: "trim" as const,
        column
      }));
  }

  if (type === "format_number") {
    const column =
      String(
        rawOperation.column ??
          (Array.isArray(rawOperation.targetColumns) ? rawOperation.targetColumns[0] : "")
      ).trim();
    const options =
      rawOperation.options && typeof rawOperation.options === "object"
        ? (rawOperation.options as Record<string, unknown>)
        : {};
    const digitsValue =
      rawOperation.digits ?? options.decimalPlaces ?? options.digits ?? 2;
    const digits = Number(digitsValue);

    if (!column || Number.isNaN(digits)) {
      return [];
    }

    return [
      {
        type: "format_number",
        column,
        digits
      }
    ];
  }

  if (type === "derive_column") {
    const sourceColumn = String(
      rawOperation.sourceColumn ??
        (Array.isArray(rawOperation.sourceColumns) ? rawOperation.sourceColumns[0] : "")
    ).trim();
    const targetColumn = String(
      rawOperation.targetColumn ?? rawOperation.newColumn ?? ""
    ).trim();
    const instruction = String(
      rawOperation.instruction ?? rawOperation.expression ?? rawOperation.description ?? ""
    ).trim();
    const method = String(rawOperation.method ?? "").trim();

    if (!sourceColumn || !targetColumn) {
      return [];
    }

    return [
      {
        type: "derive_column",
        sourceColumn,
        targetColumn,
        method:
          method === "regex" || method === "mapping" || method === "ai_extract"
            ? method
            : "ai_extract",
        instruction: instruction || `从 ${sourceColumn} 提取 ${targetColumn}`
      }
    ];
  }

  if (type === "delete_rows") {
    const condition =
      rawOperation.condition && typeof rawOperation.condition === "object"
        ? (rawOperation.condition as Record<string, unknown>)
        : {};
    const column = String(
      condition.column ??
        rawOperation.column ??
        (Array.isArray(rawOperation.targetColumns) ? rawOperation.targetColumns[0] : "")
    ).trim();
    const operator = String(condition.operator ?? rawOperation.operator ?? "is_empty").trim();
    const value =
      condition.value == null && rawOperation.value == null
        ? undefined
        : String(condition.value ?? rawOperation.value ?? "");

    if (!column) {
      return [];
    }

    return [
      {
        type: "delete_rows",
        condition: {
          column,
          operator:
            operator === "equals" || operator === "not_equals" || operator === "is_empty"
              ? operator
              : "is_empty",
          value
        }
      }
    ];
  }

  if (type === "deduplicate") {
    const column = String(
      rawOperation.column ??
        (Array.isArray(rawOperation.targetColumns) ? rawOperation.targetColumns[0] : "")
    ).trim();
    const keep = String(rawOperation.keep ?? "first").trim();

    if (!column) {
      return [];
    }

    return [
      {
        type: "deduplicate",
        column,
        keep: keep === "last" ? "last" : "first"
      }
    ];
  }

  if (type === "map_values") {
    const column = String(
      rawOperation.column ??
        (Array.isArray(rawOperation.targetColumns) ? rawOperation.targetColumns[0] : "")
    ).trim();
    const mapping =
      rawOperation.mapping && typeof rawOperation.mapping === "object"
        ? (rawOperation.mapping as Record<string, string>)
        : rawOperation.options &&
            typeof rawOperation.options === "object" &&
            (rawOperation.options as Record<string, unknown>).mapping &&
            typeof (rawOperation.options as Record<string, unknown>).mapping === "object"
          ? ((rawOperation.options as Record<string, unknown>).mapping as Record<string, string>)
          : undefined;

    if (!column || !mapping) {
      return [];
    }

    return [
      {
        type: "map_values",
        column,
        mapping
      }
    ];
  }

  if (type === "ai_transform") {
    const sourceColumn = String(
      rawOperation.sourceColumn ??
        (Array.isArray(rawOperation.sourceColumns) ? rawOperation.sourceColumns[0] : "")
    ).trim();
    const targetColumn = String(
      rawOperation.targetColumn ?? rawOperation.newColumn ?? sourceColumn
    ).trim();
    const instruction = String(
      rawOperation.instruction ?? rawOperation.expression ?? rawOperation.description ?? ""
    ).trim();

    if (!sourceColumn || !targetColumn || !instruction) {
      return [];
    }

    return [
      {
        type: "ai_transform",
        sourceColumn,
        targetColumn,
        instruction
      }
    ];
  }

  return [];
}

export function normalizeAiPlan(raw: unknown): AiPlan {
  const direct = aiPlanSchema.safeParse(raw);
  if (direct.success) {
    return sanitizePlan(direct.data);
  }

  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : undefined;
  const rawOperations = Array.isArray(record?.operations) ? record.operations : [];
  const operations = rawOperations.flatMap((item) =>
    item && typeof item === "object"
      ? normalizeOperation(item as Record<string, unknown>)
      : []
  );

  return sanitizePlan(
    aiPlanSchema.parse({
    summary: String(record?.summary ?? "已生成处理计划").trim() || "已生成处理计划",
    operations,
    warnings: Array.isArray(record?.warnings) ? record.warnings.map((item) => String(item)) : []
    })
  );
}

export function supplementPlanFromRequest(input: GeneratePlanInput, plan: AiPlan): AiPlan {
  const request = input.userRequest.toLowerCase();
  const columns = buildColumnIndex(input.columns);
  const supplements: Operation[] = [];

  const phonePatterns = ["phone", "mobile", CN_PHONE, CN_TEL];
  const namePatterns = ["name", CN_NAME];
  const amountPatterns = ["amount", "price", "total", CN_AMOUNT];
  const addressPatterns = ["address", "addr", CN_ADDRESS];
  const emailPatterns = ["email", CN_EMAIL];

  const mentionedColumns = findColumnsMentionedInRequest(request, columns);
  const phoneColumn = findColumnByPatterns(columns, phonePatterns);
  const nameColumn = findColumnByPatterns(columns, namePatterns);
  const amountColumn = findColumnByPatterns(columns, amountPatterns);
  const addressColumn = findColumnByPatterns(columns, addressPatterns);
  const emailColumn = findColumnByPatterns(columns, emailPatterns);

  const trimRequested =
    requestIncludesAny(request, ["trim", "space", CN_SPACE, CN_TRIM]) &&
    !plan.operations.some((operation) => operation.type === "trim");

  if (trimRequested) {
    const trimTargets = new Set<string>();

    for (const column of mentionedColumns) {
      trimTargets.add(column);
    }

    if (requestIncludesAny(request, phonePatterns) && phoneColumn) {
      trimTargets.add(phoneColumn);
    }

    if (requestIncludesAny(request, namePatterns) && nameColumn) {
      trimTargets.add(nameColumn);
    }

    if (trimTargets.size === 0 && phoneColumn) {
      trimTargets.add(phoneColumn);
    }

    for (const column of trimTargets) {
      supplements.push({
        type: "trim",
        column
      });
    }
  }

  const wantsTwoDecimals = requestIncludesAny(request, [
    "2 decimal",
    "two decimal",
    "2 digits",
    CN_TWO_DIGITS
  ]);
  if (
    amountColumn &&
    requestIncludesAny(request, amountPatterns) &&
    wantsTwoDecimals &&
    !plan.operations.some(
      (operation) => operation.type === "format_number" && operation.column === amountColumn
    )
  ) {
    supplements.push({
      type: "format_number",
      column: amountColumn,
      digits: 2
    });
  }

  const wantsProvince = requestIncludesAny(request, ["province", CN_PROVINCE]);
  if (
    wantsProvince &&
    addressColumn &&
    !plan.operations.some(
      (operation) =>
        operation.type === "derive_column" &&
        operation.sourceColumn === addressColumn &&
        ["province", CN_PROVINCE].includes(operation.targetColumn.toLowerCase())
    )
  ) {
    supplements.push({
      type: "derive_column",
      sourceColumn: addressColumn,
      targetColumn: request.includes("province") ? "Province" : CN_PROVINCE,
      method: "ai_extract",
      instruction: "从地址中提取省份或州信息。"
    });
  }

  if (
    requestIncludesAny(request, ["delete", CN_DELETE]) &&
    requestIncludesAny(request, ["empty", CN_EMPTY]) &&
    !plan.operations.some((operation) => operation.type === "delete_rows")
  ) {
    const targetColumn = mentionedColumns[0] ?? phoneColumn ?? nameColumn ?? input.columns[0];
    if (targetColumn) {
      supplements.push({
        type: "delete_rows",
        condition: {
          column: targetColumn,
          operator: "is_empty"
        }
      });
    }
  }

  if (
    requestIncludesAny(request, ["deduplicate", CN_DEDUPLICATE]) &&
    !plan.operations.some((operation) => operation.type === "deduplicate")
  ) {
    const targetColumn = mentionedColumns[0] ?? phoneColumn ?? emailColumn ?? input.columns[0];
    if (targetColumn) {
      supplements.push({
        type: "deduplicate",
        column: targetColumn,
        keep: "first"
      });
    }
  }

  const mergedOperations = mergeOperations(plan.operations, supplements);
  const warnings =
    supplements.length === 0
      ? plan.warnings
      : [...plan.warnings, "部分操作已根据需求由规则引擎自动补全。"];

  return sanitizePlan({
    ...plan,
    operations: mergedOperations,
    warnings
  });
}

function createMockPlan(input: GeneratePlanInput): AiPlan {
  return supplementPlanFromRequest(input, {
    summary: "模拟处理计划",
    operations: [],
    warnings: ["当前使用模拟 AI 服务。"]
  });
}

class MockAiProvider implements AiProvider {
  async generatePlan(input: GeneratePlanInput) {
    return createMockPlan(input);
  }

  async transformCells(input: TransformCellsInput): Promise<TransformCellsResult> {
    return {
      results: input.batch.map((item) => {
        const text = String(item.value ?? "").trim();

        if (!text) {
          return {
            rowIndex: item.rowIndex,
            result: "",
            error: "输入为空"
          };
        }

        const instruction = input.instruction.toLowerCase();
        if (
          instruction.includes("province") ||
          instruction.includes("state") ||
          input.instruction.includes(CN_PROVINCE)
        ) {
          const province = extractProvince(text);
          return {
            rowIndex: item.rowIndex,
            result: province,
            error: province ? "" : "未识别到省份"
          };
        }

        if (
          input.instruction.includes("20") &&
          (instruction.includes("title") ||
            input.instruction.includes(CN_TITLE) ||
            input.instruction.includes(CN_CHAR))
        ) {
          return {
            rowIndex: item.rowIndex,
            result: text.slice(0, 20),
            error: ""
          };
        }

        return {
          rowIndex: item.rowIndex,
          result: text,
          error: ""
        };
      })
    };
  }
}

class OpenAiCompatibleProvider implements AiProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;

  constructor() {
    if (!config.aiBaseUrl || !config.aiApiKey) {
      throw new AppError(
        "AI_REQUEST_FAILED",
        "openai_compatible 配置缺少 AI_BASE_URL 或 AI_API_KEY",
        502
      );
    }

    if (!config.planModel) {
      throw new AppError("AI_REQUEST_FAILED", "实际 AI 配置缺少 PLAN_MODEL", 502);
    }

    this.baseUrl = config.aiBaseUrl.replace(/\/$/, "");
    this.apiKey = config.aiApiKey;
    this.maxRetries = config.aiMaxRetries;
  }

  private async readErrorMessage(response: Response) {
    const bodyText = await response.text().catch(() => "");

    try {
      const body = JSON.parse(bodyText) as {
        error?: {
          message?: string;
        };
        message?: string;
      };

      return body.error?.message ?? body.message ?? bodyText;
    } catch {
      return bodyText;
    }
  }

  private async requestChatCompletion(options: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    preferJsonMode: boolean;
  }) {
    let useJsonMode = options.preferJsonMode;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const requestBody: Record<string, unknown> = {
          model: options.model,
          temperature: 0,
          messages: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: options.userPrompt }
          ]
        };

        if (useJsonMode) {
          requestBody.response_format = { type: "json_object" };
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(config.aiTimeoutMs)
        });

        if (!response.ok) {
          const message = await this.readErrorMessage(response);
          const lowerMessage = message.toLowerCase();

          if (
            useJsonMode &&
            response.status === 400 &&
            (lowerMessage.includes("response_format") ||
              lowerMessage.includes("json_object") ||
              lowerMessage.includes("json schema"))
          ) {
            useJsonMode = false;
            continue;
          }

          throw new AppError("AI_REQUEST_FAILED", "对话补全请求失败", 502, {
            status: response.status,
            message
          });
        }

        const json = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: ChatCompletionContent;
            };
          }>;
        };

        const content = normalizeContent(json.choices?.[0]?.message?.content);
        if (!content) {
          throw new AppError("INVALID_AI_RESPONSE", "模型返回为空", 422);
        }

        return content;
      } catch (error) {
        const shouldRetry =
          attempt < this.maxRetries &&
          ((error instanceof AppError &&
            isRetryableStatus(
              typeof error.details?.status === "number"
                ? error.details.status
                : undefined
            )) ||
            !(error instanceof AppError));

        if (!shouldRetry) {
          throw error;
        }

        await sleep(400 * (attempt + 1));
      }
    }

    throw new AppError("AI_REQUEST_FAILED", "对话补全请求失败", 502);
  }

  async generatePlan(input: GeneratePlanInput) {
    const content = await this.requestChatCompletion({
      model: config.planModel,
      systemPrompt: buildPlanSystemPrompt(),
      userPrompt: buildPlanUserPrompt(input),
      preferJsonMode: true
    });

    try {
      return supplementPlanFromRequest(input, normalizeAiPlan(safeJsonParse(content)));
    } catch (error) {
      throw new AppError("INVALID_AI_PLAN", "模型返回的计划结构无效", 422, {
        reason: error instanceof Error ? error.message : "未知校验错误"
      });
    }
  }

  async transformCells(input: TransformCellsInput) {
    const content = await this.requestChatCompletion({
      model: config.cellModel || config.planModel,
      systemPrompt: buildCellSystemPrompt(),
      userPrompt: buildCellUserPrompt(input),
      preferJsonMode: true
    });

    const result = safeJsonParse<TransformCellsResult>(content);
    if (!Array.isArray(result.results)) {
      throw new AppError("INVALID_AI_RESPONSE", "单元格转换结果格式无效", 422);
    }

    return result;
  }
}

export function createAiProvider(): AiProvider {
  if (config.aiProvider === "openai_compatible") {
    return new OpenAiCompatibleProvider();
  }

  return new MockAiProvider();
}
