---
name: building-the-drill
description: >
  Covers this app's domain vocabulary and settled design: topics, seeds, structure
  types, modes, units, levels, the phrase list, and the feedback schema; the POST
  /api/feedback endpoint and its contract; the browser-state document; and why the app
  deviates from the template (no bearer auth, no POST /api/ask, deployment deferred).
  Use when adding or changing static topic/seed data, the feedback handler or schema
  factory, unit/level/progress logic, phrase-list state, or asking why a template rule
  (auth, rate limiting, deployment) does not apply here.
---

# Building the Drill

**Owns:** the product vocabulary and the decisions specific to this app, cut from
`nextjs-app-template`. **Does not own:** the zone boundaries and Route Handler shape
(`building-app-routes`), the `LlmPort`/adapter contract (`integrating-llm`), the message
catalog mechanics (`localizing-ui`), error-code naming (`designing-errors`).

This repository keeps no `docs/` directory and no ADR. This skill, plus the issue that
introduces a change, is where the domain vocabulary and the settled decisions live.

## What the app is

A browser-only, login-free, chat-style repetition drill for stating an opinion in
English, in short form. One session is one topic, meant to take under five minutes: read
a topic, write an English answer, get schema-fixed feedback from one LLM call,
optionally save the rewrite to a phrase list. No accounts, no scores, no streaks.

## Vocabulary

| Term                 | Values / shape                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure type       | `prep` (elements `point`, `reason`, `example`, `restatement`), `concession` (`acknowledgement`, `opinion`, `reason`), `comparison` (`contrast`, `choice`, `reason`)                                     |
| Question → structure | recommendation/opinion → `prep`; agree/disagree → `concession`; either/or → `comparison`; the app assigns it, the user never chooses                                                                    |
| Mode                 | `short` (1–2 sentences; judges only the structure's first two elements), `long` (4–6 sentences; judges all elements)                                                                                    |
| Unit                 | `1`=`prep`, `2`=`concession`, `3`=`comparison`, `4`=mixed (all topics); one pass = 8 `short` + 8 `long` topics, each shuffled, no repeat until the pass ends; completion = 16 answered topics           |
| Level                | `A2`, `B1`, `B2`; default `B1`; changes only the rewrite's vocabulary/strictness, not which topics appear                                                                                               |
| Category (8)         | `travel` (旅行・おすすめ), `food` (食), `work` (仕事・働き方), `hobbies` (趣味・休日), `technology` (技術・習慣), `city-life` (街・暮らし), `relationships` (人間関係・マナー), `learning` (学び・言語) |
| Topic grid           | 3 structure types × 8 categories × 2 (one `short`, one `long` per cell) = 48 topics                                                                                                                     |
| Seeds                | 48 topics × 3 levels × 3 seeds each = 432 rows; a seed is a stance + one or two key phrases, never a full sentence                                                                                      |

## Core loop

1. A unit presents the next topic; the topic fixes its structure type and mode.
2. The user writes an English answer; a button reveals the topic's seeds if they have no
   opinion of their own.
3. The answer goes to `POST /api/feedback`, which returns a fixed-schema verdict per
   judged element, up to 2 fixes, a level-appropriate rewrite, and up to 5 grammar
   notes.
4. The rewrite can be saved to the phrase list, tagged with its topic's category,
   structure, mode, level, and whether a seed was used.

## Settled decisions

- **Runtime.** Next.js 16 App Router stays, as the template ships it — the earlier
  planning-phase "static SPA + Cloudflare Workers relay" is superseded. Reason: the
  existing Route Handler pattern already is the relay; splitting it into a separate
  Worker bought nothing. Deployment is deferred; Cloudflare (OpenNext on Workers) is the
  first candidate when it happens, re-checked then for commercial-use terms and the
  Workers CPU limit. Constraint until then: no Node-only APIs beyond what the template
  already uses.
- **Auth.** Bearer-token auth (`API_ACCESS_KEY`, `requiresAccessKey`,
  `ADAPTER_BILLS_A_PROVIDER` gating) is removed. Reason: the only caller is the app's
  own browser page, so a bearer token shipped to the browser is exposure without
  protection. Replacement: `POST /api/feedback` requires the `Sec-Fetch-Site` request
  header to equal `same-origin`, rejecting `cross-site`, `same-site`, `none`, or a
  missing header with `403 ERR_FORBIDDEN_ORIGIN`. The spend cap lives on the Anthropic
  side, in a dedicated workspace with a spend limit (per-key limits do not exist —
  verified 2026-09-10). The app still implements no rate limiting of its own, per the
  template's rule.
- **The endpoint.** `POST /api/ask` (the template's free-text demo) is deleted along
  with its handler, tests, fixtures, and home-page demo copy — this app makes one kind
  of LLM call. `POST /api/feedback` request:
  `{ topicId: string, answer: string, level: "A2"|"B1"|"B2" }` — no `locale` field; the
  app is English-only (see Localization below), so feedback language is not a request
  parameter. Structure, mode, and topic text are looked up server-side from static data;
  an unknown `topicId` is `400 ERR_BAD_REQUEST`. Input validation (same rules client and
  server, server authoritative, before any LLM call): trimmed answer non-empty (else
  `ERR_BAD_REQUEST`); length ceiling 400 chars `short` / 1200 chars `long` (else
  `ERR_ANSWER_TOO_LONG`); CJK letters outnumbering Latin letters is
  `ERR_ANSWER_NOT_ENGLISH`; the template's 64 KiB body ceiling is unchanged. Port errors
  keep the template's mapping (`AUTH`→500, `RATE_LIMIT`→429, `TIMEOUT`→504,
  `INVALID_OUTPUT`→502, `UNAVAILABLE`→503). A `200` answers with the clamped feedback
  object (below) plus an echo of `{ topicId, structure, mode, level }` so the client
  renders without a second lookup. `src/server/env.ts` reads only `ANTHROPIC_API_KEY`
  (optional; a missing key is a per-request `ERR_LLM_AUTH` → 500, not a boot failure).
- **Feedback schema.** Built per request by a pure factory
  `feedbackSchemaFor(structure, mode)` returning a `z.object`: a `structure` field whose
  keys are exactly the judged elements for that mode (first two for `short`, all for
  `long`), each `{ verdict: "present"|"weak"|"absent", reason }`; plus common fields
  `fixes` (the 1–2 things to fix), `rewrite` (the level-appropriate rewrite), and
  `grammar` (excerpt/correction/note entries). Six concrete shapes come out of the one
  function (3 structures × 2 modes). No score field, and deviating from the presented
  element order is never penalized. Granularity policy (verified 2026-09-10 against the
  structured-outputs docs; `maxItems`/`minLength`/`maxLength`/`minimum` are unsupported,
  `enum`/`required`/`additionalProperties:false`/`minItems` 0-or-1/`pattern` are): the
  API guarantees which keys come back and their enum values, nothing about length or
  count, so the prompt asks for ordering-by-importance and the server then clamps
  deterministically — `fixes` to the first 2, `grammar` to the first 5; a `rewrite` over
  the mode's sentence ceiling (2 `short` / 6 `long`) is logged, not regenerated. No
  retry beyond the adapter's own one.
- **Prompt rules.** Built by a pure function from (topic text, structure type, the
  mode's element list, level, answer). The topic's text is sent, never its id. Seeds are
  never sent; whether one was opened is a browser-only attribute. Output language is
  always English: the handler passes `outputLanguage: "en"` as a constant, not a value
  derived from a locale. The `ask` handler's `OUTPUT_LANGUAGE_BY_LOCALE` map is not
  carried over.
- **Model.** `src/server/composition.ts` wires `createAnthropicAdapter` with
  `claude-haiku-4-5` as the initial model, chosen for speed against the five-minute
  session — a one-line choice, revisited by a separate measurement issue. Tests keep
  using `createFakeLlmPort`; fixtures under `tests/fixtures/llm/` cover the feedback
  schema's success case and its four failure shapes.
- **Browser state.** One `localStorage` document under the key
  `english-opinion-trainer`:
  `{ version, level, units: { [unitId]: { answeredTopicIds, completed } }, phrases: [...], flaggedTopicIds, flaggedSeedIds }`.
  Read through zod; invalid or absent input resets to the default rather than throwing,
  and `version` drives migrations. The pure shape, its zod schema, and migrations live
  in `src/core/` (framework-free); the `localStorage` adapter and the React hook are
  client-only. A phrase-list entry is
  `{ id, text, topicId, category, structure, mode, level, usedSeed, savedAt }`.
- **Pages.** `/` lists units with progress and a level selector; `/units/[unitId]` runs
  the drill; `/phrases` lists saved phrases with tag filters. Units are always
  selectable — reopening a completed unit starts a new pass and keeps the completed
  mark; there is no lock and no separate review mode.
- **Static data.** English only, never translated — topics, seeds, and the three
  structure-template explanations. A vitest suite validates the grid: 48 unique topics
  (one `short` + one `long` per structure×category cell), 432 seeds (every topic × every
  level × 3, stances differing within a triple, no seed a full sentence), and no CJK. It
  lives in `src/core/content/` (settled by #3): `topics.json` and `seeds.json`, their
  zod schemas in `schema.ts` (`Topic` and `Seed` are `z.infer` of them), and
  `index.ts`'s `getTopics`, `getTopicById`, and `getSeedsForTopic`, which `.parse` both
  files once at module load so a malformed row fails every test and build.
  `tests/content.test.ts` is the suite.
- **Localization (owner decision, 2026-09-10).** The app is English-only for now; the
  earlier planning-phase decision that switching to Japanese changes UI and feedback
  language is superseded. `LOCALES` (`src/i18n/locales.ts`) is `["en"]` only,
  `messages/ja.json` is deleted, and the locale switcher is removed from the UI. The
  next-intl mechanism — the `/[locale]/` page tree, the typed message catalogs,
  `src/i18n/` — is kept rather than removed, specifically so `ja` can return later by
  reverting this edit; see `starting-an-app`'s "The locale decision" for the exact files
  it touches. Every new UI string goes to `messages/en.json` only, and feedback language
  is not locale-driven (see the endpoint contract above).

## Deviations from the template

A reader of `building-app-routes` or `integrating-llm` should not be confused by these:

- No bearer-token auth and no `API_ACCESS_KEY` — replaced by the `Sec-Fetch-Site` check
  above, because the only caller is same-origin.
- No `POST /api/ask` — the template's demo endpoint is deleted, replaced by the single
  `POST /api/feedback` endpoint.
- No deployment yet — the app runs locally only (`pnpm dev` /
  `pnpm build && pnpm start`) until the deferred Cloudflare decision above is made.
- A single locale (`en`) and no locale switcher — the template's two-locale default is
  deferred, not cancelled; see Localization above.

## Not decided

- The deployment target (candidate: Cloudflare/OpenNext, re-checked when pursued).
- The model, pending the Haiku-4.5-vs-Sonnet-5 measurement issue.
- When, or whether, `ja` returns — the mechanism is kept so it is a documented edit
  rather than a rebuild, but no date or trigger is decided.
- The `src/app/_client/` folder name for the localStorage adapter and hook, marked
  "assumption" in the design doc — treat it as the current default, not settled, until
  an issue confirms or changes it. (`src/core/content/` was the other such assumption;
  #3 settled it — see Static data above.) The element key names and category slugs in
  the vocabulary table above are settled: `src/core/drill.ts` is their source of truth.

## Planning history

The handoff, decisions log, and open questions this skill was distilled from live
outside this repository, at
`/Users/masuyama/ghq/github.com/tomada1114/braintrust/docs/plan/english-opinion-trainer/`.
