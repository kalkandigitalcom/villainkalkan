import { NextResponse } from "next/server";

import {
  deleteSaleListing,
  getSaleListing,
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
   🛡️ /api/admin/sale-listings/[villaId] — TEK İLAN (oku/güncelle/sil)
   ===============================================================
   GET    → { ok, listing, translation_tr }
   PUT    → body: { listing: {...}, translation_tr?: {...} }
   DELETE → yalnız satılık ilan satırı (+ çevirisi, FK CASCADE).
            Villa kaydı ve kiralık verisi DEĞİŞMEZ.
   Yetki: authorizeAdminCaller + "sale_listings". Audit: server-side.
=============================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ villaId: string }> };

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
  const { villaId } = await ctx.params;

  const res = await getSaleListing(villaId);
  if (!res.ok) return json(res);
  return NextResponse.json({
    ok: true,
    listing: res.listing,
    translation_tr: res.translation_tr,
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
  const { villaId } = await ctx.params;

  let body: SaleListingWriteInput;
  try {
    body = (await req.json()) as SaleListingWriteInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }

  const res = await updateSaleListing(villaId, body);
  if (!res.ok) return json(res);

  await insertAdminActivityLog(extractAdminContextFromRequest(req, auth.caller), {
    action: "sale_listing.updated",
    entity_type: "sale_listing",
    entity_id: villaId,
    entity_title: res.listing.villa?.title || res.listing.reference_code || "Satılık ilan",
    before_data: {
      ...res.before.listing,
      villa: undefined,
      translation_tr: res.before.translation_tr,
    },
    after_data: { ...res.listing, villa: undefined, translation_tr: res.translation_tr },
  });

  return NextResponse.json({
    ok: true,
    listing: res.listing,
    translation_tr: res.translation_tr,
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
  const { villaId } = await ctx.params;

  const res = await deleteSaleListing(villaId);
  if (!res.ok) return json(res);

  await insertAdminActivityLog(extractAdminContextFromRequest(req, auth.caller), {
    action: "sale_listing.deleted",
    entity_type: "sale_listing",
    entity_id: villaId,
    entity_title:
      res.before.listing.villa?.title || res.before.listing.reference_code || "Satılık ilan",
    before_data: {
      ...res.before.listing,
      villa: undefined,
      translation_tr: res.before.translation_tr,
    },
  });

  return NextResponse.json({ ok: true });
}
