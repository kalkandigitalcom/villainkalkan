/* ===============================================================
   🛡️ PHASE 1B — LOCALE CORE TESTS
   ===============================================================
   Hedef: lib/i18n/config.ts
     • Locale type / SUPPORTED_LOCALES / DEFAULT_LOCALE
     • isSupportedLocale / toLocale
     • resolveLocale
     • isMultilingualEnabled / getPublicDefaultLocale (settings entegrasyonu)

   Bu testler yalnız yeni, izole locale-core primitive'lerini kapsar.
   price-engine / discount / pool-heating / reservation testlerine
   HİÇ dokunulmadı.
=============================================================== */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  toLocale,
  resolveLocale,
  isMultilingualEnabled,
  getPublicDefaultLocale,
  localeFromPathname,
  CONTENT_SOURCE_LOCALE,
  TRANSLATION_LOCALE,
  TRANSLATION_LOCALES,
  isTranslationLocale,
  ADMIN_UI_LOCALE,
  ROUTE_DEFAULT_LOCALE,
  PREFIXED_ROUTE_LOCALE,
} from "@/lib/i18n/config";

describe("SUPPORTED_LOCALES / DEFAULT_LOCALE", () => {
  it("SUPPORTED_LOCALES sadece tr/en içerir", () => {
    expect(SUPPORTED_LOCALES).toEqual(["tr", "en"]);
  });

  it("DEFAULT_LOCALE en'dir (İngilizce ana dil)", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("isSupportedLocale", () => {
  it("'tr' geçerli", () => {
    expect(isSupportedLocale("tr")).toBe(true);
  });

  it("'en' geçerli", () => {
    expect(isSupportedLocale("en")).toBe(true);
  });

  it("'de' artık desteklenmiyor", () => {
    expect(isSupportedLocale("de")).toBe(false);
  });

  it("desteklenmeyen değer geçersiz ('fr')", () => {
    expect(isSupportedLocale("fr")).toBe(false);
  });

  it("boş string geçersiz", () => {
    expect(isSupportedLocale("")).toBe(false);
  });

  it("undefined/null geçersiz", () => {
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
  });

  it("string olmayan değerler geçersiz", () => {
    expect(isSupportedLocale(123)).toBe(false);
    expect(isSupportedLocale({})).toBe(false);
  });
});

describe("toLocale", () => {
  it("geçerli locale aynen döner", () => {
    expect(toLocale("en")).toBe("en");
    expect(toLocale("tr")).toBe("tr");
  });

  it("geçersiz/tanınmayan değer -> en (varsayılan dil) fallback", () => {
    expect(toLocale("fr")).toBe("en");
    expect(toLocale("de")).toBe("en");
    /* case-sensitive — büyük harf normalize edilmez, bilinçli olarak
       geçersiz sayılır (üst katman gerekirse normalize eder). */
    expect(toLocale("EN")).toBe("en");
  });

  it("undefined/null/empty -> en (varsayılan dil) fallback", () => {
    expect(toLocale(undefined)).toBe("en");
    expect(toLocale(null)).toBe("en");
    expect(toLocale("")).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("geçerli explicit locale verilmişse onu kullanır", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("tr")).toBe("tr");
  });

  it("geçersiz locale verilmişse en'e (varsayılan dil) düşer", () => {
    expect(resolveLocale("fr")).toBe("en");
  });

  it("locale verilmemişse en'e (varsayılan dil) düşer", () => {
    expect(resolveLocale()).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });
});

describe("isMultilingualEnabled (URL yapısı gereği her zaman açık)", () => {
  it("ayar ne olursa olsun true — EN kökte, TR /tr altında yapısal olarak yaşar", () => {
    expect(isMultilingualEnabled({ multilingual_enabled: true })).toBe(true);
    expect(isMultilingualEnabled({ multilingual_enabled: false })).toBe(true);
    expect(isMultilingualEnabled({ multilingual_enabled: null })).toBe(true);
    expect(isMultilingualEnabled({})).toBe(true);
    expect(isMultilingualEnabled(null)).toBe(true);
    expect(isMultilingualEnabled(undefined)).toBe(true);
  });
});

describe("localeFromPathname (URL yapısı: EN prefix'siz, TR /tr)", () => {
  it("prefix'siz path'ler -> 'en' (varsayılan dil)", () => {
    expect(localeFromPathname("/")).toBe("en");
    expect(localeFromPathname("/kiralik-villa/ornek-slug")).toBe("en");
    expect(localeFromPathname("/kiralik-villalar")).toBe("en");
  });

  it("'/de' veya '/de/...' locale değil -> 'en' (varsayılan)", () => {
    expect(localeFromPathname("/de")).toBe("en");
    expect(localeFromPathname("/de/kiralik-villa/ornek-slug")).toBe("en");
  });

  it("'/tr' prefix'li path'ler -> 'tr'", () => {
    expect(localeFromPathname("/tr")).toBe("tr");
    expect(localeFromPathname("/tr/kiralik-villa/ornek-slug")).toBe("tr");
    expect(localeFromPathname("/tr/kiralik-villalar")).toBe("tr");
    expect(localeFromPathname("/tr/arama")).toBe("tr");
  });

  it("eski '/en/...' adresleri -> 'en'", () => {
    expect(localeFromPathname("/en")).toBe("en");
    expect(localeFromPathname("/en/kiralik-villa/x")).toBe("en");
  });

  it("segment sınırı korunur — '/tr' ile BAŞLAYAN ama farklı segment olan path'ler 'tr' sayılmaz", () => {
    expect(localeFromPathname("/trabzon-villalari")).toBe("en");
    expect(localeFromPathname("/travel")).toBe("en");
  });

  it("null/undefined/boş -> 'en' (varsayılan dil)", () => {
    expect(localeFromPathname(null)).toBe("en");
    expect(localeFromPathname(undefined)).toBe("en");
    expect(localeFromPathname("")).toBe("en");
  });
});

describe("getPublicDefaultLocale (Phase 1A settings entegrasyonu)", () => {
  it("geçerli public_default_locale aynen döner", () => {
    expect(getPublicDefaultLocale({ public_default_locale: "en" })).toBe(
      "en"
    );
  });

  it("geçersiz/bozuk değer -> en (varsayılan dil) fallback (DB CHECK bypass edilse bile güvenli)", () => {
    expect(getPublicDefaultLocale({ public_default_locale: "fr" })).toBe(
      "en"
    );
    expect(getPublicDefaultLocale({ public_default_locale: "de" })).toBe(
      "en"
    );
  });

  it("null/undefined -> en (varsayılan dil) fallback", () => {
    expect(getPublicDefaultLocale({ public_default_locale: null })).toBe(
      "en"
    );
    expect(getPublicDefaultLocale({})).toBe("en");
    expect(getPublicDefaultLocale(null)).toBe("en");
    expect(getPublicDefaultLocale(undefined)).toBe("en");
  });
});

describe("İngilizce ana dil / Türkçe çeviri modeli", () => {
  it("içerik kaynağı (canonical) EN, tek çeviri dili TR", () => {
    expect(CONTENT_SOURCE_LOCALE).toBe("en");
    expect(CONTENT_SOURCE_LOCALE).toBe(DEFAULT_LOCALE);
    expect(TRANSLATION_LOCALE).toBe("tr");
    expect(TRANSLATION_LOCALES).toEqual(["tr"]);
  });

  it("isTranslationLocale yalnız 'tr' kabul eder", () => {
    expect(isTranslationLocale("tr")).toBe(true);
    for (const v of ["en", "de", "TR", "", null, undefined, 1]) {
      expect(isTranslationLocale(v)).toBe(false);
    }
  });

  it("URL: varsayılan (prefix'siz) dil EN, prefix'li dil TR", () => {
    expect(ROUTE_DEFAULT_LOCALE).toBe("en");
    expect(PREFIXED_ROUTE_LOCALE).toBe("tr");
  });

  it("admin arayüzü Türkçe kalır", () => {
    expect(ADMIN_UI_LOCALE).toBe("tr");
  });
});
