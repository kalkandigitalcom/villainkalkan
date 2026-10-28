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

const TR_PAGE = {
  id: PAGE_ID,
  slug: SLUG,
  title: "Kaş'ta Unutulmaz Bir Tatil",
  excerpt: "Türkçe özet",
  body: "Türkçe gövde",
  seo_title: "TR SEO başlık",
  seo_description: "TR SEO açıklama",
  noindex: false,
  cover_image: "pages/kas.webp",
  sections: [],
};

const EN_ROW = {
  id: "t-en",
  page_id: PAGE_ID,
  locale: "en",
  title: "An Unforgettable Holiday in Kas",
  excerpt: "EN excerpt",
  body: "EN body",
  seo_title: "EN SEO title",
  seo_description: "EN SEO description",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  getTranslationMock.mockResolvedValue(null);
  getPageBySlugMock.mockResolvedValue(TR_PAGE);
  getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: false });
});

/* =============================================================== */
describe("resolvePageContent — TR", () => {
  it("1) TR: page_translations'a HİÇ SORGU ATMAZ, canonical döner", async () => {
    const r = await resolvePageContent(TR_PAGE, "tr");
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r).toEqual({
      title: TR_PAGE.title,
      excerpt: TR_PAGE.excerpt,
      body: TR_PAGE.body,
      seoTitle: TR_PAGE.seo_title,
      seoDescription: TR_PAGE.seo_description,
      /* 🛡️ MIGRATION 091 — bölümler de çözülen içeriğin parçasıdır;
         çeviri yok/geçersiz → canonical `pages.sections`. */
      sections: TR_PAGE.sections,
    });
  });

  it("2) body/content drift: body null ise content kullanılır", async () => {
    const r = await resolvePageContent(
      { ...TR_PAGE, body: null, content: "eski content" },
      "tr"
    );
    expect(r.body).toBe("eski content");
  });

  it("3) page null → tüm alanlar null, sorgu yok", async () => {
    const r = await resolvePageContent(null, "en");
    expect(r).toEqual({
      title: null,
      excerpt: null,
      body: null,
      seoTitle: null,
      seoDescription: null,
      /* 🛡️ MIGRATION 091 — page yoksa bölümler de null. */
      sections: null,
    });
    expect(getTranslationMock).not.toHaveBeenCalled();
  });

  it("4) id yoksa sorgu atılmaz, canonical döner", async () => {
    const r = await resolvePageContent({ ...TR_PAGE, id: null }, "en");
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r.title).toBe(TR_PAGE.title);
  });
});

describe("resolvePageContent — EN", () => {
  it("5) EN: doğru entity/parent/locale ile okunur ve EN değerler döner", async () => {
    getTranslationMock.mockResolvedValue(EN_ROW);
    const r = await resolvePageContent(TR_PAGE, "en");
    expect(getTranslationMock).toHaveBeenCalledWith("page", PAGE_ID, "en");
    expect(r).toEqual({
      title: EN_ROW.title,
      excerpt: EN_ROW.excerpt,
      body: EN_ROW.body,
      seoTitle: EN_ROW.seo_title,
      seoDescription: EN_ROW.seo_description,
      /* 🛡️ MIGRATION 091 — EN satırında `sections` anahtarı YOK
         (migration henüz uygulanmamış satır senaryosu) → canonical
         bölümlere düşer. */
      sections: TR_PAGE.sections,
    });
  });

  it("7) EN çeviri satırı YOKSA tüm alanlar TR'ye fallback", async () => {
    getTranslationMock.mockResolvedValue(null);
    const r = await resolvePageContent(TR_PAGE, "en");
    expect(r).toEqual({
      title: TR_PAGE.title,
      excerpt: TR_PAGE.excerpt,
      body: TR_PAGE.body,
      seoTitle: TR_PAGE.seo_title,
      seoDescription: TR_PAGE.seo_description,
      /* 🛡️ MIGRATION 091 — bölümler de çözülen içeriğin parçasıdır;
         çeviri yok/geçersiz → canonical `pages.sections`. */
      sections: TR_PAGE.sections,
    });
  });

  it("8) DE artık desteklenmiyor → TR kısayolu (sorgu yok)", async () => {
    const r = await resolvePageContent(TR_PAGE, "de" as unknown as "en");
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r.title).toBe(TR_PAGE.title);
    expect(r.body).toBe(TR_PAGE.body);
  });

  it("9) ALAN BAZINDA fallback — boş/NULL kolonlar TR'ye düşer", async () => {
    getTranslationMock.mockResolvedValue({
      ...EN_ROW,
      excerpt: null,
      body: "   ",
      seo_description: "",
    });
    const r = await resolvePageContent(TR_PAGE, "en");
    expect(r.title).toBe(EN_ROW.title);
    expect(r.excerpt).toBe(TR_PAGE.excerpt);
    expect(r.body).toBe(TR_PAGE.body);
    expect(r.seoTitle).toBe(EN_ROW.seo_title);
    expect(r.seoDescription).toBe(TR_PAGE.seo_description);
  });

  it("10) geçersiz locale → TR kısayolu (sorgu yok)", async () => {
    const r = await resolvePageContent(
      TR_PAGE,
      "fr" as unknown as "en"
    );
    expect(getTranslationMock).not.toHaveBeenCalled();
    expect(r.title).toBe(TR_PAGE.title);
  });
});

/* =============================================================== */
describe("buildCmsPageMetadata — TR (mevcut davranış korunuyor)", () => {
  it("11) TR: SEO değerleri canonical page'den, canonical '/tr/p/{slug}'", async () => {
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(md.title).toBe(TR_PAGE.seo_title);
    expect(md.description).toBe(TR_PAGE.seo_description);
    expect(md.alternates).toEqual({ canonical: `/tr/p/${SLUG}`, languages: expect.any(Object) });
    expect(md.robots).toEqual({ index: true, follow: true });
    expect(getTranslationMock).not.toHaveBeenCalled();
  });

  it("12) TR: openGraph/twitter alanları önceki yapıyla aynı", async () => {
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(md.openGraph).toMatchObject({
      type: "article",
      title: TR_PAGE.seo_title,
      url: `/tr/p/${SLUG}`,
      images: [{ url: "https://cdn.test/pages/kas.webp" }],
    });
    expect(md.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("13) seo_title boşsa title'a, seo_description boşsa excerpt'e düşer", async () => {
    getPageBySlugMock.mockResolvedValue({
      ...TR_PAGE,
      seo_title: null,
      seo_description: null,
    });
    const md = await buildCmsPageMetadata(SLUG, "tr");
    expect(md.title).toBe(TR_PAGE.title);
    expect(md.description).toBe(TR_PAGE.excerpt);
  });

  /* 🛡️ "Sayfa bulunamadı" başlığı ARTIK dictionary'den
     (`cms.notFoundMetaTitle`) — TR değeri eski hardcoded metinle
     BİREBİR, EN kendi karşılığını döner. `noindex` DEĞİŞMEDİ. */
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
    getPageBySlugMock.mockResolvedValue({ ...TR_PAGE, noindex: true });
    getTranslationMock.mockResolvedValue(EN_ROW);
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.robots).toEqual({ index: false, follow: false });
  });
});

describe("buildCmsPageMetadata — EN", () => {
  it("16) EN: SEO başlık/açıklama çeviriden gelir, canonical '/p/{slug}'", async () => {
    getTranslationMock.mockResolvedValue(EN_ROW);
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.title).toBe(EN_ROW.seo_title);
    expect(md.description).toBe(EN_ROW.seo_description);
    expect(md.alternates).toEqual({ canonical: `/p/${SLUG}`, languages: expect.any(Object) });
    expect(md.openGraph).toMatchObject({ url: `/p/${SLUG}` });
  });

  it("18) EN çevirisi yoksa SEO TR'ye düşer ama URL /en/p/… kalır", async () => {
    getTranslationMock.mockResolvedValue(null);
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.title).toBe(TR_PAGE.seo_title);
    expect(md.description).toBe(TR_PAGE.seo_description);
    expect(md.alternates).toEqual({ canonical: `/p/${SLUG}`, languages: expect.any(Object) });
  });

  it("19) multilingual AÇIK → hreflang seti eklenir (2 locale + x-default, DE YOK)", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    getTranslationMock.mockResolvedValue(EN_ROW);
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.alternates).toEqual({
      canonical: `/p/${SLUG}`,
      languages: {
        tr: `/tr/p/${SLUG}`,
        en: `/p/${SLUG}`,
        "x-default": `/p/${SLUG}`,
      },
    });
  });

  it("20) slug ÇEVRİLMEZ — tüm locale'ler aynı slug'ı taşır", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    getTranslationMock.mockResolvedValue(EN_ROW);
    const md = await buildCmsPageMetadata(SLUG, "en");
    const langs = (md.alternates as { languages: Record<string, string> })
      .languages;
    for (const url of Object.values(langs)) {
      expect(url.endsWith(`/p/${SLUG}`)).toBe(true);
    }
  });

  it("21) settings okunamazsa da hreflang seti üretilir (URL yapısı ayardan bağımsız)", async () => {
    getCachedSettingsMock.mockRejectedValue(new Error("db"));
    getTranslationMock.mockResolvedValue(EN_ROW);
    const md = await buildCmsPageMetadata(SLUG, "en");
    expect(md.alternates).toEqual({ canonical: `/p/${SLUG}`, languages: expect.any(Object) });
  });
});
