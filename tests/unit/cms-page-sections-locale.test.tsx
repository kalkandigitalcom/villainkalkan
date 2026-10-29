/* ===============================================================
   🛡️ MIGRATION 091 — CMS BÖLÜM (pages.sections) ÇEVİRİSİ TESTLERİ
   ===============================================================
   Forensic audit'te tespit edilen SON canonical DB kapsam açığını
   kilitler:

     `pages.sections` (JSONB: richtext | image | quote) için
     `page_translations`'ta kolon YOKTU → EN `/p/[slug]`
     sayfalarında canonical TÜRKÇE bölüm metni render ediliyordu
     (DB_CANONICAL_LEAK).

   YÖNTEM — `cms-page-static-i18n.test.tsx` ile AYNI mock katmanı;
   TEK fark: `PageSectionRenderer` STUB EDİLMEZ (gerçek metin DOM'a
   çıksın diye) ve `getTranslation` leaf'i mock'lanır. Böylece
   "TR'de sorgu yok" ve "sayfa başına TEK çeviri sorgusu" iddiaları
   GERÇEKTEN kanıtlanabilir.

   KAPSAM:
     A) TR / EN bölüm metinleri
     B) Fallback: satır yok · sections null · boş dizi · bozuk veri
     C) Alan bazında: richtext.content · quote.text · quote.author ·
        image.alt (+ image.path ÇEVRİLMEZ)
     D) Mevcut page translation alanları (title/excerpt/body) bozulmadı
     E) N+1 YOK + TR'de SIFIR sorgu
     F) STRUCTURAL INVARIANT — canonical alan resolver zincirinden
        geçiyor (kaynak-kilidi)
   =============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

/* ---------------- mock katmanı ---------------- */
const requirePublicLocaleEnabledMock = vi.fn();
vi.mock("@/lib/i18n/public-locale-gate.server", () => ({
  requirePublicLocaleEnabled: () => requirePublicLocaleEnabledMock(),
}));
vi.mock("@/lib/i18n/request-locale.server", () => ({
  setRequestLocale: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const getPageBySlugMock = vi.fn();
vi.mock("@/app/services/page.service", () => ({
  getPageBySlug: (...a: unknown[]) => getPageBySlugMock(...a),
  getPages: vi.fn(),
}));

/* 🛡️ GERÇEK `resolvePageContent` + GERÇEK `resolveTranslatedSections`
   çalışır; yalnız en alttaki okuma primitive'i mock'lanır. */
const getTranslationMock = vi.fn();
vi.mock("@/lib/i18n/get-translation.server", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    getTranslation: (...a: unknown[]) => getTranslationMock(...a),
  };
});

vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: vi.fn().mockResolvedValue({ multilingual_enabled: true }),
}));
vi.mock("@/lib/storage.helpers", () => ({
  getPageCoverPublicUrl: (v: string | null | undefined) =>
    v ? `https://cdn.test/${v}` : null,
  getPageSectionImageUrl: (v: string | null | undefined) =>
    v ? `https://cdn.test/${v}` : null,
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img alt={String(props.alt ?? "")} src={String(props.src ?? "")} />
  ),
}));
vi.mock("@/app/components/ui/PageHero", () => ({
  default: (props: { title?: React.ReactNode }) => (
    <div data-testid="page-hero">
      <h1>{props.title}</h1>
    </div>
  ),
}));
vi.mock("@/app/components/seo/StructuredData", () => ({
  JsonLd: () => null,
  buildBreadcrumb: (items: unknown, locale?: string) => ({ items, locale }),
}));

const PAGE_ID = "page-uuid-1";
const SLUG = "kasta-unutulmaz-bir-tatil";

/* Canonical (EN — ana içerik) bölümler — üç tipin de çevrilebilir alanları dolu. */
const EN_SECTIONS = [
  { type: "richtext", content: "An unforgettable holiday in Kalkan bays." },
  { type: "image", path: "pages/kalkan.webp", alt: "View of Kalkan bay" },
  { type: "quote", text: "The sea heals everything.", author: "Founding Partner" },
];

/* Türkçe çeviri bölümleri (`page_translations.sections`, locale 'tr'). */
const TR_SECTIONS = [
  { type: "richtext", content: "Kalkan koylarinda unutulmaz bir tatil." },
  { type: "image", path: "pages/kalkan.webp", alt: "Kalkan koyu manzarasi" },
  { type: "quote", text: "Deniz her seyi iyilestirir.", author: "Kurucu Ortak" },
];

const EN_PAGE = {
  id: PAGE_ID,
  slug: SLUG,
  title: "An Unforgettable Holiday",
  excerpt: "EN excerpt",
  body: "EN body",
  seo_title: null,
  seo_description: null,
  noindex: false,
  cover_image: "pages/kas.webp",
  sections: EN_SECTIONS,
};

function translationRow(locale: "tr", sections: unknown) {
  return {
    id: `t-${locale}`,
    page_id: PAGE_ID,
    locale,
    title: "Kas'ta Unutulmaz Bir Tatil",
    body: "Turkce govde",
    excerpt: "Turkce ozet",
    seo_title: null,
    seo_description: null,
    sections,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const ROUTES = {
  tr: "@/app/(public)/tr/p/[slug]/page",
  en: "@/app/(public)/p/[slug]/page",
} as const;

async function renderRoute(locale: keyof typeof ROUTES) {
  const { default: Page } = await import(ROUTES[locale]);
  const element = await Page({ params: Promise.resolve({ slug: SLUG }) });
  render(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePublicLocaleEnabledMock.mockResolvedValue(undefined);
  getPageBySlugMock.mockResolvedValue(EN_PAGE);
  getTranslationMock.mockResolvedValue(null);
});

/* ===============================================================
   A) EN / TR — bölüm metinleri
   =============================================================== */
describe("CMS bölümleri (sections) — locale-aware render", () => {
  it("1) EN: canonical bölüm metinleri gösterilir", async () => {
    await renderRoute("en");
    expect(screen.getByText(/unforgettable holiday in Kalkan bays/)).toBeInTheDocument();
    expect(screen.getByText(/The sea heals everything/)).toBeInTheDocument();
    expect(screen.getByAltText("View of Kalkan bay")).toBeInTheDocument();
  });

  it("2) EN (ana dil): page_translations'a HİÇ SORGU ATILMAZ", async () => {
    await renderRoute("en");
    expect(getTranslationMock).not.toHaveBeenCalled();
  });

  it("3) TR: TR bölüm metinleri gösterilir, EN metinleri DOM'da YOK", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", TR_SECTIONS));
    await renderRoute("tr");
    expect(screen.getByText(/Kalkan koylarinda/)).toBeInTheDocument();
    expect(screen.getByText(/Deniz her seyi iyilestirir/)).toBeInTheDocument();
    expect(screen.getByAltText("Kalkan koyu manzarasi")).toBeInTheDocument();

    expect(screen.queryByText(/unforgettable holiday in Kalkan bays/)).not.toBeInTheDocument();
    expect(screen.queryByText(/The sea heals everything/)).not.toBeInTheDocument();
    expect(screen.queryByAltText("View of Kalkan bay")).not.toBeInTheDocument();
  });
});

/* ===============================================================
   B) FALLBACK
   =============================================================== */
describe("CMS bölümleri — canonical EN fallback", () => {
  it("5) tr: çeviri SATIRI yoksa canonical EN bölümleri gösterilir", async () => {
    getTranslationMock.mockResolvedValue(null);
    await renderRoute("tr");
    expect(screen.getByText(/unforgettable holiday in Kalkan bays/)).toBeInTheDocument();
    expect(screen.getByAltText("View of Kalkan bay")).toBeInTheDocument();
  });

  it("6) tr: sections NULL ise canonical EN bölümleri gösterilir", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", null));
    await renderRoute("tr");
    expect(screen.getByText(/unforgettable holiday in Kalkan bays/)).toBeInTheDocument();
  });

  it("7) tr: sections BOŞ DİZİ ise canonical EN bölümleri gösterilir", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", []));
    await renderRoute("tr");
    expect(screen.getByText(/unforgettable holiday in Kalkan bays/)).toBeInTheDocument();
  });

  it("8) tr: sections BOZUK/geçersiz ise canonical EN bölümleri gösterilir", async () => {
    getTranslationMock.mockResolvedValue(
      translationRow("tr", [{ type: "bilinmeyen", foo: 1 }, "metin", null])
    );
    await renderRoute("tr");
    expect(screen.getByText(/unforgettable holiday in Kalkan bays/)).toBeInTheDocument();
  });

  it("9) `sections` anahtarı HİÇ YOKSA (migration uygulanmamış satır) canonical", async () => {
    const row = translationRow("tr", undefined) as Record<string, unknown>;
    delete row.sections;
    getTranslationMock.mockResolvedValue(row);
    await renderRoute("tr");
    expect(screen.getByText(/unforgettable holiday in Kalkan bays/)).toBeInTheDocument();
  });
});

/* ===============================================================
   C) ALAN BAZINDA + image.path ÇEVRİLMEZ
   =============================================================== */
describe("CMS bölümleri — alan bazında davranış", () => {
  it("10) image.path ÇEVRİLMEZ — asset yolu her locale'de AYNI", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", TR_SECTIONS));
    await renderRoute("tr");
    const img = screen.getByAltText("Kalkan koyu manzarasi") as HTMLImageElement;
    expect(img.src).toContain("pages/kalkan.webp");
  });

  it("11) quote.author çevirisi uygulanır", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", TR_SECTIONS));
    await renderRoute("tr");
    expect(screen.getByText(/Kurucu Ortak/)).toBeInTheDocument();
    expect(screen.queryByText(/Founding Partner/)).not.toBeInTheDocument();
  });

  it("12) mevcut section TİPLERİ korunur (richtext + image + quote hepsi render)", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", TR_SECTIONS));
    await renderRoute("tr");
    expect(screen.getByText(/Kalkan koylarinda/)).toBeInTheDocument();
    expect(screen.getByAltText("Kalkan koyu manzarasi")).toBeInTheDocument();
    expect(screen.getByText(/Deniz her seyi iyilestirir/)).toBeInTheDocument();
  });

  it("13) mevcut page translation alanları (title) ÇALIŞMAYA DEVAM EDİYOR", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", TR_SECTIONS));
    await renderRoute("tr");
    expect(
      screen.getByRole("heading", { name: "Kas'ta Unutulmaz Bir Tatil" })
    ).toBeInTheDocument();
  });
});

/* ===============================================================
   D) PERFORMANS — N+1 YOK
   =============================================================== */
describe("CMS bölümleri — N+1 yok", () => {
  it("14) TR: sayfa başına TEK çeviri okuması; bölüm BAŞINA sorgu YOK", async () => {
    getTranslationMock.mockResolvedValue(translationRow("tr", TR_SECTIONS));
    await renderRoute("tr");
    /* 3 bölüm var; yine de TEK `getTranslation("page", …)` çağrısı. */
    expect(getTranslationMock).toHaveBeenCalledTimes(1);
    expect(getTranslationMock).toHaveBeenCalledWith("page", PAGE_ID, "tr");
  });
});

/* ===============================================================
   E) resolveTranslatedSections — saf birim testleri
   =============================================================== */
describe("resolveTranslatedSections — fallback semantiği", () => {
  it("16) geçerli çeviri → çeviri; aksi halde canonical", async () => {
    const { resolveTranslatedSections } = await import(
      "@/lib/i18n/get-page-translation.server"
    );
    expect(resolveTranslatedSections(TR_SECTIONS, EN_SECTIONS)).toBe(
      TR_SECTIONS
    );
    expect(resolveTranslatedSections(null, EN_SECTIONS)).toBe(EN_SECTIONS);
    expect(resolveTranslatedSections(undefined, EN_SECTIONS)).toBe(EN_SECTIONS);
    expect(resolveTranslatedSections([], EN_SECTIONS)).toBe(EN_SECTIONS);
    expect(resolveTranslatedSections("bozuk", EN_SECTIONS)).toBe(EN_SECTIONS);
    expect(resolveTranslatedSections([{ type: "yok" }], EN_SECTIONS)).toBe(
      EN_SECTIONS
    );
  });

  it("17) canonical DEĞİŞTİRİLMEZ (saf fonksiyon)", async () => {
    const { resolveTranslatedSections } = await import(
      "@/lib/i18n/get-page-translation.server"
    );
    const before = JSON.stringify(EN_SECTIONS);
    resolveTranslatedSections(null, EN_SECTIONS);
    expect(JSON.stringify(EN_SECTIONS)).toBe(before);
  });
});

/* ===============================================================
   F) STRUCTURAL INVARIANT — kaynak kilidi
   ---------------------------------------------------------------
   "Translation tablosunda karşılığı bulunan canonical DB alanı public
    EN yüzeyde render ediliyorsa translation resolver/batch reader
    zincirinden geçmelidir."
   Bu blok o invariant'ı `pages.sections` için YAPISAL olarak kilitler
   — davranış testleri geçse bile zincir koparsa test KIRILIR.
   =============================================================== */
function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
}

describe("STRUCTURAL INVARIANT — pages.sections resolver zinciri", () => {
  it("18) migration 091 mevcut, ADDITIVE ve jsonb + nullable", () => {
    const sql = read("db/migrations/091_page_translations_sections.sql");
    expect(sql).toMatch(/\bBEGIN;/);
    expect(sql).toMatch(/\bCOMMIT;/);
    expect(sql).toMatch(
      /ALTER TABLE public\.page_translations\s+ADD COLUMN IF NOT EXISTS sections jsonb;/
    );
    /* destructive DDL / veri yazımı YOK */
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql.replace(/^--.*$/gm, "")).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql.replace(/^--.*$/gm, "")).not.toMatch(/\bUPDATE\s+public\./i);
    expect(sql.replace(/^--.*$/gm, "")).not.toMatch(/\bALTER TABLE\s+public\.pages\b/i);
    /* NOT NULL DEFAULT kullanılmadı — NULL "çeviri yok" demek. */
    expect(sql.replace(/^--.*$/gm, "")).not.toMatch(/sections jsonb NOT NULL/i);
  });

  it("19) resolvePageContent `sections`'ı resolver'dan geçirir", () => {
    const src = read("lib/i18n/get-page-translation.server.ts");
    expect(src).toMatch(/export function resolveTranslatedSections/);
    expect(src).toMatch(
      /sections:\s*resolveTranslatedSections\(row\.sections,\s*canonical\.sections\)/
    );
    /* Ana dil (EN) kısa devresi korunuyor */
    expect(src).toMatch(/if \(resolvedLocale === DEFAULT_LOCALE\) return canonical;/);
  });

  it("20) CmsPageBody bölümleri `resolvedSections` üzerinden okur", () => {
    const src = read("app/components/cms/CmsPageBody.tsx");
    expect(src).toMatch(/resolvedSections/);
    expect(src).toMatch(
      /parsePageSections\(\s*resolvedSections !== undefined/
    );
    /* Bileşen hâlâ SAF: içinde DB/async erişim YOK. */
    expect(src).not.toMatch(/export default async function CmsPageBody/);
    expect(src).not.toMatch(/getTranslation\(|resolvePageContent\(/);
  });

  it("21) TR/EN iki route da `resolvedSections` prop'unu geçer (DE route'u YOK)", () => {
    for (const rel of [
      "app/(public)/tr/p/[slug]/page.tsx",
      "app/(public)/p/[slug]/page.tsx",
    ]) {
      const src = read(rel);
      expect(src, rel).toMatch(/resolvedSections=\{resolved\.sections\}/);
      expect(src, rel).toMatch(/resolvePageContent\(/);
    }
    /* DE desteği kaldırıldı — route dosyası artık mevcut değil. */
    expect(
      fs.existsSync(path.join(process.cwd(), "app/(public)/de/p/[slug]/page.tsx"))
    ).toBe(false);
  });

  it("22) PageSectionRenderer locale/DB bilmez (render saf kalır)", () => {
    const src = read("app/components/cms/PageSectionRenderer.tsx");
    expect(src).not.toMatch(/locale|getTranslation|resolvePageContent|Locale/);
  });

  it("23) admin servisi `sections`'ı sanitize eder ve opsiyonel tutar", () => {
    const src = read("app/services/page-translation.service.ts");
    expect(src).toMatch(/normalizeSections/);
    expect(src).toMatch(/parsePageSections/);
    /* verilmediyse payload'a HİÇ eklenmez → mevcut çağıranlar korunur */
    expect(src).toMatch(/\.\.\.\(sectionsProvided \? \{ sections \} : \{\}\)/);
  });
});
