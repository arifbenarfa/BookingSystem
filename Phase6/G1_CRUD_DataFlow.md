# G1 — CRUD Data Flow (Phase6 Booking System)

This document models how **Phase6** handles **Create**, **Read**, **Update**, and **Delete** for the `resources` API. Flows are aligned with the codebase:

- **Frontend:** `public/form.js` (submit → `fetch`), `public/resources.js` (list load, edit mode, `window.onResourceActionSuccess` refresh).
- **Backend:** `src/app.js` mounts `src/routes/resources.routes.js` at **`/api/resources`**.
- **Validation:** `src/validators/resource.validators.js` (`express-validator`) on **POST** and **PUT**.
- **Persistence:** `src/db/pool.js` → PostgreSQL (`resources` table in `db/init/001_create_resources.sql`).
- **Audit logging (C / U / D only):** `src/services/log.service.js` → `booking_log` (logging failures are non-fatal).

**Observed HTTP surface**

| Operation | Method | Path | Typical success |
|-----------|--------|------|-----------------|
| Create | `POST` | `/api/resources` | `201 Created` + JSON body |
| Read (list) | `GET` | `/api/resources` | `200 OK` + `{ ok, data: [...] }` |
| Read (one) | `GET` | `/api/resources/:id` | `200 OK` + `{ ok, data: {...} }` *(implemented in API; list UI uses cache after list load)* |
| Update | `PUT` | `/api/resources/:id` | `200 OK` + JSON body |
| Delete | `DELETE` | `/api/resources/:id` | `204 No Content` *(empty body)* |

---

## CREATE — `POST /api/resources`

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Browser)
    participant F as Frontend (form.js)
    participant R as Frontend (resources.js)
    participant E as Express (resources.routes.js)
    participant V as express-validator (resource.validators.js)
    participant L as log.service.js
    participant DB as PostgreSQL

    U->>F: Submit "Create" on #resourceForm
    F->>F: getPayloadFromForm() → JSON body
    F->>E: POST /api/resources (Content-Type: application/json)

    E->>V: Run resourceValidators on body
    alt Validation fails
        V-->>E: errors array
        E-->>F: 400 { ok: false, errors: [{ field, msg }, ...] }
        F->>U: showFormMessage(error) — buildValidationMessage(errors)
    else Validation OK
        E->>DB: INSERT INTO resources (...) RETURNING *
        alt Unique name conflict (SQL 23505)
            DB-->>E: duplicate key
            E->>L: logEvent (duplicate blocked)
            E-->>F: 409 { ok: false, error: "Duplicate resource name" }
            F->>U: showFormMessage — duplicate name message
        else Insert OK
            E->>L: logEvent("Resource created (ID …)")
            E-->>F: 201 { ok: true, data: row }
            F->>U: showFormMessage(success)
            F->>R: onResourceActionSuccess({ action: "create" })
            R->>E: GET /api/resources (reload list)
            E->>DB: SELECT * … ORDER BY created_at DESC
            E-->>R: 200 { ok: true, data: rows }
            R->>U: renderResourceList(resourcesCache)
        end
    end
```

---

## READ — `GET /api/resources` (and optional `GET /api/resources/:id`)

The **resources page** loads the list on startup via `loadResources()` in `resources.js` (`fetch("/api/resources")`). Selecting a row fills the form from **`resourcesCache`** (no second request). The backend also implements **`GET /api/resources/:id`** (invalid id → `400`, missing row → `404`, found → `200`) for clients that fetch a single resource by id.

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Browser)
    participant R as Frontend (resources.js)
    participant E as Express (resources.routes.js)
    participant DB as PostgreSQL

    U->>R: Open /resources (page load)
    R->>E: GET /api/resources
    alt List success
        E->>DB: SELECT * FROM resources ORDER BY created_at DESC
        DB-->>E: rows
        E-->>R: 200 JSON ok plus data rows
        R->>R: resourcesCache = body.data
        R->>R: renderResourceList()
        R->>U: Clickable resource buttons (data-resource-id)
    else Database / server error
        E-->>R: 500 Database error JSON
        R->>R: console.error Failed to load resources (see status)
        R->>U: Empty list UI
    end

    Note over U,R: Selecting a resource uses cached row (no second GET for one item)
    Note over R,E: After CUD, onResourceActionSuccess then loadResources repeats GET list
```

**Read-one API** (`GET /api/resources/:id`, not used by the list UI): `GET …/not-a-number` → `400` `"Invalid ID"`; `GET …/999999` where row missing → `404` `"Resource not found"`; `GET …/1` → `200` `{ ok: true, data: row }`.

---

## UPDATE — `PUT /api/resources/:id`

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Browser)
    participant F as Frontend (form.js)
    participant R as Frontend (resources.js)
    participant E as Express (resources.routes.js)
    participant V as express-validator (resource.validators.js)
    participant L as log.service.js
    participant DB as PostgreSQL

    U->>R: Click resource in list → selectResource() (edit mode)
    U->>F: Change fields → enable "Update" when valid + changed
    U->>F: Submit "Update"
    F->>F: If missing resourceId → client error (no fetch)
    F->>E: PUT /api/resources/:id + JSON body

    E->>E: Number(id) — if NaN → 400 { error: "Invalid ID" }
    E->>V: resourceValidators + validationResult
    alt Validation fails
        E-->>F: 400 { ok: false, errors: [...] }
        F->>U: showFormMessage — validation lines
    else Validation OK
        E->>DB: UPDATE resources SET … WHERE id RETURNING *
        alt No row updated
            E-->>F: 404 { ok: false, error: "Resource not found" }
            F->>U: showFormMessage — not found / refresh hint
        else Duplicate name (23505)
            E-->>F: 409 { ok: false, error: "Duplicate resource name" }
            F->>U: showFormMessage — duplicate name
        else Update OK
            E->>L: logEvent("Resource updated …")
            E-->>F: 200 { ok: true, data: row }
            F->>U: showFormMessage(success)
            F->>R: onResourceActionSuccess({ action: "update" })
            R->>E: GET /api/resources
            E-->>R: 200 + refreshed list
        end
    end
```

---

## DELETE — `DELETE /api/resources/:id`

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Browser)
    participant F as Frontend (form.js)
    participant R as Frontend (resources.js)
    participant E as Express (resources.routes.js)
    participant L as log.service.js
    participant DB as PostgreSQL

    U->>F: Submit "Delete" (edit mode, resource selected)
    F->>F: If missing resourceId → client error (no fetch)
    F->>E: DELETE /api/resources/:id (no body)

    E->>E: Number(id) — if NaN
    alt Invalid id
        E-->>F: 400 { ok: false, error: "Invalid ID" }
        F->>U: showFormMessage — generic / validation path for 400
    else Valid id
        E->>DB: DELETE FROM resources WHERE id = $1
        alt No row deleted
            E-->>F: 404 { ok: false, error: "Resource not found" }
            F->>U: showFormMessage — not found
        else Deleted
            E->>L: logEvent("Resource deleted …")
            E-->>F: 204 No Content (empty body)
            F->>F: response.status === 204 → responseBody = null
            F->>U: showFormMessage(success)
            F->>R: onResourceActionSuccess({ action: "delete" })
            R->>E: GET /api/resources
            E-->>R: 200 + updated list
        end
    end
```

---

## Console & Network notes (DevTools)

- **Network:** Match **Method** and **URL** to the table above; **Create/Update** send `Content-Type: application/json` with `resourceName`, `resourceDescription`, `resourceAvailable`, `resourcePrice`, `resourcePriceUnit`.
- **Delete:** `204` responses have **no JSON body** — `form.js` treats `204` before `readResponseBody()`.
- **Console:** On failed list load, `resources.js` logs `Failed to load resources:` with status; `form.js` logs `Fetch error:` on network failure.

---

## Runtime verification (Docker + HTTP)

Phase6 was run with `docker compose up -d --build` from the Phase6 project folder (`.env` maps **`EPORT=5000`** → app). The following were checked against **`http://localhost:5000`** (same requests the browser **Network** tab shows; you can repeat in DevTools or with curl/Invoke-WebRequest):

| Check | Request | Result |
|--------|---------|--------|
| Read list | `GET /api/resources` | `200`, `{ "ok": true, "data": [...] }` |
| Create | `POST /api/resources` (valid JSON body) | `201`, `{ "ok": true, "data": { ... } }` |
| Create validation | `POST` with invalid body | `400`, `{ "ok": false, "errors": [...] }` |
| Create duplicate | `POST` same `resourceName` (case-insensitive unique index) | `409`, `{ "ok": false, "error": "Duplicate resource name" }` |
| Read one | `GET /api/resources/:id` | `200` + row when present |
| Read one | `GET /api/resources/notanumber` | `400` `"Invalid ID"` |
| Read one | `GET /api/resources/99999` (missing row) | `404` `"Resource not found"` |
| Update | `PUT /api/resources/:id` (valid body) | `200`, `{ "ok": true, "data": { ... } }` |
| Update duplicate | `PUT` with name that clashes with another row | `409` |
| Update missing | `PUT /api/resources/99999` | `404` |
| Delete | `DELETE /api/resources/:id` | `204` **empty body** |
| Delete missing | `DELETE` same id again | `404` |

---

*Phase6 source: `BookingSystemPhase6` (AdvWebDev2026K Materials). Diagrams reflect `src/routes/resources.routes.js`, `public/form.js`, and `public/resources.js`.*
