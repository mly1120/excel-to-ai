<script setup lang="ts">
import { ref } from "vue";

import type { CapabilityGroup, ScenarioPromptChip } from "../../config/workbenchCatalog";
import CapabilityMatrix from "./CapabilityMatrix.vue";
import ScenarioPromptChips from "./ScenarioPromptChips.vue";

type Props = {
  title?: string;
  description?: string;
  capabilityGroups?: CapabilityGroup[];
  scenarioPromptChips?: ScenarioPromptChip[];
  acceptedExtensions?: string[];
  maxUploadSizeMb?: number;
  uploading?: boolean;
};

withDefaults(defineProps<Props>(), {
  title: "从一个 Excel 开始，把复杂处理交给工作台",
  description:
    "上传后先确认表格，再通过自然语言描述你要的处理方式。执行结果、失败记录和历史回看都围绕同一条工作链路展开。",
  capabilityGroups: () => [],
  scenarioPromptChips: () => [],
  acceptedExtensions: () => [".xlsx", ".xls"],
  maxUploadSizeMb: 20,
  uploading: false,
});

const emit = defineEmits<{
  (event: "upload", file: File): void;
  (event: "choose-template", template: string): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);

function openPicker() {
  fileInput.value?.click();
}

function emitFile(file: File | undefined) {
  if (!file) {
    return;
  }

  emit("upload", file);
}

function onInputChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  emitFile(input.files?.[0]);
  input.value = "";
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = false;
  emitFile(event.dataTransfer?.files?.[0]);
}
</script>

<template>
  <section class="workbench-panel empty-dashboard">
    <div class="workbench-panel__body empty-dashboard__body">
      <div class="empty-dashboard__intro">
        <p class="workbench-panel__eyebrow">开始处理</p>
        <h2>{{ title }}</h2>
        <p class="empty-dashboard__description">{{ description }}</p>
      </div>

      <div class="empty-dashboard__stage">
        <div
          :class="['empty-dashboard__dropzone', { 'empty-dashboard__dropzone--drag': isDragOver }]"
          @click="openPicker"
          @dragenter.prevent="isDragOver = true"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop="onDrop"
        >
          <input
            ref="fileInput"
            :accept="acceptedExtensions.join(',')"
            class="empty-dashboard__input"
            type="file"
            @change="onInputChange"
          />

          <span class="empty-dashboard__dropzone-title">
            {{ uploading ? "正在上传并解析文件" : "点击选择文件，或把 Excel 拖到这里" }}
          </span>
          <span class="empty-dashboard__dropzone-copy">
            预览会先出现在中间主舞台，AI 只在右侧给出建议与确认，不再把所有信息一起摊开。
          </span>
          <span class="empty-dashboard__dropzone-meta">
            支持 {{ acceptedExtensions.join(" / ") }}，单文件不超过 {{ maxUploadSizeMb }}MB
          </span>
        </div>

        <aside class="empty-dashboard__guide">
          <article class="empty-dashboard__guide-card">
            <span class="empty-dashboard__guide-index">01</span>
            <div>
              <strong>先看预览</strong>
              <p>上传后先确认文件、工作表和样例数据，先理解上下文，再决定怎么处理。</p>
            </div>
          </article>

          <article class="empty-dashboard__guide-card">
            <span class="empty-dashboard__guide-index">02</span>
            <div>
              <strong>再说需求</strong>
              <p>用一句中文描述目标，AI 先总结计划和影响范围，不直接改动原始数据。</p>
            </div>
          </article>

          <article class="empty-dashboard__guide-card">
            <span class="empty-dashboard__guide-index">03</span>
            <div>
              <strong>确认后执行</strong>
              <p>执行、导出和失败记录都由程序完成，历史任务固定保留在左侧导航里。</p>
            </div>
          </article>
        </aside>
      </div>

      <CapabilityMatrix
        v-if="capabilityGroups.length"
        :groups="capabilityGroups"
        @choose-prompt="emit('choose-template', $event)"
      />

      <ScenarioPromptChips
        v-if="scenarioPromptChips.length"
        :chips="scenarioPromptChips"
        @choose-prompt="emit('choose-template', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.empty-dashboard__body {
  display: grid;
  gap: 24px;
}

.empty-dashboard__intro h2 {
  margin: 12px 0 0;
  max-width: 14ch;
  font-family: var(--font-display);
  font-size: clamp(30px, 3.2vw, 48px);
  line-height: 1.02;
}

.empty-dashboard__description {
  max-width: 56ch;
  margin: 14px 0 0;
  color: var(--text-muted);
  line-height: 1.8;
}

.empty-dashboard__stage {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.78fr);
  gap: 18px;
  align-items: stretch;
}

.empty-dashboard__dropzone {
  display: grid;
  gap: 10px;
  min-height: 320px;
  padding: 30px;
  border: 1px dashed rgba(15, 109, 100, 0.38);
  border-radius: 28px;
  align-content: center;
  background:
    linear-gradient(135deg, rgba(255, 247, 233, 0.96), rgba(240, 250, 247, 0.92));
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.empty-dashboard__dropzone:hover,
.empty-dashboard__dropzone--drag {
  transform: translateY(-2px);
  border-color: rgba(15, 109, 100, 0.6);
  box-shadow: 0 22px 44px rgba(15, 109, 100, 0.09);
}

.empty-dashboard__input {
  display: none;
}

.empty-dashboard__dropzone-title {
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 1.12;
}

.empty-dashboard__dropzone-copy {
  max-width: 30ch;
  color: var(--text-muted);
  line-height: 1.8;
}

.empty-dashboard__dropzone-meta {
  color: var(--text-faint);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.empty-dashboard__guide {
  display: grid;
  gap: 12px;
}

.empty-dashboard__guide-card {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 18px;
  border: 1px solid var(--line-soft);
  border-radius: 22px;
  background:
    linear-gradient(145deg, rgba(255, 252, 247, 0.92), rgba(243, 250, 248, 0.76));
}

.empty-dashboard__guide-index {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--accent-gold);
  font-family: "Consolas", "SFMono-Regular", monospace;
  font-size: 14px;
  font-weight: 700;
}

.empty-dashboard__guide-card strong {
  display: block;
  margin-top: 2px;
  color: var(--text-strong);
  font-size: 16px;
}

.empty-dashboard__guide-card p {
  margin: 8px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
}

@media (max-width: 980px) {
  .empty-dashboard__stage {
    grid-template-columns: 1fr;
  }

  .empty-dashboard__intro h2 {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .empty-dashboard__dropzone {
    min-height: 260px;
    padding: 22px;
  }

  .empty-dashboard__guide-card {
    grid-template-columns: 44px minmax(0, 1fr);
    padding: 16px;
  }
}
</style>
