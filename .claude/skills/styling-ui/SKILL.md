---
name: styling-ui
description: >
  Covers the shared component layer at src/app/_client/ui/, the token source in
  src/app/globals.css, and docs/design/: reading the semantic token layer only, never
  inventing a colour, radius, space or duration, the --color-primary vs shadcn
  --color-accent distinction, the light-dark() theme tokens, and implementing every
  state in a component's state matrix. Use when adding or changing a component under
  src/app/_client/ui/, editing a token in src/app/globals.css, reading
  docs/design/design-system.md or design-concept.md, or choosing a colour, spacing,
  radius, or duration for a new piece of UI.
---

# Styling UI

**Owns:** the shared component layer (`src/app/_client/ui/`), the design token source
(`src/app/globals.css`), and its documentation (`docs/design/`) — what a component may
read, what it may never invent, and which states it must implement. **Does not own:**
the Server/Client boundary and where a component is used (`building-app-routes`); UI
strings and the message catalog (`localizing-ui`); TypeScript idiom inside a component
(`writing-typescript`); adding a shadcn/ui dependency, which needs a review record
(`managing-dependencies`).

`docs/design/design-system.md` holds the implementable values and
`docs/design/design-concept.md` the reasoning behind them. This skill does not restate
either — it is the rule a component follows while reading them, and the judgment neither
document enforces mechanically.

## The single token source

`src/app/globals.css` is the live token source — its `:root` block for primitives and
hand-written `var()` use, its `@theme inline` block for the semantic names and the
shadcn/ui aliases. `docs/design/tokens.css` is only a pointer to it; never copy a
declaration into that file or restate a value in two places.

The component inventory table in `design-system.md` is closed: nothing outside it gets
built. When a new part is genuinely needed, add the row there first, with its variants,
sizes, and states, before writing the component.

## Read the semantic layer only

A component reads `--color-*`, `--space-*`, `--text-*`, and `--motion-*` — the names
`@theme inline` derives, such as `bg-primary` or `text-text-muted` in `button.tsx`. A
primitive name (`--neutral-600`, `--accent-400`) inside a component is a bug: it is the
one place a later theme change would miss, because every other surface reads the
semantic layer that a theme edit actually touches.

## Never invent a token

Do not invent a colour, radius, space, or duration — no arbitrary Tailwind value, no
inline style, no ad hoc hex or `oklch()`. If a needed value is missing, propose the
token first: add it to `src/app/globals.css`'s `:root` or `@theme` block and to the
matching table in `design-system.md`, in the same change. A token proposed without the
value it is meant to hold is not yet a token.

## `--color-primary`, never shadcn's `--color-accent`

shadcn/ui's own vocabulary uses `--accent` for a subtle hover surface, not the primary
colour. Tailwind v4 gives both vocabularies one `--color-*` namespace, so
`--color-accent` can only mean one thing — and in `globals.css` it is bound to
`--color-surface-hover`, the shadcn meaning. This app's primary action token is
`--color-primary` instead, precisely so the clash cannot be written. When a new
shadcn/ui component brings its own CSS variable names, alias them through the table in
`design-system.md`'s "Mapping to shadcn/ui's token names" rather than guessing —
reaching for `--accent` to mean "primary" repaints every hovered row the primary colour.

## Both themes, OS-following only

Every semantic colour in `globals.css`'s `@theme inline` block is a
`light-dark(<light>, <dark>)` pair, and `color-scheme: light dark` is what makes
`light-dark()` resolve against the OS setting. See `design-concept.md`'s "Theme policy"
for why the earlier dark-only decision (kept in its decision log as superseded) changed.
**There is no in-app toggle** — that would need the choice persisted in the state
document and a first-paint flash suppressed, and neither is built; do not add one. A new
semantic token needs both halves derived from the recipe in `design-system.md` (reversed
lightness ladder for a neutral, adjusted L/C for a hue) and measured with
`check_contrast.py` in both modes — never a light or dark half invented without
measuring it, and never a component reading `light-dark()` or a `prefers-color-scheme`
query directly instead of the semantic token.

## Implement every state in the state matrix

`design-system.md`'s "State matrix" names the states a component must render — Button
(primary): Default, Hover, Focus-visible, Active, Disabled, Busy; Textarea, Card,
Disclosure, and list item states in the table beside it. Building only `default` is not
a partial implementation of the row, it is a missing one.

- Every `:hover` rule needs a `:focus-visible` counterpart — a state reachable only by
  hover is unreachable by keyboard and by touch.
- Hover styling lives inside `@media (hover: hover)` (Tailwind's `hover:` already
  compiles to this), so a tap never leaves a stuck hover colour.
- Disabled reads `--color-disabled-bg` / `--color-disabled-text`, never `opacity` on the
  element — opacity also dims nested text and makes the contrast unmeasurable.
- A colour is never the only signal on its own (see "Verdict appearance" in
  `design-system.md`): pair it with a glyph, a word, or a text decoration.

## Boundary with `building-app-routes` and `localizing-ui`

`building-app-routes` owns the Server/Client boundary and which page or layout renders a
component; this skill owns how the component looks and behaves once it exists.
`localizing-ui` owns every string a component displays — no literal user-facing text in
a component under `src/app/_client/ui/`, read it through `useTranslations` instead. A
component styled here should need no `"use client"` of its own unless it holds state, an
effect, or an event handler; when it does, `building-app-routes` is where that directive
question is answered, not this skill.

## What to run

```bash
pnpm exec vitest run --project=component  # a component under src/app/_client/ui/ with a rendered test
pnpm build                                 # a token change in src/app/globals.css
pnpm test:smoke                            # after the build above
```

Re-run the colour-vision and contrast checks in `design-system.md`'s "Accessibility"
section whenever a token's value changes, not only when a component using it changes —
the values are what the checks measure.
