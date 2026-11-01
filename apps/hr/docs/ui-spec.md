# H-HR user interface specification — Phase One

Scope: the surfaces delivered in Phase One (employee records, organization structure, self-service
entry). Leave, attendance, payroll and self-service extensions are not part of this document.

The UI is one React application (`platform/web`) hosting app screens from `apps/hr/web`. There is no
separate H-HR login, shell or theme (`DEC-0004`).

## Navigation

| Route | Screen | Permission required |
|---|---|---|
| `/` | Launcher: one card per app the account may open | none (any signed-in account) |
| `/employees` | Employee directory | `hr.employee.read` |
| `/employees/new` | Create employee | `hr.employee.create` |
| `/employees/$employeeId` | Employee profile | `hr.employee.read` |
| `/organization` | Organization structure, six tabs | `hr.organization.read` |
| `/me` | Own employment record | `hr.employee.read` |
| `/login` | Redirects to `/`; the shell already shows sign-in to anonymous callers | none |

Navigation entries disappear when the session lacks the permission. That is a convenience only: every
request is authorized again on the server with the caller's data scope (`SEC-002`).

Unlinked self-service accounts are routed to `/me` successfully and see an explained empty state,
not a blank screen.

## Screen states

Every screen implements the same four states so the behaviour is predictable:

| State | Presentation |
|---|---|
| Loading | Skeletons with `aria-busy="true"`; route chunks show a centred loading line inside the shell |
| Empty | `EmptyState` with a title that says what is missing and what to do next |
| Error | `ErrorAlert` with the server's message key and a Retry action |
| Forbidden | `ForbiddenScreen` at the route boundary; a per-screen 403 renders an in-place restricted state instead of a blank gap |

A profile section the caller may not read is omitted rather than shown empty; sensitive identifiers
arrive already masked from the server (`****7890`), so the browser never receives the full value.

## Screens

### Employee directory (`/employees`)

- Search box (name, employee number, work email), status filter, Reset, and an optional "advanced"
  disclosure for branch, location, organization unit and job title.
- Result count, a table with employee number, name, status badge, work email and an Open action.
- Cursor pagination: Previous / Next, page number, and an explicit "end of the list" line.
- `New employee` appears only with `hr.employee.create`.

### Create employee (`/employees/new`)

- Two-column form on tablet and desktop, one column on phone.
- Branch, location and organization unit are dependent selects: choosing a branch narrows locations
  and units. The unit list shows the materialized path so identical names in different branches are
  distinguishable.
- Effective start date is required; the created employee's status is derived by the server, never
  chosen by the client.
- Arabic name fields are marked `dir="rtl"` inside the English layout so mixed input stays legible.

### Employee profile (`/employees/$employeeId`)

Header: employee number, display name (localized), status badge, unit and job title, plus the action
buttons the caller may use — Edit details, Change status, Change assignment, Change manager, Add
emergency contact, Add document reference.

Sections, each in its own card:

1. **Summary** — work email, branch, location, reporting manager.
2. **Identity** — national ID and passport masked, date of birth, gender, nationality. Hidden entirely
   without `hr.employee.read.sensitive`.
3. **Contact** — personal email, phone, city.
4. **Employment** — start date, employment type, probation end, episode table, contract summary.
5. **Organization** — current unit, branch, job title, work arrangement, path, cost center, assignment
   history with half-open effective ranges, and manager history.
6. **Documents** — type, classification, issued and expiry dates, archive reference.
7. **History** — the audit timeline: what changed, when, by whom, and the recorded reason.
8. **Login account** — linked account id and link date.

Action panels are inline cards, not modals: the record stays visible while the operator works, which
matters on a narrow screen where a modal would cover the data being edited.

### Organization (`/organization`)

Six tabs sharing one overview query: Branches, Locations, Units, Job titles, Job grades, Work
schedules. Each tab has a table, an empty state and — with `hr.organization.manage` at scope `all` —
one create panel.

The work schedule editor is a seven-row table: rest day toggle, start, end, unpaid break minutes. Rest
days disable the time inputs instead of hiding them, so the week stays comparable row by row.

Creating an org unit requires the parent to be inside the caller's scope; root units require global
scope. That rule is enforced by the server; the UI only offers branches the caller can see.

### Self-service (`/me`)

The same profile body with every management action suppressed and no organization picker. An account
that is not linked to an employee record sees: *"Your account is not linked to an employee record"*
with the next step. The 403 from the API is expected here and is deliberately not surfaced as an
error.

## Language, direction and formatting

- One language switcher in the shell header (and in the mobile drawer). It changes i18next, flips
  `<html lang>` and `<html dir>`, and persists the choice.
- All copy comes from i18next catalogs: shell keys in `platform/i18n`, H-HR keys under the `hr.`
  prefix in `apps/hr/web/src/i18n`. A test asserts English and Arabic have identical keys, no empty
  strings and identical interpolation placeholders.
- Dates go through one formatter (`formatDate`) and numbers through `formatNumber`, both bound to the
  active locale. Raw ISO timestamps never reach the screen.
- Layout uses logical properties only (`ms-*`, `me-*`, `ps-*`, `pe-*`, `border-s`, `start-*`, `end-*`),
  so the Arabic layout mirrors without direction-specific overrides.
- Server-provided names are bilingual objects. A missing Arabic name falls back to the English value
  rather than rendering empty.

## Accessibility

- Skip link to `#main`, semantic landmarks (`header`, `nav`, `main`, `footer`).
- Tabs use `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` and a labelled panel.
- Every input is bound to a `<label>`; schedule row controls carry an explicit `aria-label` that names
  both the field and the weekday.
- Status is never conveyed by colour alone: badges carry text, and trend/status text repeats the state.
- Focus is visible on every interactive element; the skip link becomes visible on focus.
- Tables have `scope="col"` headers.

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| Phone (< 640px) | Single column, hamburger navigation, tables scroll horizontally inside their card, action buttons wrap |
| Tablet (640–1024px) | Two-column forms, top navigation visible from `md` |
| Desktop (≥ 1024px) | Three-column launcher, full tables, no horizontal scroll |

## Deliberate limitations

- No bulk import, export or print; `hr.employee.export` exists as a permission but no screen uses it.
- No org-unit rename, move or archive; create only.
- No document upload: document references point at an archive id owned by a future document service.
- No employee photo/avatar; initials are not used as a fallback.
- Rehire is not exposed as an operation yet, although the data model supports a new employment
  episode.
