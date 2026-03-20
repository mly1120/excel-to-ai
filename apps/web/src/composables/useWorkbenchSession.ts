import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";

import type { AiPlan, Operation, PreviewData, TaskResultResponse, TaskStatus } from "@shared";

import {
  executeTask,
  fetchPreview,
  fetchTaskResult,
  generatePlan,
  getErrorMessage,
  uploadExcel,
} from "../api";
import { workbenchCatalog } from "../config/workbenchCatalog";

export type WorkspaceMode = "dashboard" | "draft" | "running" | "result";
export type ResultTab = "preview" | "changed" | "failures";
export type MainStageTab = "preview" | "result";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  status?: "streaming" | "done" | "error";
};

export type PlanChecklistStatus = "pending" | "running" | "done" | "failed";

export type PlanChecklistItem = {
  id: string;
  label: string;
  status: PlanChecklistStatus;
};

const DEFAULT_REQUEST = "去掉手机号前后空格，把金额保留两位小数，并新增省份列。";
const REQUEST_TEMPLATES = [
  "去掉手机号前后空格，把金额保留两位小数，并新增省份列。",
  "删除手机号为空的行，并按手机号去重。",
  "把标题压缩到 20 个字以内，输出到新列。",
];
const MAX_UPLOAD_SIZE_MB = 20;
const ACCEPTED_FILE_EXTENSIONS = [".xlsx", ".xls"];
const TASK_POLL_INTERVAL_MS = 1500;
const TASK_POLL_MAX_ATTEMPTS = 120;
const LAST_TASK_STORAGE_KEY = "excel-to-ai:last-task-id";

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function createMessage(
  role: ChatMessage["role"],
  text: string,
  status: ChatMessage["status"] = "done",
): ChatMessage {
  return {
    id: `${role}-${nowIso()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: nowIso(),
    status,
  };
}

function buildWelcomeMessage() {
  return createMessage(
    "assistant",
    "上传 Excel 后，直接告诉我你想怎么处理。我会先用自然语言总结动作，再帮你发起执行。",
  );
}

function isTerminalStatus(status: TaskStatus) {
  return status === "success" || status === "partial_success" || status === "failed";
}

function describeDeleteCondition(operation: Extract<Operation, { type: "delete_rows" }>) {
  switch (operation.condition.operator) {
    case "is_empty":
      return `“${operation.condition.column}”为空`;
    case "equals":
      return `“${operation.condition.column}”等于“${operation.condition.value ?? ""}”`;
    case "not_equals":
      return `“${operation.condition.column}”不等于“${operation.condition.value ?? ""}”`;
  }
}

function describeOperation(operation: Operation) {
  switch (operation.type) {
    case "trim":
      return `清理“${operation.column}”前后空格`;
    case "format_number":
      return `将“${operation.column}”统一为 ${operation.digits} 位小数`;
    case "derive_column":
      return `基于“${operation.sourceColumn}”生成“${operation.targetColumn}”`;
    case "delete_rows":
      return `删除满足条件的行：${describeDeleteCondition(operation)}`;
    case "deduplicate":
      return `按“${operation.column}”去重，保留${operation.keep === "first" ? "首条" : "末条"}记录`;
    case "map_values":
      return `映射“${operation.column}”中的 ${Object.keys(operation.mapping).length} 个值`;
    case "ai_transform":
      return `用 AI 处理“${operation.sourceColumn}”，并写入“${operation.targetColumn}”`;
  }
}

function buildPlanMessage(plan: AiPlan, sheetName: string) {
  const steps = plan.operations
    .slice(0, 4)
    .map((operation, index) => `${index + 1}. ${describeOperation(operation)}`)
    .join("\n");

  const warnings = plan.warnings.length
    ? `\n\n需要注意：${plan.warnings.join("；")}`
    : "";

  return [
    `我理解你的需求是：${plan.summary}`,
    "",
    `工作表：${sheetName}`,
    "",
    "将执行这些处理：",
    steps || "1. 按你的描述生成处理方案",
  ].join("\n") + warnings;
}

function buildRunningMessage(status: TaskStatus) {
  if (status === "pending") {
    return "任务已创建，正在进入执行队列。";
  }

  return "任务正在后台执行，主画面仍然可以继续查看预览和上下文。";
}

function buildResultMessage(result: TaskResultResponse) {
  if (result.status === "success") {
    return `已执行 ${result.summary.operationCount} 个处理动作，处理 ${result.preview.total} 行，修改 ${result.summary.changedRows} 行。`;
  }

  if (result.status === "partial_success") {
    return `已执行 ${result.summary.operationCount} 个处理动作，成功更新 ${result.summary.changedRows} 行，另有 ${result.summary.failedRows} 条失败待复核。`;
  }

  return `本轮尝试执行 ${result.summary.operationCount} 个处理动作，但失败 ${result.summary.failedRows} 条。${result.failures[0]?.reason ?? "请查看失败原因。"}`
}

function readSavedTaskId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(LAST_TASK_STORAGE_KEY) ?? "";
}

function saveTaskId(taskId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAST_TASK_STORAGE_KEY, taskId);
}

function clearSavedTaskId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LAST_TASK_STORAGE_KEY);
}

function resolveSheetsFromTaskResult(result: TaskResultResponse) {
  const maybeSheets = (result as TaskResultResponse & { sheets?: unknown }).sheets;
  const normalizedSheets = Array.isArray(maybeSheets)
    ? maybeSheets.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (normalizedSheets.length > 0) {
    if (normalizedSheets.includes(result.sheetName)) {
      return normalizedSheets;
    }
    return [result.sheetName, ...normalizedSheets];
  }

  return result.sheetName ? [result.sheetName] : [];
}

export function useWorkbenchSession() {
  const taskPollToken = ref(0);
  const taskRefreshToken = ref(0);

  const session = reactive({
    fileId: "",
    fileName: "",
    selectedFileName: "",
    sheets: [] as string[],
    selectedSheet: "",
    preview: null as PreviewData | null,
    isUploading: false,
    isLoadingPreview: false,
    isDragOver: false,
    acceptedExtensions: ACCEPTED_FILE_EXTENSIONS,
    maxUploadSizeMb: MAX_UPLOAD_SIZE_MB,
    get hasFile() {
      return Boolean(this.fileId);
    },
    get previewColumns() {
      return this.preview?.columns ?? [];
    },
    get previewRows() {
      return this.preview?.rows ?? [];
    },
    get previewTotal() {
      return this.preview?.total ?? 0;
    },
  });

  const planState = reactive({
    plan: null as AiPlan | null,
    planUserRequest: "",
    isGenerating: false,
    get hasPlan() {
      return Boolean(this.plan);
    },
    get operationCount() {
      return this.plan?.operations.length ?? 0;
    },
    get warnings() {
      return this.plan?.warnings ?? [];
    },
  });

  const taskState = reactive({
    currentTaskId: "",
    currentTaskStatus: null as TaskStatus | null,
    currentTaskCreatedAt: "",
    taskResult: null as TaskResultResponse | null,
    activeResultTab: "preview" as ResultTab,
    activeMainStage: "preview" as MainStageTab,
    isExecuting: false,
    get latestTaskId() {
      return this.taskResult?.taskId ?? this.currentTaskId;
    },
    get latestTaskStatus() {
      return this.taskResult?.status ?? this.currentTaskStatus;
    },
    get displayTaskStatus(): TaskStatus {
      return this.latestTaskStatus ?? "pending";
    },
    get hasTaskState() {
      return Boolean(this.latestTaskId);
    },
    get isTaskInProgress() {
      return this.latestTaskStatus === "pending" || this.latestTaskStatus === "running";
    },
    get canDownloadResult() {
      return (
        this.taskResult?.status === "success" ||
        this.taskResult?.status === "partial_success"
      );
    },
    get executionStatusText() {
      if (!this.latestTaskStatus || isTerminalStatus(this.latestTaskStatus)) {
        return "";
      }

      return buildRunningMessage(this.latestTaskStatus);
    },
    get resultPreviewColumns() {
      return this.taskResult?.preview.columns ?? [];
    },
    get resultPreviewRows() {
      return this.taskResult?.preview.rows ?? [];
    },
    get resultPreviewTotal() {
      return this.taskResult?.preview.total ?? 0;
    },
    get changedPreviewRows() {
      return this.taskResult?.changedOnlyPreview.rows ?? [];
    },
    get failures() {
      return this.taskResult?.failures ?? [];
    },
    get resultSummaryText() {
      if (!this.taskResult) {
        return "";
      }

      return buildResultMessage(this.taskResult);
    },
    get executionSummaryText() {
      return this.resultSummaryText;
    },
  });

  const chatState = reactive({
    input: DEFAULT_REQUEST,
    requestTemplates: [...REQUEST_TEMPLATES],
    messages: [buildWelcomeMessage()] as ChatMessage[],
    get hasMessages() {
      return this.messages.length > 0;
    },
  });

  const workspaceMode = computed<WorkspaceMode>(() => {
    if (taskState.isTaskInProgress) {
      return "running";
    }

    if (taskState.taskResult) {
      return "result";
    }

    if (session.hasFile || session.preview) {
      return "draft";
    }

    return "dashboard";
  });

  const planChecklist = computed<PlanChecklistItem[]>(() => {
    if (!planState.plan) {
      return [];
    }

    let status: PlanChecklistStatus = "pending";
    if (taskState.isTaskInProgress) {
      status = "running";
    } else if (taskState.taskResult?.status === "failed") {
      status = "failed";
    } else if (taskState.taskResult) {
      status = "done";
    }

    if (!planState.plan.operations.length) {
      return [
        {
          id: "plan-summary",
          label: planState.plan.summary || "按当前需求生成处理方案",
          status,
        },
      ];
    }

    return planState.plan.operations.map((operation, index) => ({
      id: `plan-${index + 1}-${operation.type}`,
      label: describeOperation(operation),
      status,
    }));
  });

  const suggestedNextPrompts = computed(() => {
    const prompts: string[] = [];

    if (taskState.taskResult?.status === "failed" || taskState.taskResult?.status === "partial_success") {
      prompts.push("优先处理失败记录，并补一列失败原因说明。");
    }

    if (planState.plan?.operations.length) {
      prompts.push(`基于当前计划，再补一条规则并重新生成建议。`);
    }

    prompts.push(...workbenchCatalog.suggestedNextPrompts);
    prompts.push(...REQUEST_TEMPLATES);

    return Array.from(new Set(prompts.map((item) => item.trim()).filter(Boolean))).slice(0, 6);
  });

  const executionSummaryText = computed(() => {
    return taskState.executionSummaryText;
  });

  function setDragOver(value: boolean) {
    session.isDragOver = value;
  }

  function resetComposerTemplates() {
    chatState.requestTemplates = [...REQUEST_TEMPLATES];
  }

  function useSuggestedPromptsAsTemplates() {
    chatState.requestTemplates = [...suggestedNextPrompts.value];
  }

  function resetChatMessages(...messages: ChatMessage[]) {
    chatState.messages = messages.length ? messages : [buildWelcomeMessage()];
  }

  function updateRequest(value: string) {
    chatState.input = value;
  }

  function applyTemplate(template: string) {
    updateRequest(template);
  }

  function clearTaskState({ clearSavedId = false }: { clearSavedId?: boolean } = {}) {
    taskPollToken.value += 1;
    taskRefreshToken.value += 1;
    taskState.currentTaskId = "";
    taskState.currentTaskStatus = null;
    taskState.currentTaskCreatedAt = "";
    taskState.taskResult = null;
    taskState.activeResultTab = "preview";
    taskState.activeMainStage = "preview";

    if (clearSavedId) {
      clearSavedTaskId();
    }
  }

  function clearPlanAndTaskState(options?: { clearSavedId?: boolean }) {
    planState.plan = null;
    planState.planUserRequest = "";
    clearTaskState(options);
    resetComposerTemplates();
  }

  function resetWorkspace() {
    session.fileId = "";
    session.fileName = "";
    session.selectedFileName = "";
    session.sheets = [];
    session.selectedSheet = "";
    session.preview = null;
    session.isUploading = false;
    session.isLoadingPreview = false;
    session.isDragOver = false;

    planState.isGenerating = false;
    planState.plan = null;
    planState.planUserRequest = "";

    taskState.isExecuting = false;
    clearTaskState({ clearSavedId: true });

    chatState.input = DEFAULT_REQUEST;
    resetComposerTemplates();
    resetChatMessages();
  }

  function hasAcceptedExtension(fileName: string) {
    const lower = fileName.toLowerCase();
    return ACCEPTED_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
  }

  function validateFile(file: File) {
    if (!hasAcceptedExtension(file.name)) {
      ElMessage.warning("仅支持上传 .xlsx 和 .xls 文件。");
      return false;
    }

    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      ElMessage.warning(`文件大小不能超过 ${MAX_UPLOAD_SIZE_MB}MB。`);
      return false;
    }

    return true;
  }

  async function loadPreview(fileId: string, sheetName: string) {
    const result = await fetchPreview(fileId, sheetName);
    session.selectedSheet = result.sheetName;
    session.preview = result.preview;
    return result.preview;
  }

  async function uploadFile(file: File) {
    if (!validateFile(file)) {
      return null;
    }

    resetWorkspace();
    session.selectedFileName = file.name;
    session.isUploading = true;

    try {
      const result = await uploadExcel(file);
      session.fileId = result.fileId;
      session.fileName = result.fileName;
      session.sheets = result.sheets;
      session.selectedSheet = result.defaultSheet;
      session.preview = result.defaultPreview;
      resetComposerTemplates();
      resetChatMessages(
        createMessage(
          "assistant",
          `文件《${result.fileName}》已载入，当前工作表是《${result.defaultSheet}》。你可以直接描述想怎么处理。`,
        ),
      );
      ElMessage.success("文件上传并解析完成。");
      return result;
    } catch (error) {
      resetWorkspace();
      ElMessage.error(getErrorMessage(error, "文件上传失败"));
      return null;
    } finally {
      session.isUploading = false;
    }
  }

  async function selectSheet(sheetName: string) {
    if (!session.fileId || !sheetName) {
      return null;
    }

    session.isLoadingPreview = true;
    clearPlanAndTaskState({ clearSavedId: true });

    try {
      const preview = await loadPreview(session.fileId, sheetName);
      resetChatMessages(
        createMessage(
          "assistant",
          `已切换到工作表《${sheetName}》，现在可以继续描述你的处理需求。`,
        ),
      );
      ElMessage.success("工作表预览已更新。");
      return preview;
    } catch (error) {
      ElMessage.error(getErrorMessage(error, "读取预览失败"));
      return null;
    } finally {
      session.isLoadingPreview = false;
    }
  }

  async function generatePlanAction() {
    const userRequest = chatState.input.trim();
    if (!session.fileId || !session.selectedSheet || !userRequest) {
      ElMessage.warning("请先上传文件并填写处理需求。");
      return null;
    }

    if (taskState.isTaskInProgress) {
      ElMessage.warning("当前任务正在执行中，请等待完成后再生成新的建议。");
      return null;
    }

    if (taskState.isExecuting) {
      ElMessage.warning("当前任务仍在执行中，请等待完成后再生成新的建议。");
      return null;
    }

    planState.isGenerating = true;

    try {
      const plan = await generatePlan({
        fileId: session.fileId,
        sheetName: session.selectedSheet,
        userRequest,
      });

      clearTaskState({ clearSavedId: true });
      planState.plan = plan;
      planState.planUserRequest = userRequest;
      resetComposerTemplates();
      resetChatMessages(
        createMessage("user", userRequest),
        createMessage("assistant", buildPlanMessage(plan, session.selectedSheet)),
      );
      ElMessage.success("AI 处理建议已生成。");
      return plan;
    } catch (error) {
      ElMessage.error(getErrorMessage(error, "生成 AI 建议失败"));
      return null;
    } finally {
      planState.isGenerating = false;
    }
  }

  async function hydrateSessionFromTask(result: TaskResultResponse, refreshToken: number) {
    let nextPreview: PreviewData | null = null;

    try {
      const previewResult = await fetchPreview(result.fileId, result.sheetName);
      if (refreshToken !== taskRefreshToken.value) {
        return false;
      }
      nextPreview = previewResult.preview;
    } catch {
      if (refreshToken !== taskRefreshToken.value) {
        return false;
      }
      nextPreview = null;
    }

    if (refreshToken !== taskRefreshToken.value) {
      return false;
    }

    session.fileId = result.fileId;
    session.fileName = result.fileName;
    session.sheets = resolveSheetsFromTaskResult(result);
    session.selectedSheet = result.sheetName;
    session.preview = nextPreview;
    chatState.input = result.userRequest;

    return true;
  }

  function syncChatForTaskResult(result: TaskResultResponse) {
    useSuggestedPromptsAsTemplates();
    resetChatMessages(
      createMessage("user", result.userRequest),
      createMessage("assistant", buildResultMessage(result)),
    );
  }

  async function refreshTask(taskId = taskState.currentTaskId, options?: { silent?: boolean }) {
    if (!taskId) {
      return null;
    }

    if (taskId !== taskState.latestTaskId) {
      taskPollToken.value += 1;
    }

    const refreshToken = ++taskRefreshToken.value;
    const currentActiveTaskId = taskState.latestTaskId;
    const isRestoringDifferentTask = taskId !== currentActiveTaskId;
    if (isRestoringDifferentTask) {
      // 后端结果接口不返回可重建的 plan 详情，切任务时必须清掉旧计划，避免误导展示。
      planState.plan = null;
      planState.planUserRequest = "";
    }

    const result = await fetchTaskResult(taskId);
    if (refreshToken !== taskRefreshToken.value) {
      return null;
    }

    taskState.currentTaskId = result.taskId;
    taskState.currentTaskStatus = result.status;
    taskState.currentTaskCreatedAt = result.createdAt;

    const hydrated = await hydrateSessionFromTask(result, refreshToken);
    if (!hydrated || refreshToken !== taskRefreshToken.value) {
      return null;
    }
    saveTaskId(result.taskId);

    if (isTerminalStatus(result.status)) {
      taskState.taskResult = result;
      taskState.activeResultTab = result.status === "failed" ? "failures" : "preview";
      taskState.activeMainStage = "result";
      syncChatForTaskResult(result);

      if (!options?.silent) {
        if (result.status === "success") {
          ElMessage.success("任务执行完成，可以直接下载结果。");
        } else if (result.status === "partial_success") {
          ElMessage.warning("任务已完成，但有部分失败记录需要复核。");
        } else {
          ElMessage.error(buildResultMessage(result));
        }
      }
    } else {
      taskState.taskResult = null;
      taskState.activeResultTab = "preview";
      taskState.activeMainStage = "preview";
      resetComposerTemplates();
      resetChatMessages(
        createMessage("user", result.userRequest),
        createMessage("assistant", buildRunningMessage(result.status)),
      );
    }

    return result;
  }

  async function pollTaskResult(taskId: string) {
    const pollToken = ++taskPollToken.value;

    for (let attempt = 0; attempt < TASK_POLL_MAX_ATTEMPTS; attempt += 1) {
      const result = await fetchTaskResult(taskId);

      if (pollToken !== taskPollToken.value || taskState.currentTaskId !== taskId) {
        return null;
      }

      taskState.currentTaskStatus = result.status;

      if (isTerminalStatus(result.status)) {
        await refreshTask(taskId);
        return result;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }

    throw new Error("任务仍在后台执行，请稍后手动刷新状态。");
  }

  async function executePlanAction() {
    if (!session.fileId || !session.selectedSheet || !planState.plan) {
      ElMessage.warning("请先生成可执行的处理建议。");
      return null;
    }

    if (taskState.isExecuting) {
      return null;
    }

    const planForExecution = planState.plan;
    const planUserRequest = planState.planUserRequest.trim();
    const currentRequest = chatState.input.trim();
    const requestForExecution = planUserRequest || currentRequest;

    if (!requestForExecution) {
      ElMessage.warning("请先输入处理需求并生成建议。");
      return null;
    }

    if (planUserRequest && currentRequest && currentRequest !== planUserRequest) {
      ElMessage.warning("当前需求已修改，请先重新生成 AI 建议，再执行任务。");
      return null;
    }

    taskState.isExecuting = true;
    clearTaskState();
    resetComposerTemplates();

    try {
      const execution = await executeTask({
        fileId: session.fileId,
        sheetName: session.selectedSheet,
        plan: planForExecution,
        userRequest: requestForExecution,
      });

      taskState.currentTaskId = execution.taskId;
      taskState.currentTaskStatus = execution.status;
      taskState.currentTaskCreatedAt = execution.createdAt;
      saveTaskId(execution.taskId);

      resetChatMessages(
        createMessage("user", requestForExecution),
        createMessage("assistant", buildPlanMessage(planForExecution, session.selectedSheet)),
        createMessage("assistant", buildRunningMessage(execution.status)),
      );

      ElMessage.info("任务已提交，正在后台执行。");

      await pollTaskResult(execution.taskId);
      return execution;
    } catch (error) {
      if (taskState.currentTaskId) {
        ElMessage.warning(getErrorMessage(error, "任务仍在后台执行，请稍后刷新状态。"));
      } else {
        ElMessage.error(getErrorMessage(error, "执行任务失败"));
      }

      return null;
    } finally {
      taskState.isExecuting = false;
    }
  }

  function downloadResult() {
    if (!taskState.canDownloadResult || !taskState.taskResult) {
      ElMessage.warning("当前任务还没有可下载的结果文件。");
      return;
    }

    window.open(taskState.taskResult.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function openTask(taskId: string, options?: { silent?: boolean }) {
    try {
      if (taskId !== taskState.latestTaskId) {
        // 先清空旧计划，避免历史任务切换期间闪现上一任务计划。
        planState.plan = null;
        planState.planUserRequest = "";
      }
      return await refreshTask(taskId, options);
    } catch (error) {
      ElMessage.error(getErrorMessage(error, "恢复任务失败"));
      return null;
    }
  }

  function setActiveResultTab(tab: ResultTab) {
    taskState.activeResultTab = tab;
  }

  function setActiveMainStage(stage: MainStageTab) {
    taskState.activeMainStage = stage;
  }

  onMounted(() => {
    const savedTaskId = readSavedTaskId();

    if (!savedTaskId) {
      return;
    }

    void openTask(savedTaskId, { silent: true });
  });

  const actions = {
    uploadFile,
    selectSheet,
    updateRequest,
    applyTemplate,
    generatePlan: generatePlanAction,
    executePlan: executePlanAction,
    refreshTask,
    downloadResult,
    resetWorkspace,
    openTask,
    setActiveResultTab,
    setActiveMainStage,
    setDragOver,
  };

  return {
    workspaceMode,
    session,
    planState,
    taskState,
    chatState,
    suggestedNextPrompts,
    executionSummaryText,
    planChecklist,
    actions,
  };
}
