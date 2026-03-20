import { readMetadataStore, writeMetadataStore } from "./database";

type FileRecord = {
  id: string;
  original_name: string;
  stored_path: string;
  parse_artifact_path: string;
  file_ext: string;
  file_size: number;
  sheets_json: string;
  default_sheet: string;
  preview_json: string;
  created_at: string;
};

type TaskRecord = {
  id: string;
  file_id: string;
  sheet_name: string;
  user_request: string;
  plan_json: string;
  status: string;
  changed_rows: number;
  failed_rows: number;
  output_path: string | null;
  summary_json: string | null;
  preview_json: string | null;
  changed_preview_json: string | null;
  failures_json: string | null;
  created_at: string;
  finished_at: string | null;
};

export function insertFile(record: FileRecord) {
  const store = readMetadataStore();
  store.files.push(record);
  writeMetadataStore(store);
}

export function findFileById(id: string) {
  const store = readMetadataStore();
  return store.files.find((item) => (item as FileRecord).id === id) as
    | FileRecord
    | undefined;
}

export function insertTask(record: {
  id: string;
  file_id: string;
  sheet_name: string;
  user_request: string;
  plan_json: string;
  status: string;
  created_at: string;
}) {
  const store = readMetadataStore();
  store.tasks.push({
    ...record,
    changed_rows: 0,
    failed_rows: 0,
    output_path: null,
    summary_json: null,
    preview_json: null,
    changed_preview_json: null,
    failures_json: null,
    finished_at: null
  });
  writeMetadataStore(store);
}

export function setTaskStatus(record: {
  id: string;
  status: string;
}) {
  const store = readMetadataStore();
  store.tasks = store.tasks.map((item) => {
    const task = item as TaskRecord;
    if (task.id !== record.id) {
      return task;
    }

    return {
      ...task,
      status: record.status
    };
  });
  writeMetadataStore(store);
}

export function updateTask(record: {
  id: string;
  status: string;
  changed_rows: number;
  failed_rows: number;
  output_path: string | null;
  summary_json: string;
  preview_json: string;
  changed_preview_json: string;
  failures_json: string;
  finished_at: string;
}) {
  const store = readMetadataStore();
  store.tasks = store.tasks.map((item) => {
    const task = item as TaskRecord;
    if (task.id !== record.id) {
      return task;
    }

    return {
      ...task,
      ...record
    };
  });
  writeMetadataStore(store);
}

export function failTask(record: {
  id: string;
  status: string;
  failed_rows: number;
  finished_at: string;
  summary_json?: string;
  failures_json?: string;
}) {
  const store = readMetadataStore();
  store.tasks = store.tasks.map((item) => {
    const task = item as TaskRecord;
    if (task.id !== record.id) {
      return task;
    }

    return {
      ...task,
      status: record.status,
      failed_rows: record.failed_rows,
      finished_at: record.finished_at,
      summary_json: record.summary_json ?? task.summary_json,
      failures_json: record.failures_json ?? task.failures_json
    };
  });
  writeMetadataStore(store);
}

export function findTaskById(id: string) {
  const store = readMetadataStore();
  return store.tasks.find((item) => (item as TaskRecord).id === id) as
    | TaskRecord
    | undefined;
}

export function listTasks(options?: { limit?: number }) {
  const store = readMetadataStore();
  const limit = options?.limit && Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 20;
  const tasks = store.tasks as TaskRecord[];
  const files = store.files as FileRecord[];

  return tasks
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((record) => {
      const file = files.find((item) => item.id === record.file_id);
      return {
        taskId: record.id,
        status: record.status,
        fileId: record.file_id,
        fileName: file ? file.original_name : record.file_id,
        sheetName: record.sheet_name,
        userRequest: record.user_request,
        changedRows: record.changed_rows,
        failedRows: record.failed_rows,
        createdAt: record.created_at,
        finishedAt: record.finished_at
      };
    });
}
