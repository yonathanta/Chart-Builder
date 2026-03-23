import { defineStore } from "pinia";
import { ref } from "vue";

export type ChartBuilderDraft = {
  chartId: string | null;
  projectId: string;
  datasetId: string;
  spec: unknown;
  chartConfigs: Record<string, unknown>;
  updatedAt: string;
};

const DRAFT_STORAGE_KEY = "chartBuilder:draft:v1";

function readStoredDraft(): ChartBuilderDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as ChartBuilderDraft;
  } catch {
    return null;
  }
}

function writeStoredDraft(draft: ChartBuilderDraft | null): void {
  if (!draft) {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return;
  }

  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export const useChartBuilderStore = defineStore("chart-builder", () => {
  const draft = ref<ChartBuilderDraft | null>(readStoredDraft());

  function setDraft(nextDraft: Omit<ChartBuilderDraft, "updatedAt">): void {
    draft.value = {
      ...nextDraft,
      updatedAt: new Date().toISOString(),
    };
    writeStoredDraft(draft.value);
  }

  function clearDraft(): void {
    draft.value = null;
    writeStoredDraft(null);
  }

  function setDraftChartId(chartId: string | null): void {
    if (!draft.value) {
      return;
    }

    draft.value = {
      ...draft.value,
      chartId,
      updatedAt: new Date().toISOString(),
    };
    writeStoredDraft(draft.value);
  }

  return {
    draft,
    setDraft,
    clearDraft,
    setDraftChartId,
  };
});
