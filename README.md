<p align="center">
  <img src="https://banners.beyondco.de/Umami%20MCP.png?theme=light&packageManager=&packageName=&pattern=architect&style=style_2&description=%40climactic%2Fumami-mcp&md=1&showWatermark=0&fontSize=100px&images=arrow-circle-up" alt="Umami MCP">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@climactic/umami-mcp"><img src="https://img.shields.io/npm/v/@climactic/umami-mcp.svg" alt="npm version"></a>
  <a href="https://github.com/climactic/umami-mcp/actions/workflows/ci.yml"><img src="https://github.com/climactic/umami-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/climactic/umami-mcp/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@climactic/umami-mcp.svg" alt="License"></a>
  <a href="https://github.com/sponsors/climactic"><img src="https://img.shields.io/badge/sponsor-GitHub%20Sponsors-ea4aaa" alt="GitHub Sponsors"></a>
  <a href="https://ko-fi.com/climacticco"><img src="https://img.shields.io/badge/support-Ko--fi-ff5e5b" alt="Ko-fi"></a>
</p>

# @climactic/umami-mcp

An MCP server for [Umami Analytics](https://umami.is) that gives Claude (and any MCP-compatible client) full read/write access to your analytics data. Works with both Umami Cloud and self-hosted instances.

> **Fork note (carpe-diem-creations/umami-mcp):** this fork targets the **Umami v3 API** (tested against self-hosted 3.3.1). Compared with upstream 0.1.x: report tools send the v3 `{ websiteId, type, filters, parameters }` envelope, funnel/goal/attribution steps use `path` instead of `url`, metrics and filters use the v3 dimension names (`path`, `hostname`, `utmSource`, ...), and the v2 spellings (`url`, `host`, `utm_source`) are still accepted and translated. Run it from a checkout with `bun run index.ts` (see the plugin `.mcp.json`).

48 tools covering websites, stats, pageviews, metrics, sessions, events, reports (funnel, retention, goals, journey, attribution, UTM, revenue, performance, breakdown), teams, and user admin.

## Install

### Claude Code (plugin)

```bash
# Add the marketplace and install
claude /plugin marketplace add climactic/umami-mcp
claude /plugin install umami-mcp@climactic
```

### Claude Desktop / other MCP clients

Add to your `mcpServers` config:

```json
{
  "mcpServers": {
    "umami": {
      "command": "bunx",
      "args": ["@climactic/umami-mcp"],
      "env": {
        "UMAMI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Local dev

```bash
git clone https://github.com/climactic/umami-mcp.git
cd umami-mcp
bun install
UMAMI_API_KEY=your-key bun run index.ts
```

## Auth

Set one of these env var combinations:

**Umami Cloud:**

| Variable | Required | Description |
|---|---|---|
| `UMAMI_API_KEY` | Yes | API key from Umami Cloud dashboard |
| `UMAMI_BASE_URL` | No | Override API base (default: `https://api.umami.is/v1`) |
| `UMAMI_DEFAULT_WEBSITE_ID` | No | Default website UUID for tools that accept `websiteId` |

**Self-hosted:**

| Variable | Required | Description |
|---|---|---|
| `UMAMI_BASE_URL` | Yes | Your Umami instance URL, e.g. `https://umami.example.com` |
| `UMAMI_USERNAME` | Yes | Admin username |
| `UMAMI_PASSWORD` | Yes | Admin password |
| `UMAMI_DEFAULT_WEBSITE_ID` | No | Default website UUID |

## Tools

<details>
<summary><strong>Me (2)</strong></summary>

- `umami_whoami` — Current authenticated user
- `umami_list_my_websites` — Websites accessible to current user
</details>

<details>
<summary><strong>Websites (6)</strong></summary>

- `umami_list_websites` — List all websites
- `umami_get_website` — Get website details
- `umami_create_website` — Create a new website
- `umami_update_website` — Update name/domain/shareId
- `umami_delete_website` — Delete a website permanently
- `umami_reset_website` — Wipe all data for a website
</details>

<details>
<summary><strong>Stats & Realtime (7)</strong></summary>

- `umami_get_stats` — Aggregate stats (pageviews, visitors, bounces, time)
- `umami_get_pageviews` — Pageviews + sessions time series
- `umami_get_metrics` — Top N by dimension (path, referrer, browser, os, country, event, ...; v2 names accepted)
- `umami_get_active_users` — Active users right now
- `umami_get_realtime` — Last-30-minute realtime data
- `umami_get_daterange` — Earliest/latest data timestamps
- `umami_get_events_series` — Event counts over time
</details>

<details>
<summary><strong>Sessions (6)</strong></summary>

- `umami_list_sessions` — List sessions in a date range
- `umami_get_session` — Session details
- `umami_get_session_stats` — Session-level aggregates
- `umami_get_session_activity` — Activity timeline for a session
- `umami_get_session_properties` — Custom properties on a session
- `umami_list_session_property_values` — Value counts for a session property
</details>

<details>
<summary><strong>Events (7)</strong></summary>

- `umami_list_events` — List events in a date range
- `umami_get_event_stats` — Aggregate event stats
- `umami_list_event_data` — Events grouped by name
- `umami_list_event_fields` — Event-data field value counts
- `umami_list_event_properties` — Event names + property counts
- `umami_list_event_property_values` — Value counts for event + property
- `umami_send_event` — Send a tracking event via `/api/send`
</details>

<details>
<summary><strong>Reports (11)</strong></summary>

- `umami_list_reports` — List saved reports
- `umami_get_report` — Fetch a saved report
- `umami_report_funnel` — Funnel conversion
- `umami_report_retention` — Retention cohorts
- `umami_report_goal` — Goal tracking
- `umami_report_journey` — User journeys
- `umami_report_attribution` — Attribution (first/last click)
- `umami_report_utm` — UTM campaign breakdown
- `umami_report_revenue` — Revenue by currency
- `umami_report_performance` — Core Web Vitals
- `umami_report_breakdown` — Breakdown by custom fields
</details>

<details>
<summary><strong>Teams (6)</strong></summary>

- `umami_list_teams` — List teams
- `umami_get_team` — Team details
- `umami_create_team` — Create a team
- `umami_update_team` — Update name/access code
- `umami_delete_team` — Delete a team
- `umami_list_team_members` — List team members
</details>

<details>
<summary><strong>Users — self-hosted only (3)</strong></summary>

- `umami_list_users` — List all users (admin)
- `umami_create_user` — Create a user
- `umami_delete_user` — Delete a user
</details>

## Examples

Ask Claude things like:

- "How many pageviews did my site get this week?"
- "What are my top 10 referrers for the last 30 days?"
- "Show me a funnel from / to /checkout to /thank-you"
- "What's the retention look like for January?"
- "Who's on the site right now?"
- "Create a new website for staging.example.com"

## Development

```bash
bun install
bun test            # run test suite
bun run index.ts    # start the server (needs env vars)
bunx tsc --noEmit   # type check
bunx oxlint         # lint
```

## Sponsors

If this project saves you time, consider supporting its development:

- [GitHub Sponsors](https://github.com/sponsors/climactic)
- [Ko-fi](https://ko-fi.com/climacticco)

## License

[MIT](LICENSE)
