"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, type ReactElement, useId, useState } from "react";

import type { StateDocument } from "../../../../core/state";
import { Button } from "../../../_client/ui/button";
import { InlineError } from "../../../_client/ui/inline-error";
import { Label } from "../../../_client/ui/label";
import { downloadState, readStateFile } from "./state-transfer";

/**
 * Taking the whole browser state out, and putting one back in.
 *
 * @remarks
 * This is the only way progress leaves the browser, since nothing is stored on a
 * server, so it stays visible rather than hiding behind a menu. A rejected file
 * reports inline next to the picker: the reader has just chosen a file and the
 * message is about that choice.
 */
export function StateIo({
  state,
  onImport,
}: Readonly<{
  state: StateDocument;
  onImport: (next: StateDocument) => void;
}>): ReactElement {
  const t = useTranslations("Phrases");
  const importInputId = useId();
  const [importError, setImportError] = useState(false);

  function importState(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }
    setImportError(false);
    readStateFile(file, onImport, () => {
      setImportError(true);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={() => {
            downloadState(state);
          }}
        >
          {t("export")}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={importInputId}>{t("import")}</Label>
          <input
            id={importInputId}
            type="file"
            accept="application/json,.json"
            onChange={importState}
            className="text-sm text-text-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-text hover:file:bg-surface-hover"
          />
        </div>
      </div>
      {importError ? <InlineError>{t("importError")}</InlineError> : null}
    </div>
  );
}
