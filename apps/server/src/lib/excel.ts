import { readFileSync, writeFileSync } from "node:fs";

import XLSX from "xlsx";

type ParsedRow = {
  __rowIndex: number;
  [key: string]: unknown;
};

export type ParsedSheet = {
  sheetName: string;
  columns: string[];
  rows: ParsedRow[];
  total: number;
};

export type ParsedWorkbookArtifact = {
  sheets: Record<string, ParsedSheet>;
  sheetOrder: string[];
};

const WORKBOOK_LIMITS = {
  maxSheets: 20,
  maxRowsPerSheet: 50_000,
  maxColumnsPerSheet: 256,
  maxCellsPerSheet: 200_000,
  maxCellsPerWorkbook: 500_000,
  maxCellTextLength: 10_000
} as const;
const CELL_ADDRESS_PATTERN = /^[A-Z]{1,4}[1-9]\d*$/;

function normalizeHeader(value: unknown, index: number) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : `未命名列_${index + 1}`;
}

function getSheetRangeStats(worksheet: XLSX.WorkSheet, sheetName: string) {
  const ref = worksheet["!ref"];
  if (!ref) {
    return {
      hasRange: false,
      range: null,
      rows: 0,
      columns: 0,
      cells: 0
    };
  }

  let range: XLSX.Range;
  try {
    range = XLSX.utils.decode_range(ref);
  } catch {
    throw new Error(`Sheet ${sheetName} 的数据范围无效，无法解析。`);
  }

  const rows = range.e.r - range.s.r + 1;
  const columns = range.e.c - range.s.c + 1;
  if (rows <= 0 || columns <= 0) {
    throw new Error(`Sheet ${sheetName} 的数据范围无效，无法解析。`);
  }

  return {
    hasRange: true,
    range,
    rows,
    columns,
    cells: rows * columns
  };
}

function assertWorksheetCellAddresses(options: {
  worksheet: XLSX.WorkSheet;
  sheetName: string;
  hasRange: boolean;
  range: XLSX.Range | null;
}) {
  let explicitCellCount = 0;
  const { worksheet, sheetName, hasRange, range } = options;

  for (const key of Object.keys(worksheet)) {
    if (key.startsWith("!")) {
      continue;
    }

    if (!CELL_ADDRESS_PATTERN.test(key)) {
      continue;
    }

    const cell = XLSX.utils.decode_cell(key);
    const row = cell.r + 1;
    const column = cell.c + 1;

    if (row > WORKBOOK_LIMITS.maxRowsPerSheet || column > WORKBOOK_LIMITS.maxColumnsPerSheet) {
      throw new Error(
        `Sheet ${sheetName} 检测到超出服务端限制的单元格地址 ${key}（最大 ${WORKBOOK_LIMITS.maxRowsPerSheet} 行、${WORKBOOK_LIMITS.maxColumnsPerSheet} 列）。`
      );
    }

    if (
      hasRange &&
      range &&
      (cell.r < range.s.r || cell.r > range.e.r || cell.c < range.s.c || cell.c > range.e.c)
    ) {
      throw new Error(
        `Sheet ${sheetName} 存在超出声明范围（!ref=${worksheet["!ref"]}）的单元格 ${key}。请重新导出后再上传。`
      );
    }

    explicitCellCount += 1;
    if (explicitCellCount > WORKBOOK_LIMITS.maxCellsPerSheet) {
      throw new Error(
        `Sheet ${sheetName} 检测到过多有效单元格（最多 ${WORKBOOK_LIMITS.maxCellsPerSheet} 个）。`
      );
    }
  }

  if (!hasRange && explicitCellCount > 0) {
    throw new Error(
      `Sheet ${sheetName} 缺少有效数据范围定义（!ref），但包含单元格内容。请重新导出后再上传。`
    );
  }
}

function assertWorksheetMerges(
  worksheet: XLSX.WorkSheet,
  sheetName: string
) {
  const merges = worksheet["!merges"];
  if (!Array.isArray(merges) || merges.length === 0) {
    return;
  }

  if (merges.length > WORKBOOK_LIMITS.maxCellsPerSheet) {
    throw new Error(
      `Sheet ${sheetName} 合并单元格配置过多（最多 ${WORKBOOK_LIMITS.maxCellsPerSheet} 条）。`
    );
  }

  let mergedCells = 0;
  for (let index = 0; index < merges.length; index += 1) {
    const merge = merges[index] as Partial<XLSX.Range> | undefined;
    if (
      !merge ||
      !merge.s ||
      !merge.e ||
      !Number.isInteger(merge.s.r) ||
      !Number.isInteger(merge.s.c) ||
      !Number.isInteger(merge.e.r) ||
      !Number.isInteger(merge.e.c)
    ) {
      throw new Error(`Sheet ${sheetName} 的合并单元格配置无效（第 ${index + 1} 条）。`);
    }

    const rows = merge.e.r - merge.s.r + 1;
    const columns = merge.e.c - merge.s.c + 1;

    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows <= 0 || columns <= 0) {
      throw new Error(`Sheet ${sheetName} 的合并单元格配置无效（第 ${index + 1} 条）。`);
    }

    if (merge.e.r + 1 > WORKBOOK_LIMITS.maxRowsPerSheet) {
      throw new Error(
        `Sheet ${sheetName} 的合并单元格范围超过服务端限制（最多 ${WORKBOOK_LIMITS.maxRowsPerSheet} 行）。`
      );
    }

    if (merge.e.c + 1 > WORKBOOK_LIMITS.maxColumnsPerSheet) {
      throw new Error(
        `Sheet ${sheetName} 的合并单元格范围超过服务端限制（最多 ${WORKBOOK_LIMITS.maxColumnsPerSheet} 列）。`
      );
    }

    const mergeCells = rows * columns;
    if (mergeCells > WORKBOOK_LIMITS.maxCellsPerSheet) {
      throw new Error(
        `Sheet ${sheetName} 的单条合并单元格规模过大（最多 ${WORKBOOK_LIMITS.maxCellsPerSheet} 个）。`
      );
    }

    mergedCells += mergeCells;
    if (mergedCells > WORKBOOK_LIMITS.maxCellsPerWorkbook) {
      throw new Error(
        `Sheet ${sheetName} 的合并单元格总规模过大（最多 ${WORKBOOK_LIMITS.maxCellsPerWorkbook} 个）。`
      );
    }
  }
}

function findDuplicateHeaders(columns: string[]) {
  const counts = new Map<string, number>();
  const duplicates = new Set<string>();

  for (const column of columns) {
    const nextCount = (counts.get(column) ?? 0) + 1;
    counts.set(column, nextCount);
    if (nextCount > 1) {
      duplicates.add(column);
    }
  }

  return Array.from(duplicates);
}

function assertCellTextLength(
  value: unknown,
  sheetName: string,
  rowIndex: number,
  columnIndex: number
) {
  const text = String(value ?? "");
  if (text.length > WORKBOOK_LIMITS.maxCellTextLength) {
    throw new Error(
      `Sheet ${sheetName} 第 ${rowIndex} 行第 ${columnIndex} 列内容过长，单元格内容不能超过 ${WORKBOOK_LIMITS.maxCellTextLength} 个字符。`
    );
  }
}

export function parseWorkbook(filePath: string): ParsedWorkbookArtifact {
  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
    cellText: false,
    dense: false
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("工作簿为空");
  }

  if (workbook.SheetNames.length > WORKBOOK_LIMITS.maxSheets) {
    throw new Error(
      `工作簿包含 ${workbook.SheetNames.length} 个工作表，超过服务端限制（最多 ${WORKBOOK_LIMITS.maxSheets} 个）。`
    );
  }

  let workbookCellCount = 0;

  const sheets = Object.fromEntries(
    workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet ${sheetName} 缺失`);
      }

      const sheetStats = getSheetRangeStats(worksheet, sheetName);
      assertWorksheetCellAddresses({
        worksheet,
        sheetName,
        hasRange: sheetStats.hasRange,
        range: sheetStats.range
      });
      assertWorksheetMerges(worksheet, sheetName);

      if (sheetStats.rows > WORKBOOK_LIMITS.maxRowsPerSheet) {
        throw new Error(
          `Sheet ${sheetName} 行数超过服务端限制（最多 ${WORKBOOK_LIMITS.maxRowsPerSheet} 行）。`
        );
      }

      if (sheetStats.columns > WORKBOOK_LIMITS.maxColumnsPerSheet) {
        throw new Error(
          `Sheet ${sheetName} 列数超过服务端限制（最多 ${WORKBOOK_LIMITS.maxColumnsPerSheet} 列）。`
        );
      }

      if (sheetStats.cells > WORKBOOK_LIMITS.maxCellsPerSheet) {
        throw new Error(
          `Sheet ${sheetName} 单元格规模超过服务端限制（最多 ${WORKBOOK_LIMITS.maxCellsPerSheet} 个）。`
        );
      }

      workbookCellCount += sheetStats.cells;
      if (workbookCellCount > WORKBOOK_LIMITS.maxCellsPerWorkbook) {
        throw new Error(
          `工作簿单元格总量超过服务端限制（最多 ${WORKBOOK_LIMITS.maxCellsPerWorkbook} 个）。`
        );
      }

      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
        worksheet,
        {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false
        }
      );

      const headerRow = matrix[0] ?? [];
      headerRow.forEach((cell, index) => {
        assertCellTextLength(cell, sheetName, 1, index + 1);
      });
      const columns = headerRow.map((cell, index) => normalizeHeader(cell, index));

      if (columns.length === 0) {
        throw new Error(`Sheet ${sheetName} 的表头为空`);
      }

      const duplicateHeaders = findDuplicateHeaders(columns);
      if (duplicateHeaders.length > 0) {
        throw new Error(
          `Sheet ${sheetName} 存在重复表头：${duplicateHeaders.join("、")}。请修改后重新上传。`
        );
      }

      const rows = matrix.slice(1).map((cells, rowIndex) => {
        const row: ParsedRow = {
          __rowIndex: rowIndex + 2
        };

        columns.forEach((column, columnIndex) => {
          const cellValue = cells[columnIndex] ?? "";
          assertCellTextLength(cellValue, sheetName, rowIndex + 2, columnIndex + 1);
          row[column] = cellValue;
        });

        return row;
      });

      const parsedSheet: ParsedSheet = {
        sheetName,
        columns,
        rows,
        total: rows.length
      };

      return [sheetName, parsedSheet];
    })
  );

  return {
    sheets,
    sheetOrder: workbook.SheetNames
  };
}

export function buildPreview(sheet: ParsedSheet, limit = 20) {
  return {
    columns: sheet.columns,
    rows: sheet.rows.slice(0, limit),
    total: sheet.total
  };
}

export function writeParsedWorkbookArtifact(
  artifactPath: string,
  artifact: ParsedWorkbookArtifact
) {
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
}

export function readParsedWorkbookArtifact(artifactPath: string): ParsedWorkbookArtifact {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as ParsedWorkbookArtifact;
}

export function exportWorkbook(options: {
  outputPath: string;
  sheetName: string;
  columns: string[];
  rows: ParsedRow[];
  report: {
    summaryLines: string[];
    failures: Array<{ rowIndex: number; operationType: string; reason: string }>;
  };
}) {
  const workbook = XLSX.utils.book_new();
  const content = [
    options.columns,
    ...options.rows.map((row) => options.columns.map((column) => row[column] ?? ""))
  ];

  const resultSheet = XLSX.utils.aoa_to_sheet(content);
  XLSX.utils.book_append_sheet(
    workbook,
    resultSheet,
    options.sheetName.slice(0, 31) || "Result"
  );

  const reportRows: unknown[][] = [
    ["处理摘要"],
    ...options.report.summaryLines.map((line) => [line]),
    [],
    ["失败记录"],
    ["行号", "操作类型", "失败原因"],
    ...options.report.failures.map((item) => [
      item.rowIndex,
      item.operationType,
      item.reason
    ])
  ];

  const reportSheet = XLSX.utils.aoa_to_sheet(reportRows);
  XLSX.utils.book_append_sheet(workbook, reportSheet, "报告");
  XLSX.writeFile(workbook, options.outputPath);
}
