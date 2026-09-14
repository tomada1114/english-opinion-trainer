import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type ReactElement,
  type SyntheticEvent,
  useId,
  useState,
} from "react";

import { BusyStatus } from "../../../../_client/ui/busy-status";
import { Button } from "../../../../_client/ui/button";
import { CharacterCount, isNearLimit } from "../../../../_client/ui/character-count";
import { InlineError } from "../../../../_client/ui/inline-error";
import { Label } from "../../../../_client/ui/label";
import { Textarea } from "../../../../_client/ui/textarea";

/**
 * The answer field and everything that belongs beside it: the ceiling, the
 * count, the two inline error slots, and the send row.
 *
 * @remarks
 * Presentational on purpose — every decision about what to send and what went
 * wrong stays in `topic-attempt.tsx`, which owns the phase. This component only
 * knows how the composer looks in each of them.
 */
export function AnswerComposer({
  answer,
  ceiling,
  busy,
  settled,
  answerError,
  sendError,
  canResend,
  onAnswerChange,
  onSend,
  onCancel,
  onSkip,
}: Readonly<{
  answer: string;
  /** The mode's character ceiling, stated to the reader rather than implied. */
  ceiling: number;
  /** A request is in flight. */
  busy: boolean;
  /** The answer has been graded, so the field is no longer editable. */
  settled: boolean;
  /** A message about the answer itself: a broken rule, or the server's own verdict on one. */
  answerError?: string;
  /** A message about the request: recoverable, so the send row stays. */
  sendError?: string;
  canResend: boolean;
  onAnswerChange: (next: string) => void;
  onSend: () => void;
  /** Gives up on the in-flight request. Only ever reachable while `busy`. */
  onCancel: () => void;
  onSkip: () => void;
}>): ReactElement {
  const t = useTranslations("Drill");
  const answerId = useId();
  const hintId = useId();
  const trimmed = answer.trim().length;
  const nearLimit = isNearLimit(trimmed, ceiling);
  const [nearLimitAnnounced, setNearLimitAnnounced] = useState(false);

  function handleAnswerChange(next: string): void {
    const nextNearLimit = isNearLimit(next.trim().length, ceiling);
    if (!nextNearLimit || !nearLimit) {
      setNearLimitAnnounced(false);
    } else {
      setNearLimitAnnounced(true);
    }
    onAnswerChange(next);
  }

  /**
   * Cmd/Ctrl+Enter sends; a bare Enter is always a newline.
   *
   * @remarks
   * This is why there is no `isComposing` / `keyCode === 229` guard here. An IME
   * confirmation produces a bare Enter, never a modified one, so a shortcut that
   * requires a modifier cannot be mistaken for one — the bug class is absent
   * rather than defended against. Adding plain-Enter submission later would make
   * both of those guards mandatory; see docs/design/design-system.md.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    onSend();
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSend();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Label htmlFor={answerId}>{t("answerLabel")}</Label>
      <Textarea
        id={answerId}
        value={answer}
        rows={4}
        // `disabled`, not `readOnly`: a read-only field looks identical to an
        // editable one, which is the defect this replaces.
        disabled={busy || settled}
        aria-invalid={answerError !== undefined}
        aria-describedby={hintId}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          handleAnswerChange(event.target.value);
        }}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {/* Static, so it is read once when the field takes focus. The count next
            to it is deliberately outside `aria-describedby`. */}
        <p id={hintId} className="text-sm text-text-subtle">
          {t("answerHint", { max: ceiling })}
        </p>
        <CharacterCount
          label={t("characterCount", { count: trimmed, max: ceiling })}
          near={nearLimit}
          announce={nearLimit && !nearLimitAnnounced}
        />
      </div>

      {answerError === undefined ? null : <InlineError>{answerError}</InlineError>}
      {sendError === undefined ? null : <InlineError>{sendError}</InlineError>}
      {busy ? (
        <div className="flex flex-wrap items-center gap-2">
          <BusyStatus label={t("busy")} />
          {/* `ghost`, not `secondary`: the primary send action is busy and
              unavailable, so Cancel must not compete visually as though it
              were the button to reach for. */}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      ) : null}

      {settled ? null : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t("sending") : canResend ? t("resend") : t("send")}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onSkip}>
            {t("skip")}
          </Button>
        </div>
      )}
    </form>
  );
}
