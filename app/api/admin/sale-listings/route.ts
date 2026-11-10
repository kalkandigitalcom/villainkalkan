import { NextResponse } from "next/server";

import {
  createSaleListing,
  listSaleListings,
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
   🛡️ /api/admin/sale-listings — SATILIK İLAN LİSTE + OLUŞTURMA
   ===============================================================
   GET  → { ok, listings }      (admin liste; filtre/arama/sayfalama client)
   POST → { ok, listing, translation_tr }
          body: { villa_id, listing: {...}, translation_tr?: {...} }
   Yetki: authorizeAdminCaller + callerHasPermission("sale_listings").
   Audit: başarılı oluşturma server-side insertAdminActivityLog.
   Kiralık sisteme (villa_prices, rezervasyon, takvim) DOKUNMAZ.
=============================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  /* 🛡️ Admin yetki (sale_listings) — izin yoksa 403; hiçbir veri
     okunmaz/değiştirilmez (lib/auth/admin-permission-map.ts). */
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }

  const res = await listSaleListings();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, listings: res.listings });
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  /* 🛡️ Admin yetki (sale_listings) — izin yoksa 403; hiçbir veri
     okunmaz/değiştirilmez (lib/auth/admin-permission-map.ts). */
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }

  let body: SaleListingWriteInput;
  try {
    body = (await req.json()) as SaleListingWriteInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }

  const res = await createSaleListing(body);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  await insertAdminActivityLog(extractAdminContextFromRequest(req, auth.caller), {
    action: "sale_listing.created",
    entity_type: "sale_listing",
    entity_id: res.listing.villa_id,
    entity_title: res.listing.villa?.title || "Satılık ilan",
    after_data: { ...res.listing, villa: undefined, translation_tr: res.translation_tr },
  });

  return NextResponse.json({
    ok: true,
    listing: res.listing,
    translation_tr: res.translation_tr,
  });
}
