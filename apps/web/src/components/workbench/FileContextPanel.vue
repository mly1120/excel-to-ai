<script setup lang="ts">
type StageKey = "preview" | "result";

type Props = {
  activeStage?: StageKey;
  fileName?: string;
  fileId?: string;
  selectedSheet?: string;
  sheets?: string[];
  rowCount?: number;
  columnCount?: number;
  loading?: boolean;
};

withDefaults(defineProps<Props>(), {
  activeStage: "preview",
  fileName: "",
  fileId: "",
  selectedSheet: "",
  sheets: () => [],
  rowCount: 0,
  columnCount: 0,
  loading: false,
});

const emit = defineEmits<{
  (event: "select-sheet", sheetName: string): void;
  (event: "change-stage", stage: StageKey): void;
}>();
</script>

<template>
  <section class="workbench-panel file-context-panel">
    <div v-if="fileName" class="workbench-panel__body file-context-panel__body">
      <div class="file-context-panel__stage-nav" role="tablist" aria-label="中栏舞台导航">
        <button
          :class="[
            'file-context-panel__stage-tab',
            { 'file-context-panel__stage-tab--active': activeStage === 'preview' },
          ]"
          :aria-selected="activeStage === 'preview'"
          role="tab"
          type="button"
          @click="emit('change-stage', 'preview')"
        >
          <span>文件预览</span>
          <small>查看原始数据与工作表</small>
        </button>

        <button
          :class="[
            'file-context-panel__stage-tab',
            { 'file-context-panel__stage-tab--active': activeStage === 'result' },
          ]"
          :aria-selected="activeStage === 'result'"
          role="tab"
          type="button"
          @click="emit('change-stage', 'result')"
        >
          <span>处理结果</span>
          <small>回看变更、失败与导出</small>
        </button>
      </div>

      <div class="file-context-panel__intro">
        <div>
          <p class="workbench-panel__eyebrow">当前上下文</p>
          <p class="file-context-panel__intro-copy">
            中栏主舞台始终围绕当前文件刷新，先看清上下文，再执行下一步处理。
          </p>
        </div>
        <div class="file-context-panel__summary">
          <span>{{ rowCount }} 行</span>
          <span>{{ columnCount }} 列</span>
        </div>
      </div>

      <div class="file-context-panel__strip">
        <article class="file-context-panel__meta file-context-panel__meta--file">
          <span>文件</span>
          <strong>{{ fileName }}</strong>
          <small>{{ fileId || "等待文件编号" }}</small>
        </article>

        <article class="file-context-panel__meta">
          <span>预览规模</span>
          <strong>{{ rowCount }} 行</strong>
          <small>{{ columnCount }} 列</small>
        </article>

        <div class="file-context-panel__picker">
          <span class="file-context-panel__picker-label">工作表</span>
          <el-select
            :loading="loading"
            :model-value="selectedSheet"
            class="file-context-panel__select"
            placeholder="请选择工作表"
            @change="emit('select-sheet', $event)"
          >
            <el-option v-for="sheet in sheets" :key="sheet" :label="sheet" :value="sheet" />
          </el-select>
        </div>
      </div>
    </div>

    <div v-else class="workbench-panel__body">
      <el-empty description="上传文件后，这里会出现文件上下文和工作表选择。" />
    </div>
  </section>
</template>

<style scoped>
.file-context-panel__body {
  display: grid;
  gap: 16px;
}

.file-context-panel__stage-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.file-context-panel__stage-tab {
  display: grid;
  justify-items: start;
  gap: 6px;
  padding: 13px 14px;
  border: 1px solid rgba(51, 41, 34, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-muted);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.file-context-panel__stage-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(15, 109, 100, 0.36);
}

.file-context-panel__stage-tab span {
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.05;
  color: var(--text-strong);
}

.file-context-panel__stage-tab small {
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.5;
}

.file-context-panel__stage-tab--active {
  border-color: rgba(192, 123, 40, 0.4);
  background:
    linear-gradient(145deg, rgba(255, 248, 236, 0.95), rgba(241, 250, 248, 0.92));
}

.file-context-panel__intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.file-context-panel__intro-copy {
  margin: 10px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.file-context-panel__summary {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.file-context-panel__summary span {
  padding: 8px 12px;
  border: 1px solid rgba(51, 41, 34, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.file-context-panel__strip {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) 160px minmax(220px, 0.82fr);
  gap: 12px;
}

.file-context-panel__meta,
.file-context-panel__picker {
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
}

.file-context-panel__meta--file {
  min-width: 0;
}

.file-context-panel__meta span,
.file-context-panel__meta small,
.file-context-panel__picker-label {
  display: block;
  color: var(--text-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.file-context-panel__meta strong {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  line-height: 1.4;
  word-break: break-word;
}

.file-context-panel__meta small {
  margin-top: 6px;
  color: var(--text-muted);
  letter-spacing: normal;
  text-transform: none;
  word-break: break-all;
}

.file-context-panel__picker {
  background:
    linear-gradient(145deg, rgba(255, 249, 239, 0.9), rgba(241, 250, 248, 0.82));
}

.file-context-panel__select {
  width: 100%;
  margin-top: 10px;
}

@media (max-width: 980px) {
  .file-context-panel__stage-nav {
    grid-template-columns: 1fr;
  }

  .file-context-panel__intro {
    flex-direction: column;
  }

  .file-context-panel__summary {
    justify-content: flex-start;
  }

  .file-context-panel__strip {
    grid-template-columns: 1fr;
  }
}
</style>
