import type { Metadata } from "next";

import { requirePublicLocaleEnabled } from "@/lib/i18n/public-locale-gate.server";
import { setRequestLocale } from "@/lib/i18n/request-locale.server";
import {
  renderVillaDetailPage,
  buildVillaDetailMetadata,
  type VillaDetailSearchParams,
} from "@/app/components/villa/villa-detail-route";

/* ===============================================================
   🛡️ /kiralik-villa/[slug] — VİLLA DETAY (İNGİLİZCE, VARSAYILAN DİL)
   ===============================================================
   İngilizce ana içerik (DB canonical kolonları). Veri okuma, SEO ve
   gövde `app/components/villa/villa-detail-route.tsx` içinde — Türkçe
   sayfa (`/tr/kiralik-villa/[slug]`) AYNI modülü `locale="tr"` ile
   çağırır (kopya mantık YOK).
   =============================================================== */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildVillaDetailMetadata(slug, "en");
}

export default async function EnVillaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: VillaDetailSearchParams;
}) {
  setRequestLocale("en");
  await requirePublicLocaleEnabled();
  const { slug } = await params;
  return renderVillaDetailPage({ slug, searchParams, locale: "en" });
}
