import { z } from "zod";
import {
  def,
  dateRangeShape,
  filtersShape,
  makeWebsiteIdArg,
  METRIC_TYPES,
  normalizeFilters,
  normalizeMetricType,
  resolveWebsiteId,
  unitShape,
  type ToolDef,
  type ToolModule,
} from "./_helpers";
import { formatJson, toolText } from "../format";

export const statsTools: ToolModule = (ctx) => {
  const get = async (
    websiteId: string | undefined,
    suffix: string,
    query: Record<string, unknown>,
  ) => {
    const id = resolveWebsiteId(websiteId, ctx.defaultWebsiteId);
    const data = await ctx.client.request(
      "GET",
      `/websites/${id}/${suffix}`,
      { query: normalizeFilters(query) as never },
    );
    return toolText(formatJson(data));
  };

  const tools: ToolDef[] = [
    def({
      name: "umami_get_stats",
      description:
        "Aggregate website stats (pageviews, visitors, visits, bounce rate, total time) for a date range.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "stats", rest),
    }),
    def({
      name: "umami_get_pageviews",
      description:
        "Time series of pageviews and sessions bucketed by unit (hour/day/month).",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...unitShape,
        compare: z.string().optional(),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "pageviews", rest),
    }),
    def({
      name: "umami_get_metrics",
      description:
        "Top N by dimension (path, referrer, browser, os, device, country, event, etc). Use for 'top pages', 'top referrers', etc. v2 names (url, host, utm_source) are accepted and translated.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        type: z
          .enum(METRIC_TYPES)
          .describe("Dimension to group by."),
        limit: z.number().int().positive().max(500).optional(),
        offset: z.number().int().nonnegative().optional(),
        ...filtersShape,
      },
      handler: async ({ websiteId, type, ...rest }) =>
        get(websiteId, "metrics", { ...rest, type: normalizeMetricType(type) }),
    }),
    def({
      name: "umami_get_active_users",
      description: "Number of active users in the last N minutes.",
      inputSchema: { websiteId: makeWebsiteIdArg() },
      handler: async ({ websiteId }) => get(websiteId, "active", {}),
    }),
    def({
      name: "umami_get_realtime",
      description: "Last-30-minute realtime stats.",
      inputSchema: { websiteId: makeWebsiteIdArg() },
      handler: async ({ websiteId }) => {
        const id = resolveWebsiteId(websiteId, ctx.defaultWebsiteId);
        const data = await ctx.client.request(
          "GET",
          `/realtime/${id}`,
        );
        return toolText(formatJson(data));
      },
    }),
    def({
      name: "umami_get_daterange",
      description: "Earliest and latest data timestamps for the website.",
      inputSchema: { websiteId: makeWebsiteIdArg() },
      handler: async ({ websiteId }) => get(websiteId, "daterange", {}),
    }),
    def({
      name: "umami_get_events_series",
      description: "Event counts over time, bucketed by unit.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...unitShape,
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "events/series", rest),
    }),
  ];
  return tools;
};
