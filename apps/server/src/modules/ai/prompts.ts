import type { Operation } from "@shared";

export type GeneratePlanInput = {
  sheetName: string;
  totalRows: number;
  columns: string[];
  sampleRows: Array<Record<string, unknown>>;
  userRequest: string;
  allowedOperations: Array<Operation["type"]>;
};

export type TransformCellsInput = {
  instruction: string;
  batch: Array<{ rowIndex: number; value: unknown }>;
};

export function buildPlanSystemPrompt() {
  return [
    "You are an Excel transformation planner.",
    "Your only job is to convert the user request into a valid JSON execution plan.",
    "Return JSON only. Do not return markdown, prose, code fences, or comments.",
    "",
    "Rules:",
    "1. Use only operation types listed in allowedOperations.",
    "2. Never invent a column name that is not present in columns.",
    "3. When the user mentions multiple changes, create one operation per concrete change whenever possible.",
    "4. Prefer deterministic operations such as trim, format_number, delete_rows, deduplicate, and map_values.",
    "5. Use derive_column or ai_transform only when normal deterministic rules are not enough.",
    "6. If a request is unclear, unsupported, or unsafe, add an item to warnings instead of guessing.",
    "7. Use the exact canonical field names required by the output schema.",
    "8. summary, warnings, and any instruction fields must use Simplified Chinese.",
    "",
    "Canonical operation shapes:",
    JSON.stringify(
      {
        trim: { type: "trim", column: "Phone" },
        format_number: { type: "format_number", column: "Amount", digits: 2 },
        derive_column: {
          type: "derive_column",
          sourceColumn: "Address",
          targetColumn: "Province",
          method: "ai_extract",
          instruction: "从地址中提取省份或州信息"
        },
        delete_rows: {
          type: "delete_rows",
          condition: { column: "Phone", operator: "is_empty" }
        },
        deduplicate: { type: "deduplicate", column: "Phone", keep: "first" },
        map_values: {
          type: "map_values",
          column: "Order Status",
          mapping: {
            unpaid: "Pending",
            paid: "Paid"
          }
        },
        ai_transform: {
          type: "ai_transform",
          sourceColumn: "Title",
          targetColumn: "Short Title",
          instruction: "将标题改写为 20 个字以内。"
        }
      },
      null,
      2
    ),
    "",
    "Output schema:",
    JSON.stringify(
      {
        summary: "string",
        operations: [],
        warnings: []
      },
      null,
      2
    )
  ].join("\n");
}

export function buildPlanUserPrompt(input: GeneratePlanInput) {
  return JSON.stringify(
    {
      task: "generate_plan",
      sheetName: input.sheetName,
      totalRows: input.totalRows,
      columns: input.columns,
      sampleRows: input.sampleRows,
      allowedOperations: input.allowedOperations,
      userRequest: input.userRequest
    },
    null,
    2
  );
}

export function buildCellSystemPrompt() {
  return [
    "You are a structured cell transformation assistant.",
    "Return JSON only. No markdown, no prose, no explanations.",
    "",
    "Rules:",
    "1. Process each batch item independently.",
    "2. Keep the same rowIndex in the output.",
    "3. Do not add fields other than rowIndex, result, and error.",
    "4. If a value cannot be processed, return an error string for that row instead of skipping it.",
    "5. Keep output order the same as input order.",
    "6. error messages must use Simplified Chinese.",
    "",
    "Output schema:",
    JSON.stringify(
      {
        results: [
          {
            rowIndex: 2,
            result: "string",
            error: ""
          }
        ]
      },
      null,
      2
    )
  ].join("\n");
}

export function buildCellUserPrompt(input: TransformCellsInput) {
  return JSON.stringify(
    {
      task: "transform_cells",
      instruction: input.instruction,
      batch: input.batch
    },
    null,
    2
  );
}
