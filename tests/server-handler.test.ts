import { describe, expect, it, vi } from "vitest";
import type * as z from "zod";

import {
  createFakeLlmPort,
  type LlmError,
  type LlmErrorCode,
  type LlmPort,
  type LlmRequest,
} from "../src/ai/index";
import { POST } from "../src/app/api/feedback/route";
import { buildFeedbackPrompt } from "../src/core/feedback-prompt";
import type { Result } from "../src/core/result";
import { feedbackHandler } from "../src/server/composition";
import { createFeedbackHandler } from "../src/server/handlers/feedback";

/**
 * The origin a `Request` needs to be constructible.
 *
 * @remarks
 * Nothing in the handler reads it, but `new Request()` rejects a relative URL.
 */
const ENDPOINT = "http://localhost/api/feedback";

/** The headers a same-origin browser `fetch` of this endpoint carries. */
const SAME_ORIGIN_JSON = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
};

/**
 * Two topics from `src/core/content/topics.json`, written out rather than read,
 * so a case asserts against what the data says rather than what a lookup did.
 */
const SHORT_TOPIC = {
  id: "prep-travel-short",
  structure: "prep",
  mode: "short",
  text: "What is one place you would recommend to a friend visiting your country?",
} as const;
const LONG_TOPIC = {
  id: "concession-technology-long",
  structure: "concession",
  mode: "long",
  text: "Do you agree that smartphones make people less social?",
} as const;

/**
 * The two answer ceilings a caller is promised, written out rather than
 * imported: importing them would make every boundary case agree with the
 * implementation by construction.
 */
const SHORT_CEILING = 400;
const LONG_CEILING = 1_200;
const MAX_REQUEST_BODY_BYTES = 65_536;

const FIX = {
  before: "It is good.",
  after: "It is worth a visit.",
  why: "Be specific.",
};
const GRAMMAR = {
  excerpt: "a friends",
  correction: "a friend",
  note: "Singular noun.",
};

/** A well-formed answer for {@link SHORT_TOPIC}'s shape: `prep` × `short`. */
const SHORT_FEEDBACK = {
  structure: {
    point: { verdict: "present", reason: "Kyoto is named first." },
    reason: { verdict: "weak", reason: "The reason is vague." },
  },
  fixes: [FIX],
  rewrite: "I recommend Kyoto. Its old temples are beautiful.",
  grammar: [GRAMMAR],
};

/** A well-formed answer for {@link LONG_TOPIC}'s shape: `concession` × `long`. */
const LONG_FEEDBACK = {
  structure: {
    acknowledgement: { verdict: "present", reason: "The other side is granted." },
    opinion: { verdict: "present", reason: "The stance is clear." },
    reason: { verdict: "absent", reason: "No reason is given." },
  },
  fixes: [FIX],
  rewrite:
    "Smartphones help us keep in touch. Still, I think they make us less social.",
  grammar: [],
};

/** What the port was asked, as the handler passed it on. */
interface CapturedRequest {
  readonly prompt: string;
  readonly outputLanguage: string;
  readonly signal: AbortSignal | undefined;
}

/**
 * Wraps a port so a test can assert on what the handler asked it.
 *
 * @remarks
 * A recording wrapper rather than a mock: the request still reaches a real
 * fake port and comes back through the same code path.
 */
function capturing(inner: LlmPort, seen: CapturedRequest[]): LlmPort {
  return {
    generate<TSchema extends z.ZodType>(
      request: LlmRequest<TSchema>,
    ): Promise<Result<z.infer<TSchema>, LlmError>> {
      seen.push({
        prompt: request.prompt,
        outputLanguage: request.outputLanguage,
        signal: request.signal,
      });
      return inner.generate(request);
    },
  };
}

/** A handler over a fake answering `response`, and the record of what it was asked. */
function handlerAnswering(
  response: unknown,
  notices: string[] = [],
): { handler: (request: Request) => Promise<Response>; seen: CapturedRequest[] } {
  const seen: CapturedRequest[] = [];
  return {
    handler: createFeedbackHandler({
      llm: capturing(createFakeLlmPort({ response }), seen),
      log: (message) => notices.push(message),
    }),
    seen,
  };
}

/** A `POST` carrying `body` verbatim, however malformed, with `headers`. */
function postRequest(
  body: string,
  headers: Record<string, string> = SAME_ORIGIN_JSON,
  init: RequestInit = {},
): Request {
  return new Request(ENDPOINT, { method: "POST", headers, body, ...init });
}

/** A same-origin `POST` of a well-formed body, with `overrides` merged in. */
function feedbackRequest(overrides: Record<string, unknown> = {}): Request {
  return postRequest(
    JSON.stringify({
      topicId: SHORT_TOPIC.id,
      answer: "I recommend Kyoto because it is beautiful.",
      level: "B1",
      ...overrides,
    }),
  );
}

/**
 * `RequestInit` with the field Node requires alongside a streaming body, which
 * TypeScript's DOM `RequestInit` does not declare.
 */
type StreamingRequestInit = RequestInit & { readonly duplex: "half" };

/** A `POST` whose body stream fails partway through, as a dropped upload does. */
function postRequestThatFailsMidBody(): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"topicId":"prep-tra'));
      controller.error(new Error("connection reset"));
    },
  });
  const init: StreamingRequestInit = {
    method: "POST",
    headers: SAME_ORIGIN_JSON,
    body: stream,
    duplex: "half",
  };
  return new Request(ENDPOINT, init);
}

/**
 * A well-formed request body padded out to exactly `bytes` bytes, in a property
 * the schema does not declare — no legal answer can fill a body on its own.
 */
function bodyOfBytes(bytes: number): string {
  const fields = { topicId: SHORT_TOPIC.id, answer: "I recommend Kyoto.", level: "B1" };
  const envelope = JSON.stringify({ ...fields, padding: "" });
  return JSON.stringify({ ...fields, padding: "a".repeat(bytes - envelope.length) });
}

describe("the feedback handler's same-origin gate", () => {
  it.each([
    ["no Sec-Fetch-Site header", undefined],
    ["cross-site", "cross-site"],
    ["same-site", "same-site"],
    ["none", "none"],
    ["an empty value", ""],
  ])("rejects %s with 403 before reading the body", async (_label, site) => {
    const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (site !== undefined) {
      headers["sec-fetch-site"] = site;
    }
    const request = postRequest("not json at all", headers);

    const response = await handler(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_FORBIDDEN_ORIGIN",
        message:
          "This endpoint answers only same-origin requests from this app's own pages.",
      },
    });
    expect(request.bodyUsed).toBe(false);
    expect(seen).toStrictEqual([]);
  });

  it("answers a request whose Sec-Fetch-Site is same-origin", async () => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(feedbackRequest());

    expect(response.status).toBe(200);
  });
});

describe("the feedback handler", () => {
  it("answers with the topic echoed beside the model's feedback", async () => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(feedbackRequest({ level: "A2" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toStrictEqual({
      topicId: "prep-travel-short",
      structure: "prep",
      mode: "short",
      level: "A2",
      feedback: SHORT_FEEDBACK,
    });
  });

  it("answers a long topic with its own mode and element set", async () => {
    const { handler } = handlerAnswering(LONG_FEEDBACK);

    const response = await handler(feedbackRequest({ topicId: LONG_TOPIC.id }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      topicId: "concession-technology-long",
      structure: "concession",
      mode: "long",
      level: "B1",
      feedback: LONG_FEEDBACK,
    });
  });

  it.each(["A2", "B1", "B2"])("accepts and echoes level %s", async (level) => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(feedbackRequest({ level }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ level });
  });

  // The fake validates its answer against the schema it is handed, so an
  // answer of another topic's shape failing is what shows the handler asked
  // for the requested topic's own shape.
  it("asks for the requested topic's feedback shape and no other", async () => {
    const { handler } = handlerAnswering(LONG_FEEDBACK);

    const response = await handler(feedbackRequest({ topicId: SHORT_TOPIC.id }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_LLM_INVALID_OUTPUT" },
    });
  });

  it("sends the prompt built from the topic's text and the trimmed answer", async () => {
    const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);

    await handler(feedbackRequest({ answer: "  I recommend Kyoto.\n", level: "B2" }));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.prompt).toBe(
      buildFeedbackPrompt({
        topicText: SHORT_TOPIC.text,
        structure: "prep",
        elements: ["point", "reason"],
        level: "B2",
        mode: "short",
        answer: "I recommend Kyoto.",
      }),
    );
    expect(seen[0]?.prompt).not.toContain(SHORT_TOPIC.id);
  });

  it("always asks the model to write in English", async () => {
    const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);

    await handler(feedbackRequest({ locale: "ja" }));

    expect(seen[0]?.outputLanguage).toBe("en");
  });

  it("forwards the caller's cancellation to the port", async () => {
    const seen: CapturedRequest[] = [];
    const handler = createFeedbackHandler({
      llm: capturing(createFakeLlmPort({ response: SHORT_FEEDBACK }), seen),
      log: () => undefined,
    });
    const controller = new AbortController();

    await handler(
      postRequest(
        JSON.stringify({ topicId: SHORT_TOPIC.id, answer: "Kyoto.", level: "B1" }),
        SAME_ORIGIN_JSON,
        { signal: controller.signal },
      ),
    );
    const forwarded = seen[0]?.signal;
    expect(forwarded?.aborted).toBe(false);

    controller.abort();

    expect(forwarded?.aborted).toBe(true);
  });

  // The abort is raised from inside the port call, after the fake has armed
  // its delay, so no real timer runs and the caller's reason has to survive
  // the handler's `request.signal` hop to arrive on `cause` by identity.
  it("answers a call its caller aborts with 504, keeping the caller's reason", async () => {
    const controller = new AbortController();
    const reason = new Error("the learner closed the tab");
    const outcomes: Result<unknown, LlmError>[] = [];
    const llm: LlmPort = {
      async generate<TSchema extends z.ZodType>(
        request: LlmRequest<TSchema>,
      ): Promise<Result<z.infer<TSchema>, LlmError>> {
        const fake = createFakeLlmPort({ response: SHORT_FEEDBACK, delayMs: 60_000 });
        const pending = fake.generate(request);
        controller.abort(reason);
        const outcome = await pending;
        outcomes.push(outcome);
        return outcome;
      },
    };
    const handler = createFeedbackHandler({ llm, log: () => undefined });

    const response = await handler(
      postRequest(
        JSON.stringify({ topicId: SHORT_TOPIC.id, answer: "Kyoto.", level: "B1" }),
        SAME_ORIGIN_JSON,
        { signal: controller.signal },
      ),
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_LLM_TIMEOUT" },
    });
    const outcome = outcomes[0];
    expect(outcome?.ok).toBe(false);
    if (outcome?.ok === false) {
      expect(outcome.error.cause).toBe(reason);
    }
  });
});

describe("the feedback handler's request validation", () => {
  it("rejects a body that is not JSON", async () => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(postRequest("not json at all"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_BAD_REQUEST",
        message: "The request body is not valid JSON.",
      },
    });
  });

  it.each([
    ["an object with no topicId", { answer: "Kyoto.", level: "B1" }],
    ["an object with no answer", { topicId: SHORT_TOPIC.id, level: "B1" }],
    ["an object with no level", { topicId: SHORT_TOPIC.id, answer: "Kyoto." }],
    ["a non-string answer", { topicId: SHORT_TOPIC.id, answer: 42, level: "B1" }],
    ["a non-string topicId", { topicId: 1, answer: "Kyoto.", level: "B1" }],
    [
      "a level this app does not ship",
      { topicId: SHORT_TOPIC.id, answer: "Hi.", level: "C1" },
    ],
    ["a lowercase level", { topicId: SHORT_TOPIC.id, answer: "Hi.", level: "b1" }],
    [
      "a topicId no topic has",
      { topicId: "no-such-topic", answer: "Hi.", level: "B1" },
    ],
    ["an empty topicId", { topicId: "", answer: "Hi.", level: "B1" }],
    ["an empty answer", { topicId: SHORT_TOPIC.id, answer: "", level: "B1" }],
    [
      "a whitespace-only answer",
      { topicId: SHORT_TOPIC.id, answer: " \t\n ", level: "B1" },
    ],
    ["a JSON array", [{ topicId: SHORT_TOPIC.id, answer: "Hi.", level: "B1" }]],
    ["a bare JSON string", "Kyoto."],
    ["JSON null", null],
  ])(
    "rejects %s with ERR_BAD_REQUEST without reaching the port",
    async (_label, body) => {
      const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);

      const response = await handler(postRequest(JSON.stringify(body)));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "ERR_BAD_REQUEST" },
      });
      expect(seen).toStrictEqual([]);
    },
  );

  it("rejects a body whose stream fails mid-read without reaching the port", async () => {
    const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(postRequestThatFailsMidBody());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
    expect(seen).toStrictEqual([]);
  });

  it("rejects a request that carries no body at all", async () => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(
      new Request(ENDPOINT, { method: "POST", headers: SAME_ORIGIN_JSON }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  it("answers a body of exactly the byte ceiling", async () => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES)));

    expect(response.status).toBe(200);
  });

  it("rejects a body over the byte ceiling without reaching the port", async () => {
    const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES + 1)),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_PAYLOAD_TOO_LARGE" },
    });
    expect(seen).toStrictEqual([]);
  });
});

describe("the feedback handler's answer ceilings", () => {
  it.each([
    [
      "a short topic's answer at its ceiling",
      SHORT_TOPIC.id,
      "a".repeat(SHORT_CEILING),
    ],
    ["a long topic's answer at its ceiling", LONG_TOPIC.id, "a".repeat(LONG_CEILING)],
    [
      "an answer at the ceiling once trimmed",
      SHORT_TOPIC.id,
      `  ${"a".repeat(SHORT_CEILING)}\n`,
    ],
    [
      "a long-mode length on a long topic",
      LONG_TOPIC.id,
      "a".repeat(SHORT_CEILING + 1),
    ],
  ])("accepts %s", async (_label, topicId, answer) => {
    const { handler, seen } = handlerAnswering(
      topicId === LONG_TOPIC.id ? LONG_FEEDBACK : SHORT_FEEDBACK,
    );

    const response = await handler(feedbackRequest({ topicId, answer }));

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it.each([
    [
      "a short topic's answer one over",
      SHORT_TOPIC.id,
      SHORT_CEILING,
      SHORT_CEILING + 1,
    ],
    ["a long topic's answer one over", LONG_TOPIC.id, LONG_CEILING, LONG_CEILING + 1],
  ])(
    "rejects %s with ERR_ANSWER_TOO_LONG without reaching the port",
    async (_label, topicId, ceiling, length) => {
      const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);

      const response = await handler(
        feedbackRequest({ topicId, answer: "a".repeat(length) }),
      );
      const body = await response.text();

      expect(response.status).toBe(400);
      expect(body).toContain("ERR_ANSWER_TOO_LONG");
      expect(body).toContain(String(ceiling));
      expect(seen).toStrictEqual([]);
    },
  );

  // The one place message text is asserted on: a caller learns which
  // constraint it broke and never reads its own input back out of the answer.
  it("names the ceiling without echoing the answer that broke it", async () => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(feedbackRequest({ answer: "hunter2-".repeat(60) }));
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain(String(SHORT_CEILING));
    expect(body).not.toContain("hunter2");
  });
});

describe("the feedback handler's English check", () => {
  it.each([
    ["a Japanese answer", "私は京都をおすすめします。"],
    ["a katakana-only answer", "テスト"],
    [
      "an answer whose kana and kanji outnumber its Latin letters",
      "私はKyotoが好きです",
    ],
  ])(
    "rejects %s with ERR_ANSWER_NOT_ENGLISH without reaching the port",
    async (_l, answer) => {
      const { handler, seen } = handlerAnswering(SHORT_FEEDBACK);

      const response = await handler(feedbackRequest({ answer }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toStrictEqual({
        error: {
          code: "ERR_ANSWER_NOT_ENGLISH",
          message: "The `answer` must be written in English.",
        },
      });
      expect(seen).toStrictEqual([]);
    },
  );

  it.each([
    [
      "an English answer quoting a Japanese word",
      "I recommend Kyoto, or 京都, to everyone.",
    ],
    ["an answer with as many CJK characters as Latin letters", "abc 日本語"],
    ["an English answer with accented letters", "I recommend a café in Kyoto."],
  ])("accepts %s", async (_label, answer) => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(feedbackRequest({ answer }));

    expect(response.status).toBe(200);
  });

  it("checks the length before the language", async () => {
    const { handler } = handlerAnswering(SHORT_FEEDBACK);

    const response = await handler(
      feedbackRequest({ answer: "日".repeat(SHORT_CEILING + 1) }),
    );

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_ANSWER_TOO_LONG" },
    });
  });
});

describe("the feedback handler's port failures", () => {
  it.each([
    ["ERR_LLM_AUTH", 500],
    ["ERR_LLM_RATE_LIMIT", 429],
    ["ERR_LLM_TIMEOUT", 504],
    ["ERR_LLM_INVALID_OUTPUT", 502],
    ["ERR_LLM_UNAVAILABLE", 503],
  ] as const satisfies readonly (readonly [LlmErrorCode, number])[])(
    "reports %s as HTTP %i with a generic message",
    async (code, status) => {
      const handler = createFeedbackHandler({
        llm: createFakeLlmPort({ failWith: code }),
        log: () => undefined,
      });

      const response = await handler(feedbackRequest());

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toStrictEqual({
        error: { code, message: "The language model could not answer this request." },
      });
    },
  );
});

describe("the feedback handler's clamp", () => {
  it("keeps the first two fixes and the first five grammar notes", async () => {
    const fixes = ["one", "two", "three"].map((word) => ({ ...FIX, why: word }));
    const grammar = ["a", "b", "c", "d", "e", "f"].map((note) => ({
      ...GRAMMAR,
      note,
    }));
    const { handler } = handlerAnswering({ ...SHORT_FEEDBACK, fixes, grammar });

    const response = await handler(feedbackRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      feedback: {
        fixes: [
          { ...FIX, why: "one" },
          { ...FIX, why: "two" },
        ],
        grammar: ["a", "b", "c", "d", "e"].map((note) => ({ ...GRAMMAR, note })),
      },
    });
  });

  it("logs a rewrite over the mode's sentence ceiling and still returns it whole", async () => {
    const rewrite = "I recommend Kyoto. It is old. It is calm.";
    const notices: string[] = [];
    const { handler } = handlerAnswering({ ...SHORT_FEEDBACK, rewrite }, notices);

    const response = await handler(feedbackRequest());

    await expect(response.json()).resolves.toMatchObject({ feedback: { rewrite } });
    expect(notices).toHaveLength(1);
  });

  it("logs nothing for a rewrite within the ceiling", async () => {
    const notices: string[] = [];
    const { handler } = handlerAnswering(SHORT_FEEDBACK, notices);

    await handler(feedbackRequest());

    expect(notices).toStrictEqual([]);
  });
});

describe("the composed /api/feedback route", () => {
  it("is the handler composition.ts builds, re-exported as POST", () => {
    expect(POST).toBe(feedbackHandler);
  });

  // Re-imported under a stubbed-out key rather than driven through the static
  // import: the wired adapter reaches a billed provider, and a machine that
  // exports a real key for fixture recording must not pay for this suite.
  it("reports a missing key as 500 ERR_LLM_AUTH on the request, not at boot", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.resetModules();
    const composition = await import("../src/server/composition");

    const response = await composition.feedbackHandler(feedbackRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_LLM_AUTH" },
    });
  });

  it("rejects a cross-site request", async () => {
    const response = await POST(
      postRequest("{}", {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
  });
});
