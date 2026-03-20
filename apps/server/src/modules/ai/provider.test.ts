import assert from "node:assert/strict";
import test from "node:test";

import type { AiPlan, Operation } from "@shared";

import type { GeneratePlanInput } from "./prompts";
import {
  normalizeAiPlan,
  sanitizeSummary,
  supplementPlanFromRequest
} from "./provider";

const allowedOperations: Array<Operation["type"]> = [
  "trim",
  "format_number",
  "derive_column",
  "delete_rows",
  "deduplicate",
  "map_values",
  "ai_transform"
];

function createInput(userRequest: string): GeneratePlanInput {
  return {
    sheetName: "Sheet1",
    totalRows: 3,
    columns: ["Name", "Phone", "Address", "Amount", "Email"],
    sampleRows: [
      {
        Name: "Alice",
        Phone: " 13800138000 ",
        Address: "\u5e7f\u4e1c\u7701\u6df1\u5733\u5e02\u5357\u5c71\u533a",
        Amount: "1234.5",
        Email: "alice@example.com"
      }
    ],
    userRequest,
    allowedOperations
  };
}

test("sanitizeSummary removes invalid derived-column rejection text", () => {
  const operations: AiPlan["operations"] = [
    {
      type: "trim",
      column: "Phone"
    },
    {
      type: "derive_column",
      sourceColumn: "Address",
      targetColumn: "Province",
      method: "ai_extract",
      instruction: "Extract province from address."
    }
  ];

  const summary = sanitizeSummary(
    "Trim Phone values. Cannot create Province column because the target column does not exist.",
    operations
  );

  assert.equal(summary, "Trim Phone values.");
});

test("sanitizeSummary removes Chinese derived-column rejection text", () => {
  const operations: AiPlan["operations"] = [
    {
      type: "derive_column",
      sourceColumn: "地址",
      targetColumn: "省份",
      method: "ai_extract",
      instruction: "从地址中提取省份"
    }
  ];

  const summary = sanitizeSummary(
    "新增省份列。无法创建新列，因为目标列不存在。",
    operations
  );

  assert.equal(summary, "新增省份列。");
});

test("normalizeAiPlan sanitizes misleading summary and warnings", () => {
  const plan = normalizeAiPlan({
    summary:
      "Trim Phone and create Province. Target column does not exist in the provided columns.",
    operations: [
      {
        type: "trim",
        column: "Phone"
      },
      {
        type: "derive_column",
        sourceColumn: "Address",
        targetColumn: "Province",
        method: "ai_extract",
        instruction: "Extract province from address."
      }
    ],
    warnings: ["Target column does not exist in the provided columns."]
  });

  assert.equal(plan.summary, "Trim Phone and create Province.");
  assert.deepEqual(plan.warnings, []);
});

test("supplementPlanFromRequest adds trim, format_number, and derive_column", () => {
  const initialPlan: AiPlan = {
    summary:
      "Trim Phone and format Amount. Cannot create Province column because the target column does not exist.",
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
    ],
    warnings: ["Cannot create Province column because the target column does not exist."]
  };

  const plan = supplementPlanFromRequest(
    createInput("Trim phone spaces, format amount to two decimals, and create a Province column from Address"),
    initialPlan
  );

  assert.equal(plan.summary, "Trim Phone and format Amount.");
  assert.deepEqual(
    plan.operations.map((operation) => operation.type),
    ["trim", "format_number", "derive_column"]
  );
  assert.deepEqual(plan.warnings, ["部分操作已根据需求由规则引擎自动补全。"]);
  assert.deepEqual(plan.operations[2], {
    type: "derive_column",
    sourceColumn: "Address",
    targetColumn: "Province",
    method: "ai_extract",
    instruction: "从地址中提取省份或州信息。"
  });
});

test("supplementPlanFromRequest infers delete_rows with is_empty", () => {
  const plan = supplementPlanFromRequest(createInput("Delete rows where Phone is empty"), {
    summary: "已生成处理计划",
    operations: [],
    warnings: []
  });

  assert.deepEqual(plan.operations, [
    {
      type: "delete_rows",
      condition: {
        column: "Phone",
        operator: "is_empty"
      }
    }
  ]);
});

test("supplementPlanFromRequest infers deduplicate target column", () => {
  const plan = supplementPlanFromRequest(createInput("Deduplicate by Email"), {
    summary: "已生成处理计划",
    operations: [],
    warnings: []
  });

  assert.deepEqual(plan.operations, [
    {
      type: "deduplicate",
      column: "Email",
      keep: "first"
    }
  ]);
});
