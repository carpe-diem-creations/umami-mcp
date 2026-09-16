import { z } from "zod";
import {
  def,
  dateRangeShape,
  filtersShape,
  makeWebsiteIdArg,
  normalizeFilters,
  paginationShape,
  resolveWebsiteId,
  type ToolDef,
  type ToolModule,
} from "./_helpers";
import { formatJson, toolText } from "../format";

export const eventTools: ToolModule = (ctx) => {
  const get = async (
    websiteId: string | undefined,
    suffix: string,
    query: Record<string, unknown> = {},
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
      name: "umami_list_events",
      description: "List events for a date range with pagination + filters.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...paginationShape,
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "events", rest),
    }),
    def({
      name: "umami_get_event_stats",
      description: "Aggregate event stats over a date range.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        compare: z.string().optional(),
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "events/stats", rest),
    }),
    def({
      name: "umami_list_event_data",
      description: "Events grouped by event name with property metadata.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...paginationShape,
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "event-data", rest),
    }),
    def({
      name: "umami_list_event_fields",
      description: "Counts of event-data field values.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "event-data/fields", rest),
    }),
    def({
      name: "umami_list_event_properties",
      description: "Event names with their property counts.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...filtersShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "event-data/properties", rest),
    }),
    def({
      name: "umami_list_event_property_values",
      description: "Value counts for a specific event + property.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        event: z.string(),
        propertyName: z.string(),
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "event-data/values", rest),
    }),
    def({
      name: "umami_send_event",
      description:
        "Ingest a single event via /api/send. No auth header needed. Use for 'send me a test event' or programmatic tracking.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        hostname: z.string().optional(),
        language: z.string().optional(),
        referrer: z.string().optional(),
        screen: z.string().optional(),
        title: z.string().optional(),
        url: z.string().optional(),
        name: z.string().optional().describe("Custom event name."),
        data: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Custom event data payload."),
        tag: z.string().optional(),
      },
      handler: async ({ websiteId, ...rest }) => {
        const id = resolveWebsiteId(websiteId, ctx.defaultWebsiteId);
        const data = await ctx.client.send({ website: id, ...rest });
        return toolText(formatJson(data));
      },
    }),
  ];
  return tools;
};
