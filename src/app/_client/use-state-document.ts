"use client";

import { type SetStateAction, useSyncExternalStore } from "react";

import { defaultState, type StateDocument } from "../../core/state";
import { readState, writeState } from "./storage";

/**
 * The one in-memory copy of the document every mounted {@link useStateDocument}
 * shares, or `undefined` while nothing is mounted.
 *
 * @remarks
 * Shared rather than per component, so two components reading the document
 * cannot each hold a copy and overwrite the other's change on save. It is
 * dropped once the last consumer unmounts, so the next mount re-reads storage —
 * which another tab may have changed in the meantime.
 */
let current: StateDocument | undefined;
const listeners = new Set<() => void>();

/** What the server render and the hydrating render see: storage is unreadable there. */
const SERVER_SNAPSHOT: StateDocument = defaultState();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
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
  for (const listener of listeners) {
    listener();
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
