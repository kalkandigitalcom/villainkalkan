"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ADMIN_UI_LOCALE, localeFromPathname } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ <html lang> SENKRONU
   ===============================================================
   Root layout tek bir statik `<html lang>` üretir (varsayılan dil
   İngilizce — `headers()`/`cookies()` kullanılmaz, ISR korunur). Türkçe
   sayfalarda (`/tr/...`) ve Türkçe admin panelinde (`/maki-admin`)
   tarayıcıdaki `lang` niteliği burada istemci tarafında düzeltilir.
   Dil bilgisinin SEO kaynağı yine canonical/hreflang'dir.
   =============================================================== */
export function htmlLangForPath(pathname: string | null | undefined): string {
  if (pathname === "/maki-admin" || pathname?.startsWith("/maki-admin/")) {
    return ADMIN_UI_LOCALE;
  }
  return localeFromPathname(pathname);
}

export default function HtmlLangSync() {
  const pathname = usePathname();
  useEffect(() => {
    const lang = htmlLangForPath(pathname);
    if (document.documentElement.lang !== lang) {
      document.documentElement.lang = lang;
    }
  }, [pathname]);
  return null;
}
