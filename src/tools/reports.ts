import { z } from "zod";
import {
  def,
  filtersShape,
  makeWebsiteIdArg,
  normalizeFilters,
  resolveWebsiteId,
  type ToolDef,
  type ToolModule,
} from "./_helpers";
import { formatJson, formatList, toolText } from "../format";

const dateStringShape = {
  startDate: z
    .string()
    .describe("ISO date or datetime, e.g. 2026-01-01 or 2026-01-01T00:00:00Z."),
  endDate: z.string(),
};

/// Umami v3 spells the pageview step type `path`; `url` is the v2 name.
const stepType = z
  .enum(["path", "url", "event"])
  .transform((t) => (t === "url" ? "path" : t));

const stepFilter = z.object({
  property: z.string().min(1),
  operator: z.enum(["eq", "neq", "c", "dnc"]),
  value: z.string(),
});

const funnelStep = z.object({
  type: stepType,
  value: z.string(),
  filters: z.array(stepFilter).optional(),
});

/// Fields accepted by the v3 breakdown report (`fieldsParam`).
const BREAKDOWN_FIELDS = [
  "path",
  "referrer",
  "title",
  "query",
  "os",
  "browser",
  "device",
  "country",
  "region",
  "city",
  "tag",
  "hostname",
  "distinctId",
  "language",
  "event",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
] as const;

export const reportTools: ToolModule = (ctx) => {
  /// Umami v3 report bodies are `{ websiteId, type, filters, parameters }`
  /// (`reportResultSchema`); v2 accepted the parameters flat at the top level.
  const runReport = async (
    type: string,
    websiteId: string | undefined,
    parameters: Record<string, unknown>,
    filters: Record<string, unknown> = {},
  ) => {
    const id = resolveWebsiteId(websiteId, ctx.defaultWebsiteId);
    const data = await ctx.client.request("POST", `/reports/${type}`, {
      body: {
        websiteId: id,
        type,
        filters: normalizeFilters(filters),
        parameters,
      },
    });
    return toolText(formatJson(data));
  };

  /// Splits tool args into report parameters and the shared website filters.
  const split = (args: Record<string, unknown>) => {
    const filters: Record<string, unknown> = {};
    const parameters: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v === undefined) continue;
      if (k in filtersShape) filters[k] = v;
      else parameters[k] = v;
    }
    return { parameters, filters };
  };

  const tools: ToolDef[] = [
    def({
      name: "umami_list_reports",
      description: "List saved reports for a website, optionally filtered by type.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        type: z.string().optional(),
      },
      handler: async ({ websiteId, type }) => {
        const id = resolveWebsiteId(websiteId, ctx.defaultWebsiteId);
        const data = await ctx.client.request<{ data?: unknown[] }>(
          "GET",
          "/reports",
          { query: { websiteId: id, type } },
        );
        const rows = Array.isArray(data) ? data : data.data ?? [];
        return toolText(
          formatList(rows as Record<string, unknown>[], [
            "id",
            "name",
            "type",
            "createdAt",
          ]),
        );
      },
    }),
    def({
      name: "umami_get_report",
      description: "Fetch a saved report by id.",
      inputSchema: { reportId: z.string() },
      handler: async ({ reportId }) => {
        const data = await ctx.client.request("GET", `/reports/${reportId}`);
        return toolText(formatJson(data));
      },
    }),
    def({
      name: "umami_report_funnel",
      description:
        "Funnel conversion report across an ordered set of steps (2 to 8). Step type is `path` (a URL path) or `event` (a custom event name); `url` is accepted as an alias of `path`. Returns unique visitors per step.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        steps: z.array(funnelStep).min(2).max(8),
        window: z
          .number()
          .int()
          .positive()
          .describe("Conversion window in minutes."),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("funnel", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_retention",
      description: "Retention cohorts report.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        timezone: z.string().optional(),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("retention", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_goal",
      description:
        "Goal tracking report: how many visitors reached a path or fired an event.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        type: stepType.describe("Goal type: `path` or `event`."),
        value: z.string().describe("URL path or event name."),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("goal", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_journey",
      description: "User journey report between optional start and end steps.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        steps: z.number().int().min(2).max(7),
        startStep: z.string().optional(),
        endStep: z.string().optional(),
        eventType: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("1 = pageviews, 2 = custom events."),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("journey", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_attribution",
      description: "Attribution report across an ordered funnel.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        model: z
          .enum(["first-click", "last-click", "firstClick", "lastClick"])
          .transform((m) =>
            m === "firstClick" ? "first-click" : m === "lastClick" ? "last-click" : m,
          )
          .describe("Attribution model."),
        type: stepType.describe("Step type: `path` or `event`."),
        step: z.string(),
        currency: z.string().length(3).optional(),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("attribution", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_utm",
      description: "UTM campaign report — sources, mediums, campaigns.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("utm", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_revenue",
      description: "Revenue report grouped by currency.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        currency: z.string().length(3).describe("ISO 4217 currency code."),
        unit: z.enum(["hour", "day", "month", "year"]).optional(),
        timezone: z.string().optional(),
        compare: z.enum(["prev", "yoy"]).optional(),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("revenue", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_performance",
      description: "Core Web Vitals performance report.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        metric: z.enum(["lcp", "inp", "cls", "fcp", "ttfb"]).optional(),
        unit: z.enum(["hour", "day", "month", "year"]).optional(),
        timezone: z.string().optional(),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("performance", websiteId, parameters, filters);
      },
    }),
    def({
      name: "umami_report_breakdown",
      description: "Breakdown report segmented by one or more fields.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateStringShape,
        fields: z.array(z.enum(BREAKDOWN_FIELDS)).min(1),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...args }) => {
        const { parameters, filters } = split(args);
        return runReport("breakdown", websiteId, parameters, filters);
      },
    }),
  ];
  return tools;
};
