import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readState, writeState } from "../src/app/_client/storage";
import { useStateDocument } from "../src/app/_client/use-state-document";
import { defaultState, type StateDocument } from "../src/core/state";

// The key .agents/skills/building-the-drill/SKILL.md fixes for the document,
// written out here rather than imported so a renamed key fails this suite.
const STORAGE_KEY = "english-opinion-trainer";

function makeDocument(): StateDocument {
  return {
    version: 1,
    level: "A2",
    units: { 3: { answeredTopicIds: ["comparison-food-short"], completed: false } },
    phrases: [],
    flaggedTopicIds: [],
    flaggedSeedIds: ["seed-3"],
    answeredByDay: {},
    dailyTarget: 3,
  };
}

function quotaExceeded(): never {
  throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
}

function storageDisabled(): never {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("readState", () => {
  it("returns the default document when nothing is stored", () => {
    expect(readState()).toStrictEqual(defaultState());
  });

  it("returns what writeState stored", () => {
    writeState(makeDocument());

    expect(readState()).toStrictEqual(makeDocument());
  });

  it.each([
    ["malformed JSON", "{not json"],
    [
      "a document of an unknown version",
      JSON.stringify({ ...makeDocument(), version: 9 }),
    ],
    ["a JSON value that is not a document", "[]"],
  ])("returns the default document when the key holds %s", (_label, stored) => {
    window.localStorage.setItem(STORAGE_KEY, stored);

    expect(readState()).toStrictEqual(defaultState());
  });

  it("returns the default document when localStorage.getItem throws", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(makeDocument()));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(storageDisabled);

    expect(readState()).toStrictEqual(defaultState());
  });
});

describe("writeState", () => {
  it("stores the document as JSON under the app's single key", () => {
    writeState(makeDocument());

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored === null ? null : JSON.parse(stored)).toStrictEqual(makeDocument());
    expect(window.localStorage.length).toBe(1);
  });

  it("does not throw to its caller when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(quotaExceeded);

    expect(() => {
      writeState(makeDocument());
    }).not.toThrow();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("useStateDocument", () => {
  it("loads the stored document after mount", () => {
    writeState(makeDocument());

    const { result } = renderHook(() => useStateDocument());

    expect(result.current.loaded).toBe(true);
    expect(result.current.state).toStrictEqual(makeDocument());
  });

  it("does not overwrite a stored document with the placeholder on mount", () => {
    writeState(makeDocument());

    renderHook(() => useStateDocument());

    expect(readState()).toStrictEqual(makeDocument());
  });

  it("writes every change back to storage", () => {
    const { result } = renderHook(() => useStateDocument());

    act(() => {
      result.current.setState((current) => ({
        ...current,
        flaggedTopicIds: ["prep-work-long"],
      }));
    });

    expect(result.current.state.flaggedTopicIds).toStrictEqual(["prep-work-long"]);
    expect(readState().flaggedTopicIds).toStrictEqual(["prep-work-long"]);
  });

  it("keeps the in-memory change when saving it fails", () => {
    const { result } = renderHook(() => useStateDocument());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(quotaExceeded);

    act(() => {
      result.current.setState((current) => ({ ...current, level: "B2" }));
    });

    expect(result.current.state.level).toBe("B2");
  });

  it("shares one document between every component using it", () => {
    const first = renderHook(() => useStateDocument());
    const second = renderHook(() => useStateDocument());

    act(() => {
      first.result.current.setState(makeDocument());
    });

    expect(second.result.current.state).toStrictEqual(makeDocument());
  });

  it("re-reads storage once every component using it has unmounted", () => {
    const { unmount } = renderHook(() => useStateDocument());
    unmount();
    writeState(makeDocument());

    const { result } = renderHook(() => useStateDocument());

    expect(result.current.state).toStrictEqual(makeDocument());
  });

  it("re-reads storage when setState is called with no consumer mounted", () => {
    const { result, unmount } = renderHook(() => useStateDocument());
    const { setState } = result.current;
    unmount();

    setState(makeDocument());
    // A second write made directly, as another tab would, after our own
    // setState call above: only distinguishes a retained stale `current`
    // from a cleared one, since the two writes produce different documents.
    writeState({ ...makeDocument(), level: "B2" });

    const { result: remounted } = renderHook(() => useStateDocument());

    expect(remounted.current.state.level).toBe("B2");
  });

  it("picks up a change another tab makes while mounted", () => {
    const { result } = renderHook(() => useStateDocument());

    act(() => {
      writeState(makeDocument());
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

    expect(result.current.state).toStrictEqual(makeDocument());

    act(() => {
      result.current.setState((current) => ({ ...current, level: "B2" }));
    });

    expect(readState()).toStrictEqual({ ...makeDocument(), level: "B2" });
  });

  it("renders the default document, not yet loaded, on the server", () => {
    writeState(makeDocument());

    function Probe(): React.JSX.Element {
      const { state, loaded } = useStateDocument();
      return <p>{`${state.level}:${String(loaded)}`}</p>;
    }

    expect(renderToString(<Probe />)).toBe("<p>B1:false</p>");
  });
});
