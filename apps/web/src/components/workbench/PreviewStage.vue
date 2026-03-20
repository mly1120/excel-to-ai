<script setup lang="ts">
import type { PreviewData } from "@shared";

type StageKey = "preview" | "result";

type ViewOption = {
  key: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
};

type Props = {
  title?: string;
  note?: string;
  preview?: PreviewData | null;
  activeStage?: StageKey;
  activeView?: string;
  viewOptions?: ViewOption[];
  loading?: boolean;
  emptyDescription?: string;
};

const props = withDefaults(defineProps<Props>(), {
  title: "表格预览",
  note: "预览永远保持主画面，结果和对比只是围绕它展开。",
  preview: null,
  activeStage: "preview",
  activeView: "preview",
  viewOptions: () => [],
  loading: false,
  emptyDescription: "上传文件后，中间主区域会优先展示表格预览。",
});

const emit = defineEmits<{
  (event: "change-stage", stage: StageKey): void;
  (event: "change-view", view: string): void;
}>();

const stageTabs: Array<{
  key: StageKey;
  label: string;
  hint: string;
}> = [
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

function formatCellValue(value: unknown) {
  if (value == null || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function handleResultViewSwitch(view: string) {
  emit("change-stage", "result");
  emit("change-view", view);
}
</script>

<template>
  <section class="workbench-panel preview-stage" data-stage-anchor="preview">
    <div class="workbench-panel__header">
      <div>
        <p class="workbench-panel__eyebrow">主舞台</p>
        <h2 class="workbench-panel__title">{{ title }}</h2>
      </div>

      <div class="preview-stage__header-side">
        <div class="preview-stage__stage-tabs" role="tablist" aria-label="中栏主舞台">
          <button
            v-for="stage in stageTabs"
            :key="stage.key"
            :class="[
              'preview-stage__stage-tab',
              { 'preview-stage__stage-tab--active': stage.key === activeStage },
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

        <div v-if="viewOptions.length" class="preview-stage__view-switch">
          <button
            v-for="option in viewOptions"
            :key="option.key"
            :class="[
              'preview-stage__view-chip',
              { 'preview-stage__view-chip--active': option.key === activeView },
            ]"
            :disabled="option.disabled"
            type="button"
            @click="handleResultViewSwitch(option.key)"
          >
            <span>{{ option.label }}</span>
            <small v-if="option.badge !== undefined">{{ option.badge }}</small>
          </button>
        </div>
        <span class="workbench-panel__note">{{ note }}</span>
      </div>
    </div>

    <div class="workbench-panel__body">
      <div v-if="preview" class="preview-stage__table-wrap">
        <div class="preview-stage__meta">
          <span>{{ preview.columns.length }} 列</span>
          <span>{{ preview.total }} 行</span>
          <span v-if="loading">正在刷新预览</span>
        </div>

        <el-table
          :data="preview.rows"
          border
          class="workbench-data-table preview-stage__table"
          height="420"
          size="small"
        >
          <el-table-column
            v-for="column in preview.columns"
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

      <el-empty v-else :description="emptyDescription" />
    </div>
  </section>
</template>

<style scoped>
.preview-stage__header-side {
  display: grid;
  justify-items: end;
  gap: 10px;
}

.preview-stage__stage-tabs {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: min(420px, 100%);
}

.preview-stage__stage-tab {
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

.preview-stage__stage-tab span {
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1.1;
  color: var(--text-strong);
}

.preview-stage__stage-tab small {
  color: var(--text-faint);
  font-size: 11px;
}

.preview-stage__stage-tab--active {
  border-color: rgba(15, 109, 100, 0.4);
  background:
    linear-gradient(145deg, rgba(236, 248, 246, 0.95), rgba(250, 253, 252, 0.9));
}

.preview-stage__view-switch {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.preview-stage__view-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid rgba(51, 41, 34, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.preview-stage__view-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(15, 109, 100, 0.38);
}

.preview-stage__view-chip--active {
  border-color: rgba(15, 109, 100, 0.52);
  background: rgba(236, 248, 246, 0.94);
  color: var(--accent-teal);
}

.preview-stage__view-chip small {
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(51, 41, 34, 0.08);
  font-size: 11px;
}

.preview-stage__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 12px;
  color: var(--text-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview-stage__table-wrap {
  border: 1px solid rgba(51, 41, 34, 0.08);
  border-radius: 20px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.74);
}

@media (max-width: 900px) {
  .preview-stage__header-side {
    justify-items: start;
  }

  .preview-stage__stage-tabs {
    min-width: 0;
    width: 100%;
  }

  .preview-stage__view-switch {
    justify-content: flex-start;
  }
}
</style>
