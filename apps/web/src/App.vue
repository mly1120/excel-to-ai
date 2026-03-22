<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { Operation } from "@shared";

import AiCopilotPanel from "./components/workbench/AiCopilotPanel.vue";
import EmptyDashboard from "./components/workbench/EmptyDashboard.vue";
import FileContextPanel from "./components/workbench/FileContextPanel.vue";
import PreviewStage from "./components/workbench/PreviewStage.vue";
import ResultStage from "./components/workbench/ResultStage.vue";
import WorkbenchSidebar from "./components/workbench/WorkbenchSidebar.vue";
import WorkspaceHeader from "./components/workbench/WorkspaceHeader.vue";
import { workbenchCatalog, type WorkbenchSectionKey } from "./config/workbenchCatalog";
import { useTaskHistory } from "./composables/useTaskHistory";
import { useWorkbenchNavigation } from "./composables/useWorkbenchNavigation";
import {
  useWorkbenchSession,
  type MainStageTab,
  type ResultTab,
  type WorkspaceMode,
} from "./composables/useWorkbenchSession";

type HeaderPrimaryKind = "download" | "refresh" | "execute" | "plan" | "none";

const modeLabelMap: Record<WorkspaceMode, string> = {
  dashboard: "等待开始",
  draft: "准备执行",
  running: "执行中",
  result: "结果可回看",
};

const {
  workspaceMode,
  session,
  planState,
  taskState,
  chatState,
  suggestedNextPrompts,
  executionSummaryText,
  planChecklist,
  actions,
} = useWorkbenchSession();

const navigation = useWorkbenchNavigation({ workspaceMode });

const taskHistory = useTaskHistory({
  onSelect: async (item) => {
    await actions.openTask(item.taskId, { silent: true });
  },
});

const recentTasks = computed(() => taskHistory.items.value);
const historyLoading = computed(() => taskHistory.loading.value);
const historyError = computed(() => taskHistory.error.value);
const selectedTaskId = computed(() => taskHistory.selectedTaskId.value);
const navigationAreaSection = computed(() => navigation.areaSection.value);
const historySectionActive = computed(() => navigation.activeSection.value === "history");
const dashboardCapabilityGroups = computed(() => workbenchCatalog.capabilityGroups);
const dashboardScenarioPromptChips = computed(() => workbenchCatalog.scenarioPromptChips);
const copilotTemplatePrompts = computed(() =>
  dashboardScenarioPromptChips.value.map((item) => item.prompt),
);
const copilotSuggestedPrompts = computed(() => {
  const source =
    navigationAreaSection.value.copilot === "templates"
      ? copilotTemplatePrompts.value
      : suggestedNextPrompts.value;
  return Array.from(new Set(source));
});

const railColumnRef = ref<HTMLElement | null>(null);
const mainColumnRef = ref<HTMLElement | null>(null);
const copilotColumnRef = ref<HTMLElement | null>(null);
const prefersReducedMotion = ref(false);
let reducedMotionMediaQuery: MediaQueryList | null = null;
let reducedMotionListener: ((event: MediaQueryListEvent) => void) | null = null;

function resolveScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") {
    return "auto";
  }

  const isCompactViewport = window.matchMedia("(max-width: 900px)").matches;
  if (prefersReducedMotion.value || isCompactViewport) {
    return "auto";
  }

  return "smooth";
}

function shouldScrollToTarget(target: HTMLElement) {
  if (typeof window === "undefined") {
    return false;
  }

  const rect = target.getBoundingClientRect();
  const upperBound = Math.max(120, window.innerHeight * 0.28);
  return rect.top < 20 || rect.top > upperBound;
}

function scrollTargetIntoView(target: HTMLElement | null) {
  if (!target || !shouldScrollToTarget(target)) {
    return;
  }

  target.scrollIntoView({
    behavior: resolveScrollBehavior(),
    block: "start",
    inline: "nearest",
  });
}

watch(
  () => taskState.latestTaskId,
  (taskId) => {
    if (taskId) {
      taskHistory.selectedTaskId.value = taskId;
    }

    if (taskId) {
      void taskHistory.refresh({ silent: true });
    }
  },
  { immediate: true },
);

watch(
  () => taskState.taskResult?.status,
  (status, previous) => {
    if (status && status !== previous) {
      void taskHistory.refresh({ silent: true });
    }
  },
);

const canGeneratePlan = computed(
  () =>
    session.hasFile &&
    Boolean(session.selectedSheet) &&
    Boolean(chatState.input.trim()) &&
    !planState.isGenerating &&
    !taskState.isExecuting &&
    !taskState.isTaskInProgress,
);

const canExecutePlan = computed(
  () => planState.hasPlan && !taskState.isExecuting && !taskState.isTaskInProgress,
);

const headerDescription = computed(() => {
  switch (workspaceMode.value) {
    case "dashboard":
      return "先上传 Excel，选定工作表后就能开始输入处理需求。";
    case "draft":
      return "先核对中间预览，再在右侧输入需求并生成 AI 建议。";
    case "running":
      return "任务执行中；你可以继续看预览，并按需刷新状态。";
    case "result":
      return "先看结果预览和失败记录，确认后下载结果文件。";
  }
});

const headerStats = computed(() => [
  {
    label: "当前模式",
    value: modeLabelMap[workspaceMode.value],
    hint: session.fileName ? `文件：${session.fileName}` : "先上传文件",
  },
  {
    label: "AI 建议",
    value: planState.operationCount ? `${planState.operationCount} 个动作` : "待生成",
    hint: planState.warnings.length ? `${planState.warnings.length} 条提醒` : "输入需求后生成建议",
  },
  {
    label: "任务结果",
      value: taskState.taskResult
      ? `修改 ${taskState.taskResult.summary.changedRows} 行`
      : taskState.isTaskInProgress
        ? "正在执行"
        : "待执行",
    hint: taskState.latestTaskId ? `任务：${taskState.latestTaskId}` : "先确认执行",
  },
  {
    label: "最近任务",
    value: recentTasks.value.length,
    hint: recentTasks.value.length ? "去左侧切换查看" : "执行后会出现在左侧",
  },
]);

const headerPrimaryAction = computed(() => {
  if (taskState.canDownloadResult) {
    return {
      kind: "download" as HeaderPrimaryKind,
      label: "下载结果",
      type: "primary" as const,
      disabled: false,
      loading: false,
    };
  }

  if (taskState.hasTaskState) {
    return {
      kind: "refresh" as HeaderPrimaryKind,
      label: "刷新状态",
      type: "warning" as const,
      disabled: false,
      loading: false,
    };
  }

  if (planState.hasPlan) {
    return {
      kind: "execute" as HeaderPrimaryKind,
      label: "确认执行",
      type: "success" as const,
      disabled: !canExecutePlan.value,
      loading: taskState.isExecuting,
    };
  }

  if (session.hasFile) {
    return {
      kind: "plan" as HeaderPrimaryKind,
      label: "生成 AI 建议",
      type: "primary" as const,
      disabled: !canGeneratePlan.value,
      loading: planState.isGenerating,
    };
  }

  return {
    kind: "none" as HeaderPrimaryKind,
    label: "先上传文件",
    type: "info" as const,
    disabled: true,
    loading: false,
  };
});

const previewViewOptions = computed(() => {
  if (!taskState.taskResult) {
    return [];
  }

  return [
    {
      key: "preview",
      label: "结果预览",
      badge: taskState.resultPreviewTotal,
    },
    {
      key: "changed",
      label: "变更对比",
      badge: taskState.changedPreviewRows.length,
    },
    {
      key: "failures",
      label: "失败记录",
      badge: taskState.failures.length,
    },
  ];
});

const previewTitle = computed(() =>
  session.selectedSheet ? `原始预览 · ${session.selectedSheet}` : "原始表格预览",
);

const previewNote = computed(() =>
  navigationAreaSection.value.main === "templates"
    ? "当前定位在模板入口，可先在右侧选择提示词，再回到预览继续处理。"
    : taskState.taskResult
      ? "上方始终保留原始预览；右上角可切换结果视图。"
      : "先看预览，再在右侧描述要处理的动作。",
);

const planActions = computed(() =>
  (planState.plan?.operations ?? []).map((operation) => summarizeOperation(operation)),
);

const impactedColumns = computed(() =>
  Array.from(collectImpactedColumns(planState.plan?.operations ?? [])),
);

async function handleHeaderPrimaryAction() {
  switch (headerPrimaryAction.value.kind) {
    case "download":
      actions.downloadResult();
      return;
    case "refresh":
      await handleRefreshTask();
      return;
    case "execute":
      await handleExecutePlan();
      return;
    case "plan":
      await handleGeneratePlan();
      return;
    case "none":
      return;
  }
}

async function handleUpload(file: File) {
  const result = await actions.uploadFile(file);

  if (result) {
    await taskHistory.refresh({ silent: true });
  }
}

async function handleSelectSheet(sheetName: string) {
  await actions.selectSheet(sheetName);
}

async function handleGeneratePlan() {
  await actions.generatePlan();
}

async function handleExecutePlan() {
  const result = await actions.executePlan();

  if (result || taskState.latestTaskId) {
    await taskHistory.refresh({ silent: true });
  }
}

async function handleRefreshTask() {
  const result = await actions.refreshTask();

  if (result || taskState.latestTaskId) {
    await taskHistory.refresh({ silent: true });
  }
}

async function handleRefreshRecentTasks() {
  await taskHistory.refresh();
}

async function handleOpenTask(taskId: string) {
  await taskHistory.selectTask(taskId);
}

function handleSelectSection(section: WorkbenchSectionKey) {
  navigation.setSection(section);

  const target =
    section === "workspace"
      ? mainColumnRef.value
      : section === "templates"
        ? copilotColumnRef.value
        : railColumnRef.value;

  scrollTargetIntoView(target);
}

function handlePreviewViewChange(view: string) {
  const needsStageSwitch = taskState.activeMainStage !== "result";
  actions.setActiveMainStage("result");
  if (needsStageSwitch) {
    scrollToMainStage("result");
  }
  actions.setActiveResultTab(view as ResultTab);
}

function scrollToMainStage(stage: MainStageTab) {
  if (typeof document === "undefined") {
    return;
  }

  const selector =
    stage === "preview" ? "[data-stage-anchor='preview']" : "[data-stage-anchor='result']";
  const target = document.querySelector<HTMLElement>(selector);

  scrollTargetIntoView(target);
}

function handleMainStageChange(stage: MainStageTab) {
  if (taskState.activeMainStage === stage) {
    return;
  }

  actions.setActiveMainStage(stage);
  scrollToMainStage(stage);
}

onMounted(() => {
  if (typeof window === "undefined") {
    return;
  }

  reducedMotionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  prefersReducedMotion.value = reducedMotionMediaQuery.matches;
  reducedMotionListener = (event: MediaQueryListEvent) => {
    prefersReducedMotion.value = event.matches;
  };
  reducedMotionMediaQuery.addEventListener("change", reducedMotionListener);
});

onBeforeUnmount(() => {
  if (!reducedMotionMediaQuery || !reducedMotionListener) {
    return;
  }
  reducedMotionMediaQuery.removeEventListener("change", reducedMotionListener);
});

function summarizeOperation(operation: Operation) {
  switch (operation.type) {
    case "trim":
      return `清理“${operation.column}”前后空格`;
    case "format_number":
      return `将“${operation.column}”统一为 ${operation.digits} 位小数`;
    case "derive_column":
      return `基于“${operation.sourceColumn}”生成“${operation.targetColumn}”`;
    case "delete_rows":
      return `删除满足条件的记录`;
    case "deduplicate":
      return `按“${operation.column}”去重`;
    case "map_values":
      return `映射“${operation.column}”中的值`;
    case "ai_transform":
      return `用 AI 重写“${operation.sourceColumn}”并写入“${operation.targetColumn}”`;
  }
}

function collectImpactedColumns(operations: Operation[]) {
  const columns = new Set<string>();

  for (const operation of operations) {
    switch (operation.type) {
      case "trim":
      case "format_number":
      case "map_values":
      case "deduplicate":
        columns.add(operation.column);
        break;
      case "derive_column":
      case "ai_transform":
        columns.add(operation.sourceColumn);
        columns.add(operation.targetColumn);
        break;
      case "delete_rows":
        columns.add(operation.condition.column);
        break;
    }
  }

  return columns;
}
</script>

<template>
  <div class="workbench-shell">
    <WorkspaceHeader
      :description="headerDescription"
      :file-name="session.fileName"
      :primary-action-label="headerPrimaryAction.label"
      :primary-action-type="headerPrimaryAction.type"
      :primary-disabled="headerPrimaryAction.disabled"
      :primary-loading="headerPrimaryAction.loading"
      :secondary-disabled="workspaceMode === 'dashboard'"
      :sheet-name="session.selectedSheet"
      :stats="headerStats"
      :task-id="taskState.latestTaskId"
      :task-status="taskState.latestTaskStatus"
      @primary-action="handleHeaderPrimaryAction"
      @secondary-action="actions.resetWorkspace"
    />

    <div
      :class="['workbench-layout', `workbench-layout--${workspaceMode}`]"
      :data-nav-shortcut="navigation.activeSection"
    >
      <aside
        ref="railColumnRef"
        class="workbench-column workbench-column--rail"
        :data-active-section="navigationAreaSection.rail"
        data-workbench-area="rail"
      >
        <WorkbenchSidebar
          :active-section="navigation.activeSection.value"
          :file-name="session.fileName"
          :recent-error="historyError"
          :recent-items="recentTasks"
          :recent-loading="historyLoading"
          :recent-selected-task-id="selectedTaskId"
          :sections="navigation.availableSections.value"
          :sheet-name="session.selectedSheet"
          :suggested-section="navigation.suggestedSection.value"
          :history-section-active="historySectionActive"
          @refresh-recent="handleRefreshRecentTasks"
          @select-section="handleSelectSection"
          @select-task="handleOpenTask"
        />
      </aside>

      <main
        ref="mainColumnRef"
        class="workbench-column workbench-column--main"
        :data-active-section="navigationAreaSection.main"
        data-workbench-area="main"
      >
        <EmptyDashboard
          v-if="workspaceMode === 'dashboard'"
          :accepted-extensions="session.acceptedExtensions"
          :capability-groups="dashboardCapabilityGroups"
          :max-upload-size-mb="session.maxUploadSizeMb"
          :scenario-prompt-chips="dashboardScenarioPromptChips"
          :uploading="session.isUploading"
          @choose-template="actions.applyTemplate"
          @upload="handleUpload"
        />

        <template v-else>
          <FileContextPanel
            :active-stage="taskState.activeMainStage"
            :column-count="session.previewColumns.length"
            :file-id="session.fileId"
            :file-name="session.fileName"
            :loading="session.isLoadingPreview"
            :row-count="session.previewTotal"
            :selected-sheet="session.selectedSheet"
            :sheets="session.sheets"
            @change-stage="handleMainStageChange"
            @select-sheet="handleSelectSheet"
          />

          <PreviewStage
            :active-stage="taskState.activeMainStage"
            :active-view="taskState.activeResultTab"
            :empty-description="'先上传文件，随后在这里查看表格预览。'"
            :loading="session.isLoadingPreview"
            :note="previewNote"
            :preview="session.preview"
            :title="previewTitle"
            :view-options="previewViewOptions"
            @change-stage="handleMainStageChange"
            @change-view="handlePreviewViewChange"
          />

          <ResultStage
            :active-stage="taskState.activeMainStage"
            :active-tab="taskState.activeResultTab"
            :can-download="taskState.canDownloadResult"
            :has-task="taskState.hasTaskState"
            :is-running="taskState.isTaskInProgress"
            :refreshing="taskState.isExecuting"
            :result="taskState.taskResult"
            :result-summary-text="taskState.resultSummaryText"
            :running-message="taskState.executionStatusText"
            :task-created-at="taskState.currentTaskCreatedAt"
            :task-id="taskState.latestTaskId"
            :task-status="taskState.latestTaskStatus"
            @change-stage="handleMainStageChange"
            @change-tab="actions.setActiveResultTab"
            @download="actions.downloadResult"
            @refresh="handleRefreshTask"
          />
        </template>
      </main>

      <aside
        ref="copilotColumnRef"
        class="workbench-column workbench-column--copilot"
        :data-active-section="navigationAreaSection.copilot"
        data-workbench-area="copilot"
      >
        <AiCopilotPanel
          :can-execute="canExecutePlan"
          :can-generate="canGeneratePlan"
          :execution-summary-text="executionSummaryText"
          :execution-status-text="taskState.executionStatusText"
          :executing="taskState.isExecuting"
          :generating="planState.isGenerating"
          :impacted-columns="impactedColumns"
          :messages="chatState.messages"
          :plan-actions="planActions"
          :plan-checklist="planChecklist"
          :plan-summary="planState.plan?.summary"
          :plan-warnings="planState.warnings"
          :request-text="chatState.input"
          :sheet-name="session.selectedSheet"
          :suggested-next-prompts="copilotSuggestedPrompts"
          :templates="chatState.requestTemplates"
          :workspace-mode="workspaceMode"
          @choose-template="actions.applyTemplate"
          @execute-plan="handleExecutePlan"
          @generate-plan="handleGeneratePlan"
          @update:request-text="actions.updateRequest"
        />
      </aside>
    </div>
  </div>
</template>
