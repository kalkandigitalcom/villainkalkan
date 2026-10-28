/* ===============================================================
   🛡️ PHASE 7B — SEO ALTERNATES HELPER: TESTLER
   ===============================================================
   Hedef: lib/i18n/seo-alternates.ts (buildLocaleAlternates)

   Bu dosya SAF bir path-şekillendirme fonksiyonunu test eder — DB,
   network, React cache(), Next.js Metadata API, generateMetadata,
   sitemap, robots, StructuredData'nın HİÇBİRİNE dokunulmaz/mock'lanmaz
   (çünkü helper'ın kendisi bunların hiçbirini kullanmıyor). Görev
   listesindeki 14 zorunlu senaryo + birkaç ek güvenlik-sınırı testi
   (segment-sınırlı prefix eşleşmesi, kök path özel durumu) içerir.
   =============================================================== */

import { describe, it, expect } from "vitest";

import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

const TR_PATH = "/tr/kiralik-villa/villa-in-love";
const EN_PATH = "/kiralik-villa/villa-in-love";

describe("buildLocaleAlternates", () => {
  /* --- 1) TR villa path --- */
  it("1) TR villa path → languages.tr orijinal path'in AYNISI", () => {
    const result = buildLocaleAlternates(TR_PATH, "tr");
    expect(result.languages.tr).toBe(TR_PATH);
  });

  /* --- 2) EN villa path --- */
  it("2) EN villa path → languages.en '/' prefix'li", () => {
    const result = buildLocaleAlternates(TR_PATH, "en");
    expect(result.languages.en).toBe(EN_PATH);
  });

  /* --- 3) DE desteği kaldırıldı --- */
  it("3) languages YALNIZ tr/en/x-default içerir — 'de' alternate'i ÜRETİLMEZ", () => {
    const result = buildLocaleAlternates(TR_PATH, "en");
    expect(Object.keys(result.languages).sort()).toEqual(["en", "tr", "x-default"]);
    expect("de" in result.languages).toBe(false);
  });

  /* --- 4) x-default --- */
  it("4) x-default HER ZAMAN İngilizce (varsayılan, prefix'siz) path'e işaret eder", () => {
    expect(buildLocaleAlternates(TR_PATH, "tr").languages["x-default"]).toBe(EN_PATH);
    expect(buildLocaleAlternates(TR_PATH, "en").languages["x-default"]).toBe(EN_PATH);
  });

  /* --- 5) TR canonical --- */
  it("5) locale='tr' → canonical, prefix'siz TR path'tir", () => {
    const result = buildLocaleAlternates(TR_PATH, "tr");
    expect(result.canonical).toBe(TR_PATH);
  });

  /* --- 6) EN canonical --- */
  it("6) locale='en' → canonical, '/' prefix'li path'tir", () => {
    const result = buildLocaleAlternates(TR_PATH, "en");
    expect(result.canonical).toBe(EN_PATH);
  });


  /* --- 8) EN prefixed input normalize --- */
  it("8) input zaten '/...' ile prefixed ve locale='en' → çifte prefix OLUŞMAZ ('/en/...' değil)", () => {
    const result = buildLocaleAlternates(EN_PATH, "en");
    expect(result.canonical).toBe(EN_PATH);
    expect(result.canonical).not.toContain("/en/");
    expect(result.languages.tr).toBe(TR_PATH);
  });


  /* --- 10) TR input normalize (çapraz yön: prefixed input + tr hedefi) --- */
  it("10) input '/...' prefixed ama hedef locale='tr' → canonical prefix'siz TR path'e NORMALIZE olur", () => {
    const result = buildLocaleAlternates(EN_PATH, "tr");
    expect(result.canonical).toBe(TR_PATH);
    expect(result.languages.tr).toBe(TR_PATH);
  });

  /* --- 11) URL yapısı: TR daima '/tr', EN daima prefix'siz; '/en' asla üretilmez --- */
  it("11) her input/locale kombinasyonunda TR '/tr' ile başlar, EN/x-default '/en' ve '/tr' taşımaz", () => {
    const inputs = [TR_PATH, EN_PATH, "/", "/tr/kiralik-villalar", "/en/kiralik-villalar"];
    const locales: Locale[] = ["tr", "en"];
    for (const input of inputs) {
      for (const locale of locales) {
        const result = buildLocaleAlternates(input, locale);
        expect(result.languages.tr.startsWith("/tr")).toBe(true);
        expect(result.languages.en.startsWith("/tr")).toBe(false);
        expect(result.languages.en.startsWith("/en")).toBe(false);
        expect(result.languages["x-default"]).toBe(result.languages.en);
      }
    }
  });

  it("11b) eski '/en/...' input'u prefix'siz İngilizce adrese normalize olur", () => {
    expect(buildLocaleAlternates("/en/kiralik-villa/villa-in-love", "en").canonical).toBe(EN_PATH);
    expect(buildLocaleAlternates("/en", "tr").canonical).toBe("/tr");
  });

  /* --- 12) supported locale davranışı --- */
  it("12) SUPPORTED_LOCALES'teki HER locale için geçerli, ayrışık bir canonical üretir", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const result = buildLocaleAlternates(TR_PATH, locale);
      expect(typeof result.canonical).toBe("string");
      expect(result.canonical.startsWith("/")).toBe(true);
    }
  });

  it("12b) geçersiz/desteklenmeyen bir locale değeri (TS bypass) throw ETMEZ, güvenli şekilde TR'ye düşer", () => {
    const invalidLocale = "fr" as unknown as Locale;
    const result = buildLocaleAlternates(TR_PATH, invalidLocale);
    expect(result.canonical).toBe(TR_PATH);
  });

  /* --- 13) path sonundaki slash davranışı --- */
  it("13) trailing slash STRIP EDİLMEZ — olduğu gibi (tek kopya) taşınır, yeni bir kural icat edilmez", () => {
    const withSlash = "/tr/kiralik-villa/villa-in-love/";
    const result = buildLocaleAlternates(withSlash, "en");
    expect(result.canonical).toBe("/kiralik-villa/villa-in-love/");
    expect(result.languages.tr).toBe(withSlash);
  });

  /* --- 14) query/hash yanlışlıkla eklenmiyor/bozulmuyor --- */
  it("14) query string + hash opak taşınır — parse/strip/encode EDİLMEZ", () => {
    const withQueryAndHash = "/tr/kiralik-villa/villa-in-love?ref=abc&utm=x#section";
    const result = buildLocaleAlternates(withQueryAndHash, "en");
    expect(result.canonical).toBe(
      "/kiralik-villa/villa-in-love?ref=abc&utm=x#section"
    );
    // Yalnız prefix eklendi; query/hash karakterleri BOZULMADI.
    expect(result.canonical).toContain("?ref=abc&utm=x#section");
  });

  /* --- Ek: segment-sınırlı prefix eşleşmesi (yanlış pozitif KORUMASI) --- */
  it("ek) '/energy-report', '/trabzon' gibi path'ler '/en' veya '/tr' prefix'i taşıyormuş gibi YANLIŞ ALGILANMAZ", () => {
    for (const candidate of ["/energy-report", "/trabzon"]) {
      const result = buildLocaleAlternates(candidate, "en");
      expect(result.canonical).toBe(candidate);
      expect(result.languages.tr).toBe(`/tr${candidate}`);
    }
  });

  /* --- Ek: kök path özel durumu ("/") --- */
  it("ek) path='/' → TR '/tr' (çifte slash yok), EN '/'", () => {
    const result = buildLocaleAlternates("/", "en");
    expect(result.languages.tr).toBe("/tr");
    expect(result.languages.en).toBe("/");
    expect(result.languages["x-default"]).toBe("/");
  });

  /* --- Ek: leading slash eksikse eklenir (sitemap.ts:74-83 ile aynı desen) --- */
  it("ek) baştaki '/' eksikse eklenir (mevcut sitemap.ts url() convention'ıyla tutarlı)", () => {
    const result = buildLocaleAlternates("kiralik-villa/villa-in-love", "en");
    expect(result.canonical).toBe(EN_PATH);
  });
});
