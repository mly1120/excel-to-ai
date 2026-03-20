<script setup lang="ts">
import { computed } from "vue";

type Props = {
  summaryText?: string;
  operationCount?: number;
  changedRows?: number;
  failedRows?: number;
  canFollowUp?: boolean;
  followUpHint?: string;
  statusLabel?: string;
};

const props = withDefaults(defineProps<Props>(), {
  summaryText: "",
  operationCount: 0,
  changedRows: 0,
  failedRows: 0,
  canFollowUp: true,
  followUpHint: "可基于当前结果继续描述下一步需求。",
  statusLabel: "结果摘要",
});

const emit = defineEmits<{
  (event: "continue"): void;
}>();

const summary = computed(() => {
  const trimmed = props.summaryText.trim();
  return trimmed || "本轮任务已完成处理，可继续复核并发起下一轮。";
});

const followUpText = computed(() =>
  props.canFollowUp ? "可继续追问" : "暂不建议继续追问",
);
</script>

<template>
  <article class="task-summary-card">
    <header class="task-summary-card__header">
      <p class="task-summary-card__eyebrow">任务摘要</p>
      <span class="task-summary-card__status">{{ statusLabel }}</span>
    </header>

    <p class="task-summary-card__summary">{{ summary }}</p>

    <div class="task-summary-card__metrics">
      <article class="task-summary-card__metric">
        <span>处理动作</span>
        <strong>{{ operationCount }}</strong>
      </article>
      <article class="task-summary-card__metric">
        <span>修改行数</span>
        <strong>{{ changedRows }}</strong>
      </article>
      <article class="task-summary-card__metric">
        <span>失败条数</span>
        <strong>{{ failedRows }}</strong>
      </article>
    </div>

    <footer class="task-summary-card__footer">
      <div>
        <span
          :class="[
            'task-summary-card__followup-tag',
            {
              'task-summary-card__followup-tag--ready': canFollowUp,
              'task-summary-card__followup-tag--blocked': !canFollowUp,
            },
          ]"
        >
          {{ followUpText }}
        </span>
        <p class="task-summary-card__hint">{{ followUpHint }}</p>
      </div>

      <el-button
        :disabled="!canFollowUp"
        plain
        size="small"
        type="primary"
        @click="emit('continue')"
      >
        继续处理
      </el-button>
    </footer>
  </article>
</template>

<style scoped>
.task-summary-card {
  padding: 18px;
  border: 1px solid rgba(51, 41, 34, 0.14);
  border-radius: 20px;
  background:
    linear-gradient(142deg, rgba(255, 248, 235, 0.94), rgba(241, 250, 247, 0.9)),
    rgba(255, 255, 255, 0.78);
}

.task-summary-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-summary-card__eyebrow {
  margin: 0;
  color: var(--accent-gold);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.task-summary-card__status {
  padding: 4px 10px;
  border: 1px solid rgba(51, 41, 34, 0.14);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 12px;
}

.task-summary-card__summary {
  margin: 12px 0 0;
  color: var(--text-strong);
  font-size: 15px;
  line-height: 1.75;
}

.task-summary-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.task-summary-card__metric {
  padding: 11px 12px;
  border: 1px solid rgba(51, 41, 34, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
}

.task-summary-card__metric span {
  display: block;
  color: var(--text-faint);
  font-size: 12px;
}

.task-summary-card__metric strong {
  display: block;
  margin-top: 7px;
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1;
}

.task-summary-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 14px;
}

.task-summary-card__followup-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.task-summary-card__followup-tag--ready {
  background: rgba(15, 109, 100, 0.12);
  color: var(--accent-teal);
}

.task-summary-card__followup-tag--blocked {
  background: rgba(180, 75, 64, 0.14);
  color: #9d3a2a;
}

.task-summary-card__hint {
  margin: 7px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 880px) {
  .task-summary-card__metrics {
    grid-template-columns: 1fr;
  }

  .task-summary-card__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
