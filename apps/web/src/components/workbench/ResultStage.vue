<script setup lang="ts">
import { computed } from "vue";

import type { TaskResultResponse, TaskStatus } from "@shared";

import TaskSummaryCard from "./TaskSummaryCard.vue";

type StageKey = "preview" | "result";
type ResultTab = "preview" | "changed" | "failures";

type Props = {
  activeStage?: StageKey;
  hasTask?: boolean;
  isRunning?: boolean;
  taskId?: string;
  taskStatus?: TaskStatus | null;
  taskCreatedAt?: string;
  runningMessage?: string;
  result?: TaskResultResponse | null;
  activeTab?: ResultTab;
  resultSummaryText?: string;
  canDownload?: boolean;
  refreshing?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  activeStage: "preview",
  hasTask: false,
  isRunning: false,
  taskId: "",
  taskStatus: null,
  taskCreatedAt: "",
  runningMessage: "任务正在后台执行，预览区仍保持主画面，你可以稍后刷新查看结果。",
  result: null,
  activeTab: "preview",
  resultSummaryText: "",
  canDownload: false,
  refreshing: false,
});

const emit = defineEmits<{
  (event: "change-stage", stage: StageKey): void;
  (event: "refresh"): void;
  (event: "download"): void;
  (event: "change-tab", tab: ResultTab): void;
}>();

const statusLabelMap: Record<TaskStatus, string> = {
  pending: "等待执行",
  running: "执行中",
  success: "已完成",
  partial_success: "部分完成",
  failed: "执行失败",
};

const statusTypeMap: Record<TaskStatus, "info" | "primary" | "success" | "warning" | "danger"> =
  {
    pending: "info",
    running: "primary",
    success: "success",
    partial_success: "warning",
    failed: "danger",
  };

const stageTabs: Array<{ key: StageKey; label: string; hint: string }> = [
  {
    key: "preview",
    label: "文件预览",
    hint: "原始数据",
  },
  {
    key: "result",
    label: "处理结果",
    hint: "变更与失败",
  },
];

const tabs = computed(() => {
  const result = props.result;

  return [
    {
      key: "preview" as const,
      label: "结果预览",
      count: result?.preview.total ?? 0,
    },
    {
      key: "changed" as const,
      label: "变更对比",
      count: result?.changedOnlyPreview.rows.length ?? 0,
    },
    {
      key: "failures" as const,
      label: "失败记录",
      count: result?.failures.length ?? 0,
    },
  ];
});

const conclusionText = computed(() => {
  const result = props.result;
  if (!result) {
    return "执行完成后，这里会显示本轮结论与可继续处理入口。";
  }

  if (result.status === "success") {
    return `已执行 ${result.summary.operationCount} 个处理动作，${result.summary.changedRows} 行数据发生变化。`;
  }

  if (result.status === "partial_success") {
    return `已执行 ${result.summary.operationCount} 个处理动作，更新 ${result.summary.changedRows} 行，${result.summary.failedRows} 条待复核。`;
  }

  return `计划动作执行失败，失败 ${result.summary.failedRows} 条，建议先查看失败记录。`;
});

const requestSummary = computed(() => {
  const result = props.result;
  if (!result) {
    return "";
  }

  const request = result.userRequest.trim();
  if (request.length <= 38) {
    return request;
  }

  return `${request.slice(0, 38)}…`;
});

const actionSummary = computed(() => {
  const result = props.result;
  const derived = props.resultSummaryText.trim();
  if (derived) {
    return derived;
  }

  if (!result) {
    return "执行完成后，这里会显示可复核的处理摘要。";
  }

  if (result.status === "success") {
    return `已执行 ${result.summary.operationCount} 个处理动作，处理 ${result.preview.total} 行，修改 ${result.summary.changedRows} 行。`;
  }

  if (result.status === "partial_success") {
    return `已执行 ${result.summary.operationCount} 个处理动作，成功更新 ${result.summary.changedRows} 行，另有 ${result.summary.failedRows} 条失败待复核。`;
  }

  return `本轮尝试执行 ${result.summary.operationCount} 个处理动作，但失败 ${result.summary.failedRows} 条。${result.failures[0]?.reason ?? "请查看失败原因。"}`;
});

const canContinueProcessing = computed(() => {
  const result = props.result;
  if (!result) {
    return false;
  }

  return result.status === "success" || result.status === "partial_success";
});

const followUpHint = computed(() =>
  canContinueProcessing.value
    ? "右侧副驾驶可继续追问，沿用当前文件与工作表。"
    : "建议先查看失败记录，再继续描述下一步处理。",
);

function formatCellValue(value: unknown) {
  if (value == null || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDateTime(value: string) {
  if (!value) {
    return "待记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function scrollToCopilot() {
  if (typeof document === "undefined") {
    return;
  }

  const panel = document.querySelector<HTMLElement>("[data-workbench-area='copilot']");
  panel?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
}
</script>

<template>
  <section class="workbench-panel result-stage" data-stage-anchor="result">
    <div class="workbench-panel__header">
      <div>
        <p class="workbench-panel__eyebrow">主舞台</p>
        <h2 class="workbench-panel__title">处理结果</h2>
      </div>

      <div class="result-stage__header-side">
        <div class="result-stage__stage-tabs" role="tablist" aria-label="中栏主舞台">
          <button
            v-for="stage in stageTabs"
            :key="stage.key"
            :class="[
              'result-stage__stage-tab',
              { 'result-stage__stage-tab--active': stage.key === activeStage },
            ]"
            :aria-selected="stage.key === activeStage"
            role="tab"
            type="button"
            @click="emit('change-stage', stage.key)"
          >
            <span>{{ stage.label }}</span>
            <small>{{ stage.hint }}</small>
          </button>
        </div>
        <span class="workbench-panel__note">
          结果文件独立导出，原始 Excel 不会被覆盖。
        </span>
      </div>
    </div>

    <div class="workbench-panel__body">
      <template v-if="result">
        <article class="result-stage__conclusion-card">
          <div class="result-stage__status">
            <el-tag
              v-if="result.status"
              :type="statusTypeMap[result.status]"
              effect="dark"
              round
            >
              {{ statusLabelMap[result.status] }}
            </el-tag>
            <span class="result-stage__task-id">{{ result.taskId }}</span>
          </div>

          <p class="result-stage__conclusion-title">{{ conclusionText }}</p>
          <p v-if="requestSummary" class="result-stage__conclusion-copy">
            原始需求：{{ requestSummary }}
          </p>

          <div class="workbench-action-row workbench-action-row--compact">
            <el-button :disabled="!canDownload" type="primary" @click="emit('download')">
              下载结果
            </el-button>
            <el-button plain type="success" @click="scrollToCopilot">继续处理</el-button>
            <el-button :loading="refreshing" plain @click="emit('refresh')">
              刷新结果
            </el-button>
          </div>
        </article>

        <TaskSummaryCard
          :can-follow-up="canContinueProcessing"
          :changed-rows="result.summary.changedRows"
          :failed-rows="result.summary.failedRows"
          :follow-up-hint="followUpHint"
          :operation-count="result.summary.operationCount"
          :status-label="statusLabelMap[result.status]"
          :summary-text="actionSummary"
          class="result-stage__summary-card"
          @continue="scrollToCopilot"
        />

        <div class="result-stage__metrics">
          <article class="result-stage__metric-card">
            <span>结果总行数</span>
            <strong>{{ result.preview.total }}</strong>
            <small>下载前可在中栏继续复核</small>
          </article>
          <article class="result-stage__metric-card">
            <span>变更行数</span>
            <strong>{{ result.summary.changedRows }}</strong>
            <small>本轮被处理并更新的记录</small>
          </article>
          <article class="result-stage__metric-card">
            <span>失败条数</span>
            <strong>{{ result.summary.failedRows }}</strong>
            <small>建议切到失败记录逐条查看</small>
          </article>
          <article class="result-stage__metric-card">
            <span>警告条数</span>
            <strong>{{ result.summary.warnings.length }}</strong>
            <small>可作为下一轮处理提示</small>
          </article>
        </div>

        <div class="result-stage__tab-row">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="[
              'result-stage__tab',
              { 'result-stage__tab--active': tab.key === activeTab },
            ]"
            type="button"
            @click="emit('change-tab', tab.key)"
          >
            <span>{{ tab.label }}</span>
            <small>{{ tab.count }}</small>
          </button>
        </div>

        <ul v-if="result.summary.warnings.length" class="result-stage__warning-list">
          <li v-for="warning in result.summary.warnings" :key="warning">{{ warning }}</li>
        </ul>

        <div v-if="activeTab === 'preview'" class="result-stage__tab-panel">
          <el-table
            :data="result.preview.rows"
            border
            class="workbench-data-table"
            height="360"
            size="small"
          >
            <el-table-column
              v-for="column in result.preview.columns"
              :key="column"
              :label="column"
              :min-width="150"
            >
              <template #default="{ row }">
                <span>{{ formatCellValue(row[column]) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-else-if="activeTab === 'changed'" class="result-stage__tab-panel">
          <el-empty
            v-if="result.changedOnlyPreview.rows.length === 0"
            description="当前没有可展示的变更对比。"
          />

          <el-table
            v-else
            :data="result.changedOnlyPreview.rows"
            border
            class="workbench-data-table"
            height="360"
            size="small"
          >
            <el-table-column label="行号" min-width="90" prop="__rowIndex" />
            <el-table-column label="处理前" min-width="280">
              <template #default="{ row }">
                <pre class="result-stage__diff">{{ JSON.stringify(row.before, null, 2) }}</pre>
              </template>
            </el-table-column>
            <el-table-column label="处理后" min-width="280">
              <template #default="{ row }">
                <pre class="result-stage__diff">{{ JSON.stringify(row.after, null, 2) }}</pre>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-else class="result-stage__tab-panel">
          <el-empty
            v-if="result.failures.length === 0"
            description="这次执行没有失败记录。"
          />

          <el-table
            v-else
            :data="result.failures"
            border
            class="workbench-data-table"
            height="320"
            size="small"
          >
            <el-table-column label="行号" min-width="90" prop="rowIndex" />
            <el-table-column label="操作类型" min-width="160" prop="operationType" />
            <el-table-column label="失败原因" min-width="320" prop="reason" />
          </el-table>
        </div>
      </template>

      <template v-else-if="isRunning || hasTask">
        <div class="result-stage__running-card">
          <div class="result-stage__status">
            <el-tag
              v-if="taskStatus"
              :type="statusTypeMap[taskStatus]"
              effect="dark"
              round
            >
              {{ statusLabelMap[taskStatus] }}
            </el-tag>
            <span class="result-stage__task-id">{{ taskId || "等待任务编号" }}</span>
          </div>

          <p class="result-stage__running-title">任务已提交到服务端</p>
          <p class="result-stage__running-copy">{{ runningMessage }}</p>

          <div class="result-stage__running-meta">
            <span>任务编号：{{ taskId || "待生成" }}</span>
            <span>提交时间：{{ formatDateTime(taskCreatedAt) }}</span>
          </div>

          <div class="workbench-action-row">
            <el-button :loading="refreshing" plain type="primary" @click="emit('refresh')">
              立即刷新状态
            </el-button>
          </div>
        </div>
      </template>

      <el-empty
        v-else
        description="执行完成后，这里会展示结果预览、差异对比和失败记录。"
      />
    </div>
  </section>
</template>

<style scoped>
.result-stage__header-side {
  display: grid;
  justify-items: end;
  gap: 10px;
}

.result-stage__stage-tabs {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: min(420px, 100%);
}

.result-stage__stage-tab {
  display: grid;
  justify-items: start;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid rgba(51, 41, 34, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
  color: var(--text-muted);
  text-align: left;
  cursor: pointer;
}

.result-stage__stage-tab span {
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1.1;
  color: var(--text-strong);
}

.result-stage__stage-tab small {
  color: var(--text-faint);
  font-size: 11px;
}

.result-stage__stage-tab--active {
  border-color: rgba(192, 123, 40, 0.42);
  background:
    linear-gradient(145deg, rgba(255, 248, 236, 0.95), rgba(241, 250, 248, 0.92));
}

.result-stage__conclusion-card {
  padding: 18px;
  border: 1px solid rgba(51, 41, 34, 0.13);
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255, 252, 246, 0.95), rgba(246, 251, 249, 0.9)),
    rgba(255, 255, 255, 0.8);
}

.result-stage__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.result-stage__task-id {
  color: var(--text-muted);
  font-family: "Consolas", "SFMono-Regular", monospace;
  font-size: 12px;
}

.result-stage__conclusion-title {
  margin: 12px 0 0;
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 1.2;
}

.result-stage__conclusion-copy {
  margin: 8px 0 14px;
  color: var(--text-muted);
  line-height: 1.7;
}

.result-stage__summary-card {
  margin-top: 14px;
}

.result-stage__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.result-stage__metric-card {
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.result-stage__metric-card span,
.result-stage__metric-card small {
  display: block;
}

.result-stage__metric-card span {
  color: var(--text-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.result-stage__metric-card strong {
  display: block;
  margin: 10px 0 6px;
  font-family: var(--font-display);
  font-size: 30px;
}

.result-stage__metric-card small {
  color: var(--text-muted);
}

.result-stage__tab-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.result-stage__tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(51, 41, 34, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--text-muted);
  cursor: pointer;
  text-align: left;
}

.result-stage__tab--active {
  border-color: rgba(192, 123, 40, 0.44);
  background: rgba(255, 247, 233, 0.94);
  color: var(--accent-ink);
}

.result-stage__tab span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-stage__tab small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(51, 41, 34, 0.08);
  font-size: 11px;
}

.result-stage__warning-list {
  margin: 16px 0 0;
  padding-left: 18px;
  color: var(--accent-ink);
  line-height: 1.7;
}

.result-stage__tab-panel {
  margin-top: 16px;
}

.result-stage__diff {
  overflow: auto;
  max-height: 210px;
  margin: 0;
  padding: 12px;
  border-radius: 14px;
  background: rgba(29, 26, 23, 0.94);
  color: #f8f2e8;
  font-size: 12px;
  line-height: 1.6;
}

.result-stage__running-card {
  padding: 22px 24px;
  border: 1px solid rgba(204, 141, 64, 0.22);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(255, 244, 220, 0.96), rgba(255, 250, 241, 0.9)),
    radial-gradient(circle at top right, rgba(204, 141, 64, 0.12), transparent 55%);
}

.result-stage__running-title {
  margin: 16px 0 0;
  font-family: var(--font-display);
  font-size: 24px;
}

.result-stage__running-copy {
  margin: 10px 0 0;
  color: var(--text-muted);
  line-height: 1.75;
}

.result-stage__running-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 16px;
  color: var(--text-muted);
  font-size: 12px;
}

@media (max-width: 960px) {
  .result-stage__header-side {
    justify-items: start;
  }

  .result-stage__stage-tabs {
    min-width: 0;
    width: 100%;
  }

  .result-stage__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .result-stage__tab-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .result-stage__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
