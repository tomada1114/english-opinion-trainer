# Design system

Implementable values. The reasoning behind them is in
[`design-concept.md`](./design-concept.md). The single live token source is
[`src/app/globals.css`](../../src/app/globals.css); [`tokens.css`](./tokens.css) is only
a pointer to it, not a copy.

Read the semantic layer only (`--color-*`, `--space-*`, `--text-*`, `--motion-*`).
Reading a primitive (`--neutral-600`, `--accent-400`) from a component is what makes a
later theme change miss that one place.

**Dark only.** Every table below has a single value column on purpose. See the concept
document's "Theme policy"; do not fill a light column with guesses.

## Component inventory

Nothing outside this table gets built. When a new part is genuinely needed, add the row
first.

| Component         | Origin                                                                                                                 | Variants                                     | Sizes   | States                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------- | ----------------------------------------- |
| `Button`          | shadcn/ui `button`                                                                                                     | primary / secondary / ghost / destructive    | sm / md | see state matrix                          |
| `Textarea`        | shadcn/ui `textarea`                                                                                                   | default                                      | md      | default / focus / error / disabled / busy |
| `Select`          | styled native `<select>` — keyboard/screen-reader complete, phone picker, and the existing `value`/`onChange` contract | default                                      | md      | default / focus / disabled                |
| `Label`           | shadcn/ui `label`                                                                                                      | default                                      | —       | default                                   |
| `Card`            | shadcn/ui `card`                                                                                                       | elevated                                     | —       | default                                   |
| `Badge`           | shadcn/ui `badge`                                                                                                      | neutral / success / warning / danger / count | sm      | default                                   |
| `Disclosure`      | native `<details>`/`<summary>`                                                                                         | with count badge                             | —       | closed / open / focus                     |
| `Separator`       | native `<hr>` — already carries the separator role                                                                     | default                                      | —       | default                                   |
| `BusyStatus`      | custom                                                                                                                 | —                                            | —       | idle (unrendered) / busy                  |
| `VerdictBadge`    | custom (wraps `Badge`)                                                                                                 | present / weak / absent                      | sm      | default                                   |
| `DiffLine`        | custom                                                                                                                 | fix / grammar-note                           | —       | default                                   |
| `CharacterCount`  | custom                                                                                                                 | default / near-limit                         | —       | default / near-limit                      |
| `InlineError`     | custom                                                                                                                 | validation / retryable                       | —       | default                                   |
| `SurfaceError`    | custom                                                                                                                 | terminal                                     | —       | default                                   |
| `EmptyState`      | custom                                                                                                                 | onboarding / filtered-out                    | —       | default                                   |
| `TopicHeader`     | composition                                                                                                            | topic / structure / mode / flag              | —       | default                                   |
| `SeedReveal`      | composition                                                                                                            | hidden / revealed                            | —       | default / disabled                        |
| `RewritePanel`    | composition                                                                                                            | editable / saved                             | —       | default / disabled                        |
| `FeedbackDetails` | composition                                                                                                            | fixes / grammar                              | —       | collapsed / open                          |
| `PhraseRow`       | composition                                                                                                            | saved phrase                                 | —       | default                                   |
| `StateIo`         | composition                                                                                                            | export / import                              | —       | default / import error                    |

These six composition components are not new UI vocabulary. The 200-line per-file budget
forced the screen-specific pieces into `TopicHeader`, `SeedReveal`, `RewritePanel`,
`FeedbackDetails`, `PhraseRow`, and `StateIo`; they assemble the vocabulary above with
the domain-specific content of each screen.

Why the seven custom vocabulary parts exist — Radix ships no equivalent for any of them,
and each is a piece of this app's own vocabulary rather than a generic control:

- `BusyStatus` — the narrated wait: a `role="status"` line with three pulse dots.
- `VerdictBadge` — `present`/`weak`/`absent` with `Check`, `CircleDot`, and
  `CircleDashed`. The glyph shapes are deliberately unlike one another because
  `--color-success` and `--color-warning` sit 0.02 apart in OKLCH lightness and are all
  but identical in greyscale; the shape and the word carry the verdict, while the tone
  only reinforces it.
- `DiffLine` — one `before → after — why` row, used by both `fixes` and `grammar`.
- `CharacterCount` — count against the mode's ceiling, with a `near-limit` appearance.
- `InlineError` / `SurfaceError` — the two error severities; the split is the whole
  point, so one component for both would erase it.
- `EmptyState` — two variants that must not be merged: nothing saved yet vs. filters
  excluded everything. They lead to different next actions.

`Disclosure` uses native `<details>`/`<summary>` rather than Radix `Collapsible`: the
content must be findable by in-page search and must render open without JavaScript, both
of which the native element gives for free.

## Colour tokens

| Token                                                                                             | Dark value                        | Use                                                    |
| ------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `--color-bg`                                                                                      | `--neutral-950`                   | page ground                                            |
| `--color-bg-subtle`                                                                               | `--neutral-1000`                  | a recessed band; the only surface darker than the page |
| `--color-bg-elevated`                                                                             | `--neutral-900`                   | cards, the feedback panel                              |
| `--color-surface`                                                                                 | `--neutral-850`                   | textarea and select faces, chips                       |
| `--color-surface-hover`                                                                           | `--neutral-800`                   | pointer over the above                                 |
| `--color-text`                                                                                    | `--neutral-50`                    | headings and body                                      |
| `--color-text-muted`                                                                              | `--neutral-300`                   | labels, the progress line, `why` text                  |
| `--color-text-subtle`                                                                             | `--neutral-400`                   | placeholder, character count                           |
| `--color-text-on-primary`                                                                         | `--accent-950`                    | text on an accent face                                 |
| `--color-text-on-danger` / `--color-text-on-success` / `--color-text-on-warning`                  | `--red-950` etc.                  | text on a filled status face                           |
| `--color-border`                                                                                  | `--neutral-600`                   | control and input borders, separators                  |
| `--color-border-strong`                                                                           | `--neutral-500`                   | hovered control border, emphasised divider             |
| `--color-focus`                                                                                   | `--accent-400`                    | focus ring                                             |
| `--color-overlay`                                                                                 | `oklch(0 0 0/.7)`                 | scrim (none in use yet; reserved for a future modal)   |
| `--color-primary` / `--color-primary-hover` / `--color-primary-active` / `--color-primary-subtle` | accent 400/300/500/900            | the primary action and its states                      |
| `--color-success` / `--color-success-subtle`                                                      | green 400/900                     | `present`                                              |
| `--color-warning` / `--color-warning-subtle`                                                      | amber 400/900                     | `weak`, and the near-limit character count             |
| `--color-danger` / `--color-danger-subtle`                                                        | red 400/900                       | `absent`, validation errors, Delete                    |
| `--color-info` / `--color-info-subtle`                                                            | blue 400/900                      | neutral notices (unused today; reserved)               |
| `--color-disabled-bg` / `--color-disabled-text`                                                   | `--neutral-850` / `--neutral-700` | disabled controls                                      |
| `--color-background`                                                                              | `--color-bg`                      | shadcn/ui alias                                        |
| `--color-foreground`                                                                              | `--color-text`                    | shadcn/ui alias                                        |
| `--color-card` / `--color-popover`                                                                | `--color-bg-elevated`             | shadcn/ui aliases                                      |
| `--color-card-foreground` / `--color-popover-foreground`                                          | `--color-text`                    | shadcn/ui aliases                                      |
| `--color-primary-foreground`                                                                      | `--color-text-on-primary`         | shadcn/ui alias                                        |
| `--color-secondary`                                                                               | `--color-surface`                 | shadcn/ui alias                                        |
| `--color-secondary-foreground`                                                                    | `--color-text`                    | shadcn/ui alias                                        |
| `--color-muted`                                                                                   | `--color-surface`                 | shadcn/ui alias                                        |
| `--color-muted-foreground`                                                                        | `--color-text-muted`              | shadcn/ui alias                                        |
| `--color-accent`                                                                                  | `--color-surface-hover`           | shadcn/ui alias                                        |
| `--color-accent-foreground`                                                                       | `--color-text`                    | shadcn/ui alias                                        |
| `--color-destructive`                                                                             | `--color-danger`                  | shadcn/ui alias                                        |
| `--color-destructive-foreground`                                                                  | `--color-text-on-danger`          | shadcn/ui alias                                        |
| `--color-input`                                                                                   | `--color-border`                  | shadcn/ui alias                                        |
| `--color-ring`                                                                                    | `--color-focus`                   | shadcn/ui alias                                        |

Depth in this theme is lightness, never shadow: `bg` → `bg-elevated` → `surface` climbs
in lightness. `--shadow-*` exists, but a shadow alone must never be a boundary, because
`forced-colors: active` removes it — pair it with a `border`.

Hover and pressed add no colour. They lay `--state-hover-opacity` (0.08) or
`--state-pressed-opacity` (0.12) of `currentColor` over the existing face, so the same
rule works on the accent and on a neutral surface.

### Mapping to shadcn/ui's token names

shadcn/ui components read its own variable names, so they must be aliased to these.

**The trap is the word "accent".** In shadcn's vocabulary `--accent` is a subtle hover
surface, not the primary colour — so `--accent: var(--color-primary)` would paint every
hovered row the primary blue. Worse, both vocabularies live in Tailwind v4's single
`--color-*` namespace, where `--color-accent` can only mean one of the two things.

This app's primary action token is therefore named **`--color-primary`**, not
`--color-accent`, so that the clash cannot be written in the first place. `--accent-400`
and friends remain as the _primitive_ hue steps, which no component reads.

| shadcn variable                             | Bind to                                             |
| ------------------------------------------- | --------------------------------------------------- |
| `--background`                              | `--color-bg`                                        |
| `--foreground`                              | `--color-text`                                      |
| `--card`, `--popover`                       | `--color-bg-elevated`                               |
| `--card-foreground`, `--popover-foreground` | `--color-text`                                      |
| `--primary`                                 | `--color-primary`                                   |
| `--primary-foreground`                      | `--color-text-on-primary`                           |
| `--secondary`                               | `--color-surface`                                   |
| `--secondary-foreground`                    | `--color-text`                                      |
| `--muted`                                   | `--color-surface`                                   |
| `--muted-foreground`                        | `--color-text-muted`                                |
| `--accent`                                  | `--color-surface-hover` ← **not** `--color-primary` |
| `--accent-foreground`                       | `--color-text`                                      |
| `--destructive`                             | `--color-danger`                                    |
| `--destructive-foreground`                  | `--color-text-on-danger`                            |
| `--border`, `--input`                       | `--color-border`                                    |
| `--ring`                                    | `--color-focus`                                     |

Do the aliasing once, in `src/app/globals.css`, with `@theme inline` so Tailwind emits
utilities that resolve to the live custom properties rather than to copied values.

## Typography

| Token         | Value                                        | Leading            | Use                              |
| ------------- | -------------------------------------------- | ------------------ | -------------------------------- |
| `--text-xs`   | 0.75rem                                      | `--leading-tight`  | badge, count                     |
| `--text-sm`   | 0.875rem                                     | `--leading-normal` | labels, `why` lines, meta        |
| `--text-base` | 1rem                                         | `--leading-normal` | body, textarea, the answer       |
| `--text-lg`   | `clamp(1.125rem, 1.09rem + 0.17vw, 1.25rem)` | `--leading-normal` | feedback section headings (`h4`) |
| `--text-xl`   | `clamp(1.25rem, 1.16rem + 0.45vw, 1.5rem)`   | `--leading-tight`  | `h3` — the Feedback heading      |
| `--text-2xl`  | `clamp(1.5rem, 1.33rem + 0.85vw, 2rem)`      | `--leading-tight`  | `h2` — the topic text            |
| `--text-3xl`  | `clamp(1.875rem, 1.52rem + 1.78vw, 3rem)`    | `--leading-tight`  | `h1` — page title                |

Leading: `--leading-tight` 1.25 / `--leading-normal` 1.6 / `--leading-relaxed` 1.8. The
body value is 1.6 rather than the 1.7 a Japanese catalog would need, because every UI
string here is Latin.

Measure is capped at `--measure` (68ch) on every prose container, the textarea included.
That cap is the one thing that changes on a wide screen; the column count does not.

The textarea and every place user text is shown carry `white-space: pre-wrap` so a typed
newline survives. Nothing renders Markdown — see the concept document's out-of-scope
table.

`font-variant-numeric: tabular-nums` on `CharacterCount`, so the count does not jitter
the layout as digits change width.

No web font is loaded. `--font-sans` is a system stack, which costs nothing at LCP and
needs no self-hosting decision.

## Size tokens

Space, 4px base: `--space-1` 0.25rem … `--space-12` 6rem, as in `src/app/globals.css`.
Working unit at standard density is `--space-3`; section gaps are `--space-6`.

Radii: `--radius-sm` tags and badges / `--radius-md` buttons, inputs / `--radius-lg`
cards / `--radius-xl` reserved for a sheet / `--radius-full` pills.

`--tap-min` is 2.75rem (44px) and is the minimum height of every interactive control.
The WCAG 2.2 AA floor is 24px; 44px is the design value, because 24px is smaller than a
fingertip.

z-index: only `--z-base` 0 / `--z-dropdown` 1000 / `--z-sticky` 1100 / `--z-overlay`
1200 / `--z-modal` 1300 / `--z-toast` 1400. No intermediate number.

## Motion

| Token                      | Value                        | Use                                 |
| -------------------------- | ---------------------------- | ----------------------------------- |
| `--motion-duration-fast`   | 100ms                        | hover, focus ring, colour changes   |
| `--motion-duration-base`   | 200ms                        | disclosure open/close, button press |
| `--motion-duration-slow`   | 400ms                        | the feedback panel's fade-in        |
| `--motion-ease-standard`   | `cubic-bezier(0.2, 0, 0, 1)` | default enter/exit                  |
| `--motion-ease-emphasized` | `cubic-bezier(0.3, 0, 0, 1)` | the feedback arrival                |
| `--motion-ease-exit`       | `cubic-bezier(0.4, 0, 1, 1)` | something leaving                   |

The four moving things, and nothing else:

1. **Pulse dots** in `BusyStatus` — three dots at 1.2s, staggered 0.2s, animating
   `opacity` and `transform: scale()` only.
2. **Feedback arrival** — `opacity` 0→1 plus `translateY(4px)`→0 over
   `--motion-duration-slow`.
3. **Disclosure** — `<details>` open/close at `--motion-duration-base`.
4. **Button press** — `scale(0.98)` at `--motion-duration-fast`.

Only `transform` and `opacity` are animated, so no frame needs layout or paint.

Under `prefers-reduced-motion: reduce`: the durations collapse to 0.01ms via
`src/app/globals.css`, and each of the four degrades rather than vanishing — the pulse
dots become three static dots plus the status text (the text alone already carries the
information), the feedback appears without the translate, and the programmatic scroll to
the Feedback heading becomes instant (`scroll-behavior: auto`, already forced in
`src/app/globals.css`).

## State matrix

Every `:hover` rule is written with a `:focus-visible` counterpart. A state reachable
only by hover is unreachable by keyboard and by touch.

### Button (primary)

| State         | Background               | Text                      | Border                                    | Notes                                                           |
| ------------- | ------------------------ | ------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| Default       | `--color-primary`        | `--color-text-on-primary` | none                                      |                                                                 |
| Hover         | `--color-primary-hover`  | same                      | none                                      | inside `@media (hover: hover)` only                             |
| Focus-visible | unchanged                | same                      | `outline` `--color-focus` 2px, offset 2px | measured 7.56 against `--color-bg`                              |
| Active        | `--color-primary-active` | same                      | none                                      | plus `scale(0.98)`                                              |
| Disabled      | `--color-disabled-bg`    | `--color-disabled-text`   | none                                      | `aria-disabled`, focus retained; never `opacity` on the element |
| Busy          | unchanged                | same                      | none                                      | spinner + "Getting feedback…", width held so nothing shifts     |

### Other components

| State         | Textarea                                                               | Card                    | Disclosure (`summary`)  | List item               |
| ------------- | ---------------------------------------------------------------------- | ----------------------- | ----------------------- | ----------------------- |
| Default       | `--input-bg` / `--input-border`                                        | `--card-bg` + border    | `--color-text`          | `--color-bg`            |
| Hover         | border → `--color-border-strong`                                       | `--color-surface-hover` | `--color-surface-hover` | `--color-surface-hover` |
| Focus-visible | `outline` `--color-focus` 2px, offset 2px                              | same                    | same                    | same                    |
| Error         | border `--color-danger` + `aria-invalid` + `InlineError` below         | —                       | —                       | —                       |
| Disabled      | `--color-disabled-bg` / `--color-disabled-text`, `cursor: not-allowed` | —                       | —                       | `--color-text-subtle`   |
| Busy          | `disabled`, plus `BusyStatus` beneath                                  | —                       | —                       | —                       |

The textarea uses **`disabled`, not `readOnly`, while a request is in flight.**
`readOnly` changes nothing visible, which is precisely the defect being fixed. It keeps
`disabled` after the answer is graded too, so the graded answer reads as settled rather
than editable.

### Verdict appearance

Colour is never the only signal.

| Verdict   | Glyph (Lucide) | Word      | Colour            |
| --------- | -------------- | --------- | ----------------- |
| `present` | `Check`        | "Present" | `--color-success` |
| `weak`    | `CircleDot`    | "Weak"    | `--color-warning` |
| `absent`  | `CircleDashed` | "Missing" | `--color-danger`  |

`fixes` and `grammar` carry **no** severity in the schema, so they get no status colour.
A `DiffLine` distinguishes its halves by position and by `<del>`/`<ins>` with an
explicit `text-decoration` (never the UA default alone) — `before` in
`--color-text-muted` with a line-through, `after` in `--color-text`, the `why` in
`--color-text-muted` at `--text-sm`.

### Error severity

| Group                                                                                                                                                      | Component      | Placement                   | Recovery                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------- | --------------------------------------------- |
| Validation: `empty`, `too-long`, `not-english`                                                                                                             | `InlineError`  | directly under the textarea | fix the text; cleared as soon as it changes   |
| Retryable: `ERR_LLM_RATE_LIMIT`, `ERR_LLM_TIMEOUT`, `ERR_LLM_UNAVAILABLE`, `ERR_LLM_INVALID_OUTPUT`, `ERR_BAD_REQUEST`, `ERR_PAYLOAD_TOO_LARGE`, `unknown` | `InlineError`  | above the submit row        | button becomes "Send again"; the text is kept |
| Terminal: `ERR_LLM_AUTH`, `ERR_FORBIDDEN_ORIGIN`                                                                                                           | `SurfaceError` | replaces the composer       | none available in the browser                 |
| Mirrors of a validation rule: `ERR_ANSWER_TOO_LONG`, `ERR_ANSWER_NOT_ENGLISH`                                                                              | `InlineError`  | under the textarea          | same as validation                            |

The last row exists because the server re-checks the same rules the client already
applied: if one of those codes comes back it means client and server disagree, and it
must read to the user as the validation message it is, not as a network failure.

`InlineError` gets `role="alert"`; `SurfaceError` does not (it is not an interruption —
it is the whole content).

## Responsive

| Target                           | Mechanism                              | Why                                       |
| -------------------------------- | -------------------------------------- | ----------------------------------------- |
| Page structure                   | media query                            | the input is the viewport itself          |
| Feedback sections, list rows     | `@container`                           | the same part appears at different widths |
| Type and spacing                 | `clamp()`                              | no step at a breakpoint                   |
| Filter row on the phrases screen | `repeat(auto-fit, minmax(10rem, 1fr))` | wraps without declaring a column count    |

Breakpoints, named for where content breaks rather than for a device:

| Name | Width  | What changes                                                            |
| ---- | ------ | ----------------------------------------------------------------------- |
| sm   | 640px  | the filter row goes from stacked to inline                              |
| lg   | 1024px | page padding grows from `--space-4` to `--space-8`; `--measure` centres |

Nothing becomes multi-column at any width. The drill is one topic, one column, by
principle.

Input modality, a separate axis from width: hover styling lives only inside
`@media (hover: hover) and (pointer: fine)`; under `(pointer: coarse)` every control is
at least `--tap-min`.

Verification conditions: no horizontal scroll at 320px; nothing lost at 400% zoom;
heights use `dvh`, never `vh`; `safe-area-inset` respected on the bottom padding.

## Accessibility

WCAG 2.2 level AA is the floor.

| Criterion                         | Requirement                        | Value here                                                                                                       |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Text contrast (1.4.3)             | 4.5:1 body, 3:1 large              | lowest measured 4.63 (`text-subtle` on `surface-hover`)                                                          |
| Non-text contrast (1.4.11)        | 3:1 for boundaries and icons       | lowest measured 3.03 (`border` on `surface`)                                                                     |
| Target size (2.5.8, AA)           | 24×24 CSS px                       | met by `--tap-min` 44px                                                                                          |
| Target size (design value)        | 44×44                              | `--tap-min` = 2.75rem                                                                                            |
| Focus appearance (2.4.13)         | ≥ 2px, 3:1, surrounds the element  | `outline: 2px solid var(--color-focus)`, `outline-offset: 2px`; measured 7.56 on `--color-bg`                    |
| Focus not obscured (2.4.11)       | not hidden by sticky chrome        | no sticky chrome exists; `scroll-margin-top: var(--space-8)` on the Feedback heading for the programmatic scroll |
| Drag alternative (2.5.7)          | single-pointer alternative         | nothing is draggable                                                                                             |
| Redundant entry (3.3.7)           | do not re-ask for what was entered | the answer survives a failed request; nothing is re-typed                                                        |
| Accessible authentication (3.3.8) | no cognitive-function test         | there is no authentication                                                                                       |
| Reflow (1.4.10)                   | no 2-D scroll at 320px / 400%      | single column, `--measure` in `ch`, no fixed width                                                               |
| Text spacing (1.4.12)             | survives spacing overrides         | no fixed heights on text containers; the textarea grows                                                          |

The focus ring is drawn with `outline`, not `border` (which shifts layout) and not
`box-shadow` (which `forced-colors: active` removes).

### Live regions

| Event                      | Announcement                                   | Politeness                                       |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Request starts             | "Getting feedback on your answer"              | `role="status"`                                  |
| Feedback arrives           | "Feedback ready"                               | `role="status"`, plus focus moved to the heading |
| Phrase saved               | "Saved to phrases"                             | `role="status"`                                  |
| Validation refusal         | the validation message                         | `role="alert"`                                   |
| Request failure            | the error message                              | `role="alert"`                                   |
| Character count            | **not announced continuously**                 | —                                                |
| Character count near limit | announced once, on crossing 90% of the ceiling | `role="status"`                                  |

The character count must not stay wired straight into `aria-describedby` on the
textarea: that re-reads it on every keystroke and makes composition impossible. Expose
the count visually, associate the ceiling with the field through a static description,
and announce the count only on crossing the near-limit threshold.

### Keyboard

- Submit: Cmd+Enter / Ctrl+Enter. Plain Enter always inserts a newline. There is
  deliberately no `isComposing` / `keyCode === 229` guard, because a modified Enter
  cannot be produced by an IME confirmation — the bug class is absent rather than
  defended against. **If plain-Enter submission is ever added, that guard becomes
  mandatory.**
- The shortcut is stated in the textarea's visible description, not only in a `title`.
- Focus order follows visual order; nothing reorders with `order` or `grid-area`.
- On feedback arrival, focus moves to the `h3` Feedback heading, which carries
  `tabindex="-1"`.
- Landmarks: one `<main>` per page, `<h1>` per page, and the feedback panel as a
  `<section>` labelled by its `h3`.

### Colour-vision check (run this, do not merely intend to)

1. Chrome DevTools → Rendering → Emulate vision deficiencies: protanopia, deuteranopia,
   tritanopia, achromatopsia.
2. In achromatopsia, confirm `present` / `weak` / `absent` are still distinguishable.
   They must be, from the glyph and the word; `--color-success` L 0.780 and
   `--color-warning` L 0.800 are only 0.02 apart in lightness and will look nearly
   identical in greyscale. That closeness is accepted **because** the glyph and word
   carry the distinction — it is not a reason to move the hues.
3. Confirm `<del>` / `<ins>` in `DiffLine` read correctly in greyscale, from the
   line-through and the ordering.

### Measured contrast

Output of `check_contrast.py` for the dark palette, pasted verbatim. Exit code 0.

```
name                         fg                      bg                      kind  ratio  required  result
---------------------------  ----------------------  ----------------------  ----  -----  --------  ------
text / bg                    oklch(0.965 0.004 248)  oklch(0.175 0.006 248)  text  17.14  4.50      PASS
text / bg-subtle             oklch(0.965 0.004 248)  oklch(0.145 0.006 248)  text  17.89  4.50      PASS
text / bg-elevated           oklch(0.965 0.004 248)  oklch(0.215 0.008 248)  text  15.82  4.50      PASS
text / surface               oklch(0.965 0.004 248)  oklch(0.250 0.010 248)  text  14.45  4.50      PASS
text / surface-hover         oklch(0.965 0.004 248)  oklch(0.290 0.012 248)  text  12.74  4.50      PASS
text-muted / bg              oklch(0.755 0.016 248)  oklch(0.175 0.006 248)  text  8.69   4.50      PASS
text-muted / bg-subtle       oklch(0.755 0.016 248)  oklch(0.145 0.006 248)  text  9.07   4.50      PASS
text-muted / bg-elevated     oklch(0.755 0.016 248)  oklch(0.215 0.008 248)  text  8.02   4.50      PASS
text-muted / surface         oklch(0.755 0.016 248)  oklch(0.250 0.010 248)  text  7.33   4.50      PASS
text-muted / surface-hover   oklch(0.755 0.016 248)  oklch(0.290 0.012 248)  text  6.46   4.50      PASS
text-subtle / bg             oklch(0.665 0.014 248)  oklch(0.175 0.006 248)  text  6.22   4.50      PASS
text-subtle / bg-subtle      oklch(0.665 0.014 248)  oklch(0.145 0.006 248)  text  6.50   4.50      PASS
text-subtle / bg-elevated    oklch(0.665 0.014 248)  oklch(0.215 0.008 248)  text  5.75   4.50      PASS
text-subtle / surface        oklch(0.665 0.014 248)  oklch(0.250 0.010 248)  text  5.25   4.50      PASS
text-subtle / surface-hover  oklch(0.665 0.014 248)  oklch(0.290 0.012 248)  text  4.63   4.50      PASS
border / bg                  oklch(0.530 0.010 248)  oklch(0.175 0.006 248)  ui    3.60   3.00      PASS
border / bg-elevated         oklch(0.530 0.010 248)  oklch(0.215 0.008 248)  ui    3.32   3.00      PASS
border / surface             oklch(0.530 0.010 248)  oklch(0.250 0.010 248)  ui    3.03   3.00      PASS
border-strong / bg           oklch(0.620 0.012 248)  oklch(0.175 0.006 248)  ui    5.22   3.00      PASS
border-strong / bg-elevated  oklch(0.620 0.012 248)  oklch(0.215 0.008 248)  ui    4.82   3.00      PASS
border-strong / surface      oklch(0.620 0.012 248)  oklch(0.250 0.010 248)  ui    4.40   3.00      PASS
accent / bg                  oklch(0.715 0.115 248)  oklch(0.175 0.006 248)  ui    7.56   3.00      PASS
accent / bg-elevated         oklch(0.715 0.115 248)  oklch(0.215 0.008 248)  ui    6.98   3.00      PASS
accent / surface             oklch(0.715 0.115 248)  oklch(0.250 0.010 248)  ui    6.37   3.00      PASS
accent / bg                  oklch(0.715 0.115 248)  oklch(0.175 0.006 248)  text  7.56   4.50      PASS
accent / bg-elevated         oklch(0.715 0.115 248)  oklch(0.215 0.008 248)  text  6.98   4.50      PASS
accent / surface             oklch(0.715 0.115 248)  oklch(0.250 0.010 248)  text  6.37   4.50      PASS
on-accent / accent           oklch(0.180 0.035 248)  oklch(0.715 0.115 248)  text  7.49   4.50      PASS
on-accent / accent-hover     oklch(0.180 0.035 248)  oklch(0.775 0.095 248)  text  9.29   4.50      PASS
on-accent / accent-active    oklch(0.180 0.035 248)  oklch(0.655 0.130 248)  text  5.96   4.50      PASS
accent / accent-subtle       oklch(0.715 0.115 248)  oklch(0.300 0.050 248)  text  5.42   4.50      PASS
text / accent-subtle         oklch(0.965 0.004 248)  oklch(0.300 0.050 248)  text  12.29  4.50      PASS
success / bg                 oklch(0.780 0.140 152)  oklch(0.175 0.006 248)  text  10.00  4.50      PASS
success / bg-elevated        oklch(0.780 0.140 152)  oklch(0.215 0.008 248)  text  9.24   4.50      PASS
success / success-subtle     oklch(0.780 0.140 152)  oklch(0.290 0.055 152)  text  7.29   4.50      PASS
text / success-subtle        oklch(0.965 0.004 248)  oklch(0.290 0.055 152)  text  12.49  4.50      PASS
warning / bg                 oklch(0.800 0.140 75)   oklch(0.175 0.006 248)  text  9.96   4.50      PASS
warning / bg-elevated        oklch(0.800 0.140 75)   oklch(0.215 0.008 248)  text  9.20   4.50      PASS
warning / warning-subtle     oklch(0.800 0.140 75)   oklch(0.290 0.055 75)   text  7.47   4.50      PASS
text / warning-subtle        oklch(0.965 0.004 248)  oklch(0.290 0.055 75)   text  12.85  4.50      PASS
danger / bg                  oklch(0.720 0.150 25)   oklch(0.175 0.006 248)  text  7.16   4.50      PASS
danger / bg-elevated         oklch(0.720 0.150 25)   oklch(0.215 0.008 248)  text  6.61   4.50      PASS
danger / danger-subtle       oklch(0.720 0.150 25)   oklch(0.290 0.055 25)   text  5.45   4.50      PASS
text / danger-subtle         oklch(0.965 0.004 248)  oklch(0.290 0.055 25)   text  13.03  4.50      PASS
info / bg                    oklch(0.760 0.100 250)  oklch(0.175 0.006 248)  text  8.88   4.50      PASS
info / bg-elevated           oklch(0.760 0.100 250)  oklch(0.215 0.008 248)  text  8.20   4.50      PASS
info / info-subtle           oklch(0.760 0.100 250)  oklch(0.290 0.055 250)  text  6.60   4.50      PASS
text / info-subtle           oklch(0.965 0.004 248)  oklch(0.290 0.055 250)  text  12.73  4.50      PASS
on-success / success         oklch(0.200 0.045 152)  oklch(0.780 0.140 152)  text  9.45   4.50      PASS
on-warning / warning         oklch(0.205 0.045 75)   oklch(0.800 0.140 75)   text  9.45   4.50      PASS
on-danger / danger           oklch(0.195 0.055 25)   oklch(0.720 0.150 25)   text  7.00   4.50      PASS
```

Measured separately because it is exempt from both 1.4.3 and 1.4.11, and so would fail a
run that gates on 3:1 while still being correct:

| Pair                                            | Ratio | Requirement | Verdict         |
| ----------------------------------------------- | ----- | ----------- | --------------- |
| `--color-disabled-text` / `--color-disabled-bg` | 2.56  | exempt      | distinguishable |

Two values in `src/app/globals.css` deviate from the palette recipe they came from, and
the measurements are why. Do not "restore" them:

- `--color-text-subtle` is L 0.665, not 0.590. At 0.590 a placeholder on
  `--color-surface` measured **3.90**, and a placeholder is body text needing 4.5.
- `--color-border` is L 0.530, not 0.495. At 0.495 a border on `--color-bg-elevated`
  measured **2.86**, below the 3:1 of 1.4.11.
- `--color-text-muted` then moved to L 0.755 so that muted and subtle stay visibly
  apart.

Re-run the script and rebuild both tables whenever a value changes:

```sh
python3 ~/.claude/skills/ui-ux-designing/scripts/check_contrast.py pairs.json
```

## Internationalisation

One locale (`en`), LTR only. No RTL work, so physical properties are acceptable — but
use logical ones (`padding-inline`, `margin-block`) anyway, since they cost nothing and
a second locale would otherwise mean revisiting every rule.

No button has a fixed width: a second locale can lengthen any label by half again.

Numbers and dates go through `Intl`. `savedAt` is stored as an ISO string and must be
formatted at render time, never concatenated by hand.

## Performance budget

| Metric | Target  | How it is held                                                                                             |
| ------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| INP    | ≤ 200ms | no work on keystroke beyond a `setState`; the character count is derived, not stored separately            |
| CLS    | ≤ 0.1   | the busy state holds the button's width; the feedback panel appears below existing content, never above it |
| LCP    | ≤ 2.5s  | system font stack, no images, locale pages stay `force-static`                                             |

## Instructions for the implementing session

1. Keep `src/app/globals.css` as the single token source. With Tailwind v4 that means
   its `:root` block plus the `@theme inline` block that maps the shadcn names (table
   above) and exposes the scales Tailwind needs. `tokens.css` is only a pointer; do not
   copy declarations into it or restate a value in two places.
2. Read the semantic layer only. A primitive name in a component is a bug.
3. Do not invent a colour, radius, space, or duration. If a needed value is missing,
   propose the token first.
4. Build from the inventory. The seven custom vocabulary components are the only new UI
   primitives; the six composition rows assemble them for their screens, and anything
   else comes from shadcn/ui or the native platform.
5. Implement every state in the state matrix, not just `default`.
6. Respect `eslint.config.mjs`'s 200-line per-file budget. The feedback panel's four
   sections will not fit in one file with the composer — split by section, not by
   arbitrary line count.
7. `messages/en.json` owns every string. No literal user-facing text in a component; see
   the `localizing-ui` skill.
8. Each changed area has a narrowest check in `AGENTS.md`'s table — a component with a
   rendered test is `pnpm exec vitest run tests/<name>.test.tsx`, a page needs
   `pnpm build` then `pnpm test:smoke`.
9. Adding shadcn/ui means adding dependencies, which `managing-dependencies` gates: each
   one needs a review record, and `minimumReleaseAge` may hold a fresh release back.
