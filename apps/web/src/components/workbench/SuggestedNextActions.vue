<script setup lang="ts">
import { computed } from "vue";

type Props = {
  prompts?: string[];
  disabled?: boolean;
  max?: number;
};

const props = withDefaults(defineProps<Props>(), {
  prompts: () => [],
  disabled: false,
  max: 4,
});

const emit = defineEmits<{
  (event: "choose", prompt: string): void;
}>();

const visiblePrompts = computed(() => props.prompts.slice(0, props.max));
</script>

<template>
  <div class="suggested-next-actions">
    <div class="suggested-next-actions__head">
      <span>建议继续操作</span>
      <small>基于当前结果继续追问</small>
    </div>

    <div v-if="visiblePrompts.length" class="suggested-next-actions__list">
      <button
        v-for="prompt in visiblePrompts"
        :key="prompt"
        :disabled="disabled"
        class="workbench-chip suggested-next-actions__chip"
        type="button"
        @click="emit('choose', prompt)"
      >
        {{ prompt }}
      </button>
    </div>

    <p v-else class="suggested-next-actions__empty">
      当前还没有建议操作，你可以直接补充新的处理目标。
    </p>
  </div>
</template>

<style scoped>
.suggested-next-actions {
  display: grid;
  gap: 8px;
}

.suggested-next-actions__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.suggested-next-actions__head span {
  font-size: 13px;
  font-weight: 700;
}

.suggested-next-actions__head small {
  color: var(--text-muted);
  font-size: 12px;
}

.suggested-next-actions__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.suggested-next-actions__chip {
  text-align: left;
}

.suggested-next-actions__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
