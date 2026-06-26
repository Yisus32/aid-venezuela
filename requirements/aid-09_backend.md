AID-09
## AID-09: Backend Migration and Public (Hidden) Admin UI

### Goal

Migrate all current static data (acopios, professionals, infographics metadata) from JSON into a true database (Prisma Data Platform), and provide CRUD functionality via a hidden web admin page.

---

### Deployment (Prisma Compute)

- **Platform:** Prisma Compute (Managed "BaaS" with serverless functions, Prisma ORM)
- **Repo Setup:**
  - Authenticate:  
    `bunx @prisma/cli@latest auth login`
  - Deploy:  
    `bunx @prisma/cli@latest app deploy --project proj_cmqv49kd507kyzyf5se86elhp`
    - **Project Display Name:** `aid-venezuela`
    - **Region:** `us-east-1`
    - **Branch:** main
  - Project's primary database: wire the `DATABASE_URL` (Postgres, MySQL, etc.).  
    - Run Prisma migrations to set up tables from your schema.

---

### Data Migration

- **Current Data:** All information in static JSON (`public/images.json`, etc)
- **Migration Plan:**
  - Define all humanitarian metadata types in `prisma/schema.prisma`:
    - `Center`, `Professional`, `Organization`, `Location`, etc — matching the fields currently in JSON.
    - See all fields described in `scripts/image-metadata.json` mapping.
  - Migrate (one-time) the data from JSON into the DB (via script, or a Seeder using Prisma Client).

---

### Public CRUD Admin Page

- **Purpose:**  
  Full-featured Create/Read/Update/Delete UI for all humanitarian records.
- **Access:**  
  - **NOT** linked anywhere in public UI or sidebar.
  - Access only by direct, unguessable URL (e.g., `/admin-db-17s49ic/`), to be shared only with admins.
- **Features:**
  - List, search, and filter records by type (`center`, `professional`, etc) and key properties.
  - Create new entries, edit existing, delete, with form validation.
  - Show "Copy URL to clipboard" button: on click, copies the admin page URL for easy sharing among trusted assistants.
  - Show a visible warning: "Admin page – handle with care! Changes affect the live database."
- **UI:**
  - Easy table/grid for browse, with inline edit/new modals or page.
  - Use whatever stack matches your frontend (Astro/React, etc).
  - Auth is by obscurity (hidden URL) for now—secure properly before production.
- **Database:**  
  All mutations/queries via Prisma Client (API routes or server functions).
- **Sync:**  
  Site should live-query the DB for main data-set, replacing JSON usage; fallback to static mode if DB unavailable.

---

### Acceptance Criteria

- [ ] All static humanitarian data migrated to Prisma DB, types modeled for full fidelity.
- [ ] Deployed to Prisma Compute in correct project/region.
- [ ] Admin page live at secret URL, not listed in site navigation.
- [ ] CRUD: Add, browse, edit, delete, search records. All schema fields must be editable.
- [ ] "Copy URL" button present for sharing admin interface with assistants.
- [ ] Admin page clearly marked as dangerous, edits immediately update DB.
- [ ] Main site queries/reads from the DB (not images.json) in production mode.

---

### Notes

- (Security) Hidden URL isn't real security—convert to real admin auth when ready.
- (Migrations) Once migration is live, delete old static data or ensure it's not served.
- (Frontend) Consider using an admin component in Astro, Next.js or React (calls Prisma API routes).
- (Data consistency) Any changes in DB should reflect on user-facing site instantly.

---