import type { Metadata } from "next";

import HomePageBody from "@/app/components/home/HomePageBody";
import { buildHomeMetadata } from "@/app/components/home/home-metadata";

/* ===============================================================
   🛡️ /tr — TÜRKÇE ANA SAYFA
   ===============================================================
   URL YAPISI: İngilizce varsayılan dildir ve `/`'de yaşar; Türkçe
   sayfalar `/tr` prefix'i taşır. Bu dosya Türkçe ana sayfanın TEK
   kanonik adresidir (yönlendirme YOK).

   `setRequestLocale` ÇAĞRILMAZ: request-locale store'unun başlangıç
   değeri zaten `DEFAULT_LOCALE` ("tr") — diğer TR route'larıyla aynı
   desen (bkz. lib/i18n/request-locale.server.ts).
   =============================================================== */

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeMetadata("tr");
}

export default function TrHomePage() {
  return <HomePageBody locale="tr" />;
}
