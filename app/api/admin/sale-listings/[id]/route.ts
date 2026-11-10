import { NextResponse } from "next/server";

import {
  deleteSaleListing,
  getSaleListing,
  saleListingDisplayTitle,
  updateSaleListing,
  type SaleListingWriteInput,
} from "@/app/services/sale-listing.service";
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
   🛡️ /api/admin/sale-listings/[id] — TEK İLAN (oku/güncelle/sil)
   ===============================================================
   [id] = ilan kimliği (108). Eski bağlantılar için villa id de kabul
   edilir (servis id → villa_id sırasıyla çözer).
   GET    → { ok, listing, translation_tr, feature_ids }
   PUT    → body: { listing: {...}, property?: {...} (yalnız bağımsız),
                    translation_tr?: {...} }
   DELETE → satılık ilan satırı (+ çeviri, fotoğraf, olanak — FK
            CASCADE; bağımsız ilanın R2 fotoğrafları da silinir).
            Villa kaydı ve kiralık verisi DEĞİŞMEZ.
   Yetki: authorizeAdminCaller + "sale_listings". Audit: server-side.
=============================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function json(res: { ok: false; error: string; status: number }) {
  return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
}

export async function GET(req: Request, ctx: Ctx): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  /* 🛡️ Admin yetki (sale_listings) — izin yoksa 403; hiçbir veri
     okunmaz/değiştirilmez (lib/auth/admin-permission-map.ts). */
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id } = await ctx.params;

  const res = await getSaleListing(id);
  if (!res.ok) return json(res);
  return NextResponse.json({
    ok: true,
    listing: res.listing,
    translation_tr: res.translation_tr,
    feature_ids: res.feature_ids,
  });
}

export async function PUT(req: Request, ctx: Ctx): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  /* 🛡️ Admin yetki (sale_listings) — izin yoksa 403; hiçbir veri
     okunmaz/değiştirilmez (lib/auth/admin-permission-map.ts). */
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id } = await ctx.params;

  let body: SaleListingWriteInput;
  try {
    body = (await req.json()) as SaleListingWriteInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }

  const res = await updateSaleListing(id, body);
  if (!res.ok) return json(res);

  await insertAdminActivityLog(extractAdminContextFromRequest(req, auth.caller), {
    action: "sale_listing.updated",
    entity_type: "sale_listing",
    entity_id: res.listing.id,
    entity_title: saleListingDisplayTitle(res.listing),
    before_data: {
      ...res.before.listing,
      villa: undefined,
      location: undefined,
      translation_tr: res.before.translation_tr,
      feature_ids: res.before.feature_ids,
    },
    after_data: {
      ...res.listing,
      villa: undefined,
      location: undefined,
      translation_tr: res.translation_tr,
      feature_ids: res.feature_ids,
    },
  });

  return NextResponse.json({
    ok: true,
    listing: res.listing,
    translation_tr: res.translation_tr,
    feature_ids: res.feature_ids,
  });
}

export async function DELETE(req: Request, ctx: Ctx): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  /* 🛡️ Admin yetki (sale_listings) — izin yoksa 403; hiçbir veri
     okunmaz/değiştirilmez (lib/auth/admin-permission-map.ts). */
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const { id } = await ctx.params;

  const res = await deleteSaleListing(id);
  if (!res.ok) return json(res);

  await insertAdminActivityLog(extractAdminContextFromRequest(req, auth.caller), {
    action: "sale_listing.deleted",
    entity_type: "sale_listing",
    entity_id: res.before.listing.id,
    entity_title: saleListingDisplayTitle(res.before.listing),
    before_data: {
      ...res.before.listing,
      villa: undefined,
      location: undefined,
      translation_tr: res.before.translation_tr,
      feature_ids: res.before.feature_ids,
    },
  });

  return NextResponse.json({ ok: true });
}
