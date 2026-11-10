import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { authorizeAdminSession } from "@/lib/admin-route-auth";
import { adminPermissionGate } from "@/app/components/admin/AdminSectionGuard";
import AdminPageSessionRefresh from "@/app/components/admin/AdminPageSessionRefresh";
import SaleVillaDetail from "@/app/components/sale/SaleVillaDetail";
import SalePreviewBanner from "@/app/components/sale/SalePreviewBanner";
import { loadSaleVillaDetail } from "@/app/services/sale-villa-detail.service";
import type { Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ /maki-admin/sale-listings/[villaId]/onizleme[?lang=tr]
   SATILIK İLAN — ADMIN ÖNİZLEME
   ===============================================================
   GÜVENLİK (katmanlı; hiçbiri URL parametresine bağlı DEĞİL):
     1) middleware.ts — /maki-admin/* oturumsuz → login'e yönlendirir.
     2) sale-listings/layout.tsx — AdminSectionGuard("sale_listings").
     3) Bu sayfa VERİDEN ÖNCE ayrıca: authorizeAdminSession() +
        adminPermissionGate("sale_listings") (layout render'ı durdurmaz).
   Public rotada önizleme modu YOK (`?preview=true` gibi bir bayrak
   hiçbir yerde okunmaz) → taslak ilan public'e sızamaz.
   İNDEKS: robots noindex/nofollow + /maki-admin robots.txt'de disallow;
   sitemap'e eklenmez.
   Görünüm: admin kabuğu (sidebar) olmadan, public tasarım bileşeniyle
   (bkz. maki-admin/layout.tsx önizleme bypass'ı).
   =============================================================== */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Önizleme — Satılık ilan",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

type Props = {
  params: Promise<{ villaId: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export default async function SaleListingPreviewPage({ params, searchParams }: Props) {
  const auth = await authorizeAdminSession();
  if (!auth.ok) return <AdminPageSessionRefresh />;
  const denied = await adminPermissionGate(auth.caller.id, "sale_listings");
  if (denied) return denied;

  const { villaId } = await params;
  const sp = searchParams ? await searchParams : {};
  const rawLang = Array.isArray(sp?.lang) ? sp.lang[0] : sp?.lang;
  const locale: Locale = rawLang === "tr" ? "tr" : "en";

  const data = await loadSaleVillaDetail(villaId, { locale, mode: "preview" });
  if (!data) notFound();

  return (
    <div lang={locale} className="public-shell min-h-screen bg-[var(--color-ivory)]">
      <SaleVillaDetail
        data={data}
        locale={locale}
        preview
        banner={
          <SalePreviewBanner
            villaId={data.villaId}
            locale={locale}
            status={data.listing.publicationStatus}
          />
        }
      />
    </div>
  );
}
