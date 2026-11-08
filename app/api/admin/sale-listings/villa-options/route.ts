import { NextResponse } from "next/server";

import { listSaleVillaOptions } from "@/app/services/sale-listing.service";
import { isUuid } from "@/lib/sale-listing.helper";
import { authorizeAdminCaller } from "@/lib/admin-route-auth";
import {
  callerHasPermission,
  FORBIDDEN_MESSAGE,
} from "@/lib/auth/action-authz";

/* ===============================================================
   🛡️ GET /api/admin/sale-listings/villa-options[?includeId=<uuid>]
   ===============================================================
   Satılık ilan formunun "Bağlı villa" seçenekleri: listed_for_sale=true,
   silinmemiş ve henüz ilanı olmayan villalar. `includeId` → düzenlenen
   ilanın kendi villası listede kalır.
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

  let includeId: string | null = null;
  try {
    const raw = new URL(req.url).searchParams.get("includeId");
    includeId = isUuid(raw) ? raw : null;
  } catch {
    /* URL parse hatası → includeId yok */
  }

  const res = await listSaleVillaOptions(includeId);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, villas: res.villas });
}
