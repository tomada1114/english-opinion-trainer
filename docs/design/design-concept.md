# Design concept

What was decided about this app's UI/UX and why. Implementable values live in
[`design-system.md`](./design-system.md); the live token source is
[`src/app/globals.css`](../../src/app/globals.css), with [`tokens.css`](./tokens.css)
retained only as a pointer.

This document is written for the session that implements the UI. Where a decision rules
something out, the rejected option is named, because a rejection that is not written
down gets re-litigated.

## Overview

| Item               | Value                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product            | English Opinion Trainer                                                                                                                                                    |
| In one line        | Write a short English opinion on one topic, get structured feedback on it, keep the phrasing worth reusing.                                                                |
| Primary user       | Commuting with one hand on a phone, a few minutes at a time, alone — unwilling to have the mistakes seen by anyone. Has abandoned learning apps before.                    |
| Usage context      | Phone first, desktop secondarily. Short sessions, one topic at a time, often in the dark (train at night, in bed).                                                         |
| Platform           | Web, responsive. No native app.                                                                                                                                            |
| Design-system base | shadcn/ui + Radix + Tailwind v4                                                                                                                                            |
| Why that base      | The chosen brand axes (playful, experimental) are cheapest to express through Tailwind's utilities, and Radix carries the accessibility of the parts this app grows into.  |
| Known cost of it   | Radix earns its keep on modals, menus, tabs and comboboxes — none of which this app has yet. The dependency is therefore paid for ahead of its use. Accepted deliberately. |

### Theme policy

**Both themes, OS-following only.** Every semantic colour in `src/app/globals.css`'s
`@theme inline` block is `light-dark(<light>, <dark>)`, and `color-scheme: light dark`
resolves each pair against the OS setting. **No in-app toggle** — see the decision log
below for why dark-only was superseded, and "Out of scope" for why a toggle itself stays
out.

What carried over from the original dark-only decision:

- Semantic token **names** were already final before this change, and every one of them
  was already defined — so adding light was "give each existing name a light value and
  wrap both in `light-dark()`", exactly as planned, confined to `src/app/globals.css`
  with no component touched.
- Light values are **derived, not invented**: the neutrals run the same lightness-ladder
  recipe in reverse, the primary's L/C is adjusted per the recipe, and three light
  values deviate from the plain recipe default for the same reason two dark values
  already did — measured contrast. `design-system.md`'s "Measured contrast" carries the
  numbers for both modes, output by `check_contrast.py` and pasted verbatim, never
  computed by hand.

## Design principles

### 1. The wait is narrated, never merely disabled

A feedback request goes to a language model with `max_tokens: 4096`; it can take tens of
seconds. Every such wait states what is happening, in the input field, the button, and
one live region — not by greying something out.

- Decides: when a control becomes unusable, whether to reach for `readOnly`/`disabled`
  alone. The answer is no; the state must also be said.
- Costs: more state to render and more strings to translate than a single spinner.

### 2. Feedback is a starting point, not a verdict

The user is practising alone precisely because they do not want to be judged. Findings
are phrased as the next thing to try. Nothing accumulates a score, a loss, or a
comparison.

- Decides: whether to show a total score, a percentage, or a streak. All three are out.
- Costs: the satisfying "you got 4/5" moment, and the retention lift a streak buys.

### 3. Colour never carries a distinction on its own

`present` / `weak` / `absent` and `before` / `after` are always readable with colour
removed — through an icon, a word, and position.

- Decides: whether a three-value verdict may be a coloured dot. It may not; the dot
  needs a shape and a label.
- Costs: denser rows than a pure colour code would give.

### 4. One topic fills one screen

The drill shows exactly one topic, and everything needed to answer it is reachable
without leaving. Nothing else competes for the screen.

- Decides: whether to show the remaining topics, a unit outline, or navigation beside
  the answer box. None of them.
- Costs: the user cannot see how much is left without going back to the unit view.

## Brand axes

| Axis                | Position (1–5) | How it shows in the UI                                                                                            |
| ------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Quiet ⇔ loud        | 3 (centre)     | One accent hue, four status hues, no gradients. Headline sizes stay on the type scale.                            |
| Hard ⇔ soft         | 3 (centre)     | `--radius-md` on controls, `--radius-lg` on cards. Neither hairline-sharp nor pill-shaped.                        |
| Precise ⇔ handmade  | 4 (handmade)   | Verdicts get glyph badges rather than a uniform chip row; empty states are written, not templated.                |
| Density: high ⇔ low | 3 (standard)   | Rows ≥ 40px, `--space-3` as the working unit.                                                                     |
| Plain ⇔ playful     | 4 (playful)    | Pulse dots while waiting, feedback fades in, badge counts on the collapsed sections, copy that talks to the user. |

Axes deliberately not pushed:

- **Not loud.** The screen is where the user reads and rewrites English prose for
  minutes at a stretch; raising saturation and contrast makes that tiring.
- **Not low density.** The feedback body has four sections; at low density a long
  answer's feedback stops fitting in one commute-sized scroll.

## Key flows

### Flow 1: Answer one topic

- Goal: find out whether this opinion held together, and what to say instead.
- Entry: the unit view, which drew this topic at random.
- Screens: `Unit drill (writing)` → `Unit drill (sending)` → `Unit drill (answered)` →
  next topic
- Transitions: writing → sending on submit (button, or Cmd/Ctrl+Enter); sending →
  answered when `POST /api/feedback` returns 200; answered → next topic on "Next topic".
- Carried across: the answer text (kept on failure so a transient error loses nothing),
  and the level the request was actually sent with — not the level as it stands now, so
  a level changed mid-attempt does not relabel a finished answer.
- Done signal: focus moves to the Feedback heading, and one live-region announcement
  says the feedback arrived.
- Branches: a rule the shared validation refuses is reported inline and never sent. A
  recoverable failure turns the submit button into "Send again" with the text intact. A
  failure that cannot be retried into success (`ERR_LLM_AUTH`, `ERR_FORBIDDEN_ORIGIN`)
  replaces the form with a surface-level explanation.

### Flow 2: Keep a phrase and find it again

- Goal: capture wording worth reusing before it is lost.
- Entry: the Rewrite section of a finished feedback.
- Screens: `Unit drill (answered)` → `Saved phrases`
- Transitions: the rewrite is editable in place; "Save to phrases" commits it. The link
  to Saved phrases lives on the home screen, not inside the drill — the drill must not
  offer a way out mid-topic (principle 4).
- Carried across: the edited rewrite text plus the attempt's topic, category, structure,
  mode, level, and whether a seed was used. Those become the filter axes on the phrase
  list.
- Done signal: a live-region confirmation next to the button, dismissible, that does not
  move the page.
- Branches: an empty rewrite disables saving. Zero saved phrases and zero filter matches
  are different screens (see below).

### Flow 3: Stop, and come back

- Goal: resume without re-reading anything and without being made to feel behind.
- Entry: reopening the app, at any interval.
- Screens: `Home` → `Unit drill`
- Transitions: the home screen names each unit's answered count out of the pass total; a
  finished pass is marked complete and can be restarted.
- Carried across: answered topic ids and completion per unit, from `localStorage`.
  Skipped topics are deliberately **not** persisted, so a pause forgives a skip.
- Done signal: "Unit complete" with the option to start a new pass.
- Branches: state that will not load leaves the loading text in place rather than
  rendering a zeroed dashboard, which would read as lost progress.

## Screen specifications

Component names below are the ones in `design-system.md`'s inventory.

### Unit drill

- Appears in: flows 1, 3
- Role: the user writes one answer and reads its judgement. This is the app.
- Regions, top to bottom:
  1. Progress line — answered count for this pass. One line, muted.
  2. Topic header — the topic text as the `h2`, with the flag control beside it.
  3. Prompt meta — structure template and mode expectation (`1–2 sentences` /
     `4–6 sentences`).
  4. Seeds — collapsed by default; opening it is recorded on the attempt.
  5. Answer composer — label, textarea, character count, inline validation, submit row.
  6. Feedback — only once answered. Four sections, two of them collapsed.
  7. Advance — "Next topic".
- Primary action: **Get feedback**. It is the only accent-filled control on the screen.
- Secondary: Show seeds, Skip this topic, Flag, Next topic.
- Components: Button(primary/secondary/ghost), Textarea, CharacterCount, InlineError,
  BusyStatus, VerdictBadge, DiffLine, Disclosure, Card(elevated).
- States: initial (empty textarea, submit enabled) / sending (textarea disabled, status
  line with pulse dots, button shows spinner and "Getting feedback…") / answered
  (textarea disabled and visibly settled, feedback present) / recoverable failure
  (inline alert, button becomes "Send again", text intact) / terminal failure (form
  replaced by an explanation). There is no empty state: a topic is always drawn.
- Width behaviour: single column throughout. Prose is capped at `--measure` so a long
  answer does not run the full desktop width; the cap is what changes on wide screens,
  not the column count.
- Deliberately absent: navigation, the unit's remaining topics, any score or streak.
  Reason: principles 2 and 4.

### Saved phrases

- Appears in: flow 2
- Role: the user finds a phrase they saved, or clears out ones they no longer want.
- Regions: title → filter row → list → export/import → flagged-id disclosure.
- Primary action: none. This screen is for reading; Delete is destructive and stays
  quiet.
- Components: Select, Button(secondary/destructive), List item, Disclosure, EmptyState.
- States: **zero saved phrases** gets the onboarding empty state — one sentence naming
  where phrases come from, plus a link into a unit. **Zero filter matches** is a
  different state: it says the filters excluded everything and offers to clear them.
  Conflating the two is the Grammarly failure the research flagged, so they are separate
  components.
- Deliberately absent: sample/placeholder rows. Reason: this list supports Delete and
  Export, and a dummy row that can be acted on is worse than an empty one.

### Home

- Appears in: flow 3
- Role: pick a unit, or set the level that the next request will use.
- Regions: title → intro → level select → unit list → link to Saved phrases.
- Primary action: entering a unit.
- States: loading (before the browser state document resolves) / normal. A unit with
  zero answered topics is not an error state and gets no special treatment.

## Voice and tone

UI copy is the area an implementation session invents most freely, so the register is
fixed here. All UI strings are English (`messages/en.json` is the only catalog).

| Item               | Decision                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| Person             | Address the reader as "you"; never "we".                                     |
| Register           | Plain present tense, no contractions in errors, contractions fine elsewhere. |
| Length             | Buttons ≤ 3 words. Body sentences ≤ 15 words.                                |
| Exclamation, emoji | Neither. Praise is stated, not performed.                                    |

### Terms

The same thing is never called two things.

| Use          | Do not use               | For                          |
| ------------ | ------------------------ | ---------------------------- |
| feedback     | review, analysis, result | what the model returns       |
| rewrite      | correction, suggestion   | the full replacement answer  |
| fix          | error, mistake           | one `before → after` item    |
| grammar note | grammar error            | one item in the grammar list |
| phrase       | snippet, favourite       | a saved rewrite              |
| topic        | question, prompt         | the thing being answered     |
| seed         | hint, example            | the starting-point material  |

### By situation

| Situation       | Write it like this                                                | Not like this        | Why                                                                     |
| --------------- | ----------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| Waiting         | "Getting feedback on your answer…"                                | "Loading…"           | The user should know which of several slow things is happening.         |
| Retryable error | "Too many requests right now. Wait a moment and try again."       | "An error occurred." | Without a cause and a next step the user can only repeat the action.    |
| A weak element  | "Your reason is there but does not yet support the point."        | "Reason: weak"       | The verdict word is already in the badge; the sentence says what to do. |
| An absent one   | "No example yet — one concrete case would carry this."            | "Missing example!"   | The gap is the next task, not a failure to announce (principle 2).      |
| Empty phrases   | "Nothing saved yet. Saving a rewrite from a feedback lands here." | "No data."           | Empty is a starting point, so it names the action that fills it.        |

## Iconography and imagery

### Icons

- Set: **Lucide** (it ships with shadcn/ui; mixing sets shows as inconsistent stroke
  weight).
- Stroke 1.5px (Lucide's default), sizes 16 / 20 / 24 only.
- Colour comes from `currentColor`. Icons carry no colour of their own.
- Icon-only controls get an accessible name, and a tooltip only on pointer devices.
- The verdict glyphs are chosen so that they differ in **shape**, not only hue:
  `present` → `Check`, `weak` → `CircleDot`, `absent` → `CircleDashed`.

### Imagery

- Policy: **no images and no illustrations.** Reason: the only content is the user's own
  prose and the model's response, and an illustration in an empty state would be the one
  asset in the app that needs a source, a licence, and a dark-theme variant.
- Rejected: an illustrated empty state for Saved phrases. The written sentence does the
  same job at zero maintenance.

## Products looked at

| Product    | Flow observed                  | Adopted                                                                                      | Not adopted                                                     | Reason                                                                                                  |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Duolingo   | First run; interruption/resume | Onboarding is the first lesson — no account, no setup screen before the first topic          | Day-counted guilt notifications; total streak loss              | The target user has abandoned learning apps; guilt is what they abandoned them over.                    |
| Grammarly  | Suggestion display; sign-up    | `before → after` cards with a one-line reason, as the shape for fixes and grammar notes      | Category-based colour coding; the blank dashboard after sign-up | Severity is the information this app has (`present`/`weak`/`absent`); four category hues is just noise. |
| ELSA Speak | Feedback reading               | Highlight the item, disclose the detail on demand — two-stage rather than everything at once | Its long first-run flow                                         | The app must reach the first topic without a setup phase.                                               |
| Speak      | Interruption/resume            | Nothing                                                                                      | Streak-with-amnesty mechanics; early paywall prompts            | Streaks are a domain feature, not a design one — see out of scope.                                      |

Research caveat worth keeping: none of the four was verified hands-on, and **how Speak
and ELSA present the wait during AI processing could not be established from any
source**. The busy-state design here is therefore original, not borrowed, and is the
part most worth revisiting against a real product.

## Out of scope

| Not doing                                | Why                                                                                                                            | Met instead by                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| An in-app theme toggle                   | Needs the choice persisted in the state document and a first-paint flash suppressed; nobody has asked to override their OS.    | `color-scheme: light dark` plus `light-dark()` tokens, which already follow the OS. |
| Token-by-token streaming of the feedback | The endpoint answers with one validated JSON body against a fixed schema; there is no token stream to render.                  | A narrated wait (principle 1) plus a fade-in on arrival.                            |
| A stop / cancel control during the wait  | `requestFeedback` has no abort path today, and a cancel button that does not cancel is worse than none.                        | Recorded as a follow-up: thread an `AbortSignal` through, then add the control.     |
| Markdown rendering of any text           | Neither side produces Markdown — the user writes prose, the model answers structured JSON.                                     | `white-space: pre-wrap` wherever user text is shown.                                |
| Plain-Enter submission                   | Enter is the newline key in a box meant for 4–6 sentences, and an IME-confirming Enter is indistinguishable enough to misfire. | Cmd/Ctrl+Enter, which an IME confirmation cannot produce.                           |
| A total score, percentage, or grade      | Principle 2.                                                                                                                   | Per-element verdicts, which say where to look next.                                 |
| Toasts                                   | Every message here belongs beside the thing it is about, and a toast that auto-dismisses loses a retryable error.              | Inline messages, plus one live region.                                              |

Deferred rather than rejected — these change the domain, so they belong to
`building-the-drill`, not to this document:

- **Streaks / "today's quota".** The research found this is the standard answer to "come
  back tomorrow", and the user's own stated condition for continuing is knowing today's
  portion is done. Left undecided here because it needs new persisted state, not new
  styling.
- **Spaced repetition over saved phrases.** None of the four products does phrase-level
  SRS, so there is no pattern to copy and it would be built from scratch.

## Decision log

| Date       | Decided                                                                                                                                                                 | Rejected                                                           | Reason                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-13 | Scope: a whole-app design system, then apply it                                                                                                                         | Confining the work to the answer→feedback pair                     | The app had no visual design at all (18-line stylesheet), so a local fix would have clashed with everything around it.                                                                                                                                               |
| 2026-09-13 | Cmd/Ctrl+Enter as the only submit shortcut                                                                                                                              | Enter-to-send with `isComposing` + `keyCode === 229` guards        | A modified Enter cannot be produced by an IME confirmation, so the bug class is structurally absent instead of guarded.                                                                                                                                              |
| 2026-09-13 | Status line with pulse dots for the wait                                                                                                                                | Skeleton of the four feedback sections; spinner only               | The response shape varies by structure and mode, so a skeleton would misrepresent it; a spinner alone does not say what for.                                                                                                                                         |
| 2026-09-13 | Brand axes: playful and experimental; quiet and density at centre                                                                                                       | Loud; low density                                                  | Long reading and writing sessions, and four feedback sections that must fit one scroll.                                                                                                                                                                              |
| 2026-09-13 | shadcn/ui + Radix + Tailwind v4                                                                                                                                         | Plain CSS custom properties; Tailwind alone; Tailwind + Radix only | The author's call, made after the cost was stated: Radix is paid for before the parts that need it exist.                                                                                                                                                            |
| 2026-09-13 | **Superseded 2026-09-14, see below.** Dark only, `color-scheme: dark`                                                                                                   | Both themes with OS following; both plus an in-app toggle          | "I use it in dark first. Light maybe later." Names are final, values are dark-only.                                                                                                                                                                                  |
| 2026-09-13 | Accent hue 248 (blue)                                                                                                                                                   | Teal 196; green 158; purple 305                                    | Green sits 6° from `--color-success`, which would confuse a `present` verdict with the primary button.                                                                                                                                                               |
| 2026-09-13 | Standard density; mobile-first                                                                                                                                          | Compact; roomy; desktop-first; equal weight                        | Commute-sized sessions, and 24×24px target compliance on a phone.                                                                                                                                                                                                    |
| 2026-09-13 | Moderate motion                                                                                                                                                         | Restrained; lavish                                                 | Carries the "playful" axis with `transform`/`opacity` only, which the reduced-motion fallback can undo cleanly.                                                                                                                                                      |
| 2026-09-13 | Errors split by severity: inline / resend / whole-surface                                                                                                               | One inline treatment for all; toasts                               | Ten error codes fall into two groups with different next actions; one treatment hides which group the user is in.                                                                                                                                                    |
| 2026-09-13 | Severity colouring (`present`/`weak`/`absent`), with glyph and word alongside                                                                                           | Grammarly-style category colouring; no colour at all               | Severity is the axis the schema actually carries. Fixes and grammar notes carry no severity and so get no colour.                                                                                                                                                    |
| 2026-09-13 | Two-stage disclosure: structure and rewrite open, fixes and grammar collapsed                                                                                           | All four always open; tabs                                         | Tabs would prevent reading a structural comment beside the rewrite, which is the point of the screen.                                                                                                                                                                |
| 2026-09-13 | Onboarding-style empty states, with filter-zero as a separate state                                                                                                     | A single terse line; sample rows                                   | Sample rows are dangerous on a list with Delete and Export.                                                                                                                                                                                                          |
| 2026-09-13 | Programmatic focus to the Feedback heading on arrival                                                                                                                   | Auto-scroll only; announce without moving focus                    | One mechanism serves pointer, keyboard and screen-reader users; auto-scroll alone leaves focus at the vanished button.                                                                                                                                               |
| 2026-09-13 | Announce arrival, failure and save only; character count excluded                                                                                                       | Announcing the count continuously; announcing failures only        | An `aria-describedby` count can be re-read on every keystroke, which blocks composition.                                                                                                                                                                             |
| 2026-09-13 | `--color-text-subtle` raised to L 0.665, `--color-border` to L 0.530                                                                                                    | The reference recipe's L 0.590 / L 0.495                           | Measured: placeholder on `--color-surface` was 3.90 (needs 4.5) and border on `--color-bg-elevated` was 2.86 (needs 3.0).                                                                                                                                            |
| 2026-09-13 | `--color-text-muted` raised to L 0.755                                                                                                                                  | Leaving it at L 0.700                                              | Once subtle rose to 0.665, muted at 0.700 was no longer distinguishable from it.                                                                                                                                                                                     |
| 2026-09-14 | Both themes, OS-following only, superseding the 2026-09-13 dark-only decision                                                                                           | An in-app toggle                                                   | Someone finally asked; a toggle still needs persisted state and a flash guard neither built nor requested yet.                                                                                                                                                       |
| 2026-09-14 | Light values derived from the same recipe as the dark ones, per name                                                                                                    | Inventing light values freehand                                    | `design-tokens.md`'s reference recipe already carried a light column for this hue; using it keeps light and dark one system.                                                                                                                                         |
| 2026-09-14 | `--color-text-subtle` L 0.500, `--color-border` L 0.600, `--color-primary` (and `-hover`/`-active`) shifted L −0.025 from the recipe's ~0.545/0.495/0.450, all in light | The recipe's plain reversed L 0.550 / 0.655 / 0.545                | Measured: at the recipe defaults, `text-subtle` on `surface-hover` was 3.80 (needs 4.5), `border` on `surface` was 2.70 (needs 3.0), and `primary` as text on `surface` was 4.21 (needs 4.5) — the same kind of deviation the 2026-09-13 dark values already needed. |

## Change history

| Date       | Change                                                              | Scope                                                    |
| ---------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| 2026-09-13 | First issue                                                         | —                                                        |
| 2026-09-14 | Add the light theme: `light-dark()` tokens, OS-following, no toggle | `src/app/globals.css`, this document, `design-system.md` |
