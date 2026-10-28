import { ROUTE_DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ PUBLIC ANA SAYFA LOCALE ÇÖZÜMLEYİCİSİ
   ===============================================================
   PROBLEM: `settings.public_default_locale` (migration 081) admin'de
   kaydediliyor ama public render zincirinde HİÇ okunmuyordu —
   `app/(public)/page.tsx` locale'i `"tr"` olarak HARDCODED geçiyordu.
   Bu dosya o ayarı ana sayfanın giriş davranışına bağlar.

   ⚠️ NEDEN "/tr" ROUTE'U GEREKİYOR:
     `/` bugüne kadar AYNI ANDA iki şeydi —
       (a) sitenin giriş noktası,
       (b) TR ana sayfanın KANONİK URL'i
           (sitemap priority 1.0, her sayfanın `hreflang="tr"` ve
            `x-default` hedefi, Header/Footer/BottomNav logo linki,
            dil değiştiricinin TR hedefi).
     `/` koşulsuz `/de`'ye yönlenseydi TR ana sayfanın indexlenebilir
     HİÇBİR URL'i kalmaz ve TR kullanıcı logoya basınca tekrar DE'ye
     düşerdi. Bu yüzden varsayılan TR DEĞİLKEN TR ana sayfa `/tr`'ye
     taşınır; `/` saf bir yönlendiriciye dönüşür.

   İKİ MOD (tek kural, tek kaynak — bu dosya):

     MOD A — multilingual KAPALI **veya** varsayılan = "tr"
       • `/`   → TR ana sayfayı RENDER eder (bugünkü davranış)
       • `/tr` → `/`'ye yönlenir (tek kanonik TR ana sayfa korunur)
       • trHomeHref = "/"
       → BUGÜNKÜ PRODUCTION DAVRANIŞI BYTE-IDENTICAL.

     MOD B — multilingual AÇIK **ve** varsayılan = "en"
       • `/`   → `/<varsayılan>` (307)
       • `/tr` → TR ana sayfayı RENDER eder (canonical "/tr")
       • trHomeHref = "/tr"

   FAIL-SAFE: settings okunamazsa / geçersiz locale gelirse
   (`"fr"`, null, undefined) → MOD A. `getPublicDefaultLocale`
   (lib/i18n/config.ts) zaten `toLocale` ile "tr"'ye düşüyor —
   burada YENİ bir doğrulama mantığı İCAT EDİLMEDİ.

   ⚠️ KAPSAM: yalnız ANA SAYFA. Prefix'siz TR iç route'ları
   (`/kiralik-villalar`, `/arama`, `/p/<slug>`, …) HİÇ ETKİLENMEZ —
   ne yönlenir ne de hreflang'i değişir. `DEFAULT_LOCALE` hâlâ "tr",
   `localeHref` / `localeFromPathname` / `buildLocaleAlternates` /
   translation sistemi / middleware DEĞİŞMEDİ.

   Bu modül SAF ve client-safe'tir (`server-only` YOK, DB/cache/
   cookie/header erişimi YOK) — hem server sayfaları hem TopBar
   ("use client") aynı kuralı buradan okur, kural ÇOĞALTILMAZ.
   =============================================================== */

/** `settings`ten okunan alanlar — `lib/i18n/config.ts`'teki
 *  `SettingsLocaleFields` ile AYNI şekil (orada `export` değil,
 *  bu yüzden burada minimal olarak yeniden bildirildi). */
type PublicHomeSettings = {
  multilingual_enabled?: boolean | null;
  public_default_locale?: string | null;
};

export type PublicHomeResolution = {
  /** Ana sayfanın efektif varsayılan locale'i. MOD A'da her zaman "tr". */
  defaultLocale: Locale;
  /** `/` yönlendirici mi (MOD B), yoksa TR ana sayfayı mı render ediyor (MOD A)? */
  redirectsFromRoot: boolean;
  /** TR ana sayfanın KANONİK yolu: MOD A → "/", MOD B → "/tr". */
  trHomeHref: string;
};

/** MOD A (fail-safe / bugünkü davranış) — tek tanım, tek yerde. */
/* 🛡️ URL YAPISI (güncel): İngilizce varsayılan dil `/`'de render edilir,
   Türkçe ana sayfa `/tr`'dedir. Kökte yönlendirme YOKTUR. Bu karar artık
   URL yapısının parçası olduğu için `settings.multilingual_enabled` /
   `settings.public_default_locale` (admin'de AYNEN durur) public ana
   sayfa davranışını DEĞİŞTİRMEZ. Saf + client-safe kalır. */
export const TR_HOME_PATH = "/tr";

const URL_STRUCTURE: PublicHomeResolution = {
  defaultLocale: ROUTE_DEFAULT_LOCALE,
  redirectsFromRoot: false,
  trHomeHref: TR_HOME_PATH,
};

export function resolvePublicHome(
  settings: PublicHomeSettings | null | undefined
): PublicHomeResolution {
  void settings;
  return URL_STRUCTURE;
}
