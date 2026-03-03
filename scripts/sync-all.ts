import "dotenv/config";
import { searchContacts, fetchCustomFields } from "../src/lib/ghl";
import { prisma } from "../src/lib/prisma";

function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  // Validate env
  if (!process.env.GHL_PRIVATE_INTEGRATION_TOKEN) {
    console.error("❌ Missing GHL_PRIVATE_INTEGRATION_TOKEN — copy .env.example to .env and fill it.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("❌ Missing DATABASE_URL — set your Postgres connection string.");
    process.exit(1);
  }

  // Create sync run record
  const syncRun = await prisma.syncRun.create({
    data: { status: "running" },
  });

  try {
    // ── Stage 1: Custom fields ──
    console.log("📋 Syncing custom fields...");
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
    console.log(`   ✓ ${fields.length} fields synced`);

    // ── Stage 2: Contacts via POST /contacts/search ──
    console.log("👥 Syncing contacts via POST /contacts/search...");
    let page = 1;
    let total = 0;

    while (true) {
      const result = await searchContacts({ page, pageLimit: 100 });

      if (!result.contacts.length) {
        console.log(`   Page ${page}: empty — done.`);
        break;
      }

      for (const c of result.contacts) {
        await prisma.$transaction(async (tx) => {
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
        }, { timeout: 30000 });
      }

      total += result.contacts.length;
      console.log(`   Page ${page}: +${result.contacts.length} (total: ${total})`);

      // Update sync run progress
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: { pagesProcessed: page, contactsIngested: total, fieldsIngested: fields.length },
      });

      // If we got fewer than 100, we're on the last page
      if (result.contacts.length < 100) break;

      page++;

      // Rate limit: ~3 requests/sec to stay safe
      await new Promise((r) => setTimeout(r, 350));
    }

    // Mark sync done
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "done", finishedAt: new Date(), contactsIngested: total, fieldsIngested: fields.length, pagesProcessed: page },
    });

    console.log(`\n✅ Done. ${total} contacts ingested across ${page} pages.`);
  } catch (e: any) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "error", finishedAt: new Date(), error: String(e?.message || e) },
    });
    throw e;
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
