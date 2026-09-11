import { NextIntlClientProvider } from "next-intl";
import {
  act,
  fireEvent,
  render,
  screen,
  type RenderResult,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "../src/app/[locale]/page";
import { STRUCTURE_TEMPLATES } from "../src/core/drill";
import { defaultState } from "../src/core/state";
import en from "../messages/en.json";

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
}));

// The home page, rendered the way `writing-tests`/`placing-tests` settle it
// for issue #12: under jsdom, through Testing Library, with
// `NextIntlClientProvider` supplying the `locale`/`messages` context that
// `src/app/[locale]/layout.tsx` gets for free from the Server Component tree
// in a real request but a unit test must pass explicitly (see
// `NextIntlClientProvider`'s own `locale` doc comment). The page carries no
// `"use client"` — `building-app-routes` explains why hooks alone do not make
// it one — so what makes it renderable here is that it is synchronous, not
// that it runs on the client. An asynchronous Server Component —
// `LocaleLayout` itself — is explicitly out of scope; this test never renders
// it.

async function renderHomePage(): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(async () => {
    result = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HomePage params={Promise.resolve({ locale: "en" })} />
      </NextIntlClientProvider>,
    );
    await Promise.resolve();
  });
  if (result === undefined) {
    throw new Error("Home page did not render");
  }
  return result;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("HomePage", () => {
  it("renders under jsdom", () => {
    // Proves the `component` vitest project actually runs under jsdom, and
    // that `tests/**/*.test.ts` (the `unit`/`automation` projects) does not:
    // `tests/server-env.test.ts` and the rest of the `node`-environment suite
    // have no `document` to assert against.
    expect(typeof document).not.toBe("undefined");
  });

  it("renders the translated title and intro", async () => {
    await renderHomePage();

    expect(
      screen.getByRole("heading", { name: en.HomePage.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose a unit, practice an opinion, and build confident English answers.",
      ),
    ).toBeInTheDocument();
  });

  it("renders no locale switcher, now that the app ships only one locale", async () => {
    await renderHomePage();

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders unit structures, persisted progress, completion, and the phrase link", async () => {
    window.localStorage.setItem(
      "english-opinion-trainer",
      JSON.stringify({
        ...defaultState(),
        units: {
          1: {
            answeredTopicIds: [
              "prep-travel-short",
              "prep-food-short",
              "prep-work-short",
              "prep-hobbies-short",
              "prep-technology-short",
            ],
            completed: false,
          },
          2: { answeredTopicIds: [], completed: true },
        },
      }),
    );

    await renderHomePage();

    expect(screen.getByText(STRUCTURE_TEMPLATES.prep)).toBeInTheDocument();
    expect(
      screen.getByText(
        en.HomePage.progress.replace("{answered}", "5").replace("{total}", "16"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(`✓ ${en.HomePage.completed}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.HomePage.phrasesLink })).toHaveAttribute(
      "href",
      "/en/phrases",
    );
  });

  it("persists a changed level and reads it again after a remount", async () => {
    const rendered = await renderHomePage();
    const selector = screen.getByLabelText(en.HomePage.levelLabel);

    fireEvent.change(selector, { target: { value: "B2" } });
    expect(
      JSON.parse(window.localStorage.getItem("english-opinion-trainer") ?? "null"),
    ).toMatchObject({
      level: "B2",
    });

    rendered.unmount();
    await renderHomePage();
    expect(screen.getByLabelText(en.HomePage.levelLabel)).toHaveValue("B2");
  });
});
