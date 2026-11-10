/* ===============================================================
   🛡️ SATILIK İLAN — ADMIN ÖNİZLEME TESTLERİ
   1) Önizleme sayfası: oturum / yetki kapısı, taslak-yayında-kaldırılmış
      önizleme, dil, noindex, 404.
   2) Ortak veri yükleyici: preview vs public mod (taslak public'e sızmaz).
   3) Ortak detay bileşeni: önizlemede iletişim devre dışı, uyarı şeridi.
   4) Kaynak kilitleri: public rota / sitemap / ?preview bayrağı YOK,
      robots /maki-admin disallow, middleware oturumsuzu login'e atar.
   5) Admin listesi: her yayın durumunda "Önizle".
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  auth: { ok: true, caller: { id: "admin-1", authUserId: "au", email: "a@a", is_active: true } } as unknown,
  gate: vi.fn(),
  load: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  repo: { findByVillaId: vi.fn() },
  villaRepo: { findById: vi.fn() },
  trRepo: { findOne: vi.fn() },
}));

vi.mock("@/lib/admin-route-auth", () => ({
  authorizeAdminSession: async () => h.auth,
}));
vi.mock("@/app/components/admin/AdminSectionGuard", () => ({
  adminPermissionGate: (...a: unknown[]) => h.gate(...a),
}));
vi.mock("@/app/components/admin/AdminPageSessionRefresh", () => ({
  default: () => <div data-testid="session-refresh" />,
}));
vi.mock("next/navigation", () => ({
  notFound: () => h.notFound(),
  usePathname: () => "/maki-admin/sale-listings",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/db/sale-listing.repository.server", () => ({ saleListingRepository: h.repo }));
vi.mock("@/lib/db/villa.repository.server", () => ({ villaAdminRepository: h.villaRepo }));
vi.mock("@/lib/db/translation.repository.server", () => ({ translationRepository: h.trRepo }));
vi.mock("@/app/services/villa-image/villa-image.read", () => ({
  getVillaImages: async () => [{ image_url: "villas/a.webp" }],
}));
vi.mock("@/app/services/villa-distance.service", () => ({
  getVillaDistances: async () => [{ id: "d1", title: "Plaj", distance: "1 km" }],
}));
vi.mock("@/app/services/villa-feature.service", () => ({
  getVillaFeaturesByVilla: async () => [{ id: "f1", name: "Infinity pool" }],
}));
vi.mock("@/lib/i18n/get-translation.server", () => ({
  getTranslationsForParents: async () => new Map([["f1", { name: "Sonsuzluk havuzu" }]]),
  resolveTranslatedField: (t: string | null | undefined, p: unknown) =>
    typeof t === "string" && t.trim() ? t : p,
}));
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: async () => ({ whatsapp_link: "https://wa.me/905550000000", phone: "+90 242 000 00 00" }),
}));
vi.mock("@/lib/storage.helpers", () => ({
  resolveVillaImageUrl: (u: string) => `https://cdn.test/${u}`,
  resolveAssetUrlVersioned: () => null,
}));

import SaleVillaDetail from "@/app/components/sale/SaleVillaDetail";
import SalePreviewBanner from "@/app/components/sale/SalePreviewBanner";
import {
  isPublicSaleListingVisible,
  isSaleListingPreviewPath,
  saleListingPreviewHref,
  buildSaleWhatsappHref,
} from "@/lib/sale-listing.helper";
import type { SaleVillaDetailData } from "@/app/components/sale/sale-villa-detail.types";

const V = "22222222-2222-2222-2222-222222222222";

const villaRow = (over: Record<string, unknown> = {}) => ({
  id: V,
  title: "Villa Azure",
  slug: "villa-azure",
  is_active: true,
  deleted_at: null,
  listed_for_rent: false,
  listed_for_sale: true,
  bedrooms: 4,
  bathrooms: 3,
  map_type: "coords",
  latitude: 36.2,
  longitude: 29.4,
  map_embed: null,
  location: { name: "Kalkan" },
  ...over,
});
/* reference_code / agent_* DB'de duran ESKİ kolonlar: kod bunları artık
   okumaz. Mock'ta bırakıldı → görünüm modeline sızmadığı test edilir. */
const listingRow = (status: "draft" | "published" | "unpublished") => ({
  villa_id: V,
  reference_code: "VIK-1",
  sale_price: "1250000.00",
  sale_currency: "EUR",
  price_on_request: false,
  sale_status: "available",
  property_type: "villa",
  room_layout: "4+1",
  bathrooms: null,
  built_area_m2: "240",
  plot_area_m2: "650",
  floors: 2,
  year_built: 2021,
  title_deed_type: null,
  has_garden: true,
  garden_area_m2: "400",
  sale_description: "Sea view villa.",
  agent_whatsapp: "+90 555 111 22 33",
  agent_phone: null,
  publication_status: status,
  is_published: status === "published",
});

const viewData = (status: "draft" | "published" | "unpublished"): SaleVillaDetailData => ({
  villaId: V,
  title: "Villa Azure",
  slug: "villa-azure",
  locationName: "Kalkan",
  imageUrls: ["https://cdn.test/a.webp"],
  watermark: { logo: null, enabled: false, opacity: 0.15, position: "center", size: 25 },
  listing: {
    salePrice: 1250000,
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
    hasGarden: true,
    gardenAreaM2: 400,
    description: "Sea view villa.",
    publicationStatus: status,
  },
  features: [{ id: "f1", displayName: "Infinity pool" }],
  distances: [{ id: "d1", displayTitle: "Beach", displayDistance: "1 km", iconKey: "waves" }],
  map: { mapType: "coords", latitude: 36.2, longitude: 29.4, mapEmbed: null },
  siteWhatsappLink: "https://wa.me/905550000000",
  sitePhone: "+90 242 000 00 00",
  seo: { title: null, description: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.auth = { ok: true, caller: { id: "admin-1", authUserId: "au", email: "a@a", is_active: true } };
  h.gate.mockResolvedValue(null);
  h.villaRepo.findById.mockResolvedValue(villaRow());
  h.trRepo.findOne.mockResolvedValue({ data: null, error: null });
});

/* ================================================================ 1 */
describe("önizleme sayfası — yetki kapısı ve durumlar", () => {
  async function renderPage(status: "draft" | "published" | "unpublished" | null, lang?: string) {
    vi.resetModules();
    vi.doMock("@/app/services/sale-villa-detail.service", () => ({
      loadSaleVillaDetail: (...a: unknown[]) => h.load(...a),
    }));
    h.load.mockResolvedValue(status ? viewData(status) : null);
    const mod = await import("@/app/(admin)/maki-admin/sale-listings/[villaId]/onizleme/page");
    const el = await mod.default({
      params: Promise.resolve({ villaId: V }),
      searchParams: Promise.resolve(lang ? { lang } : {}),
    });
    return { mod, el };
  }

  it.each(["draft", "published", "unpublished"] as const)(
    "%s ilan önizlenebilir (preview modu, uyarı şeridi, iletişim devre dışı)",
    async (status) => {
      const { el } = await renderPage(status);
      expect(h.gate).toHaveBeenCalledWith("admin-1", "sale_listings");
      expect(h.load).toHaveBeenCalledWith(V, { locale: "en", mode: "preview" });
      const html = renderToStaticMarkup(el);
      expect(html).toContain("data-sale-preview-banner");
      expect(html).toContain(
        status === "published" ? "ÖNİZLEME – Yayındaki ilanın görünümü" : "ÖNİZLEME – Bu ilan henüz yayında değil"
      );
      expect(html).toContain("Villa Azure");
      expect(html).toContain('data-sale-contact="preview"');
      expect(html).not.toMatch(/href="https:\/\/wa\.me/);
      expect(html).not.toMatch(/href="tel:/);
    }
  );

  it("oturum yoksa: veri OKUNMAZ, yalnız oturum-yenileme kabuğu döner", async () => {
    h.auth = { ok: false, status: 401, error: "Oturum bulunamadı" };
    const { el } = await renderPage("draft");
    expect(h.load).not.toHaveBeenCalled();
    expect(h.gate).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(el)).toContain('data-testid="session-refresh"');
  });

  it("'sale_listings' yetkisi yoksa: veri OKUNMAZ, yetki kartı döner", async () => {
    h.gate.mockResolvedValue(<div data-testid="no-access" />);
    const { el } = await renderPage("draft");
    expect(h.load).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(el)).toContain('data-testid="no-access"');
  });

  it("?lang=tr → Türkçe içerik; bilinmeyen dil → İngilizce", async () => {
    await renderPage("draft", "tr");
    expect(h.load).toHaveBeenLastCalledWith(V, { locale: "tr", mode: "preview" });
    await renderPage("draft", "de");
    expect(h.load).toHaveBeenLastCalledWith(V, { locale: "en", mode: "preview" });
  });

  it("ilan yoksa 404", async () => {
    await expect(renderPage(null)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("indexlenmeye kapalı: noindex + nofollow + dinamik", async () => {
    const { mod } = await renderPage("draft");
    expect(mod.metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
    expect(mod.dynamic).toBe("force-dynamic");
  });
});

/* ================================================================ 2 */
describe("ortak veri yükleyici — preview vs public", () => {
  async function load(villaId: string, mode: "preview" | "public", locale: "en" | "tr" = "en") {
    const { loadSaleVillaDetail } = await vi.importActual<
      typeof import("@/app/services/sale-villa-detail.service")
    >("@/app/services/sale-villa-detail.service");
    return loadSaleVillaDetail(villaId, { locale, mode });
  }

  it.each(["draft", "published", "unpublished"] as const)("preview: %s ilan yüklenir", async (status) => {
    h.repo.findByVillaId.mockResolvedValue({ data: listingRow(status), error: null });
    const d = await load(V, "preview");
    expect(d?.listing.publicationStatus).toBe(status);
    expect(d?.listing.salePrice).toBe(1250000);
    expect(d?.listing.bathrooms).toBe(3); // ilan alanı boş → villa değeri
    expect(d?.imageUrls).toEqual(["https://cdn.test/villas/a.webp"]);
    expect(d?.map).toMatchObject({ mapType: "coords", latitude: 36.2 });
    // İletişim YALNIZ Genel Ayarlar; ilan bazlı alanlar/referans sızmaz.
    expect(d?.siteWhatsappLink).toBe("https://wa.me/905550000000");
    expect(d?.sitePhone).toBe("+90 242 000 00 00");
    for (const k of ["referenceCode", "agentWhatsapp", "agentPhone"]) {
      expect(d?.listing).not.toHaveProperty(k);
    }
  });

  it("public: taslak ve yayından kaldırılmış ilan ASLA dönmez; yayındaki döner", async () => {
    for (const status of ["draft", "unpublished"] as const) {
      h.repo.findByVillaId.mockResolvedValue({ data: listingRow(status), error: null });
      expect(await load(V, "public")).toBeNull();
    }
    h.repo.findByVillaId.mockResolvedValue({ data: listingRow("published"), error: null });
    expect((await load(V, "public"))?.title).toBe("Villa Azure");
    h.villaRepo.findById.mockResolvedValue(villaRow({ listed_for_sale: false }));
    expect(await load(V, "public")).toBeNull();
    h.villaRepo.findById.mockResolvedValue(villaRow({ is_active: false }));
    expect(await load(V, "public")).toBeNull();
  });

  it("TR: satış çevirisi kullanılır, boş alan İngilizceye düşer; olanak çevrilir", async () => {
    h.repo.findByVillaId.mockResolvedValue({ data: listingRow("draft"), error: null });
    h.trRepo.findOne.mockResolvedValue({ data: { sale_description: "Deniz manzaralı villa." }, error: null });
    const tr = await load(V, "preview", "tr");
    expect(tr?.listing.description).toBe("Deniz manzaralı villa.");
    expect(tr?.features[0].displayName).toBe("Sonsuzluk havuzu");
    expect(h.trRepo.findOne).toHaveBeenCalledWith("villa_sale_listing", V, "tr");
    h.trRepo.findOne.mockResolvedValue({ data: { sale_description: "  " }, error: null });
    expect((await load(V, "preview", "tr"))?.listing.description).toBe("Sea view villa.");
  });

  it("geçersiz id → DB'ye gidilmez; ilan yok → null", async () => {
    expect(await load("x' OR 1=1", "preview")).toBeNull();
    expect(h.repo.findByVillaId).not.toHaveBeenCalled();
    h.repo.findByVillaId.mockResolvedValue({ data: null, error: null });
    expect(await load(V, "preview")).toBeNull();
  });

  it("isPublicSaleListingVisible kuralı", () => {
    const villa = { is_active: true, deleted_at: null, listed_for_sale: true };
    expect(isPublicSaleListingVisible({ is_published: true, publication_status: "published" }, villa)).toBe(true);
    expect(isPublicSaleListingVisible({ is_published: false, publication_status: "draft" }, villa)).toBe(false);
    expect(isPublicSaleListingVisible({ is_published: false, publication_status: "unpublished" }, villa)).toBe(false);
    expect(isPublicSaleListingVisible({ is_published: true, publication_status: "published" }, { ...villa, deleted_at: "x" })).toBe(false);
    expect(isPublicSaleListingVisible(null, villa)).toBe(false);
  });
});

/* ================================================================ 3 */
describe("ortak detay bileşeni", () => {
  it("bölümler: fiyat, konum, temel bilgiler, açıklama, özellikler, harita (referans YOK)", () => {
    const { container } = render(<SaleVillaDetail data={viewData("published")} locale="en" />);
    expect(screen.getAllByText("€1,250,000").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-sale-reference]")).toBeNull();
    expect(screen.queryByText(/Reference no\.|Ref\./)).toBeNull();
    for (const h2 of ["Key facts", "About this property", "General features", "Technical details", "Location"]) {
      expect(screen.getByRole("heading", { name: h2 })).toBeTruthy();
    }
    expect(screen.getByText("Infinity pool")).toBeTruthy();
    expect(screen.getByText("Sea view villa.")).toBeTruthy();
  });

  it("public (preview=false): Genel Ayarlar WhatsApp + telefonu, mesajda referans yok", () => {
    const html = renderToStaticMarkup(<SaleVillaDetail data={viewData("published")} locale="en" />);
    expect(html).toContain('data-sale-contact="live"');
    expect(html).toMatch(/href="https:\/\/wa\.me\/905550000000\?text=Hello/);
    expect(html).toContain('href="tel:+902420000000"');
    expect(html).not.toMatch(/Ref\.|%28Ref/);
    expect(html).not.toContain("data-sale-preview-banner");
  });

  it("TR: Türkçe başlıklar ve fiyat biçimi", () => {
    render(<SaleVillaDetail data={viewData("draft")} locale="tr" preview />);
    expect(screen.getByRole("heading", { name: "Temel bilgiler" })).toBeTruthy();
    expect(screen.getAllByText("€1.250.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Önizlemede devre dışı").length).toBeGreaterThan(0);
  });

  it("uyarı şeridi admin için Türkçe; dil seçici ve geri dönüş bağlantısı", () => {
    render(<SalePreviewBanner villaId={V} locale="en" status="unpublished" />);
    expect(screen.getByText(/ÖNİZLEME – Bu ilan henüz yayında değil/)).toBeTruthy();
    expect(screen.getByText("Yayından kaldırıldı")).toBeTruthy();
    expect(screen.getByRole("link", { name: "TR" }).getAttribute("href")).toBe(saleListingPreviewHref(V, "tr"));
    expect(screen.getByRole("link", { name: "İlana dön" }).getAttribute("href")).toBe(`/maki-admin/sale-listings/${V}`);
  });

  it("WhatsApp yalnız Genel Ayarlar: whatsapp_link, yoksa ayarlardaki telefondan wa.me, ikisi de yoksa null", () => {
    expect(buildSaleWhatsappHref("https://wa.me/905550000000", "+90 242 000 00 00", "Hi there")).toBe("https://wa.me/905550000000?text=Hi+there");
    expect(buildSaleWhatsappHref(null, "+90 242 000 00 00", "Hi")).toBe("https://wa.me/902420000000?text=Hi");
    expect(buildSaleWhatsappHref(null, null, "Hi")).toBeNull();
    expect(buildSaleWhatsappHref("", "12", "Hi")).toBeNull();
  });
});

/* ================================================================ 4 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf-8");
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...walk(f));
    else if (/\.(ts|tsx)$/.test(e)) out.push(f);
  }
  return out;
}

describe("güvenlik kilitleri", () => {
  it("önizleme YALNIZ /maki-admin altında; public rotalar yalnız 'public' modunu kullanır", () => {
    expect(saleListingPreviewHref(V)).toBe(`/maki-admin/sale-listings/${V}/onizleme`);
    /* Aşama 5: public sayfalar ortak modül üzerinden çalışır; hiçbir
       public dosya önizleme modunu / önizleme bileşenini kullanamaz. */
    const publicFiles = walk(join(root, "app/(public)"));
    for (const f of publicFiles) {
      const src = readFileSync(f, "utf-8");
      expect(src, f).not.toMatch(/mode:\s*"preview"|SalePreviewBanner|loadSaleVillaDetail/);
    }
    const route = read("app/components/sale/sale-public-route.tsx");
    expect(route).toContain('mode: "public"');
    expect(route).not.toContain('mode: "preview"');
    expect(route).not.toContain("SalePreviewBanner");
  });

  it("'?preview=true' gibi bir bayrak hiçbir satılık kodunda okunmuyor", () => {
    for (const p of [
      "app/(admin)/maki-admin/sale-listings/[villaId]/onizleme/page.tsx",
      "app/services/sale-villa-detail.service.ts",
      "app/components/sale/SaleVillaDetail.tsx",
    ]) {
      const code = read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, p).not.toMatch(/searchParams[^;]*preview|get\(["']preview["']\)|preview=true/);
    }
  });

  it("sayfa veriyi oturum + yetki kontrolünden SONRA okur", () => {
    const src = read("app/(admin)/maki-admin/sale-listings/[villaId]/onizleme/page.tsx");
    const body = src.slice(src.indexOf("export default async function"));
    const a = body.indexOf("authorizeAdminSession()");
    const g = body.indexOf('adminPermissionGate(auth.caller.id, "sale_listings")');
    const l = body.indexOf("loadSaleVillaDetail(");
    expect(a).toBeGreaterThan(-1);
    expect(g).toBeGreaterThan(a);
    expect(l).toBeGreaterThan(g);
  });

  it("sitemap önizleme adresi içermiyor; robots /maki-admin'i kapatıyor", () => {
    /* Aşama 5: sitemap yayındaki satılık ilanları içerir (yalnız
       public görünür satırlar); önizleme / admin adresi ASLA. */
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).not.toMatch(/onizleme|maki-admin\/sale/);
    expect(sitemap).toContain("listPublicSaleSitemapRows()");
    expect(read("app/robots.ts")).toMatch(/DISALLOW_PATHS[\s\S]*?"\/maki-admin"/);
    expect(read("middleware.ts")).toContain('"/maki-admin/:path*"');
  });

  it("kabuksuz önizleme yolu dar tanımlı", () => {
    expect(isSaleListingPreviewPath(`/maki-admin/sale-listings/${V}/onizleme`)).toBe(true);
    expect(isSaleListingPreviewPath(`/maki-admin/sale-listings/${V}`)).toBe(false);
    expect(isSaleListingPreviewPath("/maki-admin/villas/x/onizleme")).toBe(false);
    expect(isSaleListingPreviewPath(`/maki-admin/sale-listings/${V}/onizleme/x`)).toBe(false);
  });
});

/* ================================================================ 5 */
describe("admin listesi — Önizle her durumda", () => {
  it("taslak, yayında ve kaldırılmış ilanların hepsinde yeni sekmede önizleme bağlantısı", async () => {
    const { default: SaleListingList } = await import(
      "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingList"
    );
    const rows = (["draft", "published", "unpublished"] as const).map((s, i) => ({
      ...listingRow(s),
      villa_id: `${i}2222222-2222-2222-2222-222222222222`,
      created_at: "2026-11-01T00:00:00Z",
      villa: { id: String(i), title: `Villa ${s}`, slug: "v", is_active: true, deleted_at: null, listed_for_rent: false, listed_for_sale: true },
    }));
    vi.doMock("@/app/components/admin/notifications/NotificationProvider", () => ({
      useNotify: () => ({ success: vi.fn(), error: vi.fn() }),
      useConfirm: () => vi.fn(),
    }));
    render(<SaleListingList initialData={rows as never} />);
    const links = screen.getAllByRole("link", { name: /önizle$/ });
    expect(links).toHaveLength(3);
    links.forEach((a, i) => {
      expect(a.getAttribute("href")).toBe(saleListingPreviewHref(rows[i].villa_id));
      expect(a.getAttribute("target")).toBe("_blank");
    });
  });
});

describe("middleware — oturumsuz ziyaretçi önizlemeye ulaşamaz", () => {
  it("çerezsiz istek login'e yönlendirilir (redirect parametresiyle)", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await vi.importActual<typeof import("@/middleware")>("@/middleware");
    const res = await middleware(
      new NextRequest(`https://villainkalkan.com/maki-admin/sale-listings/${V}/onizleme`)
    );
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location") || "");
    expect(loc.pathname).toBe("/maki-admin/login");
    expect(loc.searchParams.get("redirect")).toBe(`/maki-admin/sale-listings/${V}/onizleme`);
  });
});
