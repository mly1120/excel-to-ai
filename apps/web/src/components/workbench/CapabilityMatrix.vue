<script setup lang="ts">
import type { CapabilityGroup } from "../../config/workbenchCatalog";

type Props = {
  groups?: CapabilityGroup[];
};

withDefaults(defineProps<Props>(), {
  groups: () => [],
});

const emit = defineEmits<{
  (event: "choose-prompt", prompt: string): void;
}>();

function capabilityStateLabel(kind: "available" | "reserved") {
  return kind === "available" ? "当前可承接" : "预留示例提示词";
}
</script>

<template>
  <section class="capability-matrix" aria-label="能力矩阵">
    <header class="capability-matrix__head">
      <div>
        <p class="capability-matrix__eyebrow">能力入口</p>
        <h3>能力矩阵</h3>
      </div>
      <p>预留项只提供示例提示词，不代表本轮已交付能力。</p>
    </header>

    <div class="capability-matrix__grid">
      <article
        v-for="group in groups"
        :key="group.key"
        class="capability-matrix__group"
      >
        <h4>{{ group.title }}</h4>
        <p class="capability-matrix__group-description">{{ group.description }}</p>

        <ul class="capability-matrix__item-list">
          <li v-for="item in group.items" :key="item.key" class="capability-matrix__item">
            <div class="capability-matrix__item-head">
              <strong>{{ item.title }}</strong>
              <span
                :class="[
                  'capability-matrix__item-state',
                  `capability-matrix__item-state--${item.kind}`,
                ]"
              >
                {{ capabilityStateLabel(item.kind) }}
              </span>
            </div>

            <p class="capability-matrix__item-description">{{ item.description }}</p>
            <p v-if="item.note" class="capability-matrix__item-note">{{ item.note }}</p>

            <div v-if="item.examplePrompts.length" class="capability-matrix__prompt-list">
              <button
                v-for="prompt in item.examplePrompts"
                :key="`${item.key}-${prompt}`"
                class="workbench-chip capability-matrix__prompt-chip"
                type="button"
                @click="emit('choose-prompt', prompt)"
              >
                {{ prompt }}
              </button>
            </div>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.capability-matrix {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--line-soft);
  border-radius: 24px;
  background:
    linear-gradient(145deg, rgba(255, 252, 247, 0.94), rgba(241, 250, 247, 0.78));
}

.capability-matrix__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.capability-matrix__eyebrow {
  margin: 0;
  color: var(--accent-gold);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.capability-matrix__head h3 {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 1.1;
}

.capability-matrix__head p {
  max-width: 28ch;
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
  text-align: right;
}

.capability-matrix__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.capability-matrix__group {
  padding: 14px;
  border: 1px solid rgba(43, 34, 28, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
}

.capability-matrix__group h4 {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
}

.capability-matrix__group-description {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.65;
}

.capability-matrix__item-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.capability-matrix__item {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(43, 34, 28, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
}

.capability-matrix__item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.capability-matrix__item-head strong {
  color: var(--text-strong);
  font-size: 14px;
}

.capability-matrix__item-state {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.capability-matrix__item-state--available {
  background: rgba(15, 109, 100, 0.12);
  color: rgba(15, 109, 100, 0.95);
}

.capability-matrix__item-state--reserved {
  background: rgba(192, 123, 40, 0.14);
  color: rgba(146, 91, 24, 0.95);
}

.capability-matrix__item-description {
  margin: 0;
  color: var(--text-main);
  font-size: 13px;
  line-height: 1.65;
}

.capability-matrix__item-note {
  margin: -2px 0 0;
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.5;
}

.capability-matrix__prompt-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.capability-matrix__prompt-chip {
  text-align: left;
}

@media (max-width: 1200px) {
  .capability-matrix__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .capability-matrix {
    padding: 16px;
  }

  .capability-matrix__head {
    flex-direction: column;
  }

  .capability-matrix__head p {
    max-width: none;
    text-align: left;
  }
}
</style>
