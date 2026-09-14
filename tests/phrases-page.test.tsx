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
import { defaultState, type PhraseEntry, type StateDocument } from "../src/core/state";
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

function makeState(): StateDocument {
  return {
    version: 1,
    level: "A2",
    units: {
      1: { answeredTopicIds: ["prep-travel-short"], completed: false },
      4: { answeredTopicIds: ["comparison-food-long"], completed: true },
    },
    phrases: [
      makePhrase({
        id: "round-trip",
        text: "A phrase to export.",
        usedSeed: true,
      }),
    ],
    flaggedTopicIds: ["concession-work-short"],
    flaggedSeedIds: ["seed-concession-work-short-b1-1"],
    answeredByDay: {},
    dailyTarget: 3,
  };
}

let latestRead: Promise<void> | undefined;

class MockFileReader {
  result: string | null = null;
  done: Promise<void> = Promise.resolve();
  private readonly listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, listener);
  }

  readAsText(file: Blob): void {
    this.done = file.text().then((text) => {
      this.result = text;
      this.listeners.get("load")?.(new Event("load"));
    });
    latestRead = this.done;
  }
}

function stubFileReader(): void {
  latestRead = undefined;
  vi.stubGlobal("FileReader", MockFileReader);
}

async function importFile(content: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(en.Phrases.import), {
    target: {
      files: [new File([content], "state.json", { type: "application/json" })],
    },
  });
  const read = latestRead;
  if (read === undefined) {
    throw new Error("FileReader was not created");
  }
  await act(async () => {
    await read;
  });
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
    expect(screen.getByText(en.Phrases.empty.heading)).toBeInTheDocument();
    expect(screen.getByText(en.Phrases.empty.body)).toBeInTheDocument();
    // The filters are absent, not merely empty: five selects above an onboarding
    // message would say the list is filtered rather than unstarted.
    expect(screen.queryByLabelText(en.Phrases.category.label)).not.toBeInTheDocument();
    // `Button asChild` renders the local `Slot`, cloning the `Link` it wraps
    // rather than nesting an anchor inside a button — this stays an anchor
    // reachable by its role and accessible name, not a `<button>`.
    expect(
      screen.getByRole("link", { name: en.Phrases.empty.action }),
    ).toBeInTheDocument();
  });

  it("distinguishes an excluding filter from nothing having been saved", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState()));
    await renderPhrasesPage();

    fireEvent.change(screen.getByLabelText(en.Phrases.category.label), {
      target: { value: "work" },
    });

    expect(screen.getByText(en.Phrases.noMatches.heading)).toBeInTheDocument();
    expect(screen.queryByText(en.Phrases.empty.heading)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.Phrases.clearFilters }));

    expect(screen.queryByText(en.Phrases.noMatches.heading)).not.toBeInTheDocument();
  });

  it("renders flagged topic and seed ids in read-only copyable fields", async () => {
    const state = makeState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    await renderPhrasesPage();

    // Behind a disclosure now: raw ids are for reporting a bad topic, not for
    // practising, so they no longer compete with the phrases above them.
    const flagged = screen
      .getAllByRole("group")
      .flatMap((details) => Array.from(details.querySelectorAll("summary")))
      .filter((summary) => summary.textContent.includes(en.Phrases.flagged.heading));
    expect(flagged).toHaveLength(1);
    const [flaggedSummary] = flagged;
    if (flaggedSummary === undefined) {
      throw new Error("the flagged-ids disclosure was not rendered");
    }
    fireEvent.click(flaggedSummary);

    const topicIds = screen.getByLabelText(en.Phrases.flagged.topicIds);
    const seedIds = screen.getByLabelText(en.Phrases.flagged.seedIds);
    expect(topicIds).toHaveValue(state.flaggedTopicIds.join("\n"));
    expect(seedIds).toHaveValue(state.flaggedSeedIds.join("\n"));
    expect(topicIds).toHaveAttribute("readonly");
    expect(seedIds).toHaveAttribute("readonly");
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

  it("exports the complete state as pretty-printed JSON with a dated filename", async () => {
    const state = makeState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    stubFileReader();

    let exportedBlob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:state";
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    await renderPhrasesPage();
    fireEvent.click(screen.getByRole("button", { name: en.Phrases.export }));

    if (exportedBlob === undefined) {
      throw new Error("Export did not create a Blob");
    }
    expect(exportedBlob.type).toBe("application/json");
    expect(await exportedBlob.text()).toBe(JSON.stringify(state, null, 2));
    expect(click).toHaveBeenCalledTimes(1);
    const clickedAnchor = click.mock.instances[0];
    if (!(clickedAnchor instanceof HTMLAnchorElement)) {
      throw new Error("Export did not click an anchor");
    }
    expect(clickedAnchor.download).toMatch(
      /^english-opinion-trainer-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  it("round-trips the exact state document from export to import", async () => {
    const state = makeState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    stubFileReader();

    let exportedBlob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:state";
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      return undefined;
    });

    await renderPhrasesPage();
    fireEvent.click(screen.getByRole("button", { name: en.Phrases.export }));
    if (exportedBlob === undefined) {
      throw new Error("Export did not create a Blob");
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState()));
    await importFile(await exportedBlob.text());

    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"),
    ).toStrictEqual(state);
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["schema-invalid JSON", JSON.stringify({ ...defaultState(), level: "C2" })],
  ] as const)(
    "shows a translated error and retains state for %s import",
    async (_label, content) => {
      const phrase = makePhrase({ id: "retained", text: "Retain this phrase." });
      const state = { ...defaultState(), phrases: [phrase] };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      stubFileReader();

      await renderPhrasesPage();
      await importFile(content);

      expect(screen.getByRole("alert")).toHaveTextContent(en.Phrases.importError);
      expect(
        JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"),
      ).toStrictEqual(state);
      expect(screen.getByText(phrase.text)).toBeInTheDocument();
    },
  );
});
