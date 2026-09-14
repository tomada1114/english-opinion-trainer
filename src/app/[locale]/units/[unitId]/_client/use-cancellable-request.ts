import { useEffect, useRef } from "react";

/**
 * One `AbortController` at a time for a component that sends requests it may
 * need to give up on — cancelled by the reader, or abandoned because the
 * component itself is gone.
 *
 * @remarks
 * The controller lives in a ref rather than state: starting or cancelling a
 * request is bookkeeping, not something the render output depends on, so
 * neither should trigger a render. The unmount cleanup aborts whatever
 * request is still open, which is what keeps a response that resolves after
 * the caller is gone from reaching a `setState` on it.
 */
export function useCancellableRequest(): {
  /** Starts a new request, superseding any still open, and returns its signal. */
  readonly start: () => AbortSignal;
  /** Aborts the request in flight, if there is one. */
  readonly cancel: () => void;
} {
  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return {
    start: () => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return controller.signal;
    },
    cancel: () => {
      controllerRef.current?.abort();
    },
  };
}
