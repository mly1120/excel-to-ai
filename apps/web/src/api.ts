import axios from "axios";

import type {
  AiPlan,
  ApiErrorResponse,
  ExecuteTaskRequest,
  ExecuteTaskResponse,
  GetPreviewResponse,
  RecentTaskItem,
  RecentTasksResponse,
  TaskResultResponse,
  UploadFileResponse
} from "@shared";

const http = axios.create({
  baseURL: "/api"
});

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export async function uploadExcel(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await http.post<ApiEnvelope<UploadFileResponse>>(
    "/files/upload",
    formData
  );
  return data.data;
}

export async function fetchPreview(fileId: string, sheetName: string) {
  const { data } = await http.get<ApiEnvelope<GetPreviewResponse>>(
    `/files/${encodeURIComponent(fileId)}/sheets/${encodeURIComponent(sheetName)}/preview`
  );
  return data.data;
}

export async function generatePlan(payload: {
  fileId: string;
  sheetName: string;
  userRequest: string;
}) {
  const { data } = await http.post<ApiEnvelope<AiPlan>>("/ai/plan", payload);
  return data.data;
}

export async function executeTask(payload: ExecuteTaskRequest) {
  const { data } = await http.post<ApiEnvelope<ExecuteTaskResponse>>(
    "/tasks/execute",
    payload
  );
  return data.data;
}

export async function fetchTaskResult(taskId: string) {
  const { data } = await http.get<ApiEnvelope<TaskResultResponse>>(
    `/tasks/${encodeURIComponent(taskId)}/result`
  );
  return data.data;
}

export async function fetchRecentTasks() {
  const { data } = await http.get<ApiEnvelope<RecentTasksResponse>>("/tasks");
  return data.data.tasks;
}

export type { RecentTaskItem };

export function getErrorMessage(error: unknown, fallback = "请求失败") {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error.message ?? error.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
