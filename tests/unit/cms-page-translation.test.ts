/* ===============================================================
   🛡️ PHASE 12D — CMS SAYFA ÇEVİRİSİ: OKUMA + SEO TESTLERİ
   ===============================================================
   Hedef:
     • lib/i18n/get-page-translation.server.ts → resolvePageContent
     • app/components/cms/cms-page-metadata.ts → buildCmsPageMetadata

   `get-villa-translation.test.ts` / `villa-translation-service.test.ts`
   ile AYNI mock-katman prensibi: `getTranslation` (Phase 5 okuma
   katmanı) ve servis/cache bağımlılıkları mock'lanır, gerçek DB'ye
   dokunulmaz.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";

const getTranslationMock = vi.fn();
vi.mock("@/lib/i18n/get-translation.server", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    getTranslation: (...a: unknown[]) => getTranslationMock(...a),
  };
});

const getPageBySlugMock = vi.fn();
vi.mock("@/app/services/page.service", () => ({
  getPageBySlug: (...a: unknown[]) => getPageBySlugMock(...a),
  getPages: vi.fn(),
}));

const getCachedSettingsMock = vi.fn();
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: () => getCachedSettingsMock(),
}));

vi.mock("@/lib/storage.helpers", () => ({
  getPageCoverPublicUrl: (v: string | null | undefined) =>
    v ? `https://cdn.test/${v}` : null,
}));

import { resolvePageContent } from "@/lib/i18n/get-page-translation.server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildCmsPageMetadata } from "@/app/components/cms/cms-page-metadata";

const PAGE_ID = "page-uuid-1";
const SLUG = "kasta-unutulmaz-bir-tatil";

/* İngilizce ANA içerik = `pages` satırı; Türkçe = `page_translations`
   (locale 'tr'). Değişken adları rolü belirtir. */
const EN_PAGE = {
  id: PAGE_ID,
  slug: SLUG,
  title: "An Unforgettable Holiday in Kas",
  excerpt: "EN excerpt",
  body: "EN body",
  seo_title: "EN SEO title",
  seo_description: "EN SEO description",
  noindex: false,
  cover_image: "pages/kas.webp",
  sections: [],
};

const TR_ROW = {
  id: "t-tr",
  page_id: PAGE_ID,
  locale: "tr",
  title: "Kaş'ta Unutulmaz Bir Tatil",
  excerpt: "Türkçe özet",
  body: "Türkçe gövde",
  seo_title: "TR SEO başlık",
  seo_description: "TR SEO açıklama",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  getTranslationMock.mockResolvedValue(null);
  getPageBySlugMock.mockResolvedValue(EN_PAGE);
  getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: false });
});

/* =============================================================== */

describe("resolvePageContent — EN (ana dil)", () => {
  it("1) EN: page_translations'a HİÇ SORGU ATMAZ, canonical döner", async () => {
    const r = await resolvePageContent(EN_PAGE, "en");
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r).toEqual({
      title: EN_PAGE.title,
      excerpt: EN_PAGE.excerpt,
      body: EN_PAGE.body,
      seoTitle: EN_PAGE.seo_title,
      seoDescription: EN_PAGE.seo_description,
      sections: EN_PAGE.sections,
    });
  });

  it("2) body/content drift: body null ise content kullanılır", async () => {
    const r = await resolvePageContent(
      { ...EN_PAGE, body: null, content: "legacy content" },
      "en"
    );
    expect(r.body).toBe("legacy content");
  });

  it("3) page null → tüm alanlar null, sorgu yok", async () => {
    const r = await resolvePageContent(null, "tr");
    expect(r).toEqual({
      title: null,
      excerpt: null,
      body: null,
      seoTitle: null,
      seoDescription: null,
      sections: null,
    });
    expect(getTranslationMock).not.toHaveBeenCalled();
  });

  it("4) id yoksa sorgu atılmaz, canonical döner", async () => {
    const r = await resolvePageContent({ ...EN_PAGE, id: null }, "tr");
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r.title).toBe(EN_PAGE.title);
  });
});

describe("resolvePageContent — TR (çeviri)", () => {
  it("5) TR: doğru entity/parent/locale ile okunur ve TR değerler döner", async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    const r = await resolvePageContent(EN_PAGE, "tr");
    expect(getTranslationMock).toHaveBeenCalledWith("page", PAGE_ID, "tr");
    expect(r).toEqual({
      title: TR_ROW.title,
      excerpt: TR_ROW.excerpt,
      body: TR_ROW.body,
      seoTitle: TR_ROW.seo_title,
      seoDescription: TR_ROW.seo_description,
      /* TR satırında `sections` anahtarı YOK → canonical bölümler. */
      sections: EN_PAGE.sections,
    });
  });

  it("7) TR çeviri satırı YOKSA tüm alanlar EN'ye fallback", async () => {
    getTranslationMock.mockResolvedValue(null);
    const r = await resolvePageContent(EN_PAGE, "tr");
    expect(r).toEqual({
      title: EN_PAGE.title,
      excerpt: EN_PAGE.excerpt,
      body: EN_PAGE.body,
      seoTitle: EN_PAGE.seo_title,
      seoDescription: EN_PAGE.seo_description,
      sections: EN_PAGE.sections,
    });
  });

  it("8) DE artık desteklenmiyor → EN kısayolu (sorgu yok)", async () => {
    const r = await resolvePageContent(EN_PAGE, "de" as unknown as "tr");
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r.title).toBe(EN_PAGE.title);
    expect(r.body).toBe(EN_PAGE.body);
  });

  it("9) ALAN BAZINDA fallback — boş/NULL kolonlar EN'ye düşer", async () => {
    getTranslationMock.mockResolvedValue({
      ...TR_ROW,
      excerpt: null,
      body: "   ",
      seo_description: "",
    });
    const r = await resolvePageContent(EN_PAGE, "tr");
    expect(r.title).toBe(TR_ROW.title);
    expect(r.excerpt).toBe(EN_PAGE.excerpt);
    expect(r.body).toBe(EN_PAGE.body);
    expect(r.seoTitle).toBe(TR_ROW.seo_title);
    expect(r.seoDescription).toBe(EN_PAGE.seo_description);
  });

  it("10) geçersiz locale → EN kısayolu (sorgu yok)", async () => {
    const r = await resolvePageContent(EN_PAGE, "fr" as unknown as "tr");
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r.title).toBe(EN_PAGE.title);
  });
});

/* =============================================================== */

describe("buildCmsPageMetadata — EN (ana dil)", () => {
  it("11) EN: SEO değerleri canonical page'den, canonical '/p/{slug}', çeviri sorgusu YOK", async () => {
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.title).toBe(EN_PAGE.seo_title);
    expect(md.description).toBe(EN_PAGE.seo_description);
    expect(md.alternates).toEqual({ canonical: `/p/${SLUG}`, languages: expect.any(Object) });
    expect(md.robots).toEqual({ index: true, follow: true });
    expect(getTranslationMock).not.toHaveBeenCalled();
  });

  it("12) EN: openGraph/twitter alanları", async () => {
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.openGraph).toMatchObject({
      type: "article",
      title: EN_PAGE.seo_title,
      url: `/p/${SLUG}`,
      images: [{ url: "https://cdn.test/pages/kas.webp" }],
    });
    expect(md.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("13) seo_title boşsa title'a, seo_description boşsa excerpt'e düşer", async () => {
    getPageBySlugMock.mockResolvedValue({
      ...EN_PAGE,
      seo_title: null,
      seo_description: null,
    });
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.title).toBe(EN_PAGE.title);
    expect(md.description).toBe(EN_PAGE.excerpt);
  });

  it("14) sayfa yoksa locale'e uygun 'bulunamadı' başlığı + noindex", async () => {
    getPageBySlugMock.mockResolvedValue(null);
    const tr = await buildCmsPageMetadata(SLUG, "tr");
    expect(tr.title).toBe("Sayfa bulunamadı");
    expect(tr.robots).toEqual({ index: false, follow: false });
    const en = await buildCmsPageMetadata(SLUG, "en");
    expect(en.title).toBe(getDictionary("en").cms.notFoundMetaTitle);
    expect(en.title).not.toBe("Sayfa bulunamadı");
    expect(en.robots).toEqual({ index: false, follow: false });
  });

  it("15) page.noindex her locale'de uygulanır", async () => {
    getPageBySlugMock.mockResolvedValue({ ...EN_PAGE, noindex: true });
    getTranslationMock.mockResolvedValue(TR_ROW);
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(md.robots).toEqual({ index: false, follow: false });
  });
});

describe("buildCmsPageMetadata — TR (çeviri)", () => {
  it("16) TR: SEO başlık/açıklama çeviriden gelir, canonical '/tr/p/{slug}'", async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(getTranslationMock).toHaveBeenCalledWith("page", PAGE_ID, "tr");
    expect(md.title).toBe(TR_ROW.seo_title);
    expect(md.description).toBe(TR_ROW.seo_description);
    expect(md.alternates).toEqual({ canonical: `/tr/p/${SLUG}`, languages: expect.any(Object) });
    expect(md.openGraph).toMatchObject({ url: `/tr/p/${SLUG}` });
  });

  it("18) TR çevirisi yoksa SEO EN'ye düşer ama URL /tr/p/… kalır", async () => {
    getTranslationMock.mockResolvedValue(null);
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(md.title).toBe(EN_PAGE.seo_title);
    expect(md.description).toBe(EN_PAGE.seo_description);
    expect(md.alternates).toEqual({ canonical: `/tr/p/${SLUG}`, languages: expect.any(Object) });
  });

  it("19) hreflang seti (2 locale + x-default → EN, DE YOK)", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    getTranslationMock.mockResolvedValue(TR_ROW);
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(md.alternates).toEqual({
      canonical: `/tr/p/${SLUG}`,
      languages: {
        tr: `/tr/p/${SLUG}`,
        en: `/p/${SLUG}`,
        "x-default": `/p/${SLUG}`,
      },
    });
  });

  it("20) slug ÇEVRİLMEZ — tüm locale'ler aynı slug'ı taşır", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    getTranslationMock.mockResolvedValue(TR_ROW);
    const md = await buildCmsPageMetadata(SLUG, "tr");
    const langs = (md.alternates as { languages: Record<string, string> })
      .languages;
    for (const url of Object.values(langs)) {
      expect(url.endsWith(`/p/${SLUG}`)).toBe(true);
    }
  });

  it("21) settings okunamazsa da hreflang seti üretilir (URL yapısı ayardan bağımsız)", async () => {
    getCachedSettingsMock.mockRejectedValue(new Error("db"));
    getTranslationMock.mockResolvedValue(TR_ROW);
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(md.alternates).toEqual({ canonical: `/tr/p/${SLUG}`, languages: expect.any(Object) });
  });
});
