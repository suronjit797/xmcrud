## 1.3.1: 
    - Introduce protected fields for updates 
    - take object as parameter in "generateCrudRoutes"


## 1.3.2
    - Introduce invalidateCache only for redis caching. [provide array of route names]


## 2.0.0 (breaking)
    Security / data safety
    - Bulk update/delete reject an empty filter with 400 (previously wiped or updated the whole collection)
    - `ids` filter accepts comma-separated strings and arrays; invalid ObjectIds return 400 instead of 500
    - `removeMany` middlewares also guard `POST /delete-many` unless `removeManyPost` is set
    - `?select=+field` is ignored; `populate` limited to schema paths or `paginationConfig.allowedPopulate`; new `allowedSelect`
    - Protected fields are stripped inside update operators (`$set`, `$inc`, `$rename`, ...) and from `updateMany`
    - `?limit=0` / invalid page and limit fall back to defaults; page and limit are integers
    - Search text is regex-escaped; `_regex` length is capped and invalid patterns return 400

    Bug fixes
    - Published package now ships its type definitions (`src/Types/index.ts`)
    - Cache keys are namespaced by `name` (`xmcrud:<name>:<path>?<query>`), so routers mounted on the same path no longer collide and invalidation always matches
    - Cache is invalidated after a successful write, uses SCAN instead of KEYS, and redis errors no longer fail requests
    - Unparseable filter values are skipped instead of matching missing fields; `field=null` works for numbers
    - Schema fields whose name ends like an operator (e.g. `check_in`) are filtered correctly
    - `remove` returns 404 when not found; `updateMany` uses matched documents and returns them even if the filter fields changed
    - Nested populate supports any depth (`a.b.c`)
    - Messages no longer append "s" to `name`

    Other
    - New exports: `errorHandler`, `stripProtectedFields`, and public types
    - CLI validates module names and supports `--version`; generated route template fixes
    - Node.js 20+ required; removed `dayjs`; build cleans `dist` first; removed unused cacheMiddleware and duplicate LICENSE.md
