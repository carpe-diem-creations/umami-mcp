import { z, ZodError, type ZodRawShape } from "zod";
import { UmamiClient, UmamiError } from "../client/umami";

export type ToolContent = { type: "text"; text: string };
export type ToolResult = { content: ToolContent[]; isError?: boolean };
export type ToolHandler<A> = (args: A) => Promise<ToolResult>;

export type ToolContext = {
  client: UmamiClient;
  mode: "cloud" | "self-hosted";
  defaultWebsiteId?: string;
};

export type ToolDef<Shape extends ZodRawShape = ZodRawShape> = {
  name: string;
  description: string;
  inputSchema: Shape;
  handler: ToolHandler<z.infer<z.ZodObject<Shape>>>;
};

export type ToolModule = (ctx: ToolContext) => ToolDef[];

export const def = <Shape extends ZodRawShape>(
  t: ToolDef<Shape>,
): ToolDef =>
  ({ ...t, handler: wrap(t.handler) }) as unknown as ToolDef;

export function wrap<A>(handler: ToolHandler<A>): ToolHandler<A> {
  return async (args: A) => {
    try {
      return await handler(args);
    } catch (e) {
      if (e instanceof UmamiError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Umami API error (HTTP ${e.status}): ${e.method} ${e.path}${
                e.body ? `\n${e.body}` : ""
              }`,
            },
          ],
        };
      }
      if (e instanceof ZodError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Invalid arguments: ${JSON.stringify(
                e.flatten().fieldErrors,
              )}`,
            },
          ],
        };
      }
      const msg = e instanceof Error ? e.message : String(e);
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${msg}` }],
      };
    }
  };
}

export function resolveWebsiteId(
  provided: string | undefined,
  fallback: string | undefined,
): string {
  const id = provided ?? fallback;
  if (!id) {
    throw new Error(
      "No websiteId provided and UMAMI_DEFAULT_WEBSITE_ID is not set. Call umami_list_websites to discover IDs.",
    );
  }
  return id;
}

export const makeWebsiteIdArg = () =>
  z
    .string()
    .optional()
    .describe(
      "Umami website UUID. Optional if UMAMI_DEFAULT_WEBSITE_ID env var is set.",
    );

const dateCoerce = z
  .union([z.number().int(), z.string()])
  .transform((v, ctx) => {
    if (typeof v === "number") return v;
    const t = Date.parse(v);
    if (Number.isNaN(t)) {
      ctx.addIssue({
        code: "custom",
        message: `Invalid date: ${v}`,
      });
      return z.NEVER;
    }
    return t;
  });

export const dateRangeShape = {
  startAt: dateCoerce.describe(
    "Start of date range. Epoch ms (number) or ISO string.",
  ),
  endAt: dateCoerce.describe(
    "End of date range. Epoch ms (number) or ISO string.",
  ),
};

export const paginationShape = {
  page: z.number().int().positive().optional().describe("Page number, 1-indexed."),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .describe("Results per page (max 200)."),
  search: z.string().optional().describe("Search query."),
};

/// Filter keys accepted by the Umami v3 API (`filterParams` in src/lib/schema.ts).
/// `url` and `host` are the v2 spellings and are translated by `normalizeFilters`.
export const filtersShape = {
  path: z.string().optional().describe("URL path filter (v2 name: url)."),
  url: z.string().optional().describe("Deprecated alias of `path`."),
  referrer: z.string().optional(),
  title: z.string().optional(),
  query: z.string().optional(),
  event: z.string().optional(),
  hostname: z.string().optional().describe("Hostname filter (v2 name: host)."),
  host: z.string().optional().describe("Deprecated alias of `hostname`."),
  os: z.string().optional(),
  browser: z.string().optional(),
  device: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  language: z.string().optional(),
  distinctId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  tag: z.string().optional(),
  segment: z.string().optional(),
  cohort: z.string().optional(),
};

/// v2 → v3 key renames applied to every query/filter object before it is sent.
const LEGACY_KEYS: Record<string, string> = {
  url: "path",
  host: "hostname",
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
};

export function normalizeFilters<T extends Record<string, unknown>>(
  query: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    const key = LEGACY_KEYS[k] ?? k;
    if (!(key in out)) out[key] = v;
  }
  return out;
}

/// Metric dimension names accepted by v3 (`EVENT_COLUMNS` + `SESSION_COLUMNS`),
/// plus the v2 spellings which `normalizeMetricType` maps onto them.
export const METRIC_TYPES = [
  "path",
  "fullPath",
  "entry",
  "exit",
  "referrer",
  "domain",
  "title",
  "query",
  "event",
  "tag",
  "hostname",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "browser",
  "os",
  "device",
  "screen",
  "language",
  "country",
  "city",
  "region",
  "distinctId",
  "channel",
  // v2 spellings, kept so older prompts keep working
  "url",
  "host",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export const normalizeMetricType = (type: string): string =>
  LEGACY_KEYS[type] ?? type;

export const unitShape = {
  unit: z
    .enum(["minute", "hour", "day", "month", "year"])
    .optional()
    .describe("Time bucket size for series endpoints."),
  timezone: z
    .string()
    .optional()
    .describe("IANA timezone (e.g. America/New_York). Defaults to UTC."),
};
