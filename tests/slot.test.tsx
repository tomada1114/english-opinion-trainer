import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slot } from "../src/app/_client/ui/slot";

describe("Slot", () => {
  it("clones its single child instead of wrapping it in an extra element", () => {
    render(
      <Slot data-testid="slot-target">
        <a href="/">Start a unit</a>
      </Slot>,
    );

    const link = screen.getByRole("link", { name: "Start a unit" });
    expect(link).toHaveAttribute("data-testid", "slot-target");
    expect(link.tagName).toBe("A");
  });

  it("merges className so the incoming class wins over the child's own", () => {
    render(
      <Slot className="incoming">
        <a href="/" className="existing">
          Start a unit
        </a>
      </Slot>,
    );

    const link = screen.getByRole("link", { name: "Start a unit" });
    expect(link.className).toContain("incoming");
  });

  it("forwards arbitrary props onto the child, letting them override its own", () => {
    const handleClick = vi.fn();
    render(
      <Slot onClick={handleClick} aria-label="override">
        <a href="/" aria-label="original">
          Start a unit
        </a>
      </Slot>,
    );

    const link = screen.getByRole("link", { name: "override" });
    link.click();
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("throws when the child is not a single valid React element", () => {
    // Suppress the error boundary noise React logs for a thrown render.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Slot>{"just text"}</Slot>)).toThrow(
      "Slot expects a single React element as its child.",
    );

    consoleError.mockRestore();
  });
});
