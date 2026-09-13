import { NextIntlClientProvider } from "next-intl";
import {
  act,
  fireEvent,
  render,
  screen,
  type RenderResult,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PhrasesPage from "../src/app/[locale]/phrases/page";
import { defaultState, type PhraseEntry } from "../src/core/state";
import en from "../messages/en.json";

const STORAGE_KEY = "english-opinion-trainer";

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
}));

function makePhrase(overrides: Partial<PhraseEntry> = {}): PhraseEntry {
  return {
    id: "phrase-default",
    text: "A saved phrase.",
    topicId: "prep-travel-short",
    category: "travel",
    structure: "prep",
    mode: "short",
    level: "B1",
    usedSeed: false,
    savedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

function seedPhrases(phrases: readonly PhraseEntry[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...defaultState(), phrases }),
  );
}

async function renderPhrasesPage(): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(async () => {
    result = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PhrasesPage params={Promise.resolve({ locale: "en" })} />
      </NextIntlClientProvider>,
    );
    await Promise.resolve();
  });
  if (result === undefined) {
    throw new Error("Phrases page did not render");
  }
  return result;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("PhrasesPage", () => {
  it("renders the translated empty state when no phrases are saved", async () => {
    await renderPhrasesPage();

    expect(screen.getByRole("heading", { name: en.Phrases.title })).toBeInTheDocument();
    expect(screen.getByText(en.Phrases.empty)).toBeInTheDocument();
  });

  it("combines category and level filters with AND semantics and sorts newest first", async () => {
    const olderMatch = makePhrase({
      id: "travel-b1-older",
      text: "Older travel B1 phrase.",
      savedAt: "2026-09-10T00:00:00.000Z",
    });
    const wrongLevel = makePhrase({
      id: "travel-b2",
      text: "Travel B2 phrase.",
      level: "B2",
      savedAt: "2026-09-12T00:00:00.000Z",
    });
    const wrongCategory = makePhrase({
      id: "food-b1",
      text: "Food B1 phrase.",
      category: "food",
      savedAt: "2026-09-13T00:00:00.000Z",
    });
    const newerMatch = makePhrase({
      id: "travel-b1-newer",
      text: "Newer travel B1 phrase.",
      savedAt: "2026-09-14T00:00:00.000Z",
    });
    seedPhrases([olderMatch, wrongLevel, wrongCategory, newerMatch]);

    await renderPhrasesPage();
    fireEvent.change(screen.getByLabelText(en.Phrases.category.label), {
      target: { value: "travel" },
    });
    fireEvent.change(screen.getByLabelText(en.Phrases.level), {
      target: { value: "B1" },
    });

    expect(screen.getByText(olderMatch.text)).toBeInTheDocument();
    expect(screen.getByText(newerMatch.text)).toBeInTheDocument();
    expect(screen.queryByText(wrongLevel.text)).not.toBeInTheDocument();
    expect(screen.queryByText(wrongCategory.text)).not.toBeInTheDocument();
    const [firstPhrase] = screen.getAllByRole("listitem");
    expect(firstPhrase).toHaveTextContent(newerMatch.text);
  });

  it("deletes one phrase from the rendered list and persisted state", async () => {
    const removed = makePhrase({ id: "remove-me", text: "Remove this phrase." });
    const retained = makePhrase({ id: "keep-me", text: "Keep this phrase." });
    seedPhrases([removed, retained]);

    await renderPhrasesPage();
    const phraseItem = screen.getByText(removed.text).closest("li");
    expect(phraseItem).not.toBeNull();
    fireEvent.click(
      within(phraseItem as HTMLElement).getByRole("button", {
        name: en.Phrases.delete,
      }),
    );

    expect(screen.queryByText(removed.text)).not.toBeInTheDocument();
    expect(screen.getByText(retained.text)).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"),
    ).toMatchObject({ phrases: [retained] });
  });
});
