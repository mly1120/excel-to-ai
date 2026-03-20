import type {
  AiPlan,
  ChangedPreviewRow,
  Operation,
  TaskFailure,
  TaskSummary
} from "@shared";
import { AppError } from "@shared";

import type { ParsedSheet } from "../lib/excel";
import { extractProvince } from "../lib/province";
import type { AiProvider } from "./ai/provider";

type Row = ParsedSheet["rows"][number];

function assertColumn(columns: string[], column: string) {
  if (!columns.includes(column)) {
    throw new AppError("COLUMN_NOT_FOUND", `未找到列：${column}`, 400, { column });
  }
}

function stringifyCell(value: unknown) {
  return value == null ? "" : String(value);
}

function cloneRows(rows: Row[]) {
  return structuredClone(rows);
}

function collectChangedPreview(
  originalRows: Row[],
  finalRows: Row[],
  finalColumns: string[]
) {
  const originalMap = new Map(originalRows.map((row) => [row.__rowIndex, row]));
  const finalMap = new Map(finalRows.map((row) => [row.__rowIndex, row]));
  const allRowIndexes = Array.from(
    new Set([...originalMap.keys(), ...finalMap.keys()])
  ).sort((a, b) => a - b);

  const changedRows: ChangedPreviewRow[] = [];

  for (const rowIndex of allRowIndexes) {
    const before = originalMap.get(rowIndex) ?? null;
    const after = finalMap.get(rowIndex) ?? null;
    const beforeNormalized = before
      ? Object.fromEntries(finalColumns.map((column) => [column, before[column] ?? ""]))
      : null;
    const afterNormalized = after
      ? Object.fromEntries(finalColumns.map((column) => [column, after[column] ?? ""]))
      : null;

    if (JSON.stringify(beforeNormalized) !== JSON.stringify(afterNormalized)) {
      changedRows.push({
        __rowIndex: rowIndex,
        before: beforeNormalized,
        after: afterNormalized
      });
    }
  }

  return {
    columns: ["__rowIndex", "before", "after"],
    rows: changedRows.slice(0, 20),
    totalChanged: changedRows.length
  };
}

async function applyAiBatchOperation(options: {
  rows: Row[];
  sourceColumn: string;
  targetColumn: string;
  instruction: string;
  batchSize: number;
  provider: AiProvider;
  failures: TaskFailure[];
  operationType: Operation["type"];
}) {
  for (let index = 0; index < options.rows.length; index += options.batchSize) {
    const batchRows = options.rows.slice(index, index + options.batchSize);
    const result = await options.provider.transformCells({
      instruction: options.instruction,
      batch: batchRows.map((row) => ({
        rowIndex: row.__rowIndex,
        value: row[options.sourceColumn]
      }))
    });

    const resultMap = new Map(result.results.map((item) => [item.rowIndex, item]));

    for (const row of batchRows) {
      const item = resultMap.get(row.__rowIndex);
      if (!item) {
        options.failures.push({
          rowIndex: row.__rowIndex,
          operationType: options.operationType,
          reason: "AI 未返回该行结果"
        });
        continue;
      }

      if (item.error) {
        options.failures.push({
          rowIndex: row.__rowIndex,
          operationType: options.operationType,
          reason: item.error
        });
      }

      row[options.targetColumn] = item.result;
    }
  }
}

function applyDeleteRows(rows: Row[], operation: Extract<Operation, { type: "delete_rows" }>) {
  return rows.filter((row) => {
    const value = stringifyCell(row[operation.condition.column]).trim();

    switch (operation.condition.operator) {
      case "is_empty":
        return value.length > 0;
      case "equals":
        return value !== stringifyCell(operation.condition.value).trim();
      case "not_equals":
        return value === stringifyCell(operation.condition.value).trim();
      default:
        return true;
    }
  });
}

export async function executePlan(options: {
  sheet: ParsedSheet;
  plan: AiPlan;
  provider: AiProvider;
  batchSize: number;
}) {
  const originalRows = cloneRows(options.sheet.rows);
  let workingRows = cloneRows(options.sheet.rows);
  const workingColumns = [...options.sheet.columns];
  const failures: TaskFailure[] = [];

  for (const operation of options.plan.operations) {
    switch (operation.type) {
      case "trim": {
        assertColumn(workingColumns, operation.column);
        for (const row of workingRows) {
          const value = row[operation.column];
          if (typeof value === "string") {
            row[operation.column] = value.trim();
          }
        }
        break;
      }

      case "format_number": {
        assertColumn(workingColumns, operation.column);
        for (const row of workingRows) {
          const raw = stringifyCell(row[operation.column]).trim();
          if (!raw) {
            continue;
          }

          const numberValue = Number(raw.replaceAll(",", ""));
          if (Number.isNaN(numberValue)) {
            failures.push({
              rowIndex: row.__rowIndex,
              operationType: operation.type,
              reason: `无法将“${raw}”格式化为数字`
            });
            continue;
          }

          row[operation.column] = numberValue.toFixed(operation.digits);
        }
        break;
      }

      case "delete_rows": {
        assertColumn(workingColumns, operation.condition.column);
        workingRows = applyDeleteRows(workingRows, operation);
        break;
      }

      case "deduplicate": {
        assertColumn(workingColumns, operation.column);
        if (operation.keep === "first") {
          const seen = new Set<string>();
          workingRows = workingRows.filter((row) => {
            const key = stringifyCell(row[operation.column]).trim();
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });
        } else {
          const seen = new Set<string>();
          workingRows = [...workingRows]
            .reverse()
            .filter((row) => {
              const key = stringifyCell(row[operation.column]).trim();
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            })
            .reverse();
        }
        break;
      }

      case "map_values": {
        assertColumn(workingColumns, operation.column);
        for (const row of workingRows) {
          const current = stringifyCell(row[operation.column]);
          if (current in operation.mapping) {
            row[operation.column] = operation.mapping[current];
          }
        }
        break;
      }

      case "derive_column": {
        assertColumn(workingColumns, operation.sourceColumn);
        if (!workingColumns.includes(operation.targetColumn)) {
          workingColumns.push(operation.targetColumn);
        }

        if (operation.method === "regex") {
          for (const row of workingRows) {
            const extracted = extractProvince(row[operation.sourceColumn]);
            row[operation.targetColumn] = extracted;
            if (!extracted && stringifyCell(row[operation.sourceColumn]).trim()) {
              failures.push({
                rowIndex: row.__rowIndex,
                operationType: operation.type,
                reason: "正则提取未命中"
              });
            }
          }
          break;
        }

        await applyAiBatchOperation({
          rows: workingRows,
          sourceColumn: operation.sourceColumn,
          targetColumn: operation.targetColumn,
          instruction: operation.instruction,
          batchSize: options.batchSize,
          provider: options.provider,
          failures,
          operationType: operation.type
        });
        break;
      }

      case "ai_transform": {
        assertColumn(workingColumns, operation.sourceColumn);
        if (!workingColumns.includes(operation.targetColumn)) {
          workingColumns.push(operation.targetColumn);
        }

        await applyAiBatchOperation({
          rows: workingRows,
          sourceColumn: operation.sourceColumn,
          targetColumn: operation.targetColumn,
          instruction: operation.instruction,
          batchSize: options.batchSize,
          provider: options.provider,
          failures,
          operationType: operation.type
        });
        break;
      }

      default:
        throw new AppError("UNKNOWN_OPERATION", "未知操作类型", 400);
    }
  }

  const changedInfo = collectChangedPreview(originalRows, workingRows, workingColumns);
  const summary: TaskSummary = {
    operationCount: options.plan.operations.length,
    changedRows: changedInfo.totalChanged,
    failedRows: failures.length,
    warnings: options.plan.warnings
  };

  return {
    columns: workingColumns,
    rows: workingRows,
    summary,
    failures,
    changedOnlyPreview: {
      columns: changedInfo.columns,
      rows: changedInfo.rows
    }
  };
}
