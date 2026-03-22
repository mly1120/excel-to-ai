<script setup lang="ts">
import { computed } from "vue";

import type { RecentTaskItem } from "@shared";

import type { WorkbenchNavSection, WorkbenchSectionKey } from "../../config/workbenchCatalog";
import RecentTasksPanel from "./RecentTasksPanel.vue";

type Props = {
  sections: WorkbenchNavSection[];
  activeSection: WorkbenchSectionKey;
  suggestedSection: WorkbenchSectionKey;
  historySectionActive?: boolean;
  fileName?: string | null;
  sheetName?: string | null;
  recentItems?: RecentTaskItem[];
  recentSelectedTaskId?: string;
  recentLoading?: boolean;
  recentError?: string | null;
};

const props = withDefaults(defineProps<Props>(), {
  fileName: null,
  sheetName: null,
  historySectionActive: false,
  recentItems: () => [],
  recentSelectedTaskId: "",
  recentLoading: false,
  recentError: null,
});

const emit = defineEmits<{
  (event: "select-section", key: WorkbenchSectionKey): void;
  (event: "refresh-recent"): void;
  (event: "select-task", taskId: string): void;
}>();

function handleSelect(key: WorkbenchSectionKey) {
  emit("select-section", key);
}

const navSections = computed(() =>
  props.sections.filter((section) => section.key === "workspace" || section.key === "templates"),
);

const showHistorySection = computed(() => props.historySectionActive || props.activeSection === "history");

function handleOpenCurrentFile() {
  emit("select-section", "workspace");
}
</script>

<template>
  <section class="workbench-panel workbench-sidebar" aria-label="工作台导航轨">
    <header class="workbench-sidebar__header">
      <p class="workbench-sidebar__eyebrow">Workbench Rail</p>
      <h2 class="workbench-sidebar__title">导航轨</h2>
      <p class="workbench-sidebar__note">左侧只做入口导航，主内容始终在中栏。</p>
    </header>

    <nav class="workbench-sidebar__nav" aria-label="工作台入口">
      <button
        v-for="section in navSections"
        :key="section.key"
        :class="[
          'workbench-sidebar__nav-item',
          {
            'workbench-sidebar__nav-item--active': section.key === activeSection,
            'workbench-sidebar__nav-item--suggested': section.key === suggestedSection,
          },
        ]"
        type="button"
        @click="handleSelect(section.key)"
      >
        <span class="workbench-sidebar__nav-main">
          <span class="workbench-sidebar__nav-title">{{ section.title }}</span>
          <span class="workbench-sidebar__nav-desc">{{ section.description }}</span>
        </span>
        <span v-if="section.key === activeSection" class="workbench-sidebar__nav-badge">
          当前
        </span>
        <span v-else-if="section.key === suggestedSection" class="workbench-sidebar__nav-badge">
          建议
        </span>
      </button>

      <button
        :class="[
          'workbench-sidebar__nav-item',
          'workbench-sidebar__nav-item--history',
          { 'workbench-sidebar__nav-item--active': activeSection === 'history' },
        ]"
        type="button"
        @click="handleSelect('history')"
      >
        <span class="workbench-sidebar__nav-main">
          <span class="workbench-sidebar__nav-title">最近任务</span>
          <span class="workbench-sidebar__nav-desc">快速回看历史执行并恢复结果视图。</span>
        </span>
        <span v-if="activeSection === 'history'" class="workbench-sidebar__nav-badge">
          当前
        </span>
      </button>

      <button
        class="workbench-sidebar__file-entry"
        type="button"
        @click="handleOpenCurrentFile"
      >
        <span class="workbench-sidebar__file-label">当前文件</span>
        <span class="workbench-sidebar__file-main">
          {{ fileName || "未上传文件" }}
        </span>
        <span class="workbench-sidebar__file-sub">
          {{ sheetName || "未选择工作表" }}
        </span>
      </button>
    </nav>

    <div class="workbench-sidebar__divider" aria-hidden="true" />

    <section class="workbench-sidebar__section" aria-label="历史任务分区">
      <p v-if="!showHistorySection" class="workbench-sidebar__section-hint">
        当前显示导航轨。切到“最近任务”后可直接回看并切换任务结果。
      </p>
      <RecentTasksPanel
        v-else
        compact
        :error="recentError"
        :items="recentItems"
        :loading="recentLoading"
        :selected-task-id="recentSelectedTaskId"
        @refresh="emit('refresh-recent')"
        @select-task="emit('select-task', $event)"
      />
    </section>
  </section>
</template>

<style scoped>
.workbench-sidebar {
  display: grid;
  gap: 12px;
  padding: 14px 12px 12px;
  min-height: 0;
}

.workbench-sidebar__header {
  display: grid;
  gap: 4px;
}

.workbench-sidebar__eyebrow {
  margin: 0;
  color: var(--accent-gold);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.workbench-sidebar__title {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
}

.workbench-sidebar__note {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.workbench-sidebar__nav {
  display: grid;
  gap: 7px;
}

.workbench-sidebar__nav-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid rgba(51, 41, 34, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.46);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.workbench-sidebar__nav-item:hover {
  transform: translateY(-1px);
  border-color: rgba(15, 109, 100, 0.2);
  background: rgba(255, 255, 255, 0.68);
}

.workbench-sidebar__nav-item:focus-visible {
  outline: 2px solid rgba(15, 109, 100, 0.3);
  outline-offset: 2px;
}

.workbench-sidebar__nav-item--active {
  border-color: rgba(51, 41, 34, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.workbench-sidebar__nav-item--suggested {
  border-color: rgba(192, 123, 40, 0.24);
  background: rgba(255, 250, 242, 0.86);
}

.workbench-sidebar__nav-item--history {
  border-style: dashed;
}

.workbench-sidebar__nav-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.workbench-sidebar__nav-title {
  font-size: 12px;
  font-weight: 750;
  color: var(--text-strong);
}

.workbench-sidebar__nav-desc {
  color: var(--text-faint);
  font-size: 10px;
  line-height: 1.45;
}

.workbench-sidebar__nav-badge {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(15, 109, 100, 0.12);
  color: rgba(15, 109, 100, 0.9);
  font-size: 10px;
  font-weight: 800;
}

.workbench-sidebar__file-entry {
  display: grid;
  gap: 3px;
  width: 100%;
  padding: 10px;
  border: 1px dashed rgba(15, 109, 100, 0.28);
  border-radius: 14px;
  background: rgba(241, 250, 248, 0.64);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.workbench-sidebar__file-entry:hover {
  border-color: rgba(15, 109, 100, 0.45);
  background: rgba(241, 250, 248, 0.82);
}

.workbench-sidebar__file-entry:focus-visible {
  outline: 2px solid rgba(15, 109, 100, 0.3);
  outline-offset: 2px;
}

.workbench-sidebar__file-label {
  color: var(--text-faint);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.workbench-sidebar__file-main {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.workbench-sidebar__file-sub {
  color: var(--text-faint);
  font-size: 10px;
  line-height: 1.35;
}

.workbench-sidebar__divider {
  height: 1px;
  background: rgba(43, 34, 28, 0.1);
}

.workbench-sidebar__section {
  display: grid;
  gap: 8px;
  min-height: 0;
}

.workbench-sidebar__section-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.5;
  padding: 8px 10px;
  border: 1px dashed rgba(51, 41, 34, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}

@media (min-width: 1181px) {
  .workbench-sidebar {
    grid-template-rows: auto auto auto auto minmax(0, 1fr);
    max-height: calc(100vh - 30px);
  }

  .workbench-sidebar__section {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
    margin-right: -4px;
    scrollbar-gutter: stable;
  }
}
</style>
