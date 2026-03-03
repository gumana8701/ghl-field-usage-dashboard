# GHL Field Usage Dashboard

A Next.js + Postgres dashboard that audits GoHighLevel custom field usage across your contacts. Built for cleaning up unused fields in personal injury lead gen subaccounts.

## What it does

1. **Syncs** all contacts from a GHL location via the LeadConnector API
2. **Counts** how many contacts have a non-empty value for each custom field
3. **Groups by source** so you can see which lead sources populate which fields
4. **Deletes** unused fields directly from the dashboard via the GHL API

## Stack

- **Next.js 14** (App Router, server components)
- **Prisma + Postgres** (Vercel Postgres, Neon, or Supabase)
- **Vercel** for hosting
- **GHL Private Integration Token** for API access

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd ghl-field-usage-dashboard
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `DATABASE_URL` — your Postgres connection string
- `GHL_LOCATION_ID` — your subaccount location ID
- `GHL_PRIVATE_INTEGRATION_TOKEN` — your private integration token
- `SYNC_SECRET` — any string to protect the sync API endpoint

### 3. Set up the database

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

### 4. Run the initial sync

```bash
pnpm sync:all
```

This paginates through all your contacts (100 per page, ~350ms delay between pages). For ~4,000 contacts it takes about 5-8 minutes.

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see the dashboard with real data.

### 6. Deploy to Vercel

```bash
vercel deploy
```

Set the same env vars in your Vercel project settings. The dashboard runs as a server component that queries Postgres on each page load.

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── sync/route.ts      # POST - batchy sync for Vercel
│   │   └── fields/route.ts    # DELETE - remove field from GHL + DB
│   ├── dashboard/
│   │   ├── page.tsx            # Server component - fetches data
│   │   └── client.tsx          # Client component - interactive UI
│   ├── layout.tsx
│   └── page.tsx                # Redirects to /dashboard
├── lib/
│   ├── ghl.ts                  # GHL API client (fetch + zod)
│   ├── prisma.ts               # Prisma singleton
│   └── usage.ts                # Analytics queries (source grouping)
scripts/
└── sync-all.ts                 # Full sync script (run locally)
prisma/
└── schema.prisma               # DB schema
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sync` | Sync a batch of contacts (needs `x-sync-secret` header) |
| DELETE | `/api/fields` | Delete a custom field `{ fieldId: "..." }` |

## Database Schema

- **CustomField** — field metadata from GHL (id, name, fieldKey, dataType, etc.)
- **Contact** — contact records with source field for grouping
- **ContactCustomFieldValue** — pivot table (contactId, fieldId, value)
- **SyncRun** — tracks sync progress and history

## Notes

- Uses `POST /contacts/search` (the current recommended endpoint). The old `GET /contacts/` was deprecated by GHL.
- The delete button calls `DELETE /locations/:locationId/customFields/:fieldId` — this is permanent and removes the field from GHL.
- For re-syncing after changes, just run `pnpm sync:all` again. It upserts everything.
