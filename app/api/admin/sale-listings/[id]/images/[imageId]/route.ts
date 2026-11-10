import { NextResponse } from "next/server";

import { deleteSaleListingImage } from "@/app/services/sale-listing-image.service";
import {
  extractAdminContextFromRequest,
  insertAdminActivityLog,
} from "@/app/services/admin-activity-log.service";
import { authorizeAdminCaller } from "@/lib/admin-route-auth";
import {
  callerHasPermission,
  FORBIDDEN_MESSAGE,
} from "@/lib/auth/action-authz";

/* ===============================================================
   🛡️ DELETE /api/admin/sale-listings/[id]/images/[imageId] (108)
   ===============================================================
   Bağımsız ilan fotoğrafını siler (DB satırı + R2 nesnesi). Fotoğraf
   başka ilana aitse 404. Kapak silinirse sıradaki fotoğraf kapak olur.
   Yetki: authorizeAdminCaller + "sale_listings".
=============================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; imageId: string }> }
): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id, imageId } = await ctx.params;
  const r = await deleteSaleListingImage(id, imageId);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  await insertAdminActivityLog(extractAdminContextFromRequest(req, auth.caller), {
    action: "sale_listing.image_deleted",
    entity_type: "sale_listing",
    entity_id: id,
    entity_title: "Satılık ilan fotoğrafı",
    before_data: { image_id: imageId },
  });
  return NextResponse.json({ ok: true });
}
