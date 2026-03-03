import { NextRequest, NextResponse } from "next/server";
import { deleteCustomField } from "@/lib/ghl";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/fields
 * Body: { fieldId: string }
 *
 * 1. Calls GHL API to delete the custom field from the location
 * 2. Removes all pivot rows for that field from local DB
 * 3. Removes the field record from local DB
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const fieldId = body?.fieldId;

    if (!fieldId || typeof fieldId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing fieldId" }, { status: 400 });
    }

    // 1. Delete from GHL
    await deleteCustomField(fieldId);

    // 2. Remove pivot rows
    await prisma.contactCustomFieldValue.deleteMany({
      where: { fieldId },
    });

    // 3. Remove field record
    await prisma.customField.delete({
      where: { id: fieldId },
    }).catch(() => {
      // Field may not exist locally yet — that's fine
    });

    return NextResponse.json({ ok: true, deletedFieldId: fieldId });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("Delete field error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
