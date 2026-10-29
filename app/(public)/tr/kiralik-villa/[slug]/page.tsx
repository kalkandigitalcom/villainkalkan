import type { Metadata } from "next";

import { setRequestLocale } from "@/lib/i18n/request-locale.server";
import {
  renderVillaDetailPage,
  buildVillaDetailMetadata,
  type VillaDetailSearchParams,
} from "@/app/components/villa/villa-detail-route";

/* ===============================================================
   🛡️ /tr/kiralik-villa/[slug] — VİLLA DETAY (TÜRKÇE ÇEVİRİ)
   ===============================================================
   İngilizce sayfa ile AYNI modül (`villa-detail-route.tsx`), yalnız
   `locale="tr"`: açıklama/SEO/özellik/kural/dahil metinleri Türkçe
   çeviri satırlarından gelir; boş alan İngilizce ana içeriğe düşer.
   =============================================================== */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildVillaDetailMetadata(slug, "tr");
}

export default async function TrVillaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: VillaDetailSearchParams;
}) {
  setRequestLocale("tr");
  const { slug } = await params;
  return renderVillaDetailPage({ slug, searchParams, locale: "tr" });
}
