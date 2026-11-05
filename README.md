# cookbook-co-mcp

> **Unofficial.** Not affiliated with or endorsed by CookBook Co.

An MCP server for the [CookBook recipe manager](https://cookbookmanager.com) by CookBook Co.
It lets an agent search and edit your recipes, tags, meal planner and shopping lists.

CookBook has no public API, so the server talks to the same endpoints the web app uses.
It only ever acts on your own account, with your own login token.
CookBook Co can change those endpoints without notice.

## Authorization

There is no API key and no OAuth flow.
You sign in to the web app once, copy the token it holds, and give that token to the server.
Treat it like a password: it gives full access to your account.

### How it works

- Signing in to https://app.cookbookmanager.com produces a long random token (134 characters).
- Every request sends it base64-encoded in the `Authorization` header.
- Recent recipes, shopping lists and remembered aisles live in Firebase, not the REST API.
  The server trades the token for a Firebase sign-in, and the Firebase SDK keeps it signed in.
- The server reads the token from `COOKBOOK_TOKEN` once at startup, so after replacing it, restart the server.

### Getting the token

The web app keeps the token in a cookie called `cbtoken`.
Sign in at https://app.cookbookmanager.com, then open the browser developer tools (F12).
Go to the Application tab (Storage in Firefox) and open Cookies.
Pick `https://app.cookbookmanager.com` and copy the Value of `cbtoken`.

The app writes this cookie itself, from script, so it is not hidden from the page.
The value may look percent-encoded (full of `%2B` and similar).
That is fine: the server accepts it as it is.

Or, in the Console:

```js
copy(decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('cbtoken=')).slice(8)))
```

### Storing it

The server takes the token as it was copied, in the `COOKBOOK_TOKEN` environment variable:
surrounding quotes and percent-encoding are accepted.
It is long-lived, so nothing needs to re-read it: when it changes, put in the new one and restart the server.

Keep it in a secrets manager or an `EnvironmentFile` with restricted permissions, not in a unit file or a checked-in file.
Never paste the token into a chat, a commit or a config file that is checked in.

### Checking it

```sh
COOKBOOK_TOKEN='<paste the token>' npx -y cookbook-co-mcp check-token
# OK: account 12345, lifetime. Token of 134 characters.
```

It signs in once and prints only the account id and plan.

### When it stops working

Tools fail with a `701` or "log out and log in again" message when the token is no longer accepted.
Copy a fresh `cbtoken` cookie the same way, update `COOKBOOK_TOKEN` and restart the server.
The `cbtoken` cookie always shows an expiry one year ahead,
because the web app rewrites it from script with a fresh one-year expiry after every response.
That says nothing about how long the server honours the token.
In use the token has stayed valid for over a day, but its lifetime is not documented,
and it is not known whether signing out of the app revokes it.

## Install

Requires Node 22 or newer.

- **npx** (no install): use `"command": "npx", "args": ["-y", "cookbook-co-mcp"]` in the client config below.
- **Nix**: `nix run github:CarsonF/cookbook-co-mcp`, or add the flake as an input
  and use `packages.<system>.default` (it installs `bin/cookbook-mcp`).
- **Release asset**: download `cookbook-mcp.js` from the
  [latest release](https://github.com/CarsonF/cookbook-co-mcp/releases/latest) and run it with `node`.
- **From source**:

```sh
pnpm install
pnpm bundle          # writes dist/cookbook-mcp.js
```

The bundle is an ES module.
Its banner defines `require`, because firebase's gRPC dependency is CommonJS and loads Node built-ins with it.

## Client configuration

Register it with your MCP client over stdio (swap in `node /path/to/cookbook-mcp.js` for a release asset):

```json
{
  "mcpServers": {
    "cookbook": {
      "command": "npx",
      "args": ["-y", "cookbook-co-mcp"],
      "env": { "COOKBOOK_TOKEN": "<the token>" }
    }
  }
}
```

Or run one long-lived server and point clients at it over HTTP:

```sh
COOKBOOK_TOKEN='<the token>' COOKBOOK_PORT=8787 npx -y cookbook-co-mcp serve
```

```json
{ "mcpServers": { "cookbook": { "type": "http", "url": "http://127.0.0.1:8787/mcp" } } }
```

The HTTP server binds to `127.0.0.1` only and rejects requests with a foreign `Host` or `Origin` header.
It has no token of its own: any process on the machine can use it, so run it only on a machine you trust.

Both transports speak only the `2026-07-28` protocol, which has no sessions.
A client that opens with the older `initialize` handshake is refused with an
unsupported-protocol-version error that names the supported version.

| Variable | Meaning |
| --- | --- |
| `COOKBOOK_TOKEN` | Required. The login token copied from the web app. |
| `COOKBOOK_READ_ONLY` | Set to `1` to register only the read tools. |
| `COOKBOOK_PORT` | Port for `serve` (or pass it as `serve <port>`). |
| `COOKBOOK_DEFAULT_SHOPPING_LIST` | Shopping list used when a tool is given none. Default `Shopping List`. |
| `COOKBOOK_BACKUP_DIR` | Where recipe backups go. Default `~/.local/state/cookbook-mcp/backups`. |
| `COOKBOOK_BACKUP_KEEP` | Edit backups kept per recipe. Default 20. |
| `COOKBOOK_EXPORT_DIR` | Where exports go when no path is given. Default `~/Downloads`, else `~/.local/state/cookbook-mcp/exports`. |

### Cache timings

Recipes, the meal planner and tags are kept in memory.
Each has three settings, named `COOKBOOK_CACHE_<CACHE>_<SETTING>`:

| Cache | `<CACHE>` | `FRESH` | `MAX_AGE` | `REFRESH_EVERY` |
| --- | --- | --- | --- | --- |
| Recipes | `RECIPES` | `1m` | `1d` | `1h` |
| Meal planner | `MEAL_PLAN` | `1m` | `1d` | `1h` |
| Tags | `TAGS` | `1h` | none | `1d` |

- `FRESH`: a read inside this age is served as it is;
  a read after it is served too, and reloads behind it.
  `0` reloads on every read.
- `MAX_AGE`: a read past this age waits for a reload instead.
- `REFRESH_EVERY`: reloaded in the background this often, even if nobody reads it.

Values are durations such as `30s`, `5m` or `1h`.
`off` removes `MAX_AGE` or `REFRESH_EVERY`.
`MAX_AGE` must not be shorter than `FRESH`.
Example: `COOKBOOK_CACHE_RECIPES_FRESH=10s COOKBOOK_CACHE_TAGS_REFRESH_EVERY=off`.

## Tools

40 tools.
Agents also receive short usage instructions from the server when they connect.

| Area | Tools |
| --- | --- |
| Find and read | `search_recipes`, `get_recipe`, `get_recent_recipes`, `list_tags`, `scale_recipe` |
| Edit a recipe | `update_recipe`, `rename_recipe`, `set_tags`, `set_favourite`, `rate_recipe`, `mark_cooked`, `set_recipe_photo`, `delete_recipe` |
| Add a recipe | `create_recipe`, `import_recipe_from_url`, `import_recipe_file` |
| Share | `export_recipe` (a `.cookbook` file or a PDF), `share_recipe_link` (a public link) |
| Tags | `create_tag`, `rename_tag`, `delete_tag` |
| Meal planner | `get_planned_meals`, `schedule_meal`, `update_planned_meal`, `unschedule_meal` |
| Shopping lists | `list_shopping_lists`, `get_shopping_list`, `create_shopping_list`, `delete_shopping_list`, `add_to_shopping_list`, `add_recipe_to_shopping_list`, `add_planned_meals_to_shopping_list`, `check_items`, `uncheck_items`, `remove_items`, `clear_completed` |
| Aisles | `set_item_aisle`, `teach_aisle`, `list_learned_aisles`, `forget_aisle` |

### Read-only access

Nine tools only read: the first row above, plus `get_planned_meals`, `list_shopping_lists`,
`get_shopping_list` and `list_learned_aisles`.
Every tool carries MCP annotations (read-only, destructive, idempotent, open-world),
but clients treat those as hints.
For a hard guarantee, run a second server entry with `COOKBOOK_READ_ONLY=1`:
the write tools are then not registered at all.

## Freshness

Where the data lives decides how current it is.

- **Shopping lists, their items, remembered aisles and recent views** live in Firebase.
  The server keeps a listener on each, all on one connection, so a read comes from memory
  and is current to within a moment of a change made in the app.
  Writes use the same connection, and a tool returns only once the server has confirmed the write.
  The listeners open when `serve` starts, or on first use over stdio.
  If the connection is down, reads wait up to 10 seconds and then fail with
  "Firestore ... is unavailable".
  A write the server has not confirmed within 15 seconds fails with a "may still apply" message,
  because the SDK keeps it queued and applies it when the connection returns.
- **Recipes** use the app's delta sync, so a refresh downloads only what changed.
  A read within a minute of the last sync is served as it is.
  After that it is served at once and refreshed in the background.
  The list is also refreshed hourly and is never served older than a day.
  Tools that edit a recipe read it fresh first,
  so an edit never uses an out-of-date `changed` value.
- **Tags** are served from memory, refreshed in the background once they are an hour old,
  and refreshed daily whether or not anyone reads them.
  Tag edits update the list in place.
- **The meal planner** is kept in memory from a year back to a year ahead,
  and refreshed like recipes: served as it is for a minute, then served at once
  and refreshed in the background, refreshed hourly, and never older than a day.
  A range outside that window is read from CookBook each time.
  Entries added, moved or removed through the tools update it in place,
  and renaming or deleting a recipe refreshes it.

A recipe, tag or planned meal added in the app can therefore be missing
from the first read after a long gap, and is there for the next one.

## Safety

- Tools that create or change a lot preview first and only write with `apply=true`:
  `update_recipe`, `create_recipe`, the imports and the recipe-to-list tools.
- Edits to a recipe need its `changed` value from `get_recipe`
  and are refused if someone edited the recipe since.
- Anything that rewrites a recipe saves a backup first.
  Backups of deleted recipes are kept for a year.
  Edit backups are pruned to the newest 20 per recipe.
- Deleting needs the exact name repeated back, and previews until `apply=true`.
  Deleting a tag also removes it from every recipe that has it, and the preview says how many.
- Unknown tag names are asked about (a prompt where the client supports it)
  instead of being created silently.
- `share_recipe_link` publishes the recipe to anyone with the link, and a link cannot be revoked
  short of deleting the recipe.

## Conventions

- Units are short (`tbsp`, `tsp`, `cup`, `oz`, `lb`, `fl oz`).
  Plain `oz` is weight; fluid ounces are written `fl oz`, except in drink recipes.
- A package size such as "15 oz can corn" keeps its size, and scaling changes how many cans.
- New tags are Title Case, and existing tags keep their spelling.
- A step that is a single line ending in a colon is a section header.
- Recipe names are shown as links, `[Name](https://app.cookbookmanager.com/recipe/<id>)`,
  which open the recipe in the web app for a signed-in user.
  The server's instructions ask the agent to build them from the recipe id, so tool output stays lean.
  The Android app's own `comappcookbook://recipe/<id>` link works in a browser,
  but some chat clients do not launch custom schemes, so it is not used.
- Shopping: "Shopping List" is the default list, and staples such as water, salt and pepper
  are skipped when adding a recipe, and reported.

## Development

```sh
pnpm install
pnpm typecheck       # tsc
pnpm bundle          # esbuild, one file for node
pnpm test            # bundle, then smoke-test the server
```

The source is in `src/`:

- `api/`: the CookBook client.
  `core/` is the route-unaware foundation (HTTP, auth, the reply envelope, the cache),
  `firestore/` holds the Firebase SDK session
  and its live collections (listeners and batched writes),
  and `recipes/`, `tags/`, `shopping/` and `meal-plan/` each hold that feature's endpoints and types.
  It imports nothing from the rest of the server and could be its own package.
- `tools/`: one file per MCP tool, grouped by feature (`recipes/`, `tags/`, `meal-plan/`, `shopping/`),
  with shared helpers in `tools/shared/`.
- `domain/`: pure logic over recipes (units, scaling, edits, change diffs) and shopping (list planning, aisles).
- `files/`: local file handling (`.cookbook` files, export paths, recipe backups, image loading).
- `pdf/`: the PDF export (layouts, nutrition table, styles and the embedded fonts).
- `server/`: config, the CLI, the HTTP entry point and the agent instructions; `index.ts` picks stdio or HTTP.

The PDF follows the app's own full-page layouts (`layout`: side_by_side_full by default,
side_by_side_compact, detailed_step_by_step, minimalistic):
A4, the app's pdfmake and Noto Sans font, a header bar per section,
and the photo and nutrition table.
`exclude` and `font_size` mirror the app's PDF settings.
`src/pdf/fonts/` is embedded into the bundle,
so PDF export needs `pnpm bundle` and does not work from `tsc` output.

When dependencies change, run `scripts/update-pnpm-hash.sh` to refresh the Nix package's pnpm hash.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## Disclaimer

This project drives an undocumented API with a login cookie copied from your own browser session.
It may break at any time, and its use may be restricted by CookBook Co's terms.
Use it at your own risk, with your own account.

## License

[MIT](LICENSE)
