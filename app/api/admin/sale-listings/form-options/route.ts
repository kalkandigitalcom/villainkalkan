import { NextResponse } from "next/server";

import { getSaleFormOptions } from "@/app/services/sale-listing.service";
import { authorizeAdminCaller } from "@/lib/admin-route-auth";
import {
  callerHasPermission,
  FORBIDDEN_MESSAGE,
} from "@/lib/auth/action-authz";

/* ===============================================================
   🛡️ GET /api/admin/sale-listings/form-options
   ===============================================================
   Bağımsız gayrimenkul formu (108): bölge (villa_locations) ve olanak
   (villa_features) seçenekleri — mevcut taksonomiler YALNIZ okunur.
   Yetki: authorizeAdminCaller + "sale_listings".
=============================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await authorizeAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!(await callerHasPermission(auth.caller.id, "sale_listings"))) {
    return NextResponse.json({ ok: false, error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  const res = await getSaleFormOptions();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, locations: res.locations, features: res.features });
}
