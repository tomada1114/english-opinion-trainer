import { defaultState, migrateState, type StateDocument } from "../../core/state";

/** The one `localStorage` key the whole state document lives under. */
const STORAGE_KEY = "english-opinion-trainer";

/**
 * The stored state document, or {@link defaultState} when nothing readable is
 * stored.
 *
 * @remarks
 * Never throws. `localStorage` itself can throw on access (a browser with
 * storage disabled, some private-browsing modes) and is absent outside a
 * browser; the stored string can be malformed JSON or an unreadable document.
 * Every one of those is an empty drill for the learner, not a crashed page.
 */
export function readState(): StateDocument {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? defaultState() : migrateState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

/**
 * Stores `state` under the app's key.
 *
 * @remarks
 * Never throws. A failed save — quota exceeded, storage disabled — must not
 * crash the page mid-drill; the in-memory state the caller already holds stays
 * correct for the rest of the session, and only persistence is lost.
 */
export function writeState(state: StateDocument): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Deliberately swallowed: see the remarks above.
  }
}
