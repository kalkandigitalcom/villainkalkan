/* ===============================================================
   🌐 SATILIK VİLLALAR — PUBLIC AŞAMA 5 TESTLERİ
   1) Liste yardımcıları: URL filtreleri, EUR dönüşümü, filtre/sıralama.
   2) Yayın durumu: taslak / kaldırılmış / pasif / satılık olmayan ilan
      public kartlara, detaya ve sitemap'e GİRMEZ.
   3) Liste sayfası render: kartlar, filtreler, diller, JSON-LD.
   4) Detay: public mod, gerçek WhatsApp, 404, SEO (title, canonical,
      hreflang), RealEstateListing.
   5) Sitemap ve navigasyon.
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  repo: {
    findPublishedPublicCards: vi.fn(),
    findPublishedSitemapRows: vi.fn(),
    findSaleVillaIdBySlug: vi.fn(),
  },
  load: vi.fn(),
  rates: { rates: { EUR: 40, GBP: 50, USD: 35 }, updatedAt: null } as { rates: Record<string, number>; updatedAt: null },
}));

vi.mock("@/lib/db/sale-listing.repository.server", () => ({ saleListingRepository: h.repo }));
vi.mock("@/lib/storage.helpers", () => ({
  resolveVillaImageUrl: (u: string | null) => (u ? `https://cdn.test/${u}` : null),
  resolveAssetUrlVersioned: () => null,
}));
vi.mock("@/app/services/exchange-rate.service", () => ({ getExchangeRatesMap: async () => h.rates }));
vi.mock("@/app/services/sale-villa-detail.service", () => ({
  loadSaleVillaDetail: (...a: unknown[]) => h.load(...a),
}));
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: async () => ({ site_name: "Villa In Kalkan", multilingual_enabled: true }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/satilik-villa/x",
}));
vi.mock("@/app/components/ui/PageHero", () => ({
  default: ({ title, stat }: { title: string; stat?: { value: number } }) => (
    <header data-hero>
      <h1>{title}</h1>
      <span data-stat>{stat?.value}</span>
    </header>
  ),
}));

import {
  buildSaleArchiveHref,
  filterSaleCards,
  paginateSaleCards,
  parseSaleArchiveParams,
  sortSaleCards,
  toEur,
  withSaleVillasNavItem,
  type SalePublicCard,
} from "@/lib/sale-listing-public.helper";
import {
  listPublicSaleCards,
  listPublicSaleSitemapRows,
  mapSaleCardRow,
} from "@/app/services/sale-listing-public.service";
import SaleVillasArchiveBody from "@/app/components/sale/SaleVillasArchiveBody";
import {
  buildSaleArchiveMetadata,
  buildSaleDetailMetadata,
  renderSaleDetailPage,
} from "@/app/components/sale/sale-public-route";
import type { SaleVillaDetailData } from "@/app/components/sale/sale-villa-detail.types";

const R1 = "11111111-1111-1111-1111-111111111111";
const R2 = "22222222-2222-2222-2222-222222222222";

const villa = (over: Record<string, unknown> = {}) => ({
  id: "v",
  title: "Villa Azure",
  slug: "villa-azure",
  is_active: true,
  deleted_at: null,
  listed_for_sale: true,
  location_id: R1,
  bedrooms: 4,
  bathrooms: 3,
  location: { name: "Kalkan" },
  villa_images: [
    { image_url: "b.webp", is_cover: false, sort_order: 0 },
    { image_url: "a.webp", is_cover: true, sort_order: 5 },
  ],
  ...over,
});
const row = (over: Record<string, unknown> = {}, villaOver: Record<string, unknown> = {}) => ({
  villa_id: "v",
  reference_code: "VIK-1",
  sale_price: "450000.00",
  sale_currency: "EUR",
  price_on_request: false,
  sale_status: "available",
  property_type: "villa",
  room_layout: "4+1",
  bathrooms: null,
  built_area_m2: "240",
  plot_area_m2: "650",
  sale_sort_order: 0,
  is_featured: false,
  is_published: true,
  publication_status: "published",
  published_at: "2026-11-01T00:00:00Z",
  created_at: "2026-11-01T00:00:00Z",
  villa: villa(villaOver),
  ...over,
});

const card = (over: Partial<SalePublicCard>): SalePublicCard => ({
  villaId: "v",
  slug: "s",
  title: "T",
  locationId: R1,
  locationName: "Kalkan",
  coverImage: null,
  referenceCode: null,
  salePrice: 100000,
  saleCurrency: "EUR",
  priceOnRequest: false,
  saleStatus: "available",
  propertyType: "villa",
  roomLayout: null,
  bedrooms: null,
  bathrooms: null,
  builtAreaM2: null,
  plotAreaM2: null,
  isFeatured: false,
  sortOrder: 0,
  createdAt: "2026-01-01",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
});

/* ================================================================ 1 */
describe("liste yardımcıları", () => {
  it("URL parametreleri güvenli çözülür", () => {
    expect(parseSaleArchiveParams({ bolge: R1, tip: "villa", min: "500.000", max: "100000", sort: "price-asc", page: "2" })).toEqual({
      regionId: R1,
      propertyType: "villa",
      minEur: 100000,
      maxEur: 500000,
      sort: "price-asc",
      page: 2,
    });
    expect(parseSaleArchiveParams({ bolge: "x' OR 1=1", tip: "castle", min: "-5", sort: "evil", page: "0" })).toEqual({
      regionId: null,
      propertyType: null,
      minEur: null,
      maxEur: null,
      sort: "featured",
      page: 1,
    });
  });

  it("href: varsayılanlar URL'e yazılmaz", () => {
    expect(buildSaleArchiveHref("/satilik-villalar", { sort: "featured", page: 1 })).toBe("/satilik-villalar");
    expect(buildSaleArchiveHref("/tr/satilik-villalar", { regionId: R1, minEur: 0, sort: "newest", page: 3 })).toBe(
      `/tr/satilik-villalar?bolge=${R1}&min=0&sort=newest&page=3`
    );
  });

  it("EUR dönüşümü (kurlar = 1 birim → TRY)", () => {
    const rates = { EUR: 40, GBP: 50 };
    expect(toEur(100, "EUR", rates)).toBe(100);
    expect(toEur(100, "GBP", rates)).toBe(125);
    expect(toEur(4000, "TRY", rates)).toBe(100);
    expect(toEur(100, "USD", rates)).toBeNull();
  });

  it("bölge, tip ve fiyat filtreleri; fiyat filtresinde 'fiyat sorunuz' gizlenir", () => {
    const cards = [
      card({ villaId: "a", locationId: R1, propertyType: "villa", salePrice: 300000 }),
      card({ villaId: "b", locationId: R2, propertyType: "apartment", salePrice: 200000, saleCurrency: "GBP" }),
      card({ villaId: "c", locationId: R1, propertyType: "villa", priceOnRequest: true, salePrice: null }),
    ];
    const f = parseSaleArchiveParams({});
    const ids = (x: SalePublicCard[]) => x.map((c) => c.villaId);
    expect(ids(filterSaleCards(cards, { ...f, regionId: R1 }, h.rates.rates))).toEqual(["a", "c"]);
    expect(ids(filterSaleCards(cards, { ...f, propertyType: "apartment" }, h.rates.rates))).toEqual(["b"]);
    // GBP 200.000 → 250.000 EUR
    expect(ids(filterSaleCards(cards, { ...f, minEur: 260000 }, h.rates.rates))).toEqual(["a"]);
    expect(ids(filterSaleCards(cards, { ...f, maxEur: 260000 }, h.rates.rates))).toEqual(["b"]);
  });

  it("sıralama: öne çıkan, fiyat (fiyatsız sonda), en yeni; sayfalama", () => {
    const cards = [
      card({ villaId: "a", salePrice: 300000, createdAt: "2026-01-01" }),
      card({ villaId: "b", salePrice: 100000, isFeatured: true, createdAt: "2026-03-01" }),
      card({ villaId: "c", priceOnRequest: true, salePrice: null, createdAt: "2026-02-01" }),
    ];
    const ids = (x: SalePublicCard[]) => x.map((c) => c.villaId);
    expect(ids(sortSaleCards(cards, "featured", {}))[0]).toBe("b");
    expect(ids(sortSaleCards(cards, "price-asc", {}))).toEqual(["b", "a", "c"]);
    expect(ids(sortSaleCards(cards, "price-desc", {}))).toEqual(["a", "b", "c"]);
    expect(ids(sortSaleCards(cards, "newest", {}))).toEqual(["b", "c", "a"]);
    const p = paginateSaleCards(Array.from({ length: 30 }, (_, i) => i), 9);
    expect(p).toMatchObject({ currentPage: 3, totalPages: 3 });
    expect(p.items).toEqual([24, 25, 26, 27, 28, 29]);
  });
});

/* ================================================================ 2 */
describe("yayın durumu — public kapı", () => {
  it.each([
    ["taslak", { is_published: false, publication_status: "draft" }, {}],
    ["yayından kaldırılmış", { is_published: false, publication_status: "unpublished" }, {}],
    ["tutarsız bayrak", { is_published: true, publication_status: "draft" }, {}],
    ["pasif villa", {}, { is_active: false }],
    ["silinmiş villa", {}, { deleted_at: "2026-01-01" }],
    ["satılık olmayan villa", {}, { listed_for_sale: false }],
    ["slug'sız villa", {}, { slug: null }],
  ])("%s → kart üretilmez", (_n, over, villaOver) => {
    expect(mapSaleCardRow(row(over, villaOver) as never)).toBeNull();
  });

  it("yayındaki ilan → kart (kapak görseli, banyo fallback, sayılar)", () => {
    const c = mapSaleCardRow(row() as never);
    expect(c).toMatchObject({
      slug: "villa-azure",
      coverImage: "https://cdn.test/a.webp",
      bathrooms: 3,
      salePrice: 450000,
      builtAreaM2: 240,
      locationName: "Kalkan",
    });
  });

  it("servis: SQL filtresine rağmen gelen taslak satır JS kapısında elenir; hata → boş liste", async () => {
    h.repo.findPublishedPublicCards.mockResolvedValue({
      data: [row(), row({ villa_id: "d", publication_status: "draft", is_published: false })],
      error: null,
    });
    expect((await listPublicSaleCards()).map((c) => c.villaId)).toEqual(["v"]);
    h.repo.findPublishedPublicCards.mockResolvedValue({ data: null, error: { message: "x", code: "42703" } });
    expect(await listPublicSaleCards()).toEqual([]);
  });

  it("sitemap satırları yalnız görünür ilanlar", async () => {
    h.repo.findPublishedSitemapRows.mockResolvedValue({
      data: [
        { is_published: true, publication_status: "published", published_at: "p", updated_at: "u", villa: { slug: "a", is_active: true, deleted_at: null, listed_for_sale: true } },
        { is_published: true, publication_status: "published", published_at: "p", updated_at: "u", villa: { slug: "b", is_active: false, deleted_at: null, listed_for_sale: true } },
        { is_published: false, publication_status: "draft", published_at: null, updated_at: "u", villa: { slug: "c", is_active: true, deleted_at: null, listed_for_sale: true } },
      ],
      error: null,
    });
    expect(await listPublicSaleSitemapRows()).toEqual([{ slug: "a", lastModified: "u" }]);
  });

  it("repository: public sorgular SQL'de yayın bayraklarını şart koşar", () => {
    const src = readFileSync(join(process.cwd(), "lib/db/sale-listing.repository.server.ts"), "utf-8");
    for (const m of ["findPublishedPublicCards", "findPublishedSitemapRows"]) {
      const body = src.slice(src.indexOf(`async ${m}`), src.indexOf("},", src.indexOf(`async ${m}`)));
      expect(body, m).toContain('.eq("is_published", true)');
      expect(body, m).toContain('.eq("publication_status", "published")');
    }
    const slug = src.slice(src.indexOf("async findSaleVillaIdBySlug"));
    expect(slug.slice(0, slug.indexOf("},"))).toMatch(/listed_for_sale", true[\s\S]*is_active", true[\s\S]*deleted_at", null/);
  });
});

/* ================================================================ 3 */
describe("liste sayfası", () => {
  beforeEach(() => {
    h.repo.findPublishedPublicCards.mockResolvedValue({
      data: [
        row(),
        row({ villa_id: "w", property_type: "apartment", sale_price: "200000", sale_currency: "GBP" }, { id: "w", slug: "sea-flat", title: "Sea Flat", location_id: R2, location: { name: "Kaş" } }),
      ],
      error: null,
    });
  });

  it("EN: kartlar, fiyat, oda/banyo/m², detay linki, filtre formu, JSON-LD", async () => {
    const html = renderToStaticMarkup(await SaleVillasArchiveBody({ locale: "en" }));
    expect(html.match(/<article[^>]*data-sale-card/g)?.length).toBe(2);
    expect(html).toContain('href="/satilik-villa/villa-azure"');
    expect(html).toContain("€450,000");
    expect(html).toContain("£200,000");
    expect(html).toContain("4+1");
    expect(html).toContain("240 m²");
    expect(html).toContain('action="/satilik-villalar"');
    expect(html).toContain('name="bolge"');
    expect(html).toContain('name="tip"');
    expect(html).toContain('name="min"');
    expect(html).toContain(">Kaş</option>");
    expect(html).toContain(">Apartment</option>");
    expect(html).toContain('"@type":"ItemList"');
  });

  it("TR: Türkçe metinler ve /tr bağlantıları; bölge filtresi uygulanır", async () => {
    const html = renderToStaticMarkup(
      await SaleVillasArchiveBody({ locale: "tr", searchParams: Promise.resolve({ bolge: R2 }) })
    );
    expect(html).toContain("Satılık Villalar");
    expect(html).toContain('href="/tr/satilik-villa/sea-flat"');
    expect(html).not.toContain("/satilik-villa/villa-azure");
    expect(html).toContain("1 ilan");
    expect(html).toContain('action="/tr/satilik-villalar"');
  });

  it("filtreye uyan ilan yoksa boş durum", async () => {
    const html = renderToStaticMarkup(
      await SaleVillasArchiveBody({ locale: "en", searchParams: Promise.resolve({ min: "9000000" }) })
    );
    expect(html).toContain("No properties match your search");
    expect(html).not.toMatch(/<article[^>]*data-sale-card/);
  });

  it("metadata: başlık, canonical ve hreflang", async () => {
    const en = await buildSaleArchiveMetadata("en");
    expect(en.title).toBe("Villas for Sale in Kalkan — Villa In Kalkan");
    expect(en.alternates).toEqual({
      canonical: "/satilik-villalar",
      languages: { en: "/satilik-villalar", tr: "/tr/satilik-villalar", "x-default": "/satilik-villalar" },
    });
    const tr = await buildSaleArchiveMetadata("tr");
    expect(tr.alternates?.canonical).toBe("/tr/satilik-villalar");
    expect(tr.title).toBe("Kalkan'da Satılık Villalar — Villa In Kalkan");
  });
});

/* ================================================================ 4 */
const detail = (over: Partial<SaleVillaDetailData> = {}): SaleVillaDetailData => ({
  villaId: "v",
  title: "Villa Azure",
  slug: "villa-azure",
  locationName: "Kalkan",
  imageUrls: ["https://cdn.test/a.webp"],
  watermark: { logo: null, enabled: false, opacity: 0.15, position: "center", size: 25 },
  listing: {
    referenceCode: "VIK-1",
    salePrice: 450000,
    saleCurrency: "EUR",
    priceOnRequest: false,
    saleStatus: "available",
    propertyType: "villa",
    roomLayout: "4+1",
    bedrooms: 4,
    bathrooms: 3,
    builtAreaM2: 240,
    plotAreaM2: 650,
    floors: 2,
    yearBuilt: 2021,
    titleDeedType: null,
    hasGarden: false,
    gardenAreaM2: null,
    description: "Sea view villa with infinity pool.",
    agentWhatsapp: "+90 555 111 22 33",
    agentPhone: null,
    publicationStatus: "published",
  },
  features: [],
  distances: [],
  map: { mapType: "coords", latitude: 36.2, longitude: 29.4, mapEmbed: null },
  siteWhatsappLink: "https://wa.me/905550000000",
  sitePhone: null,
  seo: { title: null, description: null },
  ...over,
});

describe("detay sayfası", () => {
  it("yayındaki ilan: public mod, gerçek WhatsApp (danışman numarası), RealEstateListing", async () => {
    h.repo.findSaleVillaIdBySlug.mockResolvedValue({ data: { id: "v" }, error: null });
    h.load.mockResolvedValue(detail());
    const html = renderToStaticMarkup(await renderSaleDetailPage({ slug: "villa-azure", locale: "en" }));
    expect(h.load).toHaveBeenCalledWith("v", { locale: "en", mode: "public" });
    expect(html).toContain('data-sale-contact="live"');
    expect(html).toMatch(/href="https:\/\/wa\.me\/905551112233\?text=Hello/);
    expect(html).not.toContain("data-sale-preview-banner");
    expect(html).toContain('"@type":"RealEstateListing"');
    expect(html).toContain('"priceCurrency":"EUR"');
    expect(html).toContain('"@type":"SingleFamilyResidence"');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it("danışman numarası yoksa site genel WhatsApp numarası", async () => {
    h.repo.findSaleVillaIdBySlug.mockResolvedValue({ data: { id: "v" }, error: null });
    h.load.mockResolvedValue(detail({ listing: { ...detail().listing, agentWhatsapp: null } }));
    const html = renderToStaticMarkup(await renderSaleDetailPage({ slug: "villa-azure", locale: "tr" }));
    expect(html).toMatch(/href="https:\/\/wa\.me\/905550000000\?text=Merhaba/);
  });

  it("taslak / kaldırılmış (yükleyici null) veya bilinmeyen slug → 404", async () => {
    h.repo.findSaleVillaIdBySlug.mockResolvedValue({ data: { id: "v" }, error: null });
    h.load.mockResolvedValue(null);
    await expect(renderSaleDetailPage({ slug: "draft-villa", locale: "en" })).rejects.toThrow("NEXT_NOT_FOUND");
    h.repo.findSaleVillaIdBySlug.mockResolvedValue({ data: null, error: null });
    await expect(renderSaleDetailPage({ slug: "nope", locale: "en" })).rejects.toThrow("NEXT_NOT_FOUND");
    const meta = await buildSaleDetailMetadata("nope", "en");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("SEO: ilanın kendi başlığı/açıklaması; yoksa üretilmiş başlık; canonical + hreflang", async () => {
    h.repo.findSaleVillaIdBySlug.mockResolvedValue({ data: { id: "v" }, error: null });
    h.load.mockResolvedValue(detail({ seo: { title: "Luxury Kalkan Villa", description: "Own SEO description" } }));
    const m = await buildSaleDetailMetadata("villa-azure", "en");
    expect(m.title).toBe("Luxury Kalkan Villa");
    expect(m.description).toBe("Own SEO description");
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(m.alternates).toEqual({
      canonical: "/satilik-villa/villa-azure",
      languages: { en: "/satilik-villa/villa-azure", tr: "/tr/satilik-villa/villa-azure", "x-default": "/satilik-villa/villa-azure" },
    });

    h.load.mockResolvedValue(detail());
    const tr = await buildSaleDetailMetadata("villa-azure", "tr");
    expect(tr.title).toBe("Villa Azure — Kalkan satılık villa");
    expect(tr.description).toBe("Sea view villa with infinity pool.");
    expect(tr.alternates?.canonical).toBe("/tr/satilik-villa/villa-azure");
  });
});

/* ================================================================ 5 */
describe("navigasyon ve sitemap", () => {
  it("menüye kiralık villaların sağına eklenir; admin menüsünde varsa tekrar eklenmez", () => {
    const menu = [
      { href: "/", name: "Home" },
      { href: "/kiralik-villalar", name: "Villas" },
      { href: "/iletisim", name: "Contact" },
    ];
    const out = withSaleVillasNavItem(menu);
    expect(out.map((m) => m.href)).toEqual(["/", "/kiralik-villalar", "/satilik-villalar", "/iletisim"]);
    expect((out[2] as unknown as { name: string; nameByLocale: { tr: string } })).toMatchObject({
      name: "Villas for Sale",
      nameByLocale: { tr: "Satılık Villalar" },
    });
    expect(withSaleVillasNavItem([{ href: "/x", children: [{ href: "/satilik-villalar" }] }])).toHaveLength(1);
    expect(withSaleVillasNavItem<{ href: string }>([]).map((m) => m.href)).toEqual(["/satilik-villalar"]);
  });

  it("HeaderWrapper menüyü masaüstü + mobil için aynı diziyle verir", () => {
    const src = readFileSync(join(process.cwd(), "app/components/layout/HeaderWrapper.tsx"), "utf-8");
    expect(src).toContain("menuItems = withSaleVillasNavItem(menuItems);");
    const header = readFileSync(join(process.cwd(), "app/components/layout/Header.tsx"), "utf-8");
    expect((header.match(/menu\.map\(/g) || []).length).toBeGreaterThanOrEqual(2); // desktop + mobil
  });

  it("sitemap: liste + yalnız yayındaki ilan detayları (EN + TR, hreflang)", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.doMock("@/lib/db/villa.repository.server", () => ({ villaAdminRepository: { listPublicSlugs: async () => [] } }));
    vi.doMock("@/lib/db/pages.repository", () => ({ pagesRepository: { findActivePagesForSitemap: async () => ({ data: [], error: null }), findActiveSlugsForSitemap: async () => ({ data: [], error: null }) } }));
    vi.doMock("@/lib/db/blog.repository", () => ({ blogRepository: { findActiveSlugsForSitemap: async () => ({ data: [], error: null }), findPublishedForSitemap: async () => ({ data: [], error: null }) } }));
    vi.doMock("@/lib/taxonomy-landing.server", () => ({ getTaxonomyLandingSitemapPaths: async () => [] }));
    vi.doMock("@/app/services/sale-listing-public.service", () => ({
      listPublicSaleSitemapRows: async () => [{ slug: "villa-azure", lastModified: "2026-11-01T00:00:00Z" }],
    }));
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://example.com/satilik-villalar");
    expect(urls).toContain("https://example.com/tr/satilik-villalar");
    expect(urls).toContain("https://example.com/satilik-villa/villa-azure");
    expect(urls).toContain("https://example.com/tr/satilik-villa/villa-azure");
    expect(urls.filter((u) => u.includes("/satilik-villa/"))).toHaveLength(2);
    vi.unstubAllEnvs();
  });
});
