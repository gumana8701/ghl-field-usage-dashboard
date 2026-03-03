import { getFieldUsage, getSourceAggregation, getLastSync } from "@/lib/usage";
import DashboardClient from "./client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [fields, sources, lastSync] = await Promise.all([
    getFieldUsage(),
    getSourceAggregation(),
    getLastSync(),
  ]);

  return (
    <DashboardClient
      fields={fields}
      sources={sources}
      lastSync={
        lastSync
          ? {
              status: lastSync.status,
              startedAt: lastSync.startedAt.toISOString(),
              finishedAt: lastSync.finishedAt?.toISOString() || null,
              contactsIngested: lastSync.contactsIngested,
              fieldsIngested: lastSync.fieldsIngested,
            }
          : null
      }
    />
  );
}
