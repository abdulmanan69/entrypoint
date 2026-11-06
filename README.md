# Vertex Pakistan entrypoint

The front door at **https://vertexpakistan.com**. One page that sends staff to each company tool:

| Tool | Address | Shortcut |
| --- | --- | --- |
| HR | https://hr.vertexpakistan.com | `H` |
| QA | https://qa.vertexpakistan.com | `Q` |
| CRM | https://crm.vertexpakistan.com | `C` |

Each card shows whether its tool is online right now, checked by the server every 30 seconds. The header shows the time in Karachi and New York.

The site is static HTML on nginx. It has no database, no npm packages and no client framework, and uses a few MB of memory on the server.

## Change the tools

Everything people see is in **`tools.json`**. To add, remove or reword a tool, edit that file and push. You don't need to touch HTML.

```json
{
  "name": "Dialer",
  "url": "https://dialer.vertexpakistan.com",
  "key": "d",
  "description": "Live campaigns, lists and agent seats.",
  "preview": "window",
  "tint": "rose"
}
```

| Field | Required | What it does |
| --- | --- | --- |
| `name` | yes | Card title. |
| `url` | yes | Where the card goes. Must be `https://`. Also the address the status check calls. |
| `description` | yes | One sentence under the title. |
| `key` | no | One letter or digit that opens the tool from the keyboard. Each tool needs a different one. |
| `preview` | no | The picture at the top of the card: `payslip`, `call`, `pipeline` or `window` (a plain app window, the default for new tools). |
| `tint` | no | Preview color: `indigo`, `green`, `amber`, `rose` or `slate` (default). |

The cards lay out in 3 columns, or in 2 when there are 2 or 4 tools.

The `site` block in `tools.json` sets:

- the company name
- the headline and the sentence under it
- the header clocks, as time zone names such as `Asia/Karachi`

Before you push, check the file:

```sh
npm run check     # says exactly what is wrong in tools.json, or "ok"
```

## Work on it locally

You need Node 18 or later. There is nothing to install.

```sh
npm run dev       # http://localhost:4319 by default; rebuilds on every reload; live status included
npm run build     # writes dist/
```

To use a different port, pass it after `--`, for example `npm run dev -- 5000`.

## How it is put together

```
tools.json              the content: tools, headline, clocks
src/index.html          page template ({{PLACEHOLDERS}} filled by the build)
src/card.html           one tool card
src/previews/*.html     the pictures at the top of each card; add a file here to add a new preview
src/styles.css          all styling; light and dark follow the device setting
src/app.js              clocks, status dots, keyboard shortcuts, the call waveform
scripts/build.mjs       checks tools.json and renders dist/
scripts/serve.mjs       local preview server
scripts/status-loop.sh  runs in the container: checks every tool every 30 s, writes status.json
nginx.conf              caching and security headers (strict CSP: no inline scripts, no third-party calls)
Dockerfile              build with Node, serve with nginx:alpine
```

**Status dots.** The server checks the tools itself, not the visitor's browser, because some tools (the CRM, for example) block requests from other sites. A tool counts as online when it answers with any HTTP status below 500. If `status.json` is more than 3 minutes old, the card says "Status unknown" rather than showing an old result.

To add a preview:

1. Create `src/previews/<name>.html`. It can use `{{NAME}}` and the `.sheet` and `.accent` classes.
2. Add its styles to `src/styles.css`.
3. Use `"preview": "<name>"` in `tools.json`.

## Deploy

It runs on Coolify at 72.61.151.103 as its own application, built from this repo's `Dockerfile`. It serves `https://vertexpakistan.com`, and `www` redirects there.

Coolify doesn't deploy on push: after you push, click **Redeploy** in Coolify or call its deploy API.

DNS (GoDaddy):

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `72.61.151.103` |
| CNAME | `www` | `vertexpakistan.com` |

Run any image locally:

```sh
docker build -t vertex-entrypoint .
docker run --rm -p 8080:80 vertex-entrypoint
```
