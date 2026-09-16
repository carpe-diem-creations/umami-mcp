import { test, expect, describe, afterEach, mock } from "bun:test";
import { z } from "zod";
import { UmamiClient } from "../src/client/umami";
import type { ToolContext, ToolDef } from "../src/tools/_helpers";
import { websiteTools } from "../src/tools/websites";
import { meTools } from "../src/tools/me";
import { statsTools } from "../src/tools/stats";
import { sessionTools } from "../src/tools/sessions";
import { eventTools } from "../src/tools/events";
import { reportTools } from "../src/tools/reports";
import { teamTools } from "../src/tools/teams";
import { userTools } from "../src/tools/users";

type Call = { url: string; init?: RequestInit };

function install() {
  const calls: Call[] = [];
  const responses: Response[] = [];
  const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const next =
      responses.shift() ??
      new Response(JSON.stringify({ ok: true, items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    return next;
  });
  const original = globalThis.fetch;
  // biome-ignore lint: test stub
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return {
    calls,
    queue: (body: unknown, status = 200) =>
      responses.push(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function makeCtx(defaultWebsiteId?: string): ToolContext {
  const client = new UmamiClient({
    mode: "cloud",
    baseUrl: "https://api.umami.is/v1",
    apiKey: "test-key",
  });
  return { client, mode: "cloud", defaultWebsiteId };
}

const findTool = (defs: ToolDef[], name: string): ToolDef => {
  const t = defs.find((d) => d.name === name);
  if (!t) throw new Error(`tool not found: ${name}`);
  return t;
};

const parseAndCall = async (def: ToolDef, args: unknown) => {
  const parsed = z.object(def.inputSchema).parse(args);
  return def.handler(parsed as never);
};

let stub: ReturnType<typeof install>;
afterEach(() => stub?.restore());

describe("websites tools", () => {
  test("umami_list_websites GETs /websites", async () => {
    stub = install();
    stub.queue({ websites: [{ id: "w1", name: "Acme", domain: "acme.com" }] });
    const tools = websiteTools(makeCtx());
    const result = await parseAndCall(
      findTool(tools, "umami_list_websites"),
      { pageSize: 25 },
    );
    expect(result.isError).toBeFalsy();
    const url = new URL(stub.calls[0]!.url);
    expect(url.pathname).toBe("/v1/websites");
    expect(url.searchParams.get("pageSize")).toBe("25");
  });

  test("umami_create_website POSTs /websites with body", async () => {
    stub = install();
    stub.queue({ id: "w2", name: "New", domain: "new.com" });
    const tools = websiteTools(makeCtx());
    await parseAndCall(findTool(tools, "umami_create_website"), {
      name: "New",
      domain: "new.com",
    });
    const call = stub.calls[0]!;
    expect(call.init?.method).toBe("POST");
    expect(JSON.parse(call.init?.body as string)).toEqual({
      name: "New",
      domain: "new.com",
    });
  });

  test("websiteId resolves from default when tool omits it", async () => {
    stub = install();
    stub.queue({ id: "w1" });
    const tools = websiteTools(makeCtx("default-site"));
    await parseAndCall(findTool(tools, "umami_get_website"), {});
    expect(new URL(stub.calls[0]!.url).pathname).toBe("/v1/websites/default-site");
  });

  test("error: missing websiteId and no default returns tool error", async () => {
    stub = install();
    const tools = websiteTools(makeCtx());
    const result = await parseAndCall(findTool(tools, "umami_get_website"), {});
    // wrap() catches thrown Error as a generic — but our code throws plain Error,
    // so this should rethrow. Confirm it's either caught or surfaced clearly.
    // Plain Errors are rethrown; UmamiError/ZodError are caught. Missing-id is a
    // plain Error — we want it surfaced to Claude, so wrap should catch it too.
    expect(result.isError).toBe(true);
  });
});

describe("me tools", () => {
  test("umami_whoami GETs /me", async () => {
    stub = install();
    stub.queue({ id: "u1", username: "admin" });
    const tools = meTools(makeCtx());
    await parseAndCall(findTool(tools, "umami_whoami"), {});
    expect(new URL(stub.calls[0]!.url).pathname).toBe("/v1/me");
  });
});

describe("stats tools", () => {
  test("umami_get_stats passes startAt/endAt and websiteId", async () => {
    stub = install();
    stub.queue({ pageviews: { value: 100 } });
    const tools = statsTools(makeCtx("site-1"));
    await parseAndCall(findTool(tools, "umami_get_stats"), {
      startAt: 1000,
      endAt: 2000,
    });
    const url = new URL(stub.calls[0]!.url);
    expect(url.pathname).toBe("/v1/websites/site-1/stats");
    expect(url.searchParams.get("startAt")).toBe("1000");
    expect(url.searchParams.get("endAt")).toBe("2000");
  });

  test("umami_get_metrics translates v2 `url` to v3 `path`", async () => {
    stub = install();
    stub.queue([]);
    const tools = statsTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_get_metrics"), {
      startAt: 1,
      endAt: 2,
      type: "url",
      host: "ios.example",
    });
    const url = new URL(stub.calls[0]!.url);
    expect(url.searchParams.get("type")).toBe("path");
    expect(url.searchParams.get("hostname")).toBe("ios.example");
    expect(url.searchParams.has("host")).toBe(false);
  });

  test("umami_get_metrics passes type enum", async () => {
    stub = install();
    stub.queue([]);
    const tools = statsTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_get_metrics"), {
      startAt: 0,
      endAt: 1,
      type: "path",
    });
    expect(new URL(stub.calls[0]!.url).searchParams.get("type")).toBe("path");
  });
});

describe("sessions tools", () => {
  test("umami_list_sessions calls sessions endpoint", async () => {
    stub = install();
    stub.queue({ data: [] });
    const tools = sessionTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_list_sessions"), {
      startAt: 0,
      endAt: 1,
    });
    expect(new URL(stub.calls[0]!.url).pathname).toBe("/v1/websites/s/sessions");
  });
});

describe("events tools", () => {
  test("umami_list_events calls events endpoint with date range", async () => {
    stub = install();
    stub.queue({ data: [] });
    const tools = eventTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_list_events"), {
      startAt: 0,
      endAt: 1,
    });
    expect(new URL(stub.calls[0]!.url).pathname).toBe("/v1/websites/s/events");
  });

  test("umami_send_event POSTs to send endpoint without auth header", async () => {
    stub = install();
    stub.queue({ ok: true });
    const tools = eventTools(makeCtx("my-site"));
    await parseAndCall(findTool(tools, "umami_send_event"), {
      hostname: "acme.com",
      url: "/pricing",
      name: "click-cta",
    });
    const call = stub.calls[0]!;
    expect(call.url).toBe("https://cloud.umami.is/api/send");
    const h = new Headers(call.init?.headers);
    expect(h.has("x-umami-api-key")).toBe(false);
    const body = JSON.parse(call.init?.body as string);
    expect(body.payload.website).toBe("my-site");
  });
});

describe("reports tools", () => {
  test("umami_report_funnel POSTs /reports/funnel", async () => {
    stub = install();
    stub.queue({ steps: [] });
    const tools = reportTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_report_funnel"), {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      steps: [{ type: "url", value: "/" }, { type: "url", value: "/checkout" }],
      window: 60,
    });
    const call = stub.calls[0]!;
    expect(new URL(call.url).pathname).toBe("/v1/reports/funnel");
    expect(call.init?.method).toBe("POST");
    const body = JSON.parse(call.init?.body as string);
    expect(body).toEqual({
      websiteId: "s",
      type: "funnel",
      filters: {},
      parameters: {
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        window: 60,
        steps: [
          { type: "path", value: "/" },
          { type: "path", value: "/checkout" },
        ],
      },
    });
  });

  test("umami_report_goal nests parameters and lifts website filters", async () => {
    stub = install();
    stub.queue({});
    const tools = reportTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_report_goal"), {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      type: "event",
      value: "signup",
      url: "/onboarding",
    });
    const body = JSON.parse(stub.calls[0]!.init?.body as string);
    expect(body.type).toBe("goal");
    expect(body.parameters).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      type: "event",
      value: "signup",
    });
    expect(body.filters).toEqual({ path: "/onboarding" });
  });

  test("umami_report_attribution maps camelCase model to v3 kebab-case", async () => {
    stub = install();
    stub.queue({});
    const tools = reportTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_report_attribution"), {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      model: "firstClick",
      type: "url",
      step: "/checkout",
    });
    const body = JSON.parse(stub.calls[0]!.init?.body as string);
    expect(body.parameters.model).toBe("first-click");
    expect(body.parameters.type).toBe("path");
  });

  test("umami_list_reports passes websiteId + type as query", async () => {
    stub = install();
    stub.queue({ data: [] });
    const tools = reportTools(makeCtx("s"));
    await parseAndCall(findTool(tools, "umami_list_reports"), { type: "funnel" });
    const url = new URL(stub.calls[0]!.url);
    expect(url.pathname).toBe("/v1/reports");
    expect(url.searchParams.get("websiteId")).toBe("s");
    expect(url.searchParams.get("type")).toBe("funnel");
  });
});

describe("teams tools", () => {
  test("umami_list_teams GETs /teams", async () => {
    stub = install();
    stub.queue({ data: [] });
    const tools = teamTools(makeCtx());
    await parseAndCall(findTool(tools, "umami_list_teams"), {});
    expect(new URL(stub.calls[0]!.url).pathname).toBe("/v1/teams");
  });
});

describe("users tools", () => {
  test("umami_list_users GETs /admin/users", async () => {
    stub = install();
    stub.queue({ data: [] });
    const tools = userTools({ ...makeCtx(), mode: "self-hosted" });
    await parseAndCall(findTool(tools, "umami_list_users"), {});
    expect(new URL(stub.calls[0]!.url).pathname).toBe("/v1/admin/users");
  });
});
