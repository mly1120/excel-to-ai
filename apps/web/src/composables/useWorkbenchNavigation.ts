import { computed, ref, watch } from "vue";

import type { WorkspaceMode } from "./useWorkbenchSession";
import { workbenchCatalog, type WorkbenchSectionKey } from "../config/workbenchCatalog";

type UseWorkbenchNavigationOptions = {
  workspaceMode: { value: WorkspaceMode };
};

type WorkbenchArea = "rail" | "main" | "copilot";

export function useWorkbenchNavigation(options: UseWorkbenchNavigationOptions) {
  const initialRule = workbenchCatalog.modeSectionRules[options.workspaceMode.value];
  const activeSection = ref<WorkbenchSectionKey>(initialRule.suggestedSection);
  const isUserSelected = ref(false);

  const modeRule = computed(() => workbenchCatalog.modeSectionRules[options.workspaceMode.value]);
  const suggestedSection = computed(() => modeRule.value.suggestedSection);
  const availableSections = computed(() => workbenchCatalog.navigation);
  const areaSection = computed(() => {
    const rule = modeRule.value;

    if (activeSection.value === "history") {
      return {
        rail: "history" as WorkbenchSectionKey,
        main: rule.mainSection,
        copilot: rule.copilotSection,
      };
    }

    if (activeSection.value === "templates") {
      return {
        rail: "templates" as WorkbenchSectionKey,
        main: "templates" as WorkbenchSectionKey,
        copilot: "templates" as WorkbenchSectionKey,
      };
    }

    return {
      rail: "workspace" as WorkbenchSectionKey,
      main: "workspace" as WorkbenchSectionKey,
      copilot: "workspace" as WorkbenchSectionKey,
    };
  });

  function setSection(next: WorkbenchSectionKey) {
    isUserSelected.value = true;
    activeSection.value = next;
  }

  function resetAutoSection() {
    isUserSelected.value = false;
    activeSection.value = suggestedSection.value;
  }

  function getAreaSection(area: WorkbenchArea) {
    return areaSection.value[area];
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
    areaSection,
    getAreaSection,
    catalog: workbenchCatalog,
  };
}
