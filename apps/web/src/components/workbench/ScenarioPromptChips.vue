<script setup lang="ts">
import type { ScenarioPromptChip } from "../../config/workbenchCatalog";

type Props = {
  chips?: ScenarioPromptChip[];
};

withDefaults(defineProps<Props>(), {
  chips: () => [],
});

const emit = defineEmits<{
  (event: "choose-prompt", prompt: string): void;
}>();
</script>

<template>
  <section class="scenario-prompt-chips" aria-label="行业场景提示">
    <header class="scenario-prompt-chips__head">
      <div>
        <p class="scenario-prompt-chips__eyebrow">行业场景</p>
        <h3>场景提示词</h3>
      </div>
      <p>点击后仅回填到右侧输入框，仍需手动生成建议并确认执行。</p>
    </header>

    <div class="scenario-prompt-chips__list">
      <button
        v-for="chip in chips"
        :key="chip.key"
        class="workbench-chip scenario-prompt-chips__chip"
        type="button"
        @click="emit('choose-prompt', chip.prompt)"
      >
        <span>{{ chip.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.scenario-prompt-chips {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--line-soft);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.64);
}

.scenario-prompt-chips__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.scenario-prompt-chips__eyebrow {
  margin: 0;
  color: var(--accent-gold);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.scenario-prompt-chips__head h3 {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 1.1;
}

.scenario-prompt-chips__head p {
  max-width: 26ch;
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
  text-align: right;
}

.scenario-prompt-chips__list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.scenario-prompt-chips__chip {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  text-align: left;
}

@media (max-width: 760px) {
  .scenario-prompt-chips {
    padding: 16px;
  }

  .scenario-prompt-chips__head {
    flex-direction: column;
  }

  .scenario-prompt-chips__head p {
    max-width: none;
    text-align: left;
  }
}
</style>
