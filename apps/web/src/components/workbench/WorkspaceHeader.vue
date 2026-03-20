<script setup lang="ts">
import { computed } from "vue";

import type { TaskStatus } from "@shared";

type HeaderStat = {
  label: string;
  value: string | number;
  hint?: string;
};

type ContextItem = {
  label: string;
  value: string;
  hint: string;
  mono?: boolean;
};

type ButtonType = "primary" | "success" | "warning" | "info" | "danger";

type Props = {
  eyebrow?: string;
  title?: string;
  description?: string;
  fileName?: string;
  sheetName?: string;
  taskId?: string;
  taskStatus?: TaskStatus | null;
  stats?: HeaderStat[];
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  primaryActionType?: ButtonType;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
  primaryLoading?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  eyebrow: "Excel to AI 工作台",
  title: "预览优先的 Excel 智能处理工作台",
  description:
    "先确认表格与上下文，再由 AI 给出处理建议，执行和导出仍由程序稳定完成。",
  fileName: "",
  sheetName: "",
  taskId: "",
  taskStatus: null,
  stats: () => [],
  primaryActionLabel: "下载结果",
  secondaryActionLabel: "重新开始",
  primaryActionType: "primary",
  primaryDisabled: false,
  secondaryDisabled: false,
  primaryLoading: false,
});

const emit = defineEmits<{
  (event: "primary-action"): void;
  (event: "secondary-action"): void;
}>();

const statusLabelMap: Record<TaskStatus, string> = {
  pending: "等待执行",
  running: "执行中",
  success: "已完成",
  partial_success: "部分完成",
  failed: "执行失败",
};

const statusTypeMap: Record<TaskStatus, ButtonType> = {
  pending: "info",
  running: "primary",
  success: "success",
  partial_success: "warning",
  failed: "danger",
};

const displayStats = computed<HeaderStat[]>(() => {
  if (props.stats.length > 0) {
    return props.stats;
  }

  return [
    {
      label: "当前文件",
      value: props.fileName || "未选择",
      hint: props.sheetName ? `工作表：${props.sheetName}` : "上传后自动展示表格预览",
    },
    {
      label: "任务状态",
      value: props.taskStatus ? statusLabelMap[props.taskStatus] : "待开始",
      hint: props.taskId ? `任务编号：${props.taskId}` : "确认执行后生成任务记录",
    },
  ];
});

const statusLabel = computed(() =>
  props.taskStatus ? statusLabelMap[props.taskStatus] : "未开始",
);

const statusType = computed<ButtonType>(() =>
  props.taskStatus ? statusTypeMap[props.taskStatus] : "info",
);

const contextItems = computed<ContextItem[]>(() => [
  {
    label: "当前文件",
    value: props.fileName || "还没有上传文件",
    hint: props.fileName ? "上传后的原始预览会持续保留在主舞台" : "上传后自动进入工作台",
  },
  {
    label: "工作表",
    value: props.sheetName || "待选择",
    hint: props.sheetName ? "切换工作表后，中间预览会立即刷新" : "先确认需要处理的工作表",
  },
  {
    label: "最新任务",
    value: props.taskId || "尚未创建",
    hint: props.taskId ? "用于刷新状态、回看结果与下载导出" : "确认执行后生成任务记录",
    mono: Boolean(props.taskId),
  },
]);
</script>

<template>
  <header class="workbench-panel workspace-header">
    <div class="workbench-panel__body workspace-header__body">
      <div class="workspace-header__topbar">
        <div class="workspace-header__brand">
          <div class="workspace-header__brandline">
            <p class="workbench-panel__eyebrow">{{ eyebrow }}</p>
            <el-tag v-if="taskStatus" :type="statusType" effect="dark" round>
              {{ statusLabel }}
            </el-tag>
          </div>

          <div class="workspace-header__headline">
            <h1>{{ title }}</h1>
            <p class="workspace-header__description">{{ description }}</p>
          </div>
        </div>

        <div class="workbench-action-row workspace-header__actions">
          <el-button
            :disabled="primaryDisabled"
            :loading="primaryLoading"
            :type="primaryActionType"
            @click="emit('primary-action')"
          >
            {{ primaryActionLabel }}
          </el-button>
          <el-button :disabled="secondaryDisabled" plain @click="emit('secondary-action')">
            {{ secondaryActionLabel }}
          </el-button>
        </div>
      </div>

      <div class="workspace-header__context-strip">
        <article
          v-for="item in contextItems"
          :key="item.label"
          class="workspace-header__context-card"
        >
          <span class="workspace-header__context-label">{{ item.label }}</span>
          <strong
            :class="[
              'workspace-header__context-value',
              { 'workspace-header__context-value--mono': item.mono },
            ]"
          >
            {{ item.value }}
          </strong>
          <small class="workspace-header__context-hint">{{ item.hint }}</small>
        </article>
      </div>

      <div class="workspace-header__stats-strip">
        <article
          v-for="item in displayStats"
          :key="item.label"
          class="workspace-header__stat-card"
        >
          <span class="workspace-header__stat-label">{{ item.label }}</span>
          <strong class="workspace-header__stat-value">{{ item.value }}</strong>
          <small v-if="item.hint" class="workspace-header__stat-hint">{{ item.hint }}</small>
        </article>
      </div>
    </div>
  </header>
</template>

<style scoped>
.workspace-header__body {
  display: grid;
  gap: 18px;
}

.workspace-header__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.workspace-header__brand {
  min-width: 0;
}

.workspace-header__brandline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.workspace-header__headline h1 {
  margin: 12px 0 0;
  max-width: 18ch;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1.02;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.workspace-header__description {
  max-width: 72ch;
  margin: 10px 0 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.75;
}

.workspace-header__actions {
  flex-shrink: 0;
  justify-content: flex-end;
}

.workspace-header__context-strip,
.workspace-header__stats-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.workspace-header__context-card,
.workspace-header__stat-card {
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 22px;
  background:
    linear-gradient(145deg, rgba(255, 252, 247, 0.92), rgba(243, 250, 248, 0.78));
}

.workspace-header__context-label,
.workspace-header__stat-label {
  display: block;
  color: var(--text-faint);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.workspace-header__context-value,
.workspace-header__stat-value {
  display: block;
  margin-top: 8px;
  color: var(--text-strong);
  line-height: 1.35;
}

.workspace-header__context-value {
  font-size: 16px;
}

.workspace-header__context-value--mono {
  font-family: "Consolas", "SFMono-Regular", monospace;
  font-size: 13px;
  word-break: break-all;
}

.workspace-header__context-hint,
.workspace-header__stat-hint {
  display: block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.workspace-header__stat-value {
  font-size: 20px;
}

@media (max-width: 1200px) {
  .workspace-header__context-strip,
  .workspace-header__stats-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .workspace-header__topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .workspace-header__actions {
    justify-content: flex-start;
  }

  .workspace-header__headline h1 {
    max-width: none;
  }

  .workspace-header__context-strip,
  .workspace-header__stats-strip {
    grid-template-columns: 1fr;
  }
}
</style>
