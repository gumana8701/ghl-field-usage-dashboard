import { prisma } from "@/lib/prisma";

// ─── Types ───

export type SourceCount = {
  source: string;
  count: number;
};

export type FieldUsageRow = {
  id: string;
  name: string;
  fieldKey: string | null;
  dataType: string | null;
  parentId: string | null;
  filledCount: number;
  filledPct: number;
  totalContacts: number;
  sourceBreakdown: SourceCount[];
};

// ─── Main query ───

export async function getFieldUsage(): Promise<FieldUsageRow[]> {
  // 1. Total contacts
  const totalResult = await prisma.contact.count();
  const totalContacts = totalResult || 0;

  // 2. All custom fields
  const fields = await prisma.customField.findMany({
    select: {
      id: true,
      name: true,
      fieldKey: true,
      dataType: true,
      parentId: true,
    },
    orderBy: { name: "asc" },
  });

  // 3. Filled counts per field
  const filledCounts = await prisma.$queryRawUnsafe<
    { field_id: string; filled_count: number }[]
  >(`
    SELECT
      "fieldId" AS field_id,
      COUNT(DISTINCT "contactId")::int AS filled_count
    FROM "ContactCustomFieldValue"
    WHERE COALESCE("value", '') <> ''
    GROUP BY "fieldId"
  `);

  const filledMap = new Map<string, number>();
  for (const r of filledCounts) {
    filledMap.set(r.field_id, Number(r.filled_count));
  }

  // 4. Source breakdown per field
  const sourceRows = await prisma.$queryRawUnsafe<
    { field_id: string; source: string; cnt: number }[]
  >(`
    SELECT
      v."fieldId" AS field_id,
      COALESCE(c."source", 'Unknown') AS source,
      COUNT(DISTINCT v."contactId")::int AS cnt
    FROM "ContactCustomFieldValue" v
    JOIN "Contact" c ON c."id" = v."contactId"
    WHERE COALESCE(v."value", '') <> ''
    GROUP BY v."fieldId", c."source"
    ORDER BY cnt DESC
  `);

  const sourceMap = new Map<string, SourceCount[]>();
  for (const r of sourceRows) {
    const list = sourceMap.get(r.field_id) || [];
    list.push({ source: r.source || "Unknown", count: Number(r.cnt) });
    sourceMap.set(r.field_id, list);
  }

  // 5. Assemble
  const result: FieldUsageRow[] = fields.map((f) => {
    const filled = filledMap.get(f.id) || 0;
    return {
      id: f.id,
      name: f.name || "(unnamed)",
      fieldKey: f.fieldKey,
      dataType: f.dataType,
      parentId: f.parentId,
      filledCount: filled,
      filledPct: totalContacts > 0 ? filled / totalContacts : 0,
      totalContacts,
      sourceBreakdown: (sourceMap.get(f.id) || []).sort((a, b) => b.count - a.count),
    };
  });

  // Sort by filled desc
  result.sort((a, b) => b.filledCount - a.filledCount);

  return result;
}

// ─── Source-level aggregation ───

export type SourceAggRow = {
  source: string;
  totalContacts: number;
  fieldsUsed: number;
};

export async function getSourceAggregation(): Promise<SourceAggRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    { source: string; total_contacts: number; fields_used: number }[]
  >(`
    SELECT
      COALESCE(c."source", 'Unknown') AS source,
      COUNT(DISTINCT c."id")::int AS total_contacts,
      COUNT(DISTINCT v."fieldId")::int AS fields_used
    FROM "Contact" c
    LEFT JOIN "ContactCustomFieldValue" v
      ON v."contactId" = c."id"
      AND COALESCE(v."value", '') <> ''
    GROUP BY c."source"
    ORDER BY total_contacts DESC
  `);

  return rows.map((r) => ({
    source: r.source || "Unknown",
    totalContacts: Number(r.total_contacts),
    fieldsUsed: Number(r.fields_used),
  }));
}

// ─── Last sync info ───

export async function getLastSync() {
  const run = await prisma.syncRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
  return run;
}
