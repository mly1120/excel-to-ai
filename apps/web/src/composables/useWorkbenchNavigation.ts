import { computed, ref, watch } from "vue";

import type { WorkspaceMode } from "./useWorkbenchSession";
import { workbenchCatalog, type WorkbenchSectionKey } from "../config/workbenchCatalog";

type UseWorkbenchNavigationOptions = {
  workspaceMode: { value: WorkspaceMode };
};

function getSuggestedSection(mode: WorkspaceMode): WorkbenchSectionKey {
  // Left rail acts as "quick jump" guidance in UI Task 2.
  // Dashboard first suggests templates, non-dashboard suggests workspace preview flow.
  if (mode === "dashboard") {
    return "templates";
  }
  return "workspace";
}

export function useWorkbenchNavigation(options: UseWorkbenchNavigationOptions) {
  const activeSection = ref<WorkbenchSectionKey>("history");
  const isUserSelected = ref(false);

  const suggestedSection = computed(() => getSuggestedSection(options.workspaceMode.value));
  const availableSections = computed(() => workbenchCatalog.navigation);

  function setSection(next: WorkbenchSectionKey) {
    isUserSelected.value = true;
    activeSection.value = next;
  }

  function resetAutoSection() {
    isUserSelected.value = false;
    activeSection.value = suggestedSection.value;
  }

  watch(
    () => options.workspaceMode.value,
    () => {
      if (!isUserSelected.value) {
        activeSection.value = suggestedSection.value;
      }
    },
    { immediate: true },
  );

  return {
    activeSection,
    suggestedSection,
    availableSections,
    setSection,
    resetAutoSection,
    catalog: workbenchCatalog,
  };
}
