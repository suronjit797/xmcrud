## 1.3.1: 
    - Introduce protected fields for updates 
    - take object as parameter in "generateCrudRoutes"


## 1.3.2
    - Introduce invalidateCache only for redis caching. [provide array of route names]


## 1.5.0 (backward compatible with 1.4.x)
    Security / data safety
    - Bulk update/delete reject an empty filter with 400 (previously updated or wiped the whole collection)
    - `ids` filter accepts comma-separated strings and arrays; invalid ObjectIds return 400 instead of 500
    - `?select=+field` is ignored; `populate` limited to schema paths or `paginationConfig.allowedPopulate`; new `allowedSelect`
    - Protected fields are stripped inside update operators (`$set`, `$inc`, `$rename`, ...) on single update
    - Cache uses SCAN instead of KEYS, never deletes `bull:`/`bullmq:` keys, and redis errors no longer fail requests

    Bug fixes
    - Published package ships its type definitions
    - Filters on fields inside subdocument arrays and nested subdocuments (`members.member`, `address.city`) are applied
    - `?search=` handles invalid regex text and number/date/boolean/ObjectId fields by type
    - Unparseable filter values are skipped; schema fields that end like an operator (e.g. `check_in`) filter correctly
    - Cache is cleared only after a successful write; `updateMany` returns the matched documents even if the filter fields changed
    - Nested populate supports any depth (`a.b.c`)

    New (opt-in)
    - Reference search: `partialFilterMiddlewares([{ path, refFields }])`; `buildSearchCondition` export
    - `req.scopeFilter` for row-level scoping (kept in the cache key)
    - `writableQueryMiddleware` for Express 5 `req.query`
    - `errorHandler` (uses `statusCode`/`status` of any error class), `stripProtectedFields`, public types
    - `filterHelper(query, fields, schema, { exclude, searchCondition })`; `paginationConfig.allowNoLimit`
    - `redisGenerateCacheKey(req, { name, scope })`; without options the 1.4 key format is unchanged
    - CLI validates module names, supports `--version`, template adds `removeManyPost`
