import { NextRequest, NextResponse } from "next/server";
import { searchContacts, fetchCustomFields } from "@/lib/ghl";
import { prisma } from "@/lib/prisma";

function requireSecret(req: NextRequest) {
  const expected = process.env.SYNC_SECRET || "";
  if (!expected) return;
  const got = req.headers.get("x-sync-secret") || req.nextUrl.searchParams.get("secret") || "";
  if (got !== expected) throw new Error("Unauthorized");
}

function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * POST /api/sync
 * Body: { startPage?: number, pages?: number }
 * Ingests a few pages per call to avoid Vercel timeouts.
 * For full sync, use: pnpm sync:all
 */
export async function POST(req: NextRequest) {
  try {
    requireSecret(req);
    const body = await req.json().catch(() => ({} as any));
    const startPage = Number(body.startPage || 1);
    const pages = Math.min(Number(body.pages || 3), 10);

    // ── Sync custom fields ──
    const fields = await fetchCustomFields();
    const locationId = process.env.GHL_LOCATION_ID || "";

    for (const f of fields) {
      await prisma.customField.upsert({
        where: { id: f.id },
        create: {
          id: f.id,
          locationId: String(f.locationId || locationId),
          name: String(f.name || ""),
          fieldKey: f.fieldKey || null,
          dataType: f.dataType || null,
          picklistOptions: (f.picklistOptions || null) as any,
          position: f.position != null ? Number(f.position) : null,
          parentId: f.parentId || null,
          standard: Boolean(f.standard),
          dateAdded: toDate(f.dateAdded),
        },
        update: {
          name: String(f.name || ""),
          fieldKey: f.fieldKey || null,
          dataType: f.dataType || null,
          picklistOptions: (f.picklistOptions || null) as any,
          position: f.position != null ? Number(f.position) : null,
          parentId: f.parentId || null,
          standard: Boolean(f.standard),
        },
      });
    }

    // ── Paginate contacts via POST /contacts/search ──
    let totalIngested = 0;

    for (let i = 0; i < pages; i++) {
      const currentPage = startPage + i;
      const result = await searchContacts({ page: currentPage, pageLimit: 100 });

      if (!result.contacts.length) break;

      await prisma.$transaction(async (tx) => {
        for (const c of result.contacts) {
          await tx.contact.upsert({
            where: { id: c.id },
            create: {
              id: c.id, locationId: c.locationId,
              contactName: c.contactName || null, firstName: c.firstName || null,
              lastName: c.lastName || null, email: c.email || null,
              phone: c.phone || null, type: c.type || null,
              source: c.source || null, assignedTo: c.assignedTo || null,
              city: c.city || null, state: c.state || null,
              postalCode: c.postalCode || null, address1: c.address1 || null,
              country: c.country || null, website: c.website || null,
              timezone: c.timezone || null,
              dateAdded: toDate(c.dateAdded), dateUpdated: toDate(c.dateUpdated),
              tags: (c.tags || null) as any, dnd: c.dnd ?? null,
              dndSettings: (c.dndSettings || null) as any,
            },
            update: {
              contactName: c.contactName || null, firstName: c.firstName || null,
              lastName: c.lastName || null, email: c.email || null,
              phone: c.phone || null, type: c.type || null,
              source: c.source || null, assignedTo: c.assignedTo || null,
              city: c.city || null, state: c.state || null,
              postalCode: c.postalCode || null, address1: c.address1 || null,
              country: c.country || null, website: c.website || null,
              timezone: c.timezone || null,
              dateAdded: toDate(c.dateAdded), dateUpdated: toDate(c.dateUpdated),
              tags: (c.tags || null) as any, dnd: c.dnd ?? null,
              dndSettings: (c.dndSettings || null) as any,
            },
          });

          for (const entry of c.customFields || []) {
            const val = entry.value == null ? null : String(entry.value);
            await tx.contactCustomFieldValue.upsert({
              where: { contactId_fieldId: { contactId: c.id, fieldId: entry.id } },
              create: { contactId: c.id, fieldId: entry.id, value: val },
              update: { value: val },
            });
          }
        }
      });

      totalIngested += result.contacts.length;

      // Rate limit buffer
      await new Promise((r) => setTimeout(r, 350));
    }

    return NextResponse.json({
      ok: true,
      ingested: totalIngested,
      nextPage: startPage + pages,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    return NextResponse.json({ ok: false, error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
