<script setup lang="ts">
import { computed, ref } from "vue";

import type { RecentTaskItem, TaskStatus } from "@shared";

type Props = {
  items?: RecentTaskItem[];
  selectedTaskId?: string;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  selectedTaskId: "",
  loading: false,
  error: null,
  compact: false,
});

const emit = defineEmits<{
  (event: "refresh"): void;
  (event: "select-task", taskId: string): void;
}>();

const statusLabelMap: Record<TaskStatus, string> = {
  pending: "等待执行",
  running: "执行中",
  success: "完成",
  partial_success: "部分完成",
  failed: "失败",
};

const statusClassMap: Record<TaskStatus, string> = {
  pending: "recent-tasks-panel__status--pending",
  running: "recent-tasks-panel__status--running",
  success: "recent-tasks-panel__status--success",
  partial_success: "recent-tasks-panel__status--partial",
  failed: "recent-tasks-panel__status--failed",
};

const previewLimit = computed(() => (props.compact ? 4 : 3));
const isExpanded = ref(false);

const previewItems = computed(() => props.items.slice(0, previewLimit.value));
const visibleItems = computed(() => (isExpanded.value ? props.items : previewItems.value));

const hiddenCount = computed(() => Math.max(props.items.length - previewItems.value.length, 0));

function formatDateTime(value: string) {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function summarizeResult(item: RecentTaskItem) {
  if (item.failedRows > 0) {
    return `改动 ${item.changedRows} · 失败 ${item.failedRows}`;
  }

  return `改动 ${item.changedRows}`;
}
</script>

<template>
  <section :class="['recent-tasks-panel', { 'recent-tasks-panel--compact': compact }]">
    <header class="recent-tasks-panel__header">
      <div class="recent-tasks-panel__heading">
        <p v-if="!compact" class="recent-tasks-panel__eyebrow">最近任务</p>
        <h3 class="recent-tasks-panel__title">{{ compact ? "任务历史" : "任务回看" }}</h3>
        <p v-if="!compact" class="recent-tasks-panel__hint">轻量回看，点击后在中栏查看完整结果。</p>
      </div>
      <el-button :loading="loading" plain size="small" @click="emit('refresh')">
        {{ compact ? "更新" : "刷新" }}
      </el-button>
    </header>

    <div class="recent-tasks-panel__body">
      <el-alert
        v-if="error"
        :closable="false"
        :title="error"
        show-icon
        type="warning"
      />

      <div v-else-if="visibleItems.length" class="recent-tasks-panel__list">
        <button
          v-for="item in visibleItems"
          :key="item.taskId"
          :aria-pressed="item.taskId === selectedTaskId"
          :class="[
            'recent-tasks-panel__item',
            { 'recent-tasks-panel__item--active': item.taskId === selectedTaskId },
          ]"
          type="button"
          @click="emit('select-task', item.taskId)"
        >
          <div class="recent-tasks-panel__content">
            <div class="recent-tasks-panel__topline">
              <div class="recent-tasks-panel__title-group">
                <strong class="recent-tasks-panel__file" :title="item.fileName">
                  {{ item.fileName }}
                </strong>
                <span
                  v-if="item.taskId === selectedTaskId"
                  class="recent-tasks-panel__current"
                >
                  当前
                </span>
              </div>
              <span class="recent-tasks-panel__time">{{ formatDateTime(item.createdAt) }}</span>
            </div>

            <div class="recent-tasks-panel__meta">
              <span
                :class="['recent-tasks-panel__status', statusClassMap[item.status]]"
              >
                <span class="recent-tasks-panel__status-dot" aria-hidden="true" />
                {{ statusLabelMap[item.status] }}
              </span>
              <span class="recent-tasks-panel__meta-item">{{ summarizeResult(item) }}</span>
            </div>
          </div>
        </button>

        <div v-if="hiddenCount > 0" class="recent-tasks-panel__footer">
          <p v-if="!isExpanded" class="recent-tasks-panel__more">
            还有 {{ hiddenCount }} 条历史任务。
          </p>
          <el-button
            class="recent-tasks-panel__toggle"
            link
            size="small"
            type="primary"
            :aria-expanded="isExpanded"
            @click="isExpanded = !isExpanded"
          >
            {{ isExpanded ? "收起最近任务" : `查看全部（${props.items.length} 条）` }}
          </el-button>
        </div>
      </div>

      <el-empty
        v-else
        description="这里会显示最近执行过的任务，方便继续查看结果。"
      />
    </div>
  </section>
</template>

<style scoped>
.recent-tasks-panel {
  display: grid;
  gap: 10px;
}

.recent-tasks-panel--compact {
  gap: 8px;
}

.recent-tasks-panel--compact .recent-tasks-panel__header {
  gap: 8px;
}

.recent-tasks-panel--compact .recent-tasks-panel__title {
  margin: 0;
  font-size: 12px;
  font-weight: 780;
}

.recent-tasks-panel--compact .recent-tasks-panel__item {
  padding: 8px 9px;
}

.recent-tasks-panel--compact .recent-tasks-panel__file {
  font-size: 12px;
}

.recent-tasks-panel--compact .recent-tasks-panel__meta {
  margin-top: 6px;
}

.recent-tasks-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.recent-tasks-panel__heading {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.recent-tasks-panel__eyebrow {
  margin: 0;
  color: var(--accent-gold);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.recent-tasks-panel__title {
  margin: 2px 0 0;
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0.02em;
  color: var(--text-strong);
}

.recent-tasks-panel__hint {
  margin: 0;
  color: var(--text-faint);
  font-size: 11px;
  line-height: 1.45;
}

.recent-tasks-panel__body {
  display: grid;
  gap: 10px;
}

.recent-tasks-panel__list {
  display: grid;
  gap: 8px;
}

.recent-tasks-panel__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  padding: 10px 11px;
  border: 1px solid rgba(51, 41, 34, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.48);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.recent-tasks-panel__item:hover {
  border-color: rgba(15, 109, 100, 0.16);
  background: rgba(255, 255, 255, 0.7);
}

.recent-tasks-panel__item:focus-visible {
  outline: 2px solid rgba(15, 109, 100, 0.3);
  outline-offset: 2px;
}

.recent-tasks-panel__item--active {
  border-color: rgba(192, 123, 40, 0.24);
  background: rgba(255, 250, 242, 0.86);
}

.recent-tasks-panel__content {
  min-width: 0;
}

.recent-tasks-panel__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.recent-tasks-panel__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.recent-tasks-panel__file {
  overflow: hidden;
  font-size: 14px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-tasks-panel__current {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(192, 123, 40, 0.14);
  color: var(--accent-gold);
  font-size: 11px;
  font-weight: 700;
}

.recent-tasks-panel__time {
  flex-shrink: 0;
  color: var(--text-faint);
  font-size: 11px;
  line-height: 1.4;
}

.recent-tasks-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.recent-tasks-panel__status,
.recent-tasks-panel__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
}

.recent-tasks-panel__status {
  border: 1px solid transparent;
}

.recent-tasks-panel__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.recent-tasks-panel__status--pending {
  background: rgba(109, 117, 126, 0.08);
  color: #6d757e;
}

.recent-tasks-panel__status--running {
  background: rgba(64, 158, 255, 0.1);
  color: #2f78c7;
}

.recent-tasks-panel__status--success {
  background: rgba(103, 194, 58, 0.1);
  color: #4c8f2b;
}

.recent-tasks-panel__status--partial {
  background: rgba(230, 162, 60, 0.12);
  color: #a1691f;
}

.recent-tasks-panel__status--failed {
  background: rgba(245, 108, 108, 0.1);
  color: #c44c4c;
}

.recent-tasks-panel__meta-item {
  background: rgba(51, 41, 34, 0.06);
  color: var(--text-faint);
}

.recent-tasks-panel__more {
  margin: 0;
  color: var(--text-faint);
  font-size: 11px;
  line-height: 1.45;
}

.recent-tasks-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.recent-tasks-panel__toggle {
  margin-left: auto;
}
</style>
