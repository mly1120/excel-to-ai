import assert from "node:assert/strict";
import test from "node:test";

import type { AiPlan } from "@shared";

import type { ParsedSheet } from "../lib/excel";
import type { AiProvider, TransformCellsResult } from "./ai/provider";
import { executePlan } from "./executor";

function createProvider(
  handler: (value: unknown, rowIndex: number) => { result: string; error: string }
): AiProvider {
  return {
    async generatePlan() {
      throw new Error("Not implemented for unit tests");
    },
    async transformCells(input): Promise<TransformCellsResult> {
      return {
        results: input.batch.map((item) => {
          const handled = handler(item.value, item.rowIndex);
          return {
            rowIndex: item.rowIndex,
            result: handled.result,
            error: handled.error
          };
        })
      };
    }
  };
}

test("executePlan applies trim, format_number, and ai derive_column", async () => {
  const sheet: ParsedSheet = {
    sheetName: "Sheet1",
    columns: ["Name", "Phone", "Address", "Amount"],
    rows: [
      {
        __rowIndex: 2,
        Name: "Alice",
        Phone: " 13800138000 ",
        Address: "Guangdong Shenzhen Nanshan",
        Amount: "1234.5"
      },
      {
        __rowIndex: 3,
        Name: "Bob",
        Phone: " 13900139000 ",
        Address: "Zhejiang Hangzhou Xihu",
        Amount: "88"
      }
    ],
    total: 2
  };

  const plan: AiPlan = {
    summary: "已生成处理计划",
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
      },
      {
        type: "derive_column",
        sourceColumn: "Address",
        targetColumn: "Province",
        method: "ai_extract",
        instruction: "Extract the province from the address."
      }
    ]
  };

  const result = await executePlan({
    sheet,
    plan,
    batchSize: 2,
    provider: createProvider((value) => {
      const text = String(value ?? "");
      if (text.includes("Guangdong")) {
        return { result: "Guangdong", error: "" };
      }

      if (text.includes("Zhejiang")) {
        return { result: "Zhejiang", error: "" };
      }

      return { result: "", error: "未识别到省份" };
    })
  });

  assert.deepEqual(result.columns, ["Name", "Phone", "Address", "Amount", "Province"]);
  assert.equal(result.rows[0]?.Phone, "13800138000");
  assert.equal(result.rows[0]?.Amount, "1234.50");
  assert.equal(result.rows[0]?.Province, "Guangdong");
  assert.equal(result.rows[1]?.Phone, "13900139000");
  assert.equal(result.rows[1]?.Amount, "88.00");
  assert.equal(result.rows[1]?.Province, "Zhejiang");
  assert.equal(result.summary.operationCount, 3);
  assert.equal(result.summary.changedRows, 2);
  assert.equal(result.summary.failedRows, 0);
});

test("executePlan applies delete_rows and deduplicate in sequence", async () => {
  const sheet: ParsedSheet = {
    sheetName: "Sheet1",
    columns: ["Name", "Phone", "Email"],
    rows: [
      {
        __rowIndex: 2,
        Name: "Alice",
        Phone: "13800138000",
        Email: "same@example.com"
      },
      {
        __rowIndex: 3,
        Name: "Bob",
        Phone: "",
        Email: "same@example.com"
      },
      {
        __rowIndex: 4,
        Name: "Carol",
        Phone: "13900139000",
        Email: "same@example.com"
      },
      {
        __rowIndex: 5,
        Name: "Dave",
        Phone: "13700137000",
        Email: "unique@example.com"
      }
    ],
    total: 4
  };

  const plan: AiPlan = {
    summary: "已生成处理计划",
    warnings: [],
    operations: [
      {
        type: "delete_rows",
        condition: {
          column: "Phone",
          operator: "is_empty"
        }
      },
      {
        type: "deduplicate",
        column: "Email",
        keep: "first"
      }
    ]
  };

  const result = await executePlan({
    sheet,
    plan,
    batchSize: 2,
    provider: createProvider(() => ({ result: "", error: "" }))
  });

  assert.deepEqual(
    result.rows.map((row) => row.__rowIndex),
    [2, 5]
  );
  assert.equal(result.summary.operationCount, 2);
  assert.equal(result.summary.changedRows, 2);
  assert.equal(result.summary.failedRows, 0);
});

test("executePlan derives province with regex extraction", async () => {
  const sheet: ParsedSheet = {
    sheetName: "Sheet1",
    columns: ["Address"],
    rows: [
      {
        __rowIndex: 2,
        Address: "\u5e7f\u4e1c\u7701\u6df1\u5733\u5e02\u5357\u5c71\u533a"
      },
      {
        __rowIndex: 3,
        Address: "\u672a\u77e5\u5730\u5740"
      }
    ],
    total: 2
  };

  const plan: AiPlan = {
    summary: "已生成处理计划",
    warnings: [],
    operations: [
      {
        type: "derive_column",
        sourceColumn: "Address",
        targetColumn: "Province",
        method: "regex",
        instruction: "Extract province from address."
      }
    ]
  };

  const result = await executePlan({
    sheet,
    plan,
    batchSize: 2,
    provider: createProvider(() => ({ result: "", error: "" }))
  });

  assert.equal(result.rows[0]?.Province, "\u5e7f\u4e1c\u7701");
  assert.equal(result.rows[1]?.Province, "");
  assert.deepEqual(result.failures, [
    {
      rowIndex: 3,
      operationType: "derive_column",
      reason: "正则提取未命中"
    }
  ]);
});
