import type { Metadata } from "next";

import SaleVillasArchiveBody, {
  type SaleArchiveSearchParams,
} from "@/app/components/sale/SaleVillasArchiveBody";
import { buildSaleArchiveMetadata } from "@/app/components/sale/sale-public-route";
import { setRequestLocale } from "@/lib/i18n/request-locale.server";

/* 🌐 /tr/satilik-villalar — SATILIK VİLLALAR (Türkçe). */

export async function generateMetadata(): Promise<Metadata> {
  return buildSaleArchiveMetadata("tr");
}

export default async function TrSaleVillasPage({
  searchParams,
}: {
  searchParams: SaleArchiveSearchParams;
}) {
  setRequestLocale("tr");
  return <SaleVillasArchiveBody locale="tr" searchParams={searchParams} />;
}
