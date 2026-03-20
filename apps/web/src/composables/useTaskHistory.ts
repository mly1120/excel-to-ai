import { onMounted, ref } from "vue";

import { fetchRecentTasks, type RecentTaskItem } from "../api";

type UseTaskHistoryOptions = {
  autoLoad?: boolean;
  initialSelectedTaskId?: string;
  onSelect?: (item: RecentTaskItem) => void | Promise<void>;
};

type RefreshTaskHistoryOptions = {
  silent?: boolean;
};

function isSameTaskList(current: RecentTaskItem[], next: RecentTaskItem[]) {
  if (current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    const item = current[index]!;
    const nextItem = next[index]!;
    if (
      item.taskId === nextItem.taskId &&
      item.fileName === nextItem.fileName &&
      item.createdAt === nextItem.createdAt &&
      item.status === nextItem.status &&
      item.changedRows === nextItem.changedRows &&
      item.failedRows === nextItem.failedRows
    ) {
      continue;
    }

    return false;
  }

  return true;
}

export function useTaskHistory(options: UseTaskHistoryOptions = {}) {
  const items = ref<RecentTaskItem[]>([]);
  const loading = ref(false);
  const error = ref("");
  const selectedTaskId = ref(options.initialSelectedTaskId ?? "");
  let inFlightRefresh: Promise<RecentTaskItem[]> | null = null;
  let visibleRefreshWaiters = 0;

  function trackRefreshLoading(task: Promise<RecentTaskItem[]>, shouldShowLoading: boolean) {
    if (!shouldShowLoading) {
      return task;
    }

    visibleRefreshWaiters += 1;
    loading.value = true;

    return task.finally(() => {
      visibleRefreshWaiters = Math.max(0, visibleRefreshWaiters - 1);
      loading.value = visibleRefreshWaiters > 0;
    });
  }

  async function refresh(refreshOptions: RefreshTaskHistoryOptions = {}) {
    const silent = Boolean(refreshOptions.silent);
    const shouldShowLoading = !silent;

    if (inFlightRefresh) {
      return trackRefreshLoading(inFlightRefresh, shouldShowLoading);
    }

    const task = (async () => {
      try {
        const nextItems = await fetchRecentTasks();

        if (!isSameTaskList(items.value, nextItems)) {
          items.value = nextItems;
        }

        error.value = "";
      } catch (caughtError) {
        error.value = caughtError instanceof Error ? caughtError.message : "读取最近任务失败";
      }

      return items.value;
    })();

    inFlightRefresh = task;
    task.finally(() => {
      if (inFlightRefresh === task) {
        inFlightRefresh = null;
      }
    });

    return trackRefreshLoading(task, shouldShowLoading);
  }

  async function selectTask(task: string | RecentTaskItem) {
    const nextTask =
      typeof task === "string"
        ? items.value.find((item) => item.taskId === task)
        : task;

    selectedTaskId.value = typeof task === "string" ? task : task.taskId;

    if (nextTask && options.onSelect) {
      await options.onSelect(nextTask);
    }

    return nextTask ?? null;
  }

  onMounted(() => {
    if (options.autoLoad === false) {
      return;
    }

    void refresh();
  });

  return {
    items,
    loading,
    error,
    selectedTaskId,
    refresh,
    selectTask,
  };
}
