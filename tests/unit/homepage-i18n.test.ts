/* ===============================================================
   🛡️ PHASE 11 — ANA SAYFA ÇOKLU DİL: SAF/BİRİM TESTLERİ
   ===============================================================
   Kapsam:
     A) TR BİT-BİRE AYNILIK — dictionary'ye taşınan metinler, taşınmadan
        ÖNCEKİ hardcoded Türkçe değerlerle BİREBİR aynı mı
     B) Hero çeviri fallback zinciri (settings_translations → canonical
        → dictionary default) + CTA href'lerinin DİL BAĞIMSIZ kalması
     C) SSS (faq_translations) çeviri fallback'i + batch/N+1 davranışı
     D) Villa rozeti (villa.badge / villa_translations.badge) kaldırıldı
     E) Villa ADI ve BÖLGE ADI'nın CANONICAL kalması (regresyon kilidi)
     F) Ay adları — locale'e göre, TR çıktısı değişmeden
     G) JSON-LD `inLanguage` (WebSite + FAQPage)
     H) Ana sayfa metadata: canonical + hreflang
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import {
  HERO_DEFAULTS,
  HERO_CTA_DEFAULTS,
  resolveHeroContent,
} from "@/lib/hero.helpers";
import {
  bucketMonthLabel,
  bucketMonthLabelTr,
} from "@/lib/short-gaps.helpers";
import {
  buildWebsite,
  buildFaqJsonLd,
} from "@/app/components/seo/StructuredData";
import { SETTINGS_TRANSLATABLE_FIELDS } from "@/lib/i18n/settings-translations.types";
/* 🛡️ TR canonical başlığın TEK doğruluk kaynağı — dictionary değeriyle
   senkron kalmalı (component artık dictionary'den okuyor). */
import { DISCOUNT_COLLECTION_DEFAULTS } from "@/app/services/discount-collection.service";
import type { SettingsTranslationsByLocale } from "@/lib/i18n/settings-translations.types";
import type { MonthNumber } from "@/lib/i18n/dictionaries/types";

/* ===============================================================
   A) TR BİT-BİRE AYNILIK (FAZ 17 regresyon kilidi)
   =============================================================== */
describe("A) TR dictionary değerleri, taşınmadan önceki hardcoded metinlerle BİREBİR", () => {
  const h = getDictionary("tr").home;

  it("1) Hero defaults — HERO_DEFAULTS / HERO_CTA_DEFAULTS ile birebir", () => {
    expect(h.hero.badge).toBe(HERO_DEFAULTS.badge);
    expect(h.hero.title).toBe(HERO_DEFAULTS.title);
    expect(h.hero.subtitle).toBe(HERO_DEFAULTS.subtitle);
    expect(h.hero.primaryCtaText).toBe(HERO_CTA_DEFAULTS.primary.text);
    expect(h.hero.secondaryCtaText).toBe(HERO_CTA_DEFAULTS.secondary.text);
    expect(h.hero.imageAlt).toBe("Akdeniz villası");
  });

  it("2) Section başlıkları", () => {
    expect(h.discount.title).toBe(DISCOUNT_COLLECTION_DEFAULTS.title);
    expect(h.discount.title).toBe("İndirimli Kiralık Villalar");
    /* "Villa Tiplerini Keşfedin" bölümü ana sayfadan kaldırıldı. */
    expect("villaTypes" in h).toBe(false);
    expect(h.villas.title).toBe("Öne Çıkan Villalar");
    expect(h.villas.ctaAll).toBe("Tüm Villaları Gör");
    expect(h.regions.title).toBe("Villa Kiralama Bölgeleri");
    expect(h.regions.subtitle).toBe("Özenle seçilmiş bölgeler");
    expect(h.regions.ctaAll).toBe("Tüm bölgeler");
    expect(h.shortGaps.title).toBe("Kısa Süreli Fırsatlar");
    expect(h.shortGaps.badge).toBe("Son Dakika Fırsatı");
    expect(h.faq.title).toBe("Sıkça Sorulan Sorular");
    expect(h.faq.eyebrow).toBe("Sıkça Sorulan");
    expect(h.reviews.title).toBe("Misafirlerimiz ne diyor?");
  });

  it("3) Empty state + arama paneli (avantaj kartları kaldırıldı)", () => {
    expect(h.villas.emptyEyebrow).toBe("Koleksiyon");
    expect(h.villas.emptyTitle).toBe("Yakında burada.");
    /* "14 Yıllık Tecrübe" avantaj kartları ana sayfadan kaldırıldı. */
    expect("advantages" in h).toBe(false);
    expect(h.search.datePlaceholder).toBe("Tarih seç");
    expect(h.search.villaType).toBe("Villa tipi");
    expect(h.search.allRegions).toBe("Tüm bölgeler");
    expect(h.search.submit).toBe("Villa bul");
  });

  it("4) Template metinleri eski string interpolation'ı ÜRETİR", () => {
    expect(h.shortGaps.nightsLabel.replace("{n}", "3")).toBe(
      "3 gecelik villalar"
    );
  });

  it("5) SEO açıklaması — eski hardcoded WebSite description", () => {
    expect(h.seo.websiteDescription).toBe(
      "Akdeniz'in seçkin villalarında özel havuz, deniz manzarası ve butik konfor."
    );
  });
});

describe("A2) EN gerçekten ÇEVRİLMİŞ (TR ile aynı değil)", () => {
  const tr = getDictionary("tr").home;
  for (const locale of ["en"] as const) {
    it(`${locale} — anahtar başlıklar TR'den farklı`, () => {
      const d = getDictionary(locale).home;
      expect(d.villas.title).not.toBe(tr.villas.title);
      expect(d.faq.title).not.toBe(tr.faq.title);
      expect(d.search.submit).not.toBe(tr.search.submit);
      expect(d.months[1]).not.toBe(tr.months[1]);
    });
  }

  it("TR/EN `home` şeması EKSİKSİZ (aynı anahtar kümesi)", () => {
    const keys = (l: Locale) =>
      JSON.stringify(
        Object.entries(getDictionary(l).home).map(([k, v]) => [
          k,
          typeof v === "object" && v ? Object.keys(v).sort() : null,
        ])
      );
    expect(keys("en")).toBe(keys("tr"));
  });
});

/* ===============================================================
   B) HERO — çeviri fallback zinciri
   =============================================================== */
const HERO_SETTINGS = {
  hero_enabled: true,
  hero_badge_text: "EN Badge",
  hero_title: "EN Title",
  hero_subtitle: "EN Subtitle",
  hero_primary_cta_text: "EN Primary",
  hero_primary_cta_href: "#kisa-sureli-firsatlar",
  hero_secondary_cta_text: "EN Secondary",
  business_hours: null,
  hero_secondary_cta_href: "#sss",
  hero_background_image: "https://cdn.example/hero.webp",
};

const TR_HERO: SettingsTranslationsByLocale = {
  tr: {
    footer_copyright: null,
    default_meta_title: null,
    default_meta_description: null,
    hero_title: "TR Başlık",
    hero_subtitle: "TR Alt Başlık",
    hero_badge_text: "TR Rozet",
    hero_primary_cta_text: "TR Birincil",
    hero_secondary_cta_text: "TR İkincil",
    business_hours: null,
  },
};

describe("B) resolveHeroContent — locale fallback", () => {
  it("6) EN (ana dil) — çeviri VARKEN BİLE canonical değerler (bit-bire aynı)", () => {
    const a = resolveHeroContent(HERO_SETTINGS, { cacheKey: 1 });
    const b = resolveHeroContent(HERO_SETTINGS, {
      cacheKey: 1,
      locale: "en",
      translations: TR_HERO,
    });
    expect(b).toEqual(a);
    expect(b.title).toBe("EN Title");
    expect(b.primaryCta?.text).toBe("EN Primary");
  });

  it("7) TR — çeviri varsa çeviri kullanılır", () => {
    const r = resolveHeroContent(HERO_SETTINGS, {
      locale: "tr",
      translations: TR_HERO,
    });
    expect(r.badge).toBe("TR Rozet");
    expect(r.title).toBe("TR Başlık");
    expect(r.subtitle).toBe("TR Alt Başlık");
    expect(r.primaryCta?.text).toBe("TR Birincil");
    expect(r.secondaryCta?.text).toBe("TR İkincil");
  });

  it("8) TR — çeviri YOKSA EN canonical'e düşer", () => {
    const r = resolveHeroContent(HERO_SETTINGS, {
      locale: "tr",
      translations: null,
    });
    expect(r.title).toBe("EN Title");
    expect(r.primaryCta?.text).toBe("EN Primary");
  });

  it("9) TR — çeviri BOŞ string ise EN canonical'e düşer", () => {
    const r = resolveHeroContent(HERO_SETTINGS, {
      locale: "tr",
      translations: {
        tr: {
          footer_copyright: null,
          default_meta_title: null,
          default_meta_description: null,
          hero_title: "   ",
          hero_subtitle: "",
          hero_badge_text: null,
          hero_primary_cta_text: "",
          hero_secondary_cta_text: null,
          business_hours: null,
        },
      },
    });
    expect(r.title).toBe("EN Title");
    expect(r.subtitle).toBe("EN Subtitle");
    expect(r.primaryCta?.text).toBe("EN Primary");
  });

  it("10) 🔒 CTA HREF'LERİ ve HERO GÖRSELİ DİL BAĞIMSIZ", () => {
    const tr = resolveHeroContent(HERO_SETTINGS, {
      locale: "tr",
      translations: TR_HERO,
    });
    const en = resolveHeroContent(HERO_SETTINGS, { locale: "en" });
    expect(en.primaryCta?.href).toBe("#kisa-sureli-firsatlar");
    expect(en.secondaryCta?.href).toBe("#sss");
    expect(en.primaryCta?.href).toBe(tr.primaryCta?.href);
    expect(en.backgroundImage).toBe(tr.backgroundImage);
  });

  it("11) 🔒 href alanları çeviri whitelist'inde YOK", () => {
    const fields = [...SETTINGS_TRANSLATABLE_FIELDS] as string[];
    expect(fields).not.toContain("hero_primary_cta_href");
    expect(fields).not.toContain("hero_secondary_cta_href");
    expect(fields).not.toContain("hero_background_image");
  });

  it("12) hero_enabled=false → locale'in dictionary default'ları", () => {
    const tr = resolveHeroContent(
      { ...HERO_SETTINGS, hero_enabled: false },
      { locale: "tr" }
    );
    expect(tr.title).toBe(getDictionary("tr").home.hero.title);
    expect(tr.title).toBe(HERO_DEFAULTS.title);
    /* locale verilmezse varsayılan dil İngilizce */
    const en = resolveHeroContent({ ...HERO_SETTINGS, hero_enabled: false });
    expect(en.title).toBe(getDictionary("en").home.hero.title);
  });
});

/* ===============================================================
   C) SSS — faq_translations
   =============================================================== */
const getTranslationsForParentsMock = vi.fn();
vi.mock("@/lib/i18n/get-translation.server", () => ({
  getTranslationsForParents: (...a: unknown[]) =>
    getTranslationsForParentsMock(...a),
}));

const FAQS = [
  { id: "f1", question: "EN Q1", answer: "EN A1" },
  { id: "f2", question: "EN Q2", answer: "EN A2" },
];

beforeEach(() => {
  getTranslationsForParentsMock.mockReset();
  getTranslationsForParentsMock.mockResolvedValue(new Map());
});

describe("C) applyFaqTranslations", () => {
  it("13) EN (ana dil) → sorgu HİÇ atılmaz, liste AYNI referans", async () => {
    const { applyFaqTranslations } = await import(
      "@/lib/i18n/get-faq-translations.server"
    );
    const out = await applyFaqTranslations(FAQS, "en");
    expect(out).toBe(FAQS);
    expect(getTranslationsForParentsMock).not.toHaveBeenCalled();
  });

  it("14) TR → TEK batch sorgu (N+1 YOK), tüm id'ler birlikte", async () => {
    const { applyFaqTranslations } = await import(
      "@/lib/i18n/get-faq-translations.server"
    );
    await applyFaqTranslations(FAQS, "tr");
    expect(getTranslationsForParentsMock).toHaveBeenCalledTimes(1);
    expect(getTranslationsForParentsMock).toHaveBeenCalledWith(
      "faq",
      ["f1", "f2"],
      "tr"
    );
  });

  it("15) TR → çeviri varsa çevrilir; olmayan satır canonical kalır", async () => {
    getTranslationsForParentsMock.mockResolvedValue(
      new Map([["f1", { question: "TR Soru 1", answer: "TR Cevap 1" }]])
    );
    const { applyFaqTranslations } = await import(
      "@/lib/i18n/get-faq-translations.server"
    );
    const out = await applyFaqTranslations(FAQS, "tr");
    expect(out[0]).toEqual({ id: "f1", question: "TR Soru 1", answer: "TR Cevap 1" });
    expect(out[1]).toBe(FAQS[1]);
  });

  it("16) alan bazlı fallback — soru çevrili, cevap boş", async () => {
    getTranslationsForParentsMock.mockResolvedValue(
      new Map([["f1", { question: "TR Soru 1", answer: "   " }]])
    );
    const { applyFaqTranslations } = await import(
      "@/lib/i18n/get-faq-translations.server"
    );
    const out = await applyFaqTranslations(FAQS, "tr");
    expect(out[0].question).toBe("TR Soru 1");
    expect(out[0].answer).toBe("EN A1");
  });

  it("17) okuma hata verirse canonical liste döner (sayfa ÇÖKMEZ)", async () => {
    getTranslationsForParentsMock.mockRejectedValue(new Error("boom"));
    const { applyFaqTranslations } = await import(
      "@/lib/i18n/get-faq-translations.server"
    );
    const out = await applyFaqTranslations(FAQS, "tr");
    expect(out).toBe(FAQS);
  });
});

/* ===============================================================
   D) VILLA ROZETİ KALDIRILDI + E) CANONICAL KİLİTLERİ
   =============================================================== */
describe("D) villa rozeti (villa.badge / villa_translations.badge) kaldırıldı", () => {
  it("18) rozet çeviri helper'ı yok", () => {
    expect(
      existsSync(join(process.cwd(), "lib/i18n/get-villa-badge-translations.server.ts"))
    ).toBe(false);
  });

  it("19) VillaList rozet okumuyor ve VillaCard'a rozet geçirmiyor", () => {
    const src = readFileSync(
      join(process.cwd(), "app/components/villa/VillaList.tsx"),
      "utf8"
    );
    expect(src).not.toMatch(/getVillaBadges/);
    expect(src).not.toMatch(/\bbadge\b/);
  });
});

describe("E) 🔒 CANONICAL KİLİTLERİ", () => {
  it("20) villa ADI için çeviri yolu YOK — VillaTranslationRow `title` içermez", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/i18n/translations.types.ts"),
      "utf8"
    );
    const row = src.slice(
      src.indexOf("export type VillaTranslationRow"),
      src.indexOf("};", src.indexOf("export type VillaTranslationRow"))
    );
    expect(row).not.toMatch(/^\s*title:/m);
    expect(row).not.toMatch(/^\s*badge:/m);
  });

  it("21) bölge adı için çeviri entity'si YOK", async () => {
    const { TRANSLATION_ENTITY_CONFIG } = await import(
      "@/lib/i18n/translations.types"
    );
    expect(Object.keys(TRANSLATION_ENTITY_CONFIG)).not.toContain(
      "villa_location"
    );
  });

  it("22) LocationCollection bölge adını ÇEVİRMEZ (kaynak kilidi)", async () => {
    const src = await import("fs").then((fs) =>
      fs.readFileSync("app/components/villa/LocationCollection.tsx", "utf-8")
    );
    expect(src).not.toMatch(/resolveTaxonomyName/);
    expect(src).not.toMatch(/getTranslationsForParents/);
  });
});

/* ===============================================================
   F) AY ADLARI
   =============================================================== */
describe("F) bucketMonthLabel", () => {
  const nameFor = (l: Locale) => (m: number) =>
    getDictionary(l).home.months[m as MonthNumber] ?? "";

  it("23) TR — `bucketMonthLabelTr` ile BİREBİR aynı çıktı", () => {
    for (const bm of ["2026-01-01", "2026-05-01", "2026-12-01"]) {
      expect(bucketMonthLabel(bm, nameFor("tr"))).toBe(bucketMonthLabelTr(bm));
    }
    expect(bucketMonthLabel("2026-01-01", nameFor("tr"))).toBe("Ocak 2026");
  });

  it("24) EN — çevrilmiş ay adı, format AYNI", () => {
    expect(bucketMonthLabel("2026-01-01", nameFor("en"))).toBe("January 2026");
  });

  it("25) geçersiz girdi → boş string (davranış değişmedi)", () => {
    expect(bucketMonthLabel("", nameFor("tr"))).toBe("");
    expect(bucketMonthLabel("2026-13-01", nameFor("tr"))).toBe("");
  });
});

/* ===============================================================
   G) JSON-LD inLanguage
   =============================================================== */
describe("G) JSON-LD locale", () => {
  it("26) buildWebsite — locale VERİLMEZSE çıktı eskisi gibi (inLanguage YOK)", () => {
    const d = buildWebsite({ name: "X", description: "Y" }) as Record<
      string,
      unknown
    >;
    expect(d).not.toHaveProperty("inLanguage");
  });

  it("27) buildWebsite — locale verilirse inLanguage eklenir", () => {
    expect(
      (buildWebsite({ name: "X" }, "en") as Record<string, unknown>).inLanguage
    ).toBe("en");
    expect(
      (buildWebsite({ name: "X" }, "tr") as Record<string, unknown>).inLanguage
    ).toBe("tr-TR");
  });

  it("28) buildFaqJsonLd — locale opsiyonel, mainEntity DEĞİŞMEZ", () => {
    const withoutLocale = buildFaqJsonLd(FAQS) as Record<string, unknown>;
    const withLocale = buildFaqJsonLd(FAQS, "en") as Record<string, unknown>;
    expect(withoutLocale).not.toHaveProperty("inLanguage");
    expect(withLocale.inLanguage).toBe("en");
    expect(JSON.stringify(withLocale.mainEntity)).toBe(
      JSON.stringify(withoutLocale.mainEntity)
    );
  });
});

/* ===============================================================
   H) METADATA — canonical + hreflang
   =============================================================== */
const getCachedSettingsMock = vi.fn();
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: () => getCachedSettingsMock(),
}));

describe("H) buildHomeMetadata", () => {
  beforeEach(() => {
    getCachedSettingsMock.mockReset();
    getCachedSettingsMock.mockResolvedValue({
      default_meta_title: "EN Title",
      default_meta_description: "EN Description",
      translations: {
        tr: {
          footer_copyright: null,
          default_meta_title: "TR Başlık",
          default_meta_description: "TR Açıklama",
          hero_title: null,
          hero_subtitle: null,
          hero_badge_text: null,
          hero_primary_cta_text: null,
          hero_secondary_cta_text: null,
          business_hours: null,
        },
      },
    });
  });

  it("29) canonical — TR '/tr', EN '/'", async () => {
    const { buildHomeMetadata } = await import(
      "@/app/components/home/home-metadata"
    );
    expect((await buildHomeMetadata("tr")).alternates?.canonical).toBe("/tr");
    expect((await buildHomeMetadata("en")).alternates?.canonical).toBe("/");
  });

  it("30) hreflang — tr/en/x-default her locale'de AYNI küme (DE YOK)", async () => {
    const { buildHomeMetadata } = await import(
      "@/app/components/home/home-metadata"
    );
    for (const locale of SUPPORTED_LOCALES) {
      const langs = (await buildHomeMetadata(locale)).alternates
        ?.languages as Record<string, string>;
      expect(langs).toEqual({
        tr: "/tr",
        en: "/",
        "x-default": "/",
      });
    }
  });

  it("31) title/description — TR çevirisi kullanılır", async () => {
    const { buildHomeMetadata } = await import(
      "@/app/components/home/home-metadata"
    );
    const tr = await buildHomeMetadata("tr");
    expect(tr.title).toBe("TR Başlık");
    expect(tr.description).toBe("TR Açıklama");
    expect(tr.openGraph?.title).toBe("TR Başlık");
  });

  it("32) EN (ana dil) → canonical EN metin", async () => {
    const { buildHomeMetadata } = await import(
      "@/app/components/home/home-metadata"
    );
    expect((await buildHomeMetadata("en")).title).toBe("EN Title");
  });

  it("33) settings okunamazsa dil bazlı fallback (EN: root layout ile AYNI)", async () => {
    getCachedSettingsMock.mockRejectedValue(new Error("down"));
    const { buildHomeMetadata } = await import(
      "@/app/components/home/home-metadata"
    );
    expect((await buildHomeMetadata("en")).title).toBe("Luxury Villa Rentals in Kalkan");
    expect((await buildHomeMetadata("tr")).title).toBe("Villa Kiralama — Lüks Villa Deneyimi");
  });

  it("34) `robots` BURADA set EDİLMEZ (root layout politikası miras)", async () => {
    const { buildHomeMetadata } = await import(
      "@/app/components/home/home-metadata"
    );
    expect(await buildHomeMetadata("en")).not.toHaveProperty("robots");
  });
});

describe("Ana sayfa — '14 Yıllık Tecrübe' avantaj kartları kaldırıldı", () => {
  it("HomePageBody bölümü render etmiyor; bileşen dosyası yok", () => {
    const root = process.cwd();
    const body = readFileSync(
      join(root, "app/components/home/HomePageBody.tsx"),
      "utf8",
    );
    expect(body).not.toContain("HeroAdvantageCards");
    expect(
      existsSync(join(root, "app/components/home/HeroAdvantageCards.tsx")),
    ).toBe(false);
    for (const locale of SUPPORTED_LOCALES) {
      expect("advantages" in getDictionary(locale).home).toBe(false);
    }
  });
});

describe("Ana sayfa — Öne Çıkan Villalar bölümü", () => {
  it("başlık TR 'Öne Çıkan Villalar', EN 'Featured Villas'", () => {
    expect(getDictionary("tr").home.villas.title).toBe("Öne Çıkan Villalar");
    expect(getDictionary("en").home.villas.title).toBe("Featured Villas");
  });
  it("başlık altı açıklama TR/EN ve VillaList'te ortak başlığa geçirilir", () => {
    expect(getDictionary("tr").home.villas.subtitle).toBe(
      "Kalkan'ın en güzel konumlarında, özenle seçilmiş lüks villa koleksiyonumuzdan size özel olanı bulun",
    );
    expect(getDictionary("en").home.villas.subtitle).toBe(
      "Find your perfect villa among our curated collection of luxury villas in Kalkan’s finest locations.",
    );
    const list = readFileSync(join(process.cwd(), "app/components/villa/VillaList.tsx"), "utf8");
    expect(list).toContain("<HomeSectionHeading title={dict.title} subtitle={dict.subtitle} />");
  });
  it("sıra: Hero → Öne Çıkan Villalar → İndirimli Kiralık Villalar → Bölgeler", () => {
    const body = readFileSync(
      join(process.cwd(), "app/components/home/HomePageBody.tsx"),
      "utf8",
    );
    const at = (tag: string) => body.indexOf(tag);
    expect(at("<Hero")).toBeGreaterThan(-1);
    expect(at("<VillaList")).toBeGreaterThan(at("<Hero"));
    expect(at("<DiscountCollection")).toBeGreaterThan(at("<VillaList"));
  });
  it("Bölgeler ve SSS ana sayfadan kaldırıldı; kalan bölümlerin sırası korunur", () => {
    const body = readFileSync(
      join(process.cwd(), "app/components/home/HomePageBody.tsx"),
      "utf8",
    );
    expect(body).not.toContain("<LocationCollection");
    expect(body).not.toContain("<FaqSection");
    /* Görünmeyen SSS için FAQPage işaretlemesi de basılmaz. */
    expect(body).not.toContain("buildFaqJsonLd");
    expect(body).not.toContain("getCachedFaqs");
    const order = [
      "<Hero",
      "<VillaList",
      "<HomeServicesSection",
      "<HomeBlogFeatureSection",
      "<DiscountCollection",
      "<ShortGapsSection",
      "<HomepageReviewsSection",
    ].map((t) => body.indexOf(t));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });
  it("bileşenler ve ilgili sayfalar silinmedi (yalnız ana sayfadan çıkarıldı)", () => {
    for (const p of [
      "app/components/villa/LocationCollection.tsx",
      "app/components/ui/FaqSection.tsx",
    ]) {
      expect(existsSync(join(process.cwd(), p))).toBe(true);
    }
  });
});
