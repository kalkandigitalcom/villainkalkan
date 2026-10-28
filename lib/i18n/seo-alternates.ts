/* ===============================================================
   🛡️ SEO ALTERNATES — canonical + hreflang URL SETİ (PHASE 7B)
   ===============================================================
   Saf, framework'ten bağımsız bir path helper'ı: verilen bir path +
   hedef locale için canonical path'i VE tam hreflang (`languages`)
   kümesini üretir.

   BU DOSYA BİLİNÇLİ OLARAK HİÇBİR YERE BAĞLANMADI (Phase 7B kapsamı):
     - app/layout.tsx, app/(public)/kiralik-villa/[slug]/page.tsx,
       app/(public)/kiralik-villalar/page.tsx, app/sitemap.ts,
       app/robots.ts, app/components/seo/StructuredData.tsx,
       lib/seo.ts — HİÇBİRİ bu modülü import ETMİYOR/ETMEYECEK bu
       fazda. Bağlama (generateMetadata/sitemap entegrasyonu) Phase
       7C/7D+'nin konusu (bkz. Phase 7A audit raporu §13).
     - `multilingual_enabled` bayrağını KONTROL ETMEZ — bilinçli:
       bu saf bir URL-şekillendirme fonksiyonu, flag kontrolü ileride
       çağıran generateMetadata/sitemap call-site'larının sorumluluğu
       olacak (Phase 7A audit §4, §10).
     - Absolute URL ÜRETMEZ — yalnız relative path döner; absolute'a
       çözme mevcut `metadataBase` mekanizmasının işi (lib/seo.ts,
       app/layout.tsx) — ona dokunulmadı.

   URL STRATEJİSİ (güncel — İngilizce varsayılan dil):
     EN        → {path}       (prefix YOK)
     TR        → /tr{path}    ("/" → "/tr")
     x-default → EN path

   NORMALIZATION (bilinçli minimal — yeni bir proje convention'ı İCAT
   EDİLMEDİ):
     - path'in başına tek bir "/" garanti edilir — `app/sitemap.ts`'in
       kendi `url()` helper'ıyla (satır 74-83) AYNI desen:
       `path.startsWith("/") ? path : "/" + path`.
     - path zaten `/tr` veya eski `/en` ile başlıyorsa (yalnız TAM segment
       eşleşmesi — `/en/...` veya tam `/en`) bu prefix önce soyulur,
       sonra hedef locale'e göre yeniden eklenir → çifte prefix
       (`/en/en/...`) OLUŞMAZ, fonksiyon idempotenttir. `/energy`,
       `/design` gibi path'ler YANLIŞLIKLA `/en`/`/de` prefix'i
       taşıyormuş gibi ALGILANMAZ (segment-sınırlı karşılaştırma).
     - Trailing slash / query string / hash STRIP EDİLMEZ, YORUMLANMAZ
       — path'in prefix sonrası kalan kısmı OPAK bir string olarak
       aynen taşınır (agresif normalization YOK).
     - `/tr` ve ESKİ `/en` prefix'li input'lar segment-sınırlı soyulur
       (bkz. aşağıdaki `stripLocalePrefix`).

   Locale tipi Phase 1B'den (`lib/i18n/config.ts`) reuse edilir — burada
   YENİDEN TANIMLANMADI. `toLocale`/`SUPPORTED_LOCALES` de aynı şekilde
   reuse edilir (savunmacı validasyon için — bkz. `buildLocaleAlternates`).
   =============================================================== */

import {
  PREFIXED_ROUTE_LOCALE,
  toLocale,
  type Locale,
} from "@/lib/i18n/config";

export type LocaleAlternates = {
  canonical: string;
  languages: Record<Locale | "x-default", string>;
};

/* 🛡️ URL YAPISI (güncel):
     EN        → {path}        (prefix YOK — varsayılan dil)
     TR        → /tr{path}     ("/" → "/tr")
     x-default → EN path
   Girdi `/tr` veya ESKİ `/en` prefix'i taşıyorsa (yalnız TAM segment —
   `/tr/...`, `/tr`, `/en/...`, `/en`) önce soyulur → idempotent, çifte
   prefix oluşmaz; `/trabzon`, `/energy` gibi path'ler etkilenmez. DB'de
   eski `/en/...` biçiminde saklı bağlantılar da doğru adrese çözülür. */
const STRIPPED_PREFIXES: readonly string[] = ["tr", "en"];

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function stripLocalePrefix(path: string): string {
  for (const prefix of STRIPPED_PREFIXES) {
    const withTrailingSlash = `/${prefix}/`;
    const exact = `/${prefix}`;
    if (path.startsWith(withTrailingSlash)) {
      return path.slice(withTrailingSlash.length - 1);
    }
    if (path === exact) {
      return "/";
    }
  }
  return path;
}

function withLocalePrefix(base: string, prefix: Locale): string {
  return base === "/" ? `/${prefix}` : `/${prefix}${base}`;
}

/** Locale'siz taban path (ör. "/tr/arama" → "/arama", "/en" → "/"). */
export function toBasePath(path: string): string {
  return stripLocalePrefix(ensureLeadingSlash(path));
}

export function buildLocaleAlternates(
  path: string,
  locale: Locale
): LocaleAlternates {
  const safeLocale = toLocale(locale);
  const basePath = toBasePath(path);
  const languages: Record<Locale | "x-default", string> = {
    tr: withLocalePrefix(basePath, PREFIXED_ROUTE_LOCALE),
    en: basePath,
    "x-default": basePath,
  };
  return {
    canonical: languages[safeLocale],
    languages,
  };
}
