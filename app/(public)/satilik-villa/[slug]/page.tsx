import type { Metadata } from "next";

import {
  buildSaleDetailMetadata,
  renderSaleDetailPage,
} from "@/app/components/sale/sale-public-route";
import { requirePublicLocaleEnabled } from "@/lib/i18n/public-locale-gate.server";
import { setRequestLocale } from "@/lib/i18n/request-locale.server";

/* 🌐 /satilik-villa/[slug] — SATILIK VİLLA DETAY (İngilizce).
   Yalnız yayındaki ilan; aksi 404. TR: /tr/satilik-villa/[slug]. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildSaleDetailMetadata(slug, "en");
}

export default async function EnSaleVillaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  setRequestLocale("en");
  await requirePublicLocaleEnabled();
  const { slug } = await params;
  return renderSaleDetailPage({ slug, locale: "en" });
}
