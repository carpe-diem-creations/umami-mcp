import { z } from "zod";
import {
  def,
  dateRangeShape,
  makeWebsiteIdArg,
  normalizeFilters,
  paginationShape,
  resolveWebsiteId,
  type ToolDef,
  type ToolModule,
} from "./_helpers";
import { formatJson, toolText } from "../format";

export const sessionTools: ToolModule = (ctx) => {
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
      name: "umami_list_sessions",
      description: "List sessions for a date range with pagination.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        ...paginationShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "sessions", rest),
    }),
    def({
      name: "umami_get_session",
      description: "Fetch a single session by id.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        sessionId: z.string(),
      },
      handler: async ({ websiteId, sessionId }) =>
        get(websiteId, `sessions/${sessionId}`),
    }),
    def({
      name: "umami_get_session_stats",
      description: "Session-level aggregate stats.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "sessions/stats", rest),
    }),
    def({
      name: "umami_get_session_activity",
      description: "Per-event activity timeline for a session.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        sessionId: z.string(),
        ...dateRangeShape,
      },
      handler: async ({ websiteId, sessionId, ...rest }) =>
        get(websiteId, `sessions/${sessionId}/activity`, rest),
    }),
    def({
      name: "umami_get_session_properties",
      description: "Custom properties attached to a session.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        sessionId: z.string(),
      },
      handler: async ({ websiteId, sessionId }) =>
        get(websiteId, `sessions/${sessionId}/properties`),
    }),
    def({
      name: "umami_list_session_property_values",
      description: "Counts of values for a given session property name.",
      inputSchema: {
        websiteId: makeWebsiteIdArg(),
        ...dateRangeShape,
        propertyName: z.string(),
      },
      handler: async ({ websiteId, ...rest }) =>
        get(websiteId, "session-data/values", rest),
    }),
  ];
  return tools;
};
