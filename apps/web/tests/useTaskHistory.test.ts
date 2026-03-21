import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/api", async () => {
  const actual = await vi.importActual<typeof import("../src/api")>("../src/api");
  return {
    ...actual,
    fetchRecentTasks: vi.fn(),
  };
});

import { useTaskHistory } from "../src/composables/useTaskHistory";
import { fetchRecentTasks, type RecentTaskItem } from "../src/api";

type TaskHistoryState = ReturnType<typeof useTaskHistory>;

describe("useTaskHistory", () => {
  const fetchRecentTasksMock = vi.mocked(fetchRecentTasks);

  let state: TaskHistoryState | null = null;

  beforeEach(() => {
    state = null;
    fetchRecentTasksMock.mockReset();
  });

  function mountHarness() {
    mount(
      defineComponent({
        setup() {
          state = useTaskHistory({ autoLoad: false });
          return () => h("div");
        },
      }),
    );

    if (!state) {
      throw new Error("未能初始化 useTaskHistory");
    }

    return state;
  }

  it("keeps loading off for silent refresh and falls back after manual refresh joins in-flight call", async () => {
    let resolveFetch: ((items: RecentTaskItem[]) => void) | null = null;
    const taskItems: RecentTaskItem[] = [
      {
        taskId: "task-local-1",
        fileId: "file-local",
        fileName: "local-smoke.xlsx",
        sheetName: "Sheet1",
        userRequest: "test",
        createdAt: "2026-03-21T00:00:00.000Z",
        finishedAt: "2026-03-21T00:00:01.000Z",
        status: "success",
        changedRows: 1,
        failedRows: 0,
      },
    ];

    fetchRecentTasksMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const composable = mountHarness();

    const silentRefresh = composable.refresh({ silent: true });
    expect(composable.loading.value).toBe(false);

    const manualRefresh = composable.refresh();
    expect(composable.loading.value).toBe(true);
    expect(fetchRecentTasksMock).toHaveBeenCalledTimes(1);

    if (!resolveFetch) {
      throw new Error("fetchRecentTasks 未进入 in-flight 状态");
    }
    resolveFetch(taskItems);

    await Promise.all([silentRefresh, manualRefresh]);
    await nextTick();

    expect(composable.loading.value).toBe(false);
    expect(composable.error.value).toBe("");
    expect(composable.items.value).toEqual(taskItems);
  });
});
