<script setup lang="ts">
import { computed } from "vue";

export type PromptComposerMode = "plan" | "followup";

type Props = {
  modelValue?: string;
  templates?: string[];
  mode?: PromptComposerMode;
  canSubmit?: boolean;
  submitting?: boolean;
  submitLabel?: string;
  placeholder?: string;
  showModeSwitch?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  templates: () => [],
  mode: "plan",
  canSubmit: false,
  submitting: false,
  submitLabel: "生成 AI 建议",
  placeholder: "例如：去掉手机号前后空格，把金额保留两位小数，并新增省份列。",
  showModeSwitch: true,
});

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "choose-template", template: string): void;
  (event: "submit"): void;
  (event: "update:mode", mode: PromptComposerMode): void;
}>();

const valueModel = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});

const modeOptions: Array<{ key: PromptComposerMode; label: string }> = [
  { key: "plan", label: "计划模式" },
  { key: "followup", label: "继续处理" },
];

function handleSubmit() {
  if (!props.canSubmit || props.submitting) {
    return;
  }

  emit("submit");
}
</script>

<template>
  <div class="prompt-composer">
    <div class="prompt-composer__head">
      <div>
        <strong>输入需求</strong>
        <p>越具体越好，尽量用一句话说清目标。</p>
      </div>
      <div v-if="showModeSwitch" class="prompt-composer__mode-switch" role="group" aria-label="输入模式">
        <button
          v-for="item in modeOptions"
          :key="item.key"
          :class="[
            'prompt-composer__mode-btn',
            { 'prompt-composer__mode-btn--active': mode === item.key },
          ]"
          type="button"
          @click="emit('update:mode', item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <el-input
      v-model="valueModel"
      :rows="5"
      :placeholder="placeholder"
      resize="none"
      type="textarea"
    />

    <div v-if="templates.length" class="prompt-composer__templates">
      <button
        v-for="template in templates"
        :key="template"
        class="workbench-chip prompt-composer__template-chip"
        type="button"
        @click="emit('choose-template', template)"
      >
        {{ template }}
      </button>
    </div>

    <div class="workbench-action-row">
      <el-button
        :disabled="!canSubmit"
        :loading="submitting"
        type="primary"
        @click="handleSubmit"
      >
        {{ submitLabel }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.prompt-composer {
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--line-soft);
  display: grid;
  gap: 12px;
}

.prompt-composer__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.prompt-composer__head strong {
  font-size: 14px;
}

.prompt-composer__head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.prompt-composer__mode-switch {
  display: inline-flex;
  align-self: start;
  border-radius: 999px;
  border: 1px solid rgba(51, 41, 34, 0.12);
  padding: 2px;
  background: rgba(255, 255, 255, 0.74);
}

.prompt-composer__mode-btn {
  border: 0;
  background: transparent;
  border-radius: 999px;
  padding: 5px 10px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
}

.prompt-composer__mode-btn--active {
  background: rgba(15, 109, 100, 0.14);
  color: var(--accent-teal);
  font-weight: 700;
}

.prompt-composer__templates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.prompt-composer__template-chip {
  text-align: left;
}
</style>
