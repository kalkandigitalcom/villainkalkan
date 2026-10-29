/* ===============================================================
   🛡️ CMS SAYFA BAŞLIKLARI — HEADER + FOOTER TR/EN
   ===============================================================
   Kapsam:
     A) `getPageTitlesByLocale` — batch okuma, N+1 YOK, fallback
     B) HeaderWrapper — `source_type: "page"` düğümleri (explicit +
        auto-include), parent/child, TR kısayolu, izolasyon
     C) FooterWrapper + Footer — "Kurumsal" CMS sayfa linkleri
     D) İZOLASYON — category / manual / region davranışları BİREBİR
     E) href / slug DEĞİŞMEZ

   `villa-type-name-locale.test.tsx` (Phase 10H) ve
   `menu-name-locale.test.tsx` (migration 086) ile AYNI mock katmanı —
   yeni bir test altyapısı kurulmadı. GERÇEK DB'YE DOKUNULMAZ.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ---------------- mock katmanı ---------------- */
const findManyForLocaleMock = vi.fn();
vi.mock("@/lib/db/translation.repository.server", () => ({
  translationRepository: {
    findManyForLocale: (...a: unknown[]) => findManyForLocaleMock(...a),
  },
}));

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  /* Header dil çipleri (header redesign) query string'i korumak için
     useSearchParams kullanır. */
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/app/components/layout/VillaSearchBox", () => ({
  default: () => null,
}));
vi.mock("@/app/components/favorites/HeaderFavoritesLink", () => ({
  default: () => null,
}));

const getPublicSettingsMock = vi.fn();
vi.mock("@/app/services/settings.service", () => ({
  getPublicSettings: (...a: unknown[]) => getPublicSettingsMock(...a),
}));

const getMenuMock = vi.fn();
vi.mock("@/app/services/menu.service", () => ({
  getMenu: (...a: unknown[]) => getMenuMock(...a),
}));

/* 🔄 HeaderWrapper artık `getPublicSettings`/`getMenu`'yü DOĞRUDAN değil,
   `lib/cache.helpers.ts`'teki `unstable_cache` sarmalayıcıları üzerinden
   okuyor. Sarmalayıcılar aynı fonksiyonu çağırdığı için testin AMACI ve
   TÜM assertion'ları DEĞİŞMEDİ — yalnız mock seam'i taşındı: aşağıdaki
   mock, YUKARIDAKİ AYNI mock fonksiyonlarına delege eder. */
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: (...a: unknown[]) => getPublicSettingsMock(...a),
  getCachedMenu: (...a: unknown[]) => getMenuMock(...a),
}));

const findAllVillaLocationsMock = vi.fn();
const findAllVillaTypesMock = vi.fn();
vi.mock("@/lib/db/menu.repository", () => ({
  menuRepository: {
    findAllVillaLocations: (...a: unknown[]) =>
      findAllVillaLocationsMock(...a),
    findAllVillaTypes: (...a: unknown[]) => findAllVillaTypesMock(...a),
  },
}));

const findActivePagesMock = vi.fn();
vi.mock("@/lib/db/pages.repository", () => ({
  pagesRepository: {
    findActivePages: (...a: unknown[]) => findActivePagesMock(...a),
  },
}));

import { getPageTitlesByLocale } from "@/lib/i18n/get-page-titles-by-locale.server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import HeaderWrapper from "@/app/components/layout/HeaderWrapper";
import FooterWrapper from "@/app/components/layout/FooterWrapper";

/* ---------------- fixtures / helpers ---------------- */

/** Explicit menü satırı: admin CMS sayfasını menüye ELLE bağladı.
 *  `id` = menu.id, `source_id` = pages.id. */
const PAGE_ITEM = {
  id: "menu-row-1",
  name: "About Us",
  href: "/tr/p/hakkimizda",
  source_type: "page",
  source_id: "page-1",
};

/** Auto-include satırı: `show_in_menu=true` → `menu.service` bunu
 *  `id = pages.id` ve `source_type: "page"` ile üretir. */
const PAGE_AUTO_ITEM = {
  id: "page-2",
  name: "Contact",
  href: "/tr/p/iletisim",
  source_type: "page",
  source_id: "page-2",
};

const MANUAL_ITEM = {
  id: "m1",
  name: "Rental Villas",
  href: "/tr/kiralik-villalar",
  source_type: "manual",
  source_id: null,
};

const CATEGORY_ITEM = {
  id: "m9",
  name: "Luxury Villa",
  href: "/tr/arama?villa-turleri=luks-villa",
  source_type: "category",
  source_id: "type-1",
};

const REGION_ITEM = {
  id: "m7",
  name: "Kalkan",
  href: "/tr/arama?bolgeler=kalkan",
  source_type: "region",
  source_id: "loc-1",
};

/** Entity'ye göre farklı satır döndüren `findManyForLocale` mock'u. */
function mockTranslations(opts: {
  page?: Record<string, { tr?: string }>;
  menu?: Record<string, { tr?: string }>;
  villaType?: Record<string, { tr?: string }>;
}) {
  findManyForLocaleMock.mockImplementation(
    (entity: string, ids: string[], locale: "tr") => {
      const src =
        entity === "page"
          ? opts.page
          : entity === "menu"
            ? opts.menu
            : opts.villaType;
      if (!src) return Promise.resolve({ data: [], error: null });
      const idCol =
        entity === "page"
          ? "page_id"
          : entity === "menu"
            ? "menu_id"
            : "type_id";
      const field = entity === "page" ? "title" : "name";
      const data = ids
        .filter((id) => src[id]?.[locale] !== undefined)
        .map((id) => ({ [idCol]: id, locale, [field]: src[id]![locale] }));
      return Promise.resolve({ data, error: null });
    }
  );
}

const pageCalls = () =>
  findManyForLocaleMock.mock.calls.filter((c) => c[0] === "page");

beforeEach(() => {
  vi.clearAllMocks();
  usePathnameMock.mockReturnValue("/tr");
  getPublicSettingsMock.mockResolvedValue({ multilingual_enabled: true });
  getMenuMock.mockResolvedValue([PAGE_ITEM]);
  findManyForLocaleMock.mockResolvedValue({ data: [], error: null });
  findAllVillaLocationsMock.mockResolvedValue({ data: [] });
  findAllVillaTypesMock.mockResolvedValue({ data: [] });
  findActivePagesMock.mockResolvedValue({ data: [] });
});

/* ===============================================================
   A) BATCH OKUYUCU
   =============================================================== */
describe("getPageTitlesByLocale — batch okuma", () => {
  it("1) locale başına TAM 1 sorgu (yalnız en) — sayfa başına sorgu YOK", async () => {
    await getPageTitlesByLocale(["p1", "p2", "p3", "p4", "p5"]);
    expect(findManyForLocaleMock).toHaveBeenCalledTimes(1);
    for (const call of findManyForLocaleMock.mock.calls) {
      expect(call[0]).toBe("page");
      expect(call[1]).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    }
    expect(findManyForLocaleMock.mock.calls.map((c) => c[2]).sort()).toEqual([
      "tr",
    ]);
  });

  it("2) id listesi boşsa HİÇ sorgu atılmaz", async () => {
    expect(await getPageTitlesByLocale([])).toEqual({});
    expect(findManyForLocaleMock).not.toHaveBeenCalled();
  });

  it("3) tekrarlı id'ler tekilleştirilir", async () => {
    await getPageTitlesByLocale(["p1", "p1", "p2"]);
    expect(findManyForLocaleMock.mock.calls[0][1]).toEqual(["p1", "p2"]);
  });

  it("4) satırlar page_id → {tr} haritasına dönüşür (title kolonu)", async () => {
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" } },
    });
    expect(await getPageTitlesByLocale(["page-1"])).toEqual({
      "page-1": { tr: "Hakkımızda" },
    });
  });

  it("5) BOŞ çeviri haritaya GİRMEZ → EN fallback", async () => {
    mockTranslations({
      page: { "page-1": { tr: "" }, "page-2": { tr: "İletişim" } },
    });
    expect(await getPageTitlesByLocale(["page-1", "page-2"])).toEqual({
      "page-2": { tr: "İletişim" },
    });
  });

  it("6) WHITESPACE çeviri haritaya GİRMEZ → EN fallback", async () => {
    mockTranslations({ page: { "page-1": { tr: "\t\n " } } });
    expect(await getPageTitlesByLocale(["page-1"])).toEqual({});
  });

  it("7) DB hatası → boş harita (çökmez)", async () => {
    findManyForLocaleMock.mockResolvedValue({
      data: null,
      error: new Error("db"),
    });
    expect(await getPageTitlesByLocale(["page-1"])).toEqual({});
  });
});

/* ===============================================================
   B) HEADER
   =============================================================== */
describe("HeaderWrapper — CMS sayfa menü öğeleri", () => {
  it("8) EN → canonical `pages.title` gösterilir (multilingual ayarı kapalı olsa bile); TR çevirisi SIZMAZ", async () => {
    usePathnameMock.mockReturnValue("/");
    getPublicSettingsMock.mockResolvedValue({ multilingual_enabled: false });
    mockTranslations({ page: { "page-1": { tr: "Hakkımızda" } } });
    render(await HeaderWrapper());
    expect(screen.getAllByText("About Us").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hakkımızda")).not.toBeInTheDocument();
  });

  it("9) EN path (multilingual AÇIK) → yine canonical başlık gösterilir", async () => {
    usePathnameMock.mockReturnValue("/");
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("About Us").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hakkımızda")).not.toBeInTheDocument();
  });

  it("10) TR → `page_translations.title` gösterilir", async () => {
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
    expect(screen.queryByText("About Us")).not.toBeInTheDocument();
  });

  it("11) '/de' artık desteklenmiyor → varsayılan EN (canonical) başlık", async () => {
    usePathnameMock.mockReturnValue("/de");
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("About Us").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hakkımızda")).not.toBeInTheDocument();
  });

  it("12) TR çevirisi YOK → EN fallback", async () => {
    mockTranslations({ page: {} });
    render(await HeaderWrapper());
    expect(screen.getAllByText("About Us").length).toBeGreaterThan(0);
  });

  it("14) BOŞ / WHITESPACE çeviri → EN fallback", async () => {
    mockTranslations({ page: { "page-1": { tr: "   " } } });
    render(await HeaderWrapper());
    expect(screen.getAllByText("About Us").length).toBeGreaterThan(0);
  });

  it("15) AUTO-INCLUDE sayfa (show_in_menu) da çevrilir — aynı `source_type: 'page'` yolu", async () => {
    getMenuMock.mockResolvedValue([PAGE_AUTO_ITEM]);
    mockTranslations({ page: { "page-2": { tr: "İletişim" } } });
    render(await HeaderWrapper());
    expect(screen.getAllByText("İletişim").length).toBeGreaterThan(0);
    expect(screen.queryByText("Contact")).not.toBeInTheDocument();
  });

  it("16) explicit + auto-include BİRLİKTE, TEK batch sorguda", async () => {
    getMenuMock.mockResolvedValue([PAGE_ITEM, PAGE_AUTO_ITEM]);
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" }, "page-2": { tr: "İletişim" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("İletişim").length).toBeGreaterThan(0);
    /* locale başına 1 sorgu → 2; sayfa başına sorgu YOK (N+1 YOK). */
    expect(pageCalls()).toHaveLength(1);
    expect([...pageCalls()[0][1]].sort()).toEqual(["page-1", "page-2"]);
  });

  it("17) PARENT + CHILD sayfa öğeleri çevrilir — TEK batch", async () => {
    getMenuMock.mockResolvedValue([
      { ...PAGE_ITEM, children: [PAGE_AUTO_ITEM] },
    ]);
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" }, "page-2": { tr: "İletişim" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("İletişim").length).toBeGreaterThan(0);
    expect(pageCalls()).toHaveLength(1);
    expect([...pageCalls()[0][1]].sort()).toEqual(["page-1", "page-2"]);
  });

  it("18) menüde sayfa öğesi YOKSA `page` sorgusu HİÇ atılmaz", async () => {
    getMenuMock.mockResolvedValue([MANUAL_ITEM, REGION_ITEM]);
    mockTranslations({ menu: { m1: { tr: "Kiralık Villalar" } } });
    render(await HeaderWrapper());
    expect(pageCalls()).toHaveLength(0);
  });

  it("19) çeviri okuması patlarsa header ÇÖKMEZ → EN başlık", async () => {
    findManyForLocaleMock.mockRejectedValue(new Error("db down"));
    render(await HeaderWrapper());
    expect(screen.getAllByText("About Us").length).toBeGreaterThan(0);
  });

  /* 🛡️ NAVIGATION LOCALE PERSISTENCE — `/tr/p/{slug}` SLUG'ı canonical
     kalır (çevrilmez); link yalnız aktif locale prefix'ini taşır. */
  it("20) slug ÇEVRİLMEZ — `/tr/p/{slug}` canonical, prefix locale'den", async () => {
    mockTranslations({ page: { "page-1": { tr: "Hakkımızda" } } });
    render(await HeaderWrapper());
    for (const link of screen.getAllByRole("link", { name: "Hakkımızda" })) {
      expect(link).toHaveAttribute("href", "/tr/p/hakkimizda");
    }
  });
});

/* ===============================================================
   D) İZOLASYON — diğer kaynaklar ETKİLENMEDİ
   =============================================================== */
describe("İzolasyon — category / manual / region", () => {
  it("21) `page` öğesi `menu_translations` KULLANMAZ", async () => {
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" } },
      /* Aynı id için bir menü çevirisi "varmış" gibi davranılır. */
      menu: { "menu-row-1": { tr: "WRONG" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
    expect(screen.queryByText("WRONG")).not.toBeInTheDocument();
  });

  it("22) `category` öğesi `page_translations` KULLANMAZ — villa tipi çevirisi korunur", async () => {
    getMenuMock.mockResolvedValue([CATEGORY_ITEM]);
    mockTranslations({
      villaType: { "type-1": { tr: "Lüks Villa" } },
      page: { "type-1": { tr: "WRONG" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Lüks Villa").length).toBeGreaterThan(0);
    expect(screen.queryByText("WRONG")).not.toBeInTheDocument();
    expect(pageCalls()).toHaveLength(0);
  });

  it("23) `manual` menü çevirisi BİREBİR korunur", async () => {
    getMenuMock.mockResolvedValue([MANUAL_ITEM, PAGE_ITEM]);
    mockTranslations({
      menu: { m1: { tr: "Kiralık Villalar" } },
      page: { "page-1": { tr: "Hakkımızda" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Kiralık Villalar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
  });

  it("24) `region` canonical kalır ve `page` sorgusuna GİRMEZ", async () => {
    getMenuMock.mockResolvedValue([REGION_ITEM, PAGE_ITEM]);
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" }, "loc-1": { tr: "WRONG" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Kalkan").length).toBeGreaterThan(0);
    expect(screen.queryByText("WRONG")).not.toBeInTheDocument();
    /* YALNIZ sayfa id'si batch'e girer. */
    expect(pageCalls()[0][1]).toEqual(["page-1"]);
  });

  it("25) üç kaynak birlikte — her biri KENDİ tablosundan, 3 ayrı batch", async () => {
    getMenuMock.mockResolvedValue([MANUAL_ITEM, CATEGORY_ITEM, PAGE_ITEM]);
    mockTranslations({
      menu: { m1: { tr: "Kiralık Villalar" } },
      villaType: { "type-1": { tr: "Lüks Villa" } },
      page: { "page-1": { tr: "Hakkımızda" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Kiralık Villalar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lüks Villa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
    /* 3 entity × 1 locale = 3 sorgu; öğe başına sorgu YOK. */
    expect(findManyForLocaleMock).toHaveBeenCalledTimes(3);
  });
});

/* ===============================================================
   C) FOOTER
   =============================================================== */
describe("FooterWrapper + Footer — Kurumsal CMS sayfaları", () => {
  const CORP_PAGES = [
    {
      id: "page-1",
      title: "About Us",
      slug: "hakkimizda",
      menu_order: 1,
      created_at: "2026-01-01",
    },
    {
      id: "page-2",
      title: "Contact",
      slug: "iletisim",
      menu_order: 2,
      created_at: "2026-01-02",
    },
  ];

  beforeEach(() => {
    findActivePagesMock.mockResolvedValue({ data: CORP_PAGES });
  });

  it("26) EN → canonical başlıklar", async () => {
    usePathnameMock.mockReturnValue("/");
    mockTranslations({ page: { "page-1": { tr: "Hakkımızda" } } });
    render(await FooterWrapper());
    expect(screen.getByText("About Us")).toBeInTheDocument();
    expect(screen.queryByText("Hakkımızda")).not.toBeInTheDocument();
  });

  it("27) multilingual KAPALI olsa bile çeviri okunur (URL yapısı gereği iki dilli site)", async () => {
    getPublicSettingsMock.mockResolvedValue({ multilingual_enabled: false });
    render(await FooterWrapper());
    expect(findManyForLocaleMock).toHaveBeenCalled();
  });

  it("28) TR → çevrilmiş başlıklar", async () => {
    mockTranslations({
      page: {
        "page-1": { tr: "Hakkımızda" },
        "page-2": { tr: "İletişim" },
      },
    });
    render(await FooterWrapper());
    expect(screen.getByText("Hakkımızda")).toBeInTheDocument();
    expect(screen.getByText("İletişim")).toBeInTheDocument();
  });

  it("30) çeviri yok / boş / whitespace → EN fallback", async () => {
    mockTranslations({
      page: { "page-1": { tr: "  " } /* page-2: hiç çeviri yok */ },
    });
    render(await FooterWrapper());
    expect(screen.getByText("About Us")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("31) TEK batch sorgu — sayfa başına sorgu YOK (N+1 YOK)", async () => {
    mockTranslations({ page: { "page-1": { tr: "Hakkımızda" } } });
    render(await FooterWrapper());
    expect(pageCalls()).toHaveLength(1);
    expect([...pageCalls()[0][1]].sort()).toEqual(["page-1", "page-2"]);
  });

  /* 🛡️ NAVIGATION LOCALE PERSISTENCE — `/tr/p/{slug}` SLUG'ı canonical
     kalır (çevrilmez); link yalnız aktif locale prefix'ini taşır. */
  it("32) slug ÇEVRİLMEZ — `/tr/p/{slug}` canonical, prefix locale'den", async () => {
    mockTranslations({ page: { "page-1": { tr: "Hakkımızda" } } });
    render(await FooterWrapper());
    expect(screen.getByRole("link", { name: "Hakkımızda" })).toHaveAttribute(
      "href",
      "/tr/p/hakkimizda"
    );
  });

  it("33) çeviri okuması patlarsa footer ÇÖKMEZ → EN başlık", async () => {
    findManyForLocaleMock.mockRejectedValue(new Error("db down"));
    render(await FooterWrapper());
    expect(screen.getByText("About Us")).toBeInTheDocument();
  });

  it("34) SIRALAMA değişmez (menu_order ASC)", async () => {
    mockTranslations({
      page: { "page-1": { tr: "Hakkımızda" }, "page-2": { tr: "İletişim" } },
    });
    render(await FooterWrapper());
    /* 🛡️ aria-label artık dictionary'den (`footer.corporateAriaLabel`);
       EN değeri "Kurumsal" ile BİREBİR aynı. Bu test beforeEach'ten
       gelen `/` pathname'i ile render ediliyor (TR başlıklar
       bekleniyor) → TR etiketiyle sorgulanır. */
    const nav = screen.getByRole("navigation", {
      name: getDictionary("tr").footer.corporateAriaLabel,
    });
    const texts = Array.from(nav.querySelectorAll("a")).map(
      (a) => a.textContent
    );
    expect(texts).toEqual(["Hakkımızda", "İletişim"]);
  });

  /* Footer artık villa tipi bağlantısı basmaz (Keşfet alanı kaldırıldı);
     kurumsal sayfa çevirisi ETKİLENMEZ. */
  it("35) kurumsal sayfa çevirisi korunur; villa tipi footer'da basılmaz", async () => {
    findAllVillaTypesMock.mockResolvedValue({
      data: [{ id: "type-1", name: "Luxury Villa", slug: "luks-villa" }],
    });
    mockTranslations({
      villaType: { "type-1": { tr: "Lüks Villa" } },
      page: { "page-1": { tr: "Hakkımızda" } },
    });
    render(await FooterWrapper());
    expect(screen.queryByText("Lüks Villa")).not.toBeInTheDocument();
    expect(screen.getByText("Hakkımızda")).toBeInTheDocument();
  });

  it("36) sayfa YOKSA `page` sorgusu atılmaz", async () => {
    findActivePagesMock.mockResolvedValue({ data: [] });
    render(await FooterWrapper());
    expect(pageCalls()).toHaveLength(0);
  });
});
