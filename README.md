# english-opinion-trainer

[![CI](https://github.com/tomada1114/english-opinion-trainer/actions/workflows/ci.yml/badge.svg)](https://github.com/tomada1114/english-opinion-trainer/actions/workflows/ci.yml)

Short English opinion drills with structured feedback.

## What this is

A starting point for a Next.js application on the App Router: a locale-prefixed page
tree, one JSON endpoint, and one language-model call kept behind an interface rather
than called directly. ESM-only TypeScript throughout.

Two things follow from that last part, and they are most of why this template exists. A
missing credential is a per-request error rather than a boot failure, so `pnpm dev`
starts before any API key exists — the first thing you do with a checkout is run it, not
go and find one. And a project that wants no model at all deletes the layer in one piece
instead of unpicking it, which a test keeps true rather than a convention.

`AGENTS.md` describes the architecture and the rules; this file is the tour.

## Quick start

```sh
pnpm install
pnpm dev
```

Then open <http://localhost:3000>, which redirects to `/en` — the app is English-only
for now (owner decision 2026-09-10; see `building-the-drill`). The page it renders is
`src/app/[locale]/page.tsx`, and the text on it comes from `messages/en.json`. The
`/[locale]/` tree and the typed catalogs stay in place so a locale can be added back by
reverting that decision; see `starting-an-app`'s "The locale decision".

The language-model call lives behind `LlmPort` in `src/ai/index.ts`, and
`src/server/composition.ts` wires a provider adapter on `claude-haiku-4-5`. Copy
`.env.example` to `.env` and fill in the provider key it names to get real feedback;
without it the app still starts, and `POST /api/feedback` answers `500 ERR_LLM_AUTH`.
Every call bills the provider, and this app ships no authentication or rate limit of its
own to protect that cost: issue the key from a dedicated workspace on the model
provider's side with a spend limit, which is the deployment's cost control — spend
limits are set per workspace or organization, never per API key.

This template ships `POST /api/feedback` as its endpoint. Its Route Handler follows the
pattern `building-app-routes` describes and is composed in `src/server/composition.ts`.
Add another Route Handler over the port by following that pattern, and wire it in the
composition root.

## Starting a new app from this template

Copy the tree, then work through
[`starting-an-app`](.agents/skills/starting-an-app/SKILL.md), which owns the procedure
and the order it runs in: rename first, then decide whether to keep the language-model
layer or remove it whole, then decide the locales, then run `pnpm check:source` once.

The rename is what the title, the description and the author above are waiting for —
they are this template's own identity strings, deliberately left as placeholders.
`tests/placeholders.test.ts` holds the complete list of where one still stands, and a
new app is finished renaming when that list is empty and the test is green.

## Development

This package is private: nothing here is packed, published, or consumed as a tarball.

```sh
corepack pnpm@11.18.0 install --frozen-lockfile
pnpm check:quick
```

The install puts the Git hooks in place on its own — lefthook's `postinstall` does it,
on every non-CI install — and `package.json`'s `prepare` script then runs
`scripts/verify-hooks.mjs`, which fails the install if the pre-commit hook did not
actually land. So there is no setup step for the hooks; `pnpm hooks:install` is the
repair when that check reports one is needed.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete workflow, and
[AGENTS.md](AGENTS.md) for the architecture, the command index, and the rules every
change is held to.

## License

[MIT](LICENSE) © tomada
