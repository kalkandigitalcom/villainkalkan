/* ===============================================================
   🛡️ ESKİ `/en` ADRESLERİ → YENİ URL YAPISI (308 kalıcı)
   ===============================================================
   İngilizce artık varsayılan dil ve prefix'siz: `/en` → `/`,
   `/en/kiralik-villa/x?y=1` → `/kiralik-villa/x?y=1`. Yalnız TAM
   segment eşleşir (`/energy` gibi path'ler etkilenmez); query string
   AYNEN korunur. Admin auth akışına DOKUNULMAZ. */
export function legacyEnRedirectPath(pathname: string): string | null {
  if (pathname === "/en" || pathname === "/en/") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return null;
}
