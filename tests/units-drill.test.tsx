import { NextIntlClientProvider } from "next-intl";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UnitPage from "../src/app/[locale]/units/[unitId]/page";
import { UnitDrill } from "../src/app/[locale]/units/[unitId]/_client/unit-drill";
import type { Topic } from "../src/core/content/index";
import en from "../messages/en.json";

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
}));

// The drill page's client leaf, rendered under jsdom with a stubbed `fetch`.
// Its topics are fixtures handed in as props, the way the page hands in the
// unit's pool, so these cases do not move when `topics.json` grows.

const SHORT_PREP: Topic = {
  id: "fixture-prep-short",
  category: "travel",
  structure: "prep",
  mode: "short",
  text: "Which fixture city would you recommend?",
};

const OTHER_SHORT_PREP: Topic = {
  id: "fixture-prep-short-2",
  category: "food",
  structure: "prep",
  mode: "short",
  text: "Which fixture dish would you recommend?",
};

const ANSWER = "I recommend Kyoto because its old temples are beautiful.";

const REWRITE = "I would recommend Kyoto, because its old temples are beautiful.";

/** A `200` body for a `prep`/`short` topic, as the endpoint answers it. */
function feedbackBody(topic: Topic): unknown {
  return {
    topicId: topic.id,
    structure: topic.structure,
    mode: topic.mode,
    level: "B1",
    feedback: {
      structure: {
        point: { verdict: "present", reason: "The answer names Kyoto." },
        reason: { verdict: "weak", reason: "The reason is thin." },
      },
      fixes: [
        { before: "old temples", after: "centuries-old temples", why: "More vivid." },
      ],
      rewrite: REWRITE,
      grammar: [],
    },
  };
}

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/** Stubs `fetch` to answer each call with the next response, recording every call. */
function stubFetch(...responses: Response[]): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal("fetch", (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, init });
    const next = responses.shift();
    return next === undefined
      ? Promise.reject(new TypeError("no response left in this stub"))
      : Promise.resolve(next);
  });
  return calls;
}

function renderDrill(topics: readonly Topic[]): void {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UnitDrill unit={1} topics={topics} />
    </NextIntlClientProvider>,
  );
}

function typeAnswer(value: string): void {
  fireEvent.change(screen.getByLabelText(en.Drill.answerLabel), { target: { value } });
}

function clickButton(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("the drill page's client leaf", () => {
  it("posts the answer and renders the feedback it gets back", async () => {
    const calls = stubFetch(Response.json(feedbackBody(SHORT_PREP)));
    renderDrill([SHORT_PREP]);

    expect(screen.getByRole("heading", { name: SHORT_PREP.text })).toBeInTheDocument();
    typeAnswer(`  ${ANSWER}\n`);
    clickButton(en.Drill.send);

    expect(await screen.findByText(REWRITE)).toBeInTheDocument();
    expect(screen.getByText(en.Drill.element.point)).toBeInTheDocument();
    expect(screen.getByText(/Present — The answer names Kyoto\./)).toBeInTheDocument();
    expect(screen.getByText(/Weak — The reason is thin\./)).toBeInTheDocument();
    expect(screen.getByText("centuries-old temples")).toBeInTheDocument();
    expect(screen.getByText(en.Drill.feedback.noGrammar)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.Drill.feedback.savePhrase }),
    ).toBeDisabled();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/feedback");
    expect(calls[0]?.init?.method).toBe("POST");
    const body = calls[0]?.init?.body;
    expect(typeof body).toBe("string");
    expect(JSON.parse(typeof body === "string" ? body : "null")).toStrictEqual({
      topicId: SHORT_PREP.id,
      answer: ANSWER,
      level: "B1",
    });
  });

  it.each([
    [
      "an over-length answer",
      "a".repeat(401),
      "Keep your answer to 400 characters or fewer.",
    ],
    ["an empty answer", "   ", en.Drill.validation.empty],
    ["a Japanese answer", "私は京都をおすすめします。", en.Drill.validation.notEnglish],
  ])("blocks %s before it reaches the network", (_label, answer, message) => {
    const calls = stubFetch();
    renderDrill([SHORT_PREP]);

    typeAnswer(answer);
    clickButton(en.Drill.send);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(calls).toStrictEqual([]);
  });

  it("skips to a different topic without calling fetch", () => {
    const calls = stubFetch();
    renderDrill([SHORT_PREP, OTHER_SHORT_PREP]);

    const first = screen.getByRole("heading", { level: 2 }).textContent;
    clickButton(en.Drill.skip);
    const second = screen.getByRole("heading", { level: 2 }).textContent;

    expect([SHORT_PREP.text, OTHER_SHORT_PREP.text]).toContain(first);
    expect([SHORT_PREP.text, OTHER_SHORT_PREP.text]).toContain(second);
    expect(second).not.toBe(first);
    expect(calls).toStrictEqual([]);
  });

  it("keeps the answer and offers a resend when the endpoint fails", async () => {
    const calls = stubFetch(
      Response.json(
        { error: { code: "ERR_LLM_AUTH", message: "not shown" } },
        { status: 500 },
      ),
      Response.json(feedbackBody(SHORT_PREP)),
    );
    renderDrill([SHORT_PREP]);

    typeAnswer(ANSWER);
    clickButton(en.Drill.send);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.Drill.errors.ERR_LLM_AUTH,
    );
    expect(screen.getByLabelText(en.Drill.answerLabel)).toHaveValue(ANSWER);

    clickButton(en.Drill.resend);

    expect(await screen.findByText(REWRITE)).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it.each([
    [
      "a code the page has no message for",
      Response.json({ error: { code: "ERR_NEW" } }, { status: 500 }),
    ],
    ["a body that is not JSON", new Response("<html>", { status: 502 })],
    [
      "a 200 whose feedback does not match the topic's schema",
      Response.json({ feedback: {} }),
    ],
  ])("reports %s with the generic message", async (_label, response) => {
    stubFetch(response);
    renderDrill([SHORT_PREP]);

    typeAnswer(ANSWER);
    clickButton(en.Drill.send);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.Drill.errors.unknown);
    expect(screen.getByRole("button", { name: en.Drill.resend })).toBeInTheDocument();
  });

  it("reports a network failure with the generic message", async () => {
    stubFetch();
    renderDrill([SHORT_PREP]);

    typeAnswer(ANSWER);
    clickButton(en.Drill.send);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.Drill.errors.unknown);
  });

  it("shows the completion screen once the last topic is answered, and restarts", async () => {
    stubFetch(Response.json(feedbackBody(SHORT_PREP)));
    renderDrill([SHORT_PREP]);

    expect(screen.getByText("0 topics answered")).toBeInTheDocument();
    typeAnswer(ANSWER);
    clickButton(en.Drill.send);
    await screen.findByText(REWRITE);
    clickButton(en.Drill.next);

    expect(
      screen.getByRole("heading", { name: en.Drill.complete.heading }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.Drill.complete.homeLink }),
    ).toHaveAttribute("href", "/en");

    clickButton(en.Drill.complete.restart);

    expect(screen.getByRole("heading", { name: SHORT_PREP.text })).toBeInTheDocument();
    expect(screen.getByText("0 topics answered")).toBeInTheDocument();
  });
});

describe("the drill page", () => {
  it("renders the unit's heading and one of its topics", async () => {
    await act(async () => {
      render(
        <NextIntlClientProvider locale="en" messages={en}>
          <UnitPage params={Promise.resolve({ locale: "en", unitId: "1" })} />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Unit 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});
