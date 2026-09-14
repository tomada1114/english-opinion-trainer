import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTopics } from "../src/core/content/index";
import { UNIT_IDS } from "../src/core/drill";
import { LOCALES } from "../src/i18n/locales";
import { MESSAGES } from "../src/i18n/messages";

// The only suite that asks the application a question over HTTP. Every other
// test here drives one layer through its own surface — a handler with
// `new Request()`, `src/proxy.ts` as a bare function, a page under jsdom — so
// nothing else notices when the seams between them come apart: a proxy at a
// path Next.js does not load, a Route Handler the App Router never mounts, a
// layout that renders under jsdom and throws in a real render. This starts the
// built application the way a deployment does — the production build, served by
// `next start` under `NODE_ENV=production` — and asserts only what a client
// outside the process can see.
//
// No browser and no E2E harness, deliberately: `next start` plus `fetch` needs
// neither, and issue #12's decision to take on neither still stands.

/** The repository root, whose `.next` build `next start` serves. */
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** The manifest that records the routes Next.js rendered during the build. */
const prerenderManifestPath = path.join(repoRoot, ".next", "prerender-manifest.json");

/** The `next` CLI, run through this process's own Node rather than a shell. */
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");

/** How long `next start` gets to accept its first connection. */
const READY_TIMEOUT_MS = 60_000;

/** How long between readiness attempts. */
const POLL_INTERVAL_MS = 100;

/** How long a `SIGTERM`ed server gets to exit before it is killed outright. */
const SHUTDOWN_GRACE_MS = 5_000;

/**
 * Everything `pnpm build` reads that changes what the served application does.
 *
 * @remarks
 * Compared against `.next/BUILD_ID`'s timestamp, which is why this list is
 * paths rather than a glob: it is walked, not matched. `pnpm build` writes
 * nothing under any of them — it writes `.next/` and `next-env.d.ts` — so a
 * source newer than the build means the build is not of that source.
 */
const BUILD_INPUTS = ["src", "messages", "next.config.ts"];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** The most recent modification time anywhere under a repository-relative path. */
function newestMtimeMs(target: string): number {
  const absolute = path.join(repoRoot, target);
  const root = statSync(absolute);
  if (!root.isDirectory()) {
    return root.mtimeMs;
  }
  // Directories count too: adding or removing a file changes only the
  // directory's own timestamp, and a build missing a whole new page is exactly
  // the staleness this guard is for.
  let newest = root.mtimeMs;
  for (const entry of readdirSync(absolute, {
    recursive: true,
    withFileTypes: true,
  })) {
    const { mtimeMs } = statSync(path.join(entry.parentPath, entry.name));
    if (mtimeMs > newest) {
      newest = mtimeMs;
    }
  }
  return newest;
}

/**
 * Fail unless `.next` holds a build of the source that is on disk right now.
 *
 * @remarks
 * The suite runs after `pnpm build`, never instead of it — see `package.json`'s
 * `check:source` and ci.yml's `static` job, which each build exactly once and
 * then call `pnpm run test:smoke`. Both halves are checked because the missing
 * build and the stale one fail differently: the first turns Next.js's "Could
 * not find a production build" into an instruction, and the second is the one
 * that would otherwise pass. A `.next/` from an earlier commit answers every
 * assertion below happily, about code that is no longer here — the false
 * confidence this guard exists to prevent.
 */
function assertFreshBuild(): void {
  const buildId = path.join(repoRoot, ".next", "BUILD_ID");
  if (!existsSync(buildId)) {
    throw new Error(
      "This suite serves the output of `pnpm build`, which is missing. Run `pnpm build` first, or run `pnpm run test:smoke`, which check:source and ci.yml both call after the build.",
    );
  }

  const builtAtMs = statSync(buildId).mtimeMs;
  const changed = BUILD_INPUTS.filter((input) => newestMtimeMs(input) > builtAtMs);
  if (changed.length > 0) {
    throw new Error(
      `This suite serves the output of \`pnpm build\`, and ${changed.join(", ")} changed after that build was written. Run \`pnpm build\` again: a build of code that is no longer here would pass these assertions without asserting anything about the change.`,
    );
  }
}

/** Read the build's static route table without trusting its JSON shape. */
function readPrerenderedRoutes(): object {
  const manifest: unknown = JSON.parse(readFileSync(prerenderManifestPath, "utf8"));
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("routes" in manifest) ||
    typeof manifest.routes !== "object" ||
    manifest.routes === null
  ) {
    throw new TypeError("`.next/prerender-manifest.json` must contain a routes object");
  }
  return manifest.routes;
}

/**
 * A TCP port nothing is listening on.
 *
 * @remarks
 * The port is asked of the operating system rather than written down, so two
 * checkouts of this repository — or a developer's own `pnpm dev` — can run at
 * the same time without one failing on `EADDRINUSE`. `next start` is given the
 * number after the probe releases it; the window in between is why the probe
 * binds the same loopback address the server will, and why readiness is not
 * decided by an HTTP response alone — see {@link waitUntilServing}.
 */
async function reserveEphemeralPort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  if (address === null || typeof address === "string") {
    throw new TypeError("the probe server reported no TCP address to read a port from");
  }
  probe.close();
  await once(probe, "close");
  return address.port;
}

/**
 * Signal the whole process group the server was started in.
 *
 * @remarks
 * A negative pid addresses the group, which `detached: true` gave the child of
 * its own. `next start` is a CLI that goes on to run the server, and killing
 * only the pid Node knows about is what leaves a listening process behind on a
 * developer's machine after a failed run.
 */
function signalServerGroup(server: ChildProcess, signal: NodeJS.Signals): void {
  const { pid } = server;
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is already gone, or the platform refused the negative pid.
    server.kill(signal);
  }
}

/** The signals a run is interrupted with, rather than finished by. */
const INTERRUPT_SIGNALS = ["SIGINT", "SIGTERM"] as const;

/**
 * Kill the server group if this process is interrupted, and return the undo.
 *
 * @remarks
 * `detached: true` is what makes the group killable at all, but it is also what
 * takes the child out of the terminal's foreground process group: a Ctrl-C
 * during a run never reaches `next start` on its own, and Vitest does not
 * promise `afterAll` runs on the way out. So the leak `detached` closes on the
 * normal path is one it would open on the interrupted path, and this closes it
 * back. `SIGKILL` rather than `SIGTERM` because a signal handler has no way to
 * wait for a graceful exit.
 *
 * Re-raising is conditional on this being the only listener for that signal:
 * adding one suppresses Node's default termination, so with no other listener
 * the run would hang on Ctrl-C, and with one — Vitest's own — re-raising would
 * drive it twice.
 */
function killServerGroupWhenInterrupted(server: ChildProcess): () => void {
  const registered: { signal: NodeJS.Signals; handler: () => void }[] = [];

  function remove(): void {
    for (const { signal, handler } of registered) {
      process.off(signal, handler);
    }
    registered.length = 0;
  }

  for (const signal of INTERRUPT_SIGNALS) {
    const wasAlreadyHandled = process.listenerCount(signal) > 0;
    const handler = (): void => {
      remove();
      signalServerGroup(server, "SIGKILL");
      if (!wasAlreadyHandled) {
        process.kill(process.pid, signal);
      }
    };
    registered.push({ signal, handler });
    process.on(signal, handler);
  }

  return remove;
}

/** Stop the server, whether the suite passed or failed. */
async function stopServer(server: ChildProcess): Promise<void> {
  if (
    server.pid === undefined ||
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }
  const closed = once(server, "close");
  signalServerGroup(server, "SIGTERM");
  const outcome = await Promise.race([
    closed.then(() => "closed" as const),
    delay(SHUTDOWN_GRACE_MS).then(() => "still running" as const),
  ]);
  if (outcome === "still running") {
    signalServerGroup(server, "SIGKILL");
    await closed;
  }
}

let server: ChildProcess | undefined;
let stopWatchingForInterrupts: (() => void) | undefined;
let baseUrl = "";

/**
 * Wait until the spawned server — and not merely something on that port — is
 * answering.
 *
 * @remarks
 * A poll with a deadline, not a fixed wait: how long `next start` takes to
 * listen is a property of the machine, so a sleep long enough to be reliable on
 * CI would be time every local run pays. Fake timers cannot stand in here —
 * what is being waited on is a real process binding a real socket.
 *
 * The child's own report of the address it bound gates the first `fetch`,
 * because the port was released by {@link reserveEphemeralPort} before this
 * child was told to take it: something else winning that race and answering
 * HTTP would otherwise satisfy a bare `fetch` and let every assertion below run
 * against a foreign server. Only one process can hold a TCP port, so a child
 * that printed this address is the one behind it. The cost is a dependence on
 * what the CLI prints; when that changes, the failure carries the output it did
 * print, which is the thing a reader needs.
 */
async function waitUntilServing(
  child: ChildProcess,
  port: number,
  readOutput: () => string,
  readSpawnFailure: () => Error | undefined,
): Promise<void> {
  const boundAddress = `127.0.0.1:${String(port)}`;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    // Read off the child rather than a flag of this suite's own: a server that
    // failed to start answers nothing, and waiting out the whole deadline for
    // it would hide the reason it is holding in the collected output.
    const spawnFailure = readSpawnFailure();
    if (spawnFailure !== undefined) {
      throw new Error(
        `\`next start\` could not be spawned (${spawnFailure.message}):\n${readOutput()}`,
      );
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `\`next start\` exited before it accepted a connection:\n${readOutput()}`,
      );
    }
    if (readOutput().includes(boundAddress)) {
      try {
        await fetch(baseUrl, { redirect: "manual" });
        return;
      } catch {
        // Announced, not yet accepting.
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `\`next start\` did not serve ${boundAddress} within ${String(READY_TIMEOUT_MS)}ms:\n${readOutput()}`,
      );
    }
    await delay(POLL_INTERVAL_MS);
  }
}

beforeAll(async () => {
  assertFreshBuild();

  const port = await reserveEphemeralPort();
  baseUrl = `http://127.0.0.1:${String(port)}`;

  const started = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: repoRoot,
      // `NODE_ENV` is set rather than inherited: Vitest defaults it to `test`,
      // and Next.js's CLI only fills the variable in when it is absent, so the
      // production build would otherwise be served under `test` and every
      // `process.env.NODE_ENV === "production"` branch would take a path no
      // deployment takes. `ANTHROPIC_API_KEY` is blanked rather than inherited
      // so a machine exporting a real key never bills a provider from this
      // suite; blank, not deleted, because Next.js fills an absent variable
      // from a local `.env` but leaves one that is set alone.
      env: { ...process.env, NODE_ENV: "production", ANTHROPIC_API_KEY: "" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  server = started;
  stopWatchingForInterrupts = killServerGroupWhenInterrupted(started);

  // Kept so a server that dies on start-up reports why, instead of this suite
  // reporting only that nothing ever answered.
  let output = "";
  const collect = (chunk: Buffer): void => {
    output += chunk.toString("utf8");
  };
  started.stdout.on("data", collect);
  started.stderr.on("data", collect);

  // An `error` on a `ChildProcess` nobody is listening to is thrown as an
  // uncaught exception, which on a loaded runner (`EAGAIN`, `EMFILE`) would
  // kill this worker with an opaque stack instead of the report above.
  let spawnFailure: Error | undefined;
  started.on("error", (error: Error) => {
    spawnFailure = error;
  });

  await waitUntilServing(
    started,
    port,
    () => output,
    () => spawnFailure,
  );
});

afterAll(async () => {
  stopWatchingForInterrupts?.();
  stopWatchingForInterrupts = undefined;
  if (server !== undefined) {
    await stopServer(server);
    server = undefined;
  }
});

// Node's `fetch` sends no `Sec-Fetch-Site` of its own, so the accepted case
// sets it by hand to take the path a real same-origin browser request takes,
// and the rejected one shows the header is what decides it.
describe("POST /api/feedback, served by `next start`", () => {
  const body = JSON.stringify({
    topicId: getTopics()[0]?.id,
    answer: "I recommend Kyoto because its old temples are beautiful.",
    level: "B1",
  });

  // The server was started with no key, so reaching the wired adapter shows up
  // as its `ERR_LLM_AUTH` — which is also what proves a missing key is a
  // per-request failure rather than one that stops `next start` booting.
  it("passes a same-origin request through to the adapter, which reports the missing key", async () => {
    const response = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
      body,
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_LLM_AUTH" },
    });
  });

  it("rejects a request with no Sec-Fetch-Site header with 403", async () => {
    const response = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_FORBIDDEN_ORIGIN" },
    });
  });
});

describe("the built application, served by `next start`", () => {
  it("prerenders every shipped locale", () => {
    const routes = readPrerenderedRoutes();

    for (const locale of LOCALES) {
      expect(routes).toHaveProperty(`/${locale}`);
    }
  });

  it("prerenders every unit's drill page in every shipped locale", () => {
    const routes = readPrerenderedRoutes();

    for (const locale of LOCALES) {
      for (const unit of UNIT_IDS) {
        expect(routes).toHaveProperty([`/${locale}/units/${String(unit)}`]);
      }
    }
  });

  it.each(LOCALES)("serves /%s/phrases as the phrase list page", async (locale) => {
    const response = await fetch(`${baseUrl}/${locale}/phrases`, {
      redirect: "manual",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const document = await response.text();
    expect(document).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`));
    expect(document).toContain(`<h1>${MESSAGES[locale].Phrases.title}</h1>`);
  });

  it.each(LOCALES)("serves /%s/units/1 as the drill page", async (locale) => {
    const response = await fetch(`${baseUrl}/${locale}/units/1`, {
      redirect: "manual",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const document = await response.text();
    expect(document).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`));
    expect(document).toMatch(/<h1>Unit 1<\/h1>/);
    expect(document).toMatch(
      new RegExp(
        `<link(?=[^>]*rel="canonical")(?=[^>]*href="[^"]*/${locale}/units/1")[^>]*>`,
      ),
    );
  });

  it.each(["0", "5", "01", "one"])(
    "404s for /en/units/%s, a segment that names no unit",
    async (unitId) => {
      const response = await fetch(`${baseUrl}/en/units/${unitId}`, {
        redirect: "manual",
      });

      expect(response.status).toBe(404);
    },
  );

  it("redirects a path with no locale prefix to one that has it", async () => {
    const response = await fetch(baseUrl, {
      redirect: "manual",
      headers: { "accept-language": "en" },
    });

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location ?? "", baseUrl).pathname).toBe("/en");
  });

  it.each(LOCALES)(
    "serves /%s as a document with localized metadata",
    async (locale) => {
      const response = await fetch(`${baseUrl}/${locale}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      // `<html lang>` is rendered by `src/app/[locale]/layout.tsx`, an async
      // Server Component no other test in this repository renders.
      const document = await response.text();
      expect(document).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`));
      expect(document).toContain(`<title>${MESSAGES[locale].Metadata.title}</title>`);
      expect(document).toContain(
        `<meta name="description" content="${MESSAGES[locale].Metadata.description}"`,
      );
      expect(document).toMatch(
        new RegExp(
          `<link(?=[^>]*rel="canonical")(?=[^>]*href="[^"]*/${locale}")[^>]*>`,
        ),
      );
      // No `rel="alternate"` link: with one shipped locale there is no other
      // version to point at. See `src/app/[locale]/layout.tsx`'s
      // `generateMetadata`.
      expect(document).not.toMatch(/<link[^>]*rel="alternate"/);
    },
  );

  // Issue #26: the app is English-only for now, and `/ja` is what proves it —
  // a request for a locale this app no longer ships redirects to the default
  // locale (see tests/proxy.test.ts) and then 404s there, rather than
  // rendering a Japanese page.
  it("404s for /ja, the locale this app no longer ships", async () => {
    const response = await fetch(`${baseUrl}/ja`);

    expect(response.status).toBe(404);
  });

  // The two halves of "an unknown route 404s" are asserted apart, and both with
  // `redirect: "manual"`, because following the redirect merges them: a single
  // `fetch("/no-such-page")` reports the 404 of `/en/no-such-page` and passes
  // just as happily if the proxy stopped running and the unprefixed path 404d
  // on its own — one of the failures this suite exists to catch.
  it("redirects an unknown path with no locale prefix rather than 404ing it", async () => {
    const response = await fetch(`${baseUrl}/no-such-page`, {
      redirect: "manual",
      headers: { "accept-language": "en" },
    });

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location ?? "", baseUrl).pathname).toBe("/en/no-such-page");
  });

  it.each(LOCALES)(
    "serves /%s/no-such-page as a localized 404 document",
    async (locale) => {
      const response = await fetch(`${baseUrl}/${locale}/no-such-page`, {
        redirect: "manual",
      });

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("text/html");

      const document = await response.text();
      expect(document.match(/<html\b/g)).toHaveLength(1);
      expect(document.match(/<body\b/g)).toHaveLength(1);
      expect(document).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`));
      expect(document).toContain(MESSAGES[locale].NotFound.title);
      expect(document).toContain(MESSAGES[locale].NotFound.description);
      expect(document).toContain(MESSAGES[locale].NotFound.homeLink);
    },
  );
});

// Issue #81: `src/app/globals.css` hand-binds shadcn/ui's colour vocabulary to
// this app's semantic tokens, and nothing but a real stylesheet proves the
// binding is right — jsdom, which every other suite runs under, never applies
// CSS at all. This fetches the page, follows its `<link rel="stylesheet">`,
// and asserts the served CSS by custom-property *name*, never by a resolved
// colour value: `check_contrast.py` already measures colour, and a value
// asserted here would have to be edited every time a token moves.
describe("the design token layer, served by `next start`", () => {
  let css = "";

  beforeAll(async () => {
    const page = await fetch(`${baseUrl}/en`);
    const document = await page.text();
    const stylesheetLink = document
      .match(/<link[^>]*>/g)
      ?.find((tag) => tag.includes('rel="stylesheet"'));
    const stylesheetHref = stylesheetLink?.match(/href="([^"]+)"/)?.[1];
    if (stylesheetHref === undefined) {
      throw new Error(
        `no <link rel="stylesheet"> found in the document served for /en:\n${document}`,
      );
    }

    const stylesheet = await fetch(new URL(stylesheetHref, baseUrl));
    css = await stylesheet.text();
  });

  it.each(["--color-bg", "--color-text", "--color-primary", "--color-focus"])(
    "declares %s",
    (token) => {
      expect(css).toMatch(new RegExp(`${token}:`));
    },
  );

  // The one binding whose inversion is invisible: shadcn's vocabulary calls
  // `accent` a hover surface, not the primary colour, and swapping the two
  // would paint every hovered row blue without failing the build or a jsdom
  // test.
  it("binds shadcn's --color-accent to the hover surface, not the primary colour", () => {
    expect(css).toMatch(/--color-accent:\s*var\(--color-surface-hover\)/);
    expect(css).not.toMatch(/--color-accent:\s*var\(--color-primary\)/);
  });

  it("binds shadcn's --color-primary-foreground to --color-text-on-primary", () => {
    expect(css).toMatch(/--color-primary-foreground:\s*var\(--color-text-on-primary\)/);
  });

  it("sets color-scheme to light dark, OS-following", () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
  });
});
