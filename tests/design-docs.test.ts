import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const designSystemPath = path.join(repoRoot, "docs", "design", "design-system.md");
const tokensPointerPath = path.join(repoRoot, "docs", "design", "tokens.css");
const globalsPath = path.join(repoRoot, "src", "app", "globals.css");
const uiDirectory = path.join(repoRoot, "src", "app", "_client", "ui");

function readText(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function listedColourTokens(source: string): Set<string> {
  const section = /## Colour tokens\n([\s\S]*?)(?=\n## )/u.exec(source)?.[1] ?? "";
  return new Set(
    [...section.matchAll(/^\|[^\n]*$/gmu)].flatMap(([row = ""]) =>
      [...row.matchAll(/`(--color-[\w-]+)`/gu)].map(([, token = ""]) => token),
    ),
  );
}

function definedColourTokens(source: string): Set<string> {
  return new Set(
    [...source.matchAll(/^[ \t]*(--color-[\w-]+)[ \t]*:/gmu)].map(
      ([, token = ""]) => token,
    ),
  );
}

function inventoryComponents(source: string): Set<string> {
  const section =
    /## Component inventory\n([\s\S]*?)(?=\n## Colour tokens)/u.exec(source)?.[1] ?? "";
  return new Set(
    [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gmu)].map(
      ([, component = ""]) => component,
    ),
  );
}

function componentName(fileName: string): string {
  return fileName
    .replace(/\.tsx$/u, "")
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

const designSystem = readText(designSystemPath);
const globals = readText(globalsPath);

describe("design documentation stays aligned with the shipped UI", () => {
  it("documents exactly the semantic colour tokens defined by globals.css", () => {
    expect([...listedColourTokens(designSystem)].sort()).toEqual(
      [...definedColourTokens(globals)].sort(),
    );
  });

  it("lists every shared UI component in the design inventory", () => {
    const documented = inventoryComponents(designSystem);
    const components = readdirSync(uiDirectory)
      .filter((fileName) => fileName.endsWith(".tsx"))
      .map(componentName)
      .sort();

    expect(components.filter((name) => !documented.has(name))).toEqual([]);
  });

  it("keeps the legacy token path as a pointer rather than a second declaration layer", () => {
    expect(readText(tokensPointerPath)).not.toMatch(/^[ \t]*--color-[\w-]+[ \t]*:/gmu);
  });
});
