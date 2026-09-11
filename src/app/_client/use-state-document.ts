"use client";

import { type SetStateAction, useSyncExternalStore } from "react";

import { defaultState, type StateDocument } from "../../core/state";
import { readState, STORAGE_KEY, writeState } from "./storage";

/**
 * The one in-memory copy of the document every mounted {@link useStateDocument}
 * shares, or `undefined` while nothing is mounted.
 *
 * @remarks
 * Shared rather than per component, so two components reading the document
 * cannot each hold a copy and overwrite the other's change on save. While at
 * least one consumer is mounted, a window `storage` event — another tab
 * writing the same key, or clearing storage — re-reads it here and notifies
 * every listener, so an open tab picks up what another tab saved instead of
 * overwriting it on its next change. It is dropped once the last consumer
 * unmounts, and also right after a change made with none mounted, so the next
 * mount always re-reads storage rather than reusing a copy no one was there
 * to keep in sync.
 */
let current: StateDocument | undefined;
const listeners = new Set<() => void>();

/** What the server render and the hydrating render see: storage is unreadable there. */
const SERVER_SNAPSHOT: StateDocument = defaultState();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Re-reads storage and notifies every consumer when another tab changes the
 * app's key, or clears storage entirely (`event.key === null`).
 */
function handleStorageEvent(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) {
    return;
  }
  current = readState();
  notifyListeners();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorageEvent);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorageEvent);
      current = undefined;
    }
  };
}

function getSnapshot(): StateDocument {
  current ??= readState();
  return current;
}

function getServerSnapshot(): StateDocument {
  return SERVER_SNAPSHOT;
}

function updateState(action: SetStateAction<StateDocument>): void {
  const next = typeof action === "function" ? action(getSnapshot()) : action;
  current = next;
  writeState(next);
  notifyListeners();
  if (listeners.size === 0) {
    current = undefined;
  }
}

function subscribeToNothing(): () => void {
  return () => undefined;
}

/** What {@link useStateDocument} hands a component. */
export interface StateDocumentHandle {
  /** The current document; {@link defaultState} until `loaded` is true. */
  readonly state: StateDocument;
  /**
   * Whether `state` came from storage. The server render and the hydrating
   * render cannot read `localStorage`, so there `state` is only a placeholder,
   * and a consumer deciding anything from progress waits for this.
   */
  readonly loaded: boolean;
  /**
   * Replaces the document for every consumer and writes it to storage. A failed
   * write keeps the change in memory for as long as a consumer stays mounted.
   */
  readonly setState: (action: SetStateAction<StateDocument>) => void;
}

/**
 * The persisted state document, read from storage when a component first needs
 * it and written back on every change.
 *
 * @remarks
 * Built on `useSyncExternalStore` rather than a `useState` filled by an
 * effect: the server snapshot keeps hydration matching the server render, and
 * the stored document replaces it without an effect that sets state.
 */
export function useStateDocument(): StateDocumentHandle {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const loaded = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  return { state, loaded, setState: updateState };
}
