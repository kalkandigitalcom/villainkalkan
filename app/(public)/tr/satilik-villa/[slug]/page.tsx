import type { Metadata } from "next";

import {
  buildSaleDetailMetadata,
  renderSaleDetailPage,
} from "@/app/components/sale/sale-public-route";
import { setRequestLocale } from "@/lib/i18n/request-locale.server";

/* 🌐 /tr/satilik-villa/[slug] — SATILIK VİLLA DETAY (Türkçe çeviri). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildSaleDetailMetadata(slug, "tr");
}

export default async function TrSaleVillaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  setRequestLocale("tr");
  const { slug } = await params;
  return renderSaleDetailPage({ slug, locale: "tr" });
}
