"use client";

import {
  migrateState,
  stateDocumentSchema,
  type StateDocument,
} from "../../../../core/state";

/** Starts a download containing the complete browser-state document. */
export function downloadState(state: StateDocument): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `english-opinion-trainer-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Reads, validates, migrates, and returns one selected state file. */
export function readStateFile(
  file: File,
  onState: (state: StateDocument) => void,
  onError: () => void,
): void {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const raw: unknown = reader.result;
      if (typeof raw !== "string") {
        onError();
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!stateDocumentSchema.safeParse(parsed).success) {
        onError();
        return;
      }
      onState(migrateState(parsed));
    } catch {
      onError();
    }
  });
  reader.addEventListener("error", onError);
  reader.readAsText(file);
}
