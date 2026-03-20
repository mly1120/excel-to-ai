<script setup lang="ts">
import type { RecentTaskItem } from "@shared";

import type { WorkbenchNavSection, WorkbenchSectionKey } from "../../config/workbenchCatalog";
import RecentTasksPanel from "./RecentTasksPanel.vue";

type Props = {
  sections: WorkbenchNavSection[];
  activeSection: WorkbenchSectionKey;
  suggestedSection: WorkbenchSectionKey;
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
</script>

<template>
  <section class="workbench-panel workbench-sidebar" aria-label="工作台导航轨">
    <header class="workbench-sidebar__header">
      <p class="workbench-sidebar__eyebrow">导航快捷入口</p>
      <h2 class="workbench-sidebar__title">工作台导航轨</h2>
      <p class="workbench-sidebar__note">
        点击后会定位到对应栏位，不会切换页面结构。
      </p>
    </header>

    <nav class="workbench-sidebar__nav" aria-label="快捷定位">
      <button
        v-for="section in sections"
        :key="section.key"
        :class="[
          'workbench-sidebar__nav-item',
          {
            'workbench-sidebar__nav-item--recent': section.key === activeSection,
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
          上次定位
        </span>
        <span v-else-if="section.key === suggestedSection" class="workbench-sidebar__nav-badge">
          建议
        </span>
      </button>
    </nav>

    <p class="workbench-sidebar__context">
      当前：{{ fileName || "未上传文件" }} · {{ sheetName || "未选择工作表" }}
    </p>

    <div class="workbench-sidebar__divider" aria-hidden="true" />

    <section class="workbench-sidebar__section" aria-label="最近任务">
      <RecentTasksPanel
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
  gap: 14px;
  padding: 18px 16px 16px;
  min-height: 0;
}

.workbench-sidebar__header {
  display: grid;
  gap: 6px;
}

.workbench-sidebar__eyebrow {
  margin: 0;
  color: var(--accent-gold);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.workbench-sidebar__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 1.06;
}

.workbench-sidebar__note {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.workbench-sidebar__nav {
  display: grid;
  gap: 8px;
}

.workbench-sidebar__nav-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(51, 41, 34, 0.1);
  border-radius: 16px;
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

.workbench-sidebar__nav-item--recent {
  border-color: rgba(51, 41, 34, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.workbench-sidebar__nav-item--suggested {
  border-color: rgba(192, 123, 40, 0.24);
  background: rgba(255, 250, 242, 0.86);
}

.workbench-sidebar__nav-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.workbench-sidebar__nav-title {
  font-size: 13px;
  font-weight: 750;
  color: var(--text-strong);
}

.workbench-sidebar__nav-desc {
  color: var(--text-faint);
  font-size: 11px;
  line-height: 1.45;
}

.workbench-sidebar__nav-badge {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 109, 100, 0.12);
  color: rgba(15, 109, 100, 0.9);
  font-size: 11px;
  font-weight: 800;
}

.workbench-sidebar__context {
  margin: -2px 0 0;
  color: var(--text-faint);
  font-size: 11px;
  line-height: 1.45;
}

.workbench-sidebar__divider {
  height: 1px;
  background: rgba(43, 34, 28, 0.1);
}

.workbench-sidebar__section {
  display: grid;
  gap: 10px;
  min-height: 0;
}

.workbench-sidebar__section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 850;
  color: var(--text-strong);
  letter-spacing: 0.02em;
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
