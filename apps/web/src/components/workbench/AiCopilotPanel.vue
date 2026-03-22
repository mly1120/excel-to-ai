<script setup lang="ts">
import { computed, ref, watch } from "vue";

import PromptComposer, { type PromptComposerMode } from "./PromptComposer.vue";
import SuggestedNextActions from "./SuggestedNextActions.vue";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt?: string;
  status?: "streaming" | "done" | "error";
};

type WorkspaceMode = "dashboard" | "draft" | "running" | "result";
type PlanChecklistStatus = "pending" | "running" | "done" | "failed";

type PlanChecklistItem = {
  id: string;
  label: string;
  status: PlanChecklistStatus;
};

type Props = {
  messages?: ChatMessage[];
  requestText?: string;
  templates?: string[];
  planSummary?: string;
  planActions?: string[];
  planWarnings?: string[];
  impactedColumns?: string[];
  sheetName?: string;
  canGenerate?: boolean;
  canExecute?: boolean;
  generating?: boolean;
  executing?: boolean;
  suggestedNextPrompts?: string[];
  executionSummaryText?: string;
  executionStatusText?: string;
  planChecklist?: PlanChecklistItem[];
  workspaceMode?: WorkspaceMode;
};

const props = withDefaults(defineProps<Props>(), {
  messages: () => [],
  requestText: "",
  templates: () => [],
  planSummary: "",
  planActions: () => [],
  planWarnings: () => [],
  impactedColumns: () => [],
  sheetName: "",
  canGenerate: false,
  canExecute: false,
  generating: false,
  executing: false,
  suggestedNextPrompts: () => [],
  executionSummaryText: "",
  executionStatusText: "",
  planChecklist: () => [],
  workspaceMode: undefined,
});

const emit = defineEmits<{
  (event: "update:requestText", value: string): void;
  (event: "choose-template", template: string): void;
  (event: "generate-plan"): void;
  (event: "execute-plan"): void;
}>();

const requestModel = computed({
  get: () => props.requestText,
  set: (value: string) => emit("update:requestText", value),
});

const manualComposerMode = ref<PromptComposerMode | null>(null);

const checklistStatusLabelMap: Record<PlanChecklistStatus, string> = {
  pending: "待执行",
  running: "执行中",
  done: "已完成",
  failed: "需复核",
};

function isRunningText(text: string) {
  return /进入执行队列|后台执行|任务已创建|正在执行/.test(text);
}

function isResultSummaryText(text: string) {
  return /已执行|成功更新|本轮尝试执行|处理\s*\d+\s*行|失败\s*\d+\s*条/.test(text);
}

const latestAssistantText = computed(() => {
  const target = [...props.messages]
    .reverse()
    .find((message) => message.role === "assistant" || message.role === "system");
  return target?.text?.trim() ?? "";
});

const resolvedExecutionStatusText = computed(() => {
  if (props.executionStatusText) {
    return props.executionStatusText;
  }

  return isRunningText(latestAssistantText.value) ? latestAssistantText.value : "";
});

const resolvedExecutionSummaryText = computed(() => {
  if (props.executionSummaryText) {
    return props.executionSummaryText;
  }

  if (
    latestAssistantText.value &&
    isResultSummaryText(latestAssistantText.value) &&
    !isRunningText(latestAssistantText.value)
  ) {
    return latestAssistantText.value;
  }

  return "";
});

const panelMode = computed<WorkspaceMode>(() => {
  if (props.workspaceMode) {
    return props.workspaceMode;
  }

  if (props.executing || resolvedExecutionStatusText.value) {
    return "running";
  }

  if (resolvedExecutionSummaryText.value) {
    return "result";
  }

  if (props.sheetName || props.planSummary || props.planActions.length) {
    return "draft";
  }

  return "dashboard";
});

const planCardStatus = computed<PlanChecklistStatus>(() => {
  if (panelMode.value === "result") {
    return /失败/.test(resolvedExecutionSummaryText.value) ? "failed" : "done";
  }

  if (panelMode.value === "running") {
    return "running";
  }

  if (panelMode.value === "draft" && (props.planSummary || props.planActions.length)) {
    return "running";
  }

  return "pending";
});

const executionCardStatus = computed<PlanChecklistStatus>(() => {
  if (panelMode.value === "running") {
    return "running";
  }

  if (panelMode.value === "result" && resolvedExecutionSummaryText.value) {
    return "done";
  }

  return "pending";
});

const resultCardStatus = computed<PlanChecklistStatus>(() => {
  if (panelMode.value !== "result") {
    return "pending";
  }

  return /失败/.test(resolvedExecutionSummaryText.value) ? "failed" : "done";
});

const resultStageSummaryText = computed(() =>
  panelMode.value === "result" ? resolvedExecutionSummaryText.value : "",
);

const inferredChecklistStatus = computed<PlanChecklistStatus>(() => {
  if (panelMode.value === "running") {
    return "running";
  }

  if (panelMode.value === "result") {
    return /失败/.test(resolvedExecutionSummaryText.value) ? "failed" : "done";
  }

  return "pending";
});

const resolvedPlanChecklist = computed<PlanChecklistItem[]>(() => {
  if (props.planChecklist.length) {
    return props.planChecklist;
  }

  if (props.planActions.length) {
    return props.planActions.map((label, index) => ({
      id: `plan-action-${index + 1}`,
      label,
      status: inferredChecklistStatus.value,
    }));
  }

  if (props.planSummary) {
    return [
      {
        id: "plan-summary",
        label: props.planSummary,
        status: inferredChecklistStatus.value,
      },
    ];
  }

  return [];
});

const resolvedPlanHeadline = computed(() => {
  if (props.planSummary) {
    return props.planSummary;
  }

  if (panelMode.value === "result") {
    return "本轮任务已完成处理，可继续基于结果追问下一步。";
  }

  if (panelMode.value === "running") {
    return "计划已提交执行，正在等待结果反馈。";
  }

  return "等待你描述处理目标，AI 会先生成可执行计划。";
});

const resolvedSuggestedNextPrompts = computed(() => {
  const source = props.suggestedNextPrompts.length
    ? props.suggestedNextPrompts
    : props.templates;

  return Array.from(new Set(source.map((item) => item.trim()).filter(Boolean))).slice(0, 4);
});

const composerMode = computed<PromptComposerMode>(() => {
  if (manualComposerMode.value) {
    return manualComposerMode.value;
  }

  return panelMode.value === "result" ? "followup" : "plan";
});

const composerSubmitLabel = computed(() =>
  composerMode.value === "followup" ? "继续生成建议" : "生成 AI 建议",
);

const composerPlaceholder = computed(() =>
  composerMode.value === "followup"
    ? "例如：基于当前结果，再补一轮去重和异常值处理。"
    : "例如：去掉手机号前后空格，把金额保留两位小数，并新增省份列。",
);

const composerTemplates = computed(() =>
  composerMode.value === "followup" ? resolvedSuggestedNextPrompts.value : props.templates,
);

function handleComposerModeChange(mode: PromptComposerMode) {
  if (panelMode.value !== "result") {
    manualComposerMode.value = null;
    return;
  }

  manualComposerMode.value = mode;
}

watch(
  panelMode,
  (nextMode) => {
    if (nextMode !== "result") {
      manualComposerMode.value = null;
    }
  },
  { immediate: true },
);

function handleComposerSubmit() {
  emit("generate-plan");
}

function handleChooseTemplate(template: string) {
  emit("choose-template", template);
}

function formatTime(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
</script>

<template>
  <section class="workbench-panel ai-copilot-panel">
    <div class="workbench-panel__header">
      <div>
        <p class="workbench-panel__eyebrow">AI 副驾驶</p>
        <h2 class="workbench-panel__title">先用自然语言描述需求，再决定是否执行</h2>
      </div>
      <span class="workbench-panel__note">
        AI 只负责理解需求，真正执行和导出仍由程序完成。
      </span>
    </div>

    <div class="workbench-panel__body ai-copilot-panel__body">
      <div class="ai-copilot-panel__content-scroll">
        <div class="ai-copilot-panel__messages">
          <div v-if="messages.length" class="ai-copilot-panel__message-list">
            <article
              v-for="message in messages"
              :key="message.id"
              :class="[
                'ai-copilot-panel__message',
                `ai-copilot-panel__message--${message.role}`,
              ]"
            >
              <div class="ai-copilot-panel__message-head">
                <span>{{ message.role === "user" ? "你" : message.role === "assistant" ? "AI" : "系统" }}</span>
                <small>{{ formatTime(message.createdAt) }}</small>
              </div>
              <p>{{ message.text }}</p>
            </article>
          </div>
          <div v-else class="ai-copilot-panel__placeholder">
            <strong>你可以直接说“把手机号空格去掉，金额保留两位小数”。</strong>
            <p>这里展示 AI 对需求的理解、执行反馈和结果总结。</p>
          </div>
        </div>

        <div class="ai-copilot-panel__phase-grid">
          <article class="ai-copilot-panel__phase-card">
            <div class="ai-copilot-panel__phase-head">
              <span>计划阶段</span>
              <small>{{ checklistStatusLabelMap[planCardStatus] }}</small>
            </div>
            <h3>{{ resolvedPlanHeadline }}</h3>

            <ul v-if="resolvedPlanChecklist.length" class="ai-copilot-panel__checklist">
              <li v-for="item in resolvedPlanChecklist" :key="item.id">
                <span>{{ item.label }}</span>
                <em>{{ checklistStatusLabelMap[item.status] }}</em>
              </li>
            </ul>

            <p v-if="sheetName || impactedColumns.length" class="ai-copilot-panel__phase-meta">
              <span v-if="sheetName">工作表：{{ sheetName }}</span>
              <span v-if="impactedColumns.length">涉及列：{{ impactedColumns.slice(0, 4).join("、") }}</span>
            </p>

            <ul v-if="planWarnings.length" class="ai-copilot-panel__warning-list">
              <li v-for="warning in planWarnings" :key="warning">{{ warning }}</li>
            </ul>

            <div class="workbench-action-row">
              <el-button
                :disabled="!canExecute"
                :loading="executing"
                type="success"
                @click="emit('execute-plan')"
              >
                确认执行
              </el-button>
            </div>
          </article>

          <article class="ai-copilot-panel__phase-card">
            <div class="ai-copilot-panel__phase-head">
              <span>执行阶段</span>
              <small>{{ checklistStatusLabelMap[executionCardStatus] }}</small>
            </div>
            <p class="ai-copilot-panel__phase-text">
              {{ resolvedExecutionStatusText || "提交任务后，这里会显示执行进度与状态反馈。" }}
            </p>
          </article>

          <article class="ai-copilot-panel__phase-card">
            <div class="ai-copilot-panel__phase-head">
              <span>结果阶段</span>
              <small>{{ checklistStatusLabelMap[resultCardStatus] }}</small>
            </div>
            <p class="ai-copilot-panel__phase-text">
              {{ resultStageSummaryText || "执行完成后，这里会给出结果总结与下一步建议。" }}
            </p>
            <SuggestedNextActions
              :disabled="panelMode !== 'result'"
              :prompts="resolvedSuggestedNextPrompts"
              @choose="handleChooseTemplate"
            />
          </article>
        </div>
      </div>

      <div class="ai-copilot-panel__composer">
        <PromptComposer
          v-model="requestModel"
          :can-submit="canGenerate"
          :mode="composerMode"
          :placeholder="composerPlaceholder"
          :show-mode-switch="true"
          :submit-label="composerSubmitLabel"
          :submitting="generating"
          :templates="composerTemplates"
          @choose-template="handleChooseTemplate"
          @submit="handleComposerSubmit"
          @update:mode="handleComposerModeChange"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-copilot-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ai-copilot-panel__body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
}

.ai-copilot-panel__content-scroll {
  display: grid;
  gap: 16px;
  min-height: 0;
  margin-right: -4px;
  padding-right: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ai-copilot-panel__composer {
  flex-shrink: 0;
}

.ai-copilot-panel__messages {
  min-height: 220px;
  padding: 16px;
  border: 1px solid rgba(51, 41, 34, 0.08);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(252, 249, 244, 0.82));
}

.ai-copilot-panel__message-list {
  display: grid;
  gap: 12px;
}

.ai-copilot-panel__message {
  padding: 14px 14px 12px;
  border-radius: 18px;
  line-height: 1.75;
}

.ai-copilot-panel__message--assistant,
.ai-copilot-panel__message--system {
  background: rgba(245, 250, 248, 0.92);
  border: 1px solid rgba(15, 109, 100, 0.14);
}

.ai-copilot-panel__message--user {
  background: rgba(255, 248, 235, 0.96);
  border: 1px solid rgba(192, 123, 40, 0.16);
}

.ai-copilot-panel__message-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ai-copilot-panel__message p {
  margin: 10px 0 0;
  color: var(--text-main);
  white-space: pre-wrap;
}

.ai-copilot-panel__placeholder {
  display: grid;
  place-items: center;
  min-height: 188px;
  text-align: center;
}

.ai-copilot-panel__placeholder strong {
  max-width: 18ch;
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 1.05;
}

.ai-copilot-panel__placeholder p {
  margin: 14px 0 0;
  max-width: 28ch;
  color: var(--text-muted);
  line-height: 1.75;
}

.ai-copilot-panel__phase-grid {
  display: grid;
  gap: 12px;
}

.ai-copilot-panel__phase-card {
  padding: 16px;
  border: 1px solid rgba(15, 109, 100, 0.12);
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgba(239, 250, 247, 0.85), rgba(255, 252, 246, 0.86));
  display: grid;
  gap: 10px;
}

.ai-copilot-panel__phase-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
}

.ai-copilot-panel__phase-head span {
  font-size: 13px;
  font-weight: 700;
}

.ai-copilot-panel__phase-head small {
  color: var(--text-muted);
  font-size: 12px;
}

.ai-copilot-panel__phase-card h3 {
  margin: 0;
  font-size: 18px;
  line-height: 1.35;
  font-family: var(--font-display);
}

.ai-copilot-panel__phase-text {
  margin: 0;
  color: var(--text-main);
  line-height: 1.7;
}

.ai-copilot-panel__checklist {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.ai-copilot-panel__checklist li {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: baseline;
  border: 1px dashed rgba(51, 41, 34, 0.14);
  border-radius: 12px;
  padding: 8px 10px;
  line-height: 1.55;
}

.ai-copilot-panel__checklist em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  white-space: nowrap;
}

.ai-copilot-panel__phase-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.ai-copilot-panel__warning-list {
  margin: 0;
  padding-left: 18px;
  color: var(--accent-ink);
  line-height: 1.7;
}

@media (max-width: 1180px) {
  .ai-copilot-panel__content-scroll {
    margin-right: 0;
    padding-right: 0;
    overflow-y: visible;
  }
}
</style>
