import type { Metadata } from "next";

import SaleVillasArchiveBody, {
  type SaleArchiveSearchParams,
} from "@/app/components/sale/SaleVillasArchiveBody";
import { buildSaleArchiveMetadata } from "@/app/components/sale/sale-public-route";
import { requirePublicLocaleEnabled } from "@/lib/i18n/public-locale-gate.server";
import { setRequestLocale } from "@/lib/i18n/request-locale.server";

/* 🌐 /satilik-villalar — SATILIK VİLLALAR (İngilizce, varsayılan dil).
   Gövde + SEO ortak modülde; TR sayfası (/tr/satilik-villalar) aynı
   gövdeyi locale="tr" ile render eder. */

export async function generateMetadata(): Promise<Metadata> {
  return buildSaleArchiveMetadata("en");
}

export default async function EnSaleVillasPage({
  searchParams,
}: {
  searchParams: SaleArchiveSearchParams;
}) {
  setRequestLocale("en");
  await requirePublicLocaleEnabled();
  return <SaleVillasArchiveBody locale="en" searchParams={searchParams} />;
}
