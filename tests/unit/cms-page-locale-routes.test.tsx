/* ===============================================================
   🛡️ PHASE 12D — /p/[slug] · /en/p/[slug] TESTLERİ
   ===============================================================
   Kapsam:
     A) Üç route da AYNI `CmsPageBody`'yi render eder ve DOĞRU
        locale + ÇÖZÜLMÜŞ metinleri geçirir
     B) EN/DE `setRequestLocale` + `requirePublicLocaleEnabled`
        gate davranışı (multilingual kapalıyken notFound)
     C) 404: TR'nin kendine özgü inline bloğu KORUNDU; EN/DE
        `notFound()` kullanır
     D) 🔴 GERÇEK DOM RENDER — EN/DE çeviri metinleri sayfada
        GÖRÜNÜYOR; slug ve sections TR kalıyor

   `homepage-locale-routes.test.tsx` (Phase 11) ile AYNI mock deseni.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePublicLocaleEnabledMock = vi.fn();
const setRequestLocaleMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/lib/i18n/public-locale-gate.server", () => ({
  requirePublicLocaleEnabled: () => requirePublicLocaleEnabledMock(),
}));
vi.mock("@/lib/i18n/request-locale.server", () => ({
  setRequestLocale: (...a: unknown[]) => setRequestLocaleMock(...a),
}));
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

const getPageBySlugMock = vi.fn();
vi.mock("@/app/services/page.service", () => ({
  getPageBySlug: (...a: unknown[]) => getPageBySlugMock(...a),
  getPages: vi.fn(),
}));

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
}));

/* DOM render için: async / ağır alt component'ler sadeleştirilir.
   Tasarım testi DEĞİL — metin kaynağı testi. */
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img alt={String(props.alt ?? "")} src={String(props.src ?? "")} />
  ),
}));
vi.mock("@/app/components/ui/PageHero", () => ({
  default: (props: { title?: React.ReactNode; description?: string }) => (
    <div data-testid="page-hero">
      <h1>{props.title}</h1>
      {props.description ? <p>{props.description}</p> : null}
    </div>
  ),
}));
vi.mock("@/app/components/cms/PageSectionRenderer", () => ({
  default: (props: { section: { type: string; content?: string } }) => (
    <div data-testid="section">{props.section.content ?? props.section.type}</div>
  ),
}));
vi.mock("@/app/components/seo/StructuredData", () => ({
  JsonLd: () => null,
  buildBreadcrumb: (items: unknown, locale?: string) => ({ items, locale }),
}));

import CmsPageBody from "@/app/components/cms/CmsPageBody";

const PAGE_ID = "page-uuid-1";
const SLUG = "kasta-unutulmaz-bir-tatil";

/* Kurumsal OLMAYAN + cover'lı sayfa → editorial hero dalı (h1 doğrudan).
   İngilizce ANA içerik = `pages`; Türkçe = `page_translations` ('tr'). */
const EN_PAGE = {
  id: PAGE_ID,
  slug: SLUG,
  title: "An Unforgettable Holiday in Kas",
  excerpt: "EN excerpt",
  body: "EN body paragraph",
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
  requirePublicLocaleEnabledMock.mockResolvedValue(undefined);
  getPageBySlugMock.mockResolvedValue(EN_PAGE);
  getTranslationMock.mockResolvedValue(null);
  notFoundMock.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

const params = Promise.resolve({ slug: SLUG });
const EN_ROUTE = "@/app/(public)/p/[slug]/page";
const TR_ROUTE = "@/app/(public)/tr/p/[slug]/page";

/* ===============================================================
   A) EN (ana dil, prefix'siz) ROUTE
   =============================================================== */
describe(EN_ROUTE, () => {
  it(`1) gate geçerse ORTAK CmsPageBody'yi locale="en" ile, canonical içerikle render eder`, async () => {
    const { default: Page } = await import(EN_ROUTE);
    const element = await Page({ params: Promise.resolve({ slug: SLUG }) });

    expect(setRequestLocaleMock).toHaveBeenCalledWith("en");
    expect(requirePublicLocaleEnabledMock).toHaveBeenCalledTimes(1);
    expect(element.type).toBe(CmsPageBody);
    expect(element.props.locale).toBe("en");
    expect(element.props.slug).toBe(SLUG);
    expect(element.props.title).toBe(EN_PAGE.title);
    expect(element.props.resolvedExcerpt).toBe(EN_PAGE.excerpt);
    expect(element.props.body).toBe(EN_PAGE.body);
  });

  it(`2) EN ana dil → çeviri okuması YAPILMAZ`, async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    const { default: Page } = await import(EN_ROUTE);
    await Page({ params: Promise.resolve({ slug: SLUG }) });
    expect(getTranslationMock).not.toHaveBeenCalled();
  });

  it(`4) gate notFound() fırlatırsa PROPAGATE eder`, async () => {
    requirePublicLocaleEnabledMock.mockRejectedValue(
      new Error("NEXT_NOT_FOUND")
    );
    const { default: Page } = await import(EN_ROUTE);
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it(`5) sayfa yoksa notFound() çağrılır`, async () => {
    getPageBySlugMock.mockResolvedValue(null);
    const { default: Page } = await import(EN_ROUTE);
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it(`6) generateMetadata mevcut (statik metadata YOK)`, async () => {
    const mod = await import(EN_ROUTE);
    expect(mod.metadata).toBeUndefined();
    expect(typeof mod.generateMetadata).toBe("function");
  });
});

/* ===============================================================
   B) TR (çeviri, /tr) ROUTE
   =============================================================== */
describe("app/(public)/tr/p/[slug]/page.tsx — TR", () => {
  it("7) ORTAK CmsPageBody'yi locale='tr' ile, Türkçe çeviriyle render eder", async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    const { default: Page } = await import(TR_ROUTE);
    const element = await Page({ params });
    expect(element.type).toBe(CmsPageBody);
    expect(element.props.locale).toBe("tr");
    expect(element.props.slug).toBe(SLUG);
    expect(element.props.title).toBe(TR_ROW.title);
    expect(element.props.resolvedExcerpt).toBe(TR_ROW.excerpt);
    expect(element.props.body).toBe(TR_ROW.body);
  });

  it("8) TR'de çeviri DOĞRU entity/locale ile okunur; locale gate'i çağrılmaz", async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    const { default: Page } = await import(TR_ROUTE);
    await Page({ params });
    expect(getTranslationMock).toHaveBeenCalledWith("page", PAGE_ID, "tr");
    expect(requirePublicLocaleEnabledMock).not.toHaveBeenCalled();
  });

  it("3) TR çevirisi YOKSA İngilizce ana içeriğe fallback — URL/locale korunur", async () => {
    getTranslationMock.mockResolvedValue(null);
    const { default: Page } = await import(TR_ROUTE);
    const element = await Page({ params });
    expect(element.props.locale).toBe("tr");
    expect(element.props.slug).toBe(SLUG);
    expect(element.props.title).toBe(EN_PAGE.title);
    expect(element.props.body).toBe(EN_PAGE.body);
  });

  it("9) TR 404: kendine özgü inline blok KORUNDU (notFound() DEĞİL)", async () => {
    getPageBySlugMock.mockResolvedValue(null);
    const { default: Page } = await import(TR_ROUTE);
    const element = await Page({ params });
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(element.type).not.toBe(CmsPageBody);
    render(element);
    expect(screen.getByText("Sayfa bulunamadı.")).toBeTruthy();
    expect(
      screen.getByText("Aradığın sayfa kaldırılmış veya taşınmış olabilir.")
    ).toBeTruthy();
  });
});

/* ===============================================================
   D) GERÇEK DOM RENDER — doğru dildeki metin sayfada görünüyor mu?
   =============================================================== */
describe("CmsPageBody — gerçek render (çeviri metinleri)", () => {
  async function renderRoute(modulePath: string) {
    const { default: Page } = await import(modulePath);
    const element = await Page({ params: Promise.resolve({ slug: SLUG }) });
    render(element);
  }

  it("10) EN: İngilizce başlık/excerpt/gövde render edilir, TR çeviri sızmaz", async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    await renderRoute(EN_ROUTE);
    expect(screen.getByRole("heading", { name: EN_PAGE.title })).toBeTruthy();
    expect(screen.getByText(EN_PAGE.excerpt)).toBeTruthy();
    expect(screen.getByText(EN_PAGE.body)).toBeTruthy();
    expect(screen.queryAllByText(TR_ROW.title)).toHaveLength(0);
    expect(screen.queryAllByText(TR_ROW.body)).toHaveLength(0);
  });

  it("11) TR: Türkçe başlık/excerpt/gövde render edilir, EN içerik sayfada YOK", async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    await renderRoute(TR_ROUTE);
    expect(screen.getByRole("heading", { name: TR_ROW.title })).toBeTruthy();
    expect(screen.getByText(TR_ROW.excerpt)).toBeTruthy();
    expect(screen.getByText(TR_ROW.body)).toBeTruthy();
    expect(screen.queryAllByText(EN_PAGE.title)).toHaveLength(0);
    expect(screen.queryAllByText(EN_PAGE.body)).toHaveLength(0);
  });

  it("13) TR çevirisi YOKSA sayfa İngilizce içerikle render edilir (fallback)", async () => {
    getTranslationMock.mockResolvedValue(null);
    await renderRoute(TR_ROUTE);
    expect(screen.getByRole("heading", { name: EN_PAGE.title })).toBeTruthy();
    expect(screen.getByText(EN_PAGE.body)).toBeTruthy();
  });

  it("14) ALAN BAZINDA fallback: TR başlık var, gövde EN", async () => {
    getTranslationMock.mockResolvedValue({ ...TR_ROW, body: null });
    await renderRoute(TR_ROUTE);
    expect(screen.getByRole("heading", { name: TR_ROW.title })).toBeTruthy();
    expect(screen.getByText(EN_PAGE.body)).toBeTruthy();
  });

  it("15) SLUG ÇEVRİLMEZ — başlık değişse de slug aynı kalır", async () => {
    getTranslationMock.mockResolvedValue(TR_ROW);
    const { default: Page } = await import(TR_ROUTE);
    const element = await Page({ params: Promise.resolve({ slug: SLUG }) });
    expect(element.props.slug).toBe(SLUG);
    expect(element.props.page.slug).toBe(SLUG);
  });

  it("16) TR satırında bölüm yoksa canonical (EN) sections render edilir", async () => {
    getPageBySlugMock.mockResolvedValue({
      ...EN_PAGE,
      sections: [{ type: "richtext", content: "EN section text" }],
    });
    getTranslationMock.mockResolvedValue(TR_ROW);
    await renderRoute(TR_ROUTE);

    expect(screen.getByRole("heading", { name: TR_ROW.title })).toBeTruthy();
    expect(screen.getByTestId("section").textContent).toBe("EN section text");
    /* sections varken body render EDİLMEZ (mevcut davranış). */
    expect(screen.queryByText(TR_ROW.body)).toBeNull();
  });

  it("17) kurumsal sayfa kararı canonical slug/başlığa bağlı kalır (TR'de de PageHero)", async () => {
    getPageBySlugMock.mockResolvedValue({
      ...EN_PAGE,
      slug: "hakkimizda",
      title: "About Us",
      cover_image: "pages/x.webp",
    });
    getTranslationMock.mockResolvedValue({ ...TR_ROW, title: "Hakkımızda" });

    const { default: Page } = await import(TR_ROUTE);
    const element = await Page({
      params: Promise.resolve({ slug: "hakkimizda" }),
    });
    render(element);

    /* Kurumsal hero KORUNDU (cover'a rağmen PageHero) ve başlık TR. */
    expect(screen.getByTestId("page-hero")).toBeTruthy();
    expect(screen.getByText("Hakkımızda")).toBeTruthy();
  });
});
