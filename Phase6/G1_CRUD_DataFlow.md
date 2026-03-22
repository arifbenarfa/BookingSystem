# G1 — CRUD data flow (Phase6 Booking System)

Phase6 stores resources in Postgres and exposes them under `/api/resources`. Below is how **Create, Read, Update, Delete** work in the code I used from the course ZIP (`BookingSystemPhase6`).

Main files:

- `public/form.js` — form submit, `fetch` for POST/PUT/DELETE
- `public/resources.js` — loads the list with `GET /api/resources`, edit mode, `onResourceActionSuccess` refresh
- `src/routes/resources.routes.js` — Express routes
- `src/validators/resource.validators.js` — validation on POST and PUT
- `src/services/log.service.js` — writes to `booking_log` after create/update/delete (not on plain GET)

**Endpoints (what I saw in Network + quick HTTP tests)**

| Operation | Method | Path | Success |
|-----------|--------|------|---------|
| Create | POST | `/api/resources` | 201 + JSON |
| Read list | GET | `/api/resources` | 200 + `{ ok, data: [...] }` |
| Read one | GET | `/api/resources/:id` | 200 + one row (API has this; the list page uses cache when you click a row) |
| Update | PUT | `/api/resources/:id` | 200 + JSON |
| Delete | DELETE | `/api/resources/:id` | 204, no body |

---

## CREATE — POST /api/resources

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

## READ — GET /api/resources (and GET /api/resources/:id)

Opening `/resources` runs `loadResources()` in `resources.js` → `fetch("/api/resources")`. Clicking a list item does **not** call `GET /:id`; it reads from `resourcesCache`. The route `GET /api/resources/:id` still exists on the server (good for testing invalid id / missing row).

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

Extra checks on **read one** (curl/Postman): bad id → 400 `Invalid ID`; id that does not exist → 404; valid id → 200 with the row.

---

## UPDATE — PUT /api/resources/:id

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

## DELETE — DELETE /api/resources/:id

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
        F->>U: showFormMessage (error)
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

## DevTools

- **Network:** method + URL as in the table; POST/PUT send JSON with `resourceName`, `resourceDescription`, `resourceAvailable`, `resourcePrice`, `resourcePriceUnit`.
- **Delete:** 204 has no body — `form.js` skips JSON parse for 204.
- **Console:** failed list load logs in `resources.js`; network errors log in `form.js`.

---

## Tests (Docker + localhost)

I ran Phase6 with Docker (`docker compose up`) and hit `http://localhost:5000` (port from `.env`). Same URLs as in the browser Network tab.

| Check | Request | Result |
|--------|---------|--------|
| Read list | GET /api/resources | 200 + data array |
| Create | POST /api/resources | 201 |
| Create bad body | POST | 400 |
| Duplicate name | POST | 409 |
| Read one | GET /api/resources/:id | 200 if exists |
| Read one bad id | GET /api/resources/notanumber | 400 |
| Read one missing | GET /api/resources/99999 | 404 |
| Update | PUT /api/resources/:id | 200 |
| Update duplicate name | PUT | 409 |
| Update missing id | PUT /api/resources/99999 | 404 |
| Delete | DELETE /api/resources/:id | 204 empty |
| Delete again | DELETE same id | 404 |

Course materials: AdvWebDev2026K → Phase6 → `BookingSystemPhase6.zip`.
