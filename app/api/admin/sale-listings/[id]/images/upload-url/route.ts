import { NextResponse } from "next/server";

import { createSaleImageUploadTicket } from "@/app/services/sale-listing-image.service";
import { authorizeAdminCaller } from "@/lib/admin-route-auth";
import {
  callerHasPermission,
  FORBIDDEN_MESSAGE,
} from "@/lib/auth/action-authz";

/* ===============================================================
   🛡️ POST /api/admin/sale-listings/[id]/images/upload-url (108)
   ===============================================================
   Bağımsız ilan fotoğrafı için kısa ömürlü imzalı R2 PUT adresi.
   Villa galerisi upload-url route'unun BİREBİR deseni; object key
   SUNUCUDA üretilir (sale-listings/<slug>__<id8>/...). Dosya byte'ları
   bu route'a GELMEZ.
   REQUEST  (JSON): { size: number, contentType: "image/webp" }
   RESPONSE 200   : { ok: true, uploadUrl, key, contentType, expiresIn }
   Yetki: authorizeAdminCaller + "sale_listings".
=============================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: { size?: unknown; contentType?: unknown };
  try {
    body = (await req.json()) as { size?: unknown; contentType?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek gövdesi" }, { status: 400 });
  }
  const r = await createSaleImageUploadTicket(id, { size: body?.size, contentType: body?.contentType });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
