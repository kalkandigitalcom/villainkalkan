import { NextResponse } from "next/server";

import {
  listSaleListingImages,
  registerSaleListingImage,
  reorderSaleListingImages,
  setSaleListingCover,
} from "@/app/services/sale-listing-image.service";
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
   🛡️ /api/admin/sale-listings/[id]/images — BAĞIMSIZ İLAN GALERİSİ (108)
   ===============================================================
   GET   → { ok, images }                      (sort_order sırası)
   POST  → body { key }  R2'ye yüklenmiş nesneyi doğrula + kaydet
   PATCH → body { coverId } | { order: string[] }
   Yalnız source='standalone' ilan (villa kaynaklı ilan → 409).
   Yetki: authorizeAdminCaller + "sale_listings". Villa galerisine,
   villa_images tablosuna ve "villas" yetkisine DOKUNMAZ.
=============================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function failJson(r: { error: string; status: number }) {
  return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}

export async function GET(req: Request, ctx: Ctx): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id } = await ctx.params;
  const r = await listSaleListingImages(id);
  if (!r.ok) return failJson(r);
  return NextResponse.json({ ok: true, images: r.images }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: { key?: unknown };
  try {
    body = (await req.json()) as { key?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }
  const r = await registerSaleListingImage(id, body?.key);
  if (!r.ok) return failJson(r);
  await insertAdminActivityLog(extractAdminContextFromRequest(req, auth.caller), {
    action: "sale_listing.image_added",
    entity_type: "sale_listing",
    entity_id: id,
    entity_title: "Satılık ilan fotoğrafı",
    after_data: { image_id: r.image.id, image_url: r.image.image_url },
  });
  return NextResponse.json({ ok: true, image: r.image });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: { coverId?: unknown; order?: unknown };
  try {
    body = (await req.json()) as { coverId?: unknown; order?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }
  if (typeof body?.coverId === "string") {
    const r = await setSaleListingCover(id, body.coverId);
    if (!r.ok) return failJson(r);
    return NextResponse.json({ ok: true });
  }
  if (body?.order !== undefined) {
    const r = await reorderSaleListingImages(id, body.order);
    if (!r.ok) return failJson(r);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
}
