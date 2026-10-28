/* ===============================================================
   🛡️ /kiralik-villalar · /en/... ÇOKLU DİL TESTLERİ (DE kaldırıldı)
   ===============================================================
   Kapsam:
     A) İki route da AYNI `KiralikVillalarPageBody`'yi DOĞRU locale
        ile render eder (kopya YOK); EN gate davranışı korunur
     B) `villasArchive` dictionary namespace bütünlüğü (TR/EN)
     C) TR BYTE-IDENTITY — değerler bu fazdan önceki hardcoded
        metinlerle birebir
     D) Gövde render'ı: görünür TR/EN metinler, PageHero, boş
        koleksiyon durumu, "Hakkında" bloğu
     E) FilterSidebar sözleşmesi (mode="redirect" + locale + arama
        route'una giden basePath)
     F) Villa tipi çevirisi + canonical id/slug korunması
     G) Pagination / sort / pageSize URL'leri (locale-aware basePath,
        query kontratı DEĞİŞMEDİ)
     H) Locale switch — query string korunması
     I) SOURCE-LOCK — gövdede hardcoded TR kalmadı

   `arama-locale-routes.test.tsx` (Phase 13) ile AYNI desen.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

import { tr } from "@/lib/i18n/dictionaries/tr";
import { en } from "@/lib/i18n/dictionaries/en";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import { getLocaleSwitchTargets } from "@/lib/i18n/locale-switch.helper";
import { PUBLIC_SORT_LABELS } from "@/lib/pagination";

/* ---------------- mock katmanı ---------------- */
const requirePublicLocaleEnabledMock = vi.fn();
const setRequestLocaleMock = vi.fn();
vi.mock("@/lib/i18n/public-locale-gate.server", () => ({
  requirePublicLocaleEnabled: () => requirePublicLocaleEnabledMock(),
}));
vi.mock("@/lib/i18n/request-locale.server", () => ({
  setRequestLocale: (...a: unknown[]) => setRequestLocaleMock(...a),
}));

/* --- veri katmanı (DB'ye gidilmez; davranış sözleşmesi korunur) --- */
const villasMock = vi.fn();
const locationsMock = vi.fn();
const typesMock = vi.fn();
const settingsMock = vi.fn();
vi.mock("@/lib/cache.helpers", () => ({
  getCachedVillas: () => villasMock(),
  getCachedVillaLocations: () => locationsMock(),
  getCachedVillaTypes: () => typesMock(),
  getCachedSettings: () => settingsMock(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "TRY" }) }),
}));
vi.mock("@/app/services/exchange-rate.service", () => ({
  getExchangeRatesMap: async () => ({
    rates: { USD: 32, EUR: 35, GBP: 40 },
    updatedAt: null,
  }),
}));

const typeNamesMock = vi.fn();
vi.mock("@/lib/i18n/get-villa-type-translations.server", () => ({
  getVillaTypeNamesByLocale: (ids: string[]) => typeNamesMock(ids),
}));

/* 🛡️ ADDITIVE — sidebar "Villa Özellikleri" seçenekleri `loadHeroFeatures`
   üzerinden gelir (/arama ve Hero ile AYNI action). Yalnız en alttaki
   taksonomi okuması mock'lanır; gerçek action zinciri ÇALIŞIR. Mock
   olmasaydı action fail-soft davranıp boş liste dönerdi → mevcut
   testlerin çıktısı DEĞİŞMEZ; mock sadece 22) numaralı yeni testi
   deterministik yapar. */
const featuresTaxonomyMock = vi.fn();
vi.mock("@/lib/db/villa-feature.repository", () => ({
  villaFeatureRepository: {
    findAllForPublicTaxonomy: () => featuresTaxonomyMock(),
  },
}));

/* --- ağır UI çocukları: prop-yakalayan hafif stub'lar --- */
const sidebarProps: Record<string, unknown>[] = [];
vi.mock("@/app/(public)/arama/FilterSidebar", () => ({
  default: (props: Record<string, unknown>) => {
    sidebarProps.push(props);
    return <div data-testid="filter-sidebar" />;
  },
}));

const cardProps: Record<string, unknown>[] = [];
vi.mock("@/app/components/villa/VillaCard", () => ({
  default: (props: Record<string, unknown>) => {
    cardProps.push(props);
    return <div data-testid="villa-card">{String(props.title)}</div>;
  },
}));

vi.mock("@/app/components/ui/PageHero", () => ({
  default: (props: {
    breadcrumb: { name: string; href?: string }[];
    eyebrow?: string;
    title: React.ReactNode;
    stat?: { value: string | number; label: string };
  }) => (
    <div data-testid="page-hero">
      <div data-testid="hero-breadcrumb">
        {props.breadcrumb.map((c) => c.name).join(" / ")}
      </div>
      <div data-testid="hero-eyebrow">{props.eyebrow}</div>
      <h1 data-testid="hero-title">{props.title}</h1>
      <div data-testid="hero-stat">
        {props.stat ? `${props.stat.value}|${props.stat.label}` : ""}
      </div>
    </div>
  ),
}));

vi.mock("next/script", () => ({
  default: () => <div data-testid="next-script" />,
}));

import KiralikVillalarPageBody, {
  ARCHIVE_TR_PATH,
  archivePath,
} from "@/app/components/search/KiralikVillalarPageBody";

/* ---------------- fixtures / helpers ---------------- */
const REGION_OPTIONS = [
  { id: "r1", name: "Fethiye", group: "Muğla" },
  { id: "r2", name: "Kalkan", group: "Antalya" },
];
const TYPE_OPTIONS = [
  { id: "t1", name: "Muhafazakar Villalar", slug: "muhafazakar-villalar" },
  { id: "t2", name: "Balayı Villaları", slug: "balayi-villalari" },
];

function villa(i: number) {
  return {
    id: `v${i}`,
    slug: `villa-${i}`,
    title: `Villa ${i}`,
    location: "Fethiye",
    price: 1000 + i,
    currency: "TRY",
    images: [`img-${i}.jpg`],
    bedrooms: 3,
    bathrooms: 2,
    guests: 6,
    review_average: null,
    review_count: 0,
  };
}
const MANY_VILLAS = Array.from({ length: 30 }, (_, i) => villa(i + 1));

async function renderBody(
  locale: "tr" | "en",
  sp: Record<string, string> = {}
) {
  const element = await KiralikVillalarPageBody({
    locale,
    searchParams: Promise.resolve(sp),
  });
  return render(element);
}

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
}

/** Yorumları temizler — source-lock YALNIZ koda bakmalı. */
function stripComments(src: string): string {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  let state: "code" | "block" | "line" = "code";
  while (i < n) {
    const ch = src[i];
    if (state === "code") {
      if (src.startsWith("/*", i)) {
        state = "block";
        i += 2;
        continue;
      }
      if (src.startsWith("//", i)) {
        state = "line";
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        const q = ch;
        out.push(ch);
        i += 1;
        while (i < n) {
          if (src[i] === "\\") {
            out.push(src[i]);
            if (i + 1 < n) out.push(src[i + 1]);
            i += 2;
            continue;
          }
          out.push(src[i]);
          if (src[i] === q) {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }
      out.push(ch);
      i += 1;
      continue;
    }
    if (state === "block") {
      if (src.startsWith("*/", i)) {
        state = "code";
        i += 2;
        continue;
      }
      out.push(ch === "\n" ? "\n" : " ");
      i += 1;
      continue;
    }
    if (ch === "\n") {
      state = "code";
      out.push("\n");
      i += 1;
      continue;
    }
    out.push(" ");
    i += 1;
  }
  return out.join("");
}

function leafPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}
function leafValues(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (typeof obj !== "object" || obj === null) return [];
  return Object.values(obj as Record<string, unknown>).flatMap(leafValues);
}

const BODY_SRC = "app/components/search/KiralikVillalarPageBody.tsx";

beforeEach(() => {
  vi.clearAllMocks();
  sidebarProps.length = 0;
  featuresTaxonomyMock.mockResolvedValue({
    data: [
      { id: "f-2", name: "Sauna" },
      { id: "f-1", name: "Jakuzi" },
    ],
    error: null,
  });
  cardProps.length = 0;
  requirePublicLocaleEnabledMock.mockResolvedValue(undefined);
  villasMock.mockResolvedValue(MANY_VILLAS);
  locationsMock.mockResolvedValue(REGION_OPTIONS);
  typesMock.mockResolvedValue(TYPE_OPTIONS);
  settingsMock.mockResolvedValue({ site_name: "Tatilin Yeri" });
  typeNamesMock.mockResolvedValue({
    t1: { en: "Conservative Villas" },
    t2: { en: "Honeymoon Villas" },
  });
});

/* ===============================================================
   A) ROUTE DAVRANIŞI
   =============================================================== */
const LOCALE_ROUTES: Array<[string, "en"]> = [
  ["@/app/(public)/kiralik-villalar/page", "en"],
];

describe.each(LOCALE_ROUTES)("%s", (modulePath, locale) => {
  const sp = Promise.resolve({});

  it(`1) ORTAK KiralikVillalarPageBody'yi locale="${locale}" ile render eder`, async () => {
    const { default: Page } = await import(modulePath);
    const element = await Page({ searchParams: sp });

    expect(setRequestLocaleMock).toHaveBeenCalledWith(locale);
    expect(requirePublicLocaleEnabledMock).toHaveBeenCalledTimes(1);
    expect(element.type).toBe(KiralikVillalarPageBody);
    expect(element.props.locale).toBe(locale);
    /* searchParams AYNEN geçirilir — URL kontratı değişmedi. */
    expect(element.props.searchParams).toBe(sp);
  });

  it("2) multilingual KAPALI → notFound() PROPAGATE eder", async () => {
    requirePublicLocaleEnabledMock.mockRejectedValue(
      new Error("NEXT_NOT_FOUND")
    );
    const { default: Page } = await import(modulePath);
    await expect(Page({ searchParams: sp })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("3) placeholder koşulsuz noindex metadata'sı KALDIRILDI, generateMetadata var", async () => {
    const mod = await import(modulePath);
    expect(mod.metadata).toBeUndefined();
    expect(typeof mod.generateMetadata).toBe("function");
  });

  it("4) route segment config EKLENMEDİ (TR ile aynı: dynamic/revalidate yok)", async () => {
    const mod = await import(modulePath);
    expect(mod.dynamic).toBeUndefined();
    expect(mod.revalidate).toBeUndefined();
  });
});

describe("app/(public)/tr/kiralik-villalar/page.tsx — TR", () => {
  it("5) ORTAK gövdeyi locale='tr' ile render eder", async () => {
    const sp = Promise.resolve({});
    const { default: Page } = await import(
      "@/app/(public)/tr/kiralik-villalar/page"
    );
    const element = await Page({ searchParams: sp });
    expect(element.type).toBe(KiralikVillalarPageBody);
    expect(element.props.locale).toBe("tr");
    expect(element.props.searchParams).toBe(sp);
  });

  it("6) TR'de locale gate'i ÇAĞRILMAZ (davranış değişmedi)", async () => {
    const { default: Page } = await import(
      "@/app/(public)/tr/kiralik-villalar/page"
    );
    await Page({ searchParams: Promise.resolve({}) });
    expect(setRequestLocaleMock).not.toHaveBeenCalled();
    expect(requirePublicLocaleEnabledMock).not.toHaveBeenCalled();
  });

  it("7) TR'de de route segment config YOK (mevcut davranış korundu)", async () => {
    const mod: Record<string, unknown> = await import(
      "@/app/(public)/tr/kiralik-villalar/page"
    );
    expect(mod.dynamic).toBeUndefined();
    expect(mod.revalidate).toBeUndefined();
  });

  it("7b) DE desteği kaldırıldı — /de/kiralik-villalar route dosyası YOK", () => {
    expect(
      fs.existsSync(
        path.join(process.cwd(), "app/(public)/de/kiralik-villalar/page.tsx")
      )
    ).toBe(false);
  });
});

/* ===============================================================
   B) DICTIONARY BÜTÜNLÜĞÜ
   =============================================================== */
describe("`villasArchive` namespace bütünlüğü", () => {
  it("8) TR/EN'de AYNI key ağacı", () => {
    const trPaths = leafPaths(tr.villasArchive).sort();
    expect(leafPaths(en.villasArchive).sort()).toEqual(trPaths);
    expect(trPaths.length).toBe(20);
  });

  it("9) hiçbir dilde boş değer yok", () => {
    for (const [name, d] of [
      ["tr", tr],
      ["en", en],
    ] as const) {
      for (const v of leafValues(d.villasArchive)) {
        expect(typeof v, name).toBe("string");
        expect(v.trim().length, `${name}: "${v}"`).toBeGreaterThan(0);
      }
    }
  });

  it("10) EN'de Türkçe karakter yok", () => {
    for (const v of leafValues(en.villasArchive)) {
      expect(/[çÇğĞıİöÖşŞüÜ]/.test(v), v).toBe(false);
    }
  });

  it("12) `metaTitle` TR/EN'de `{brand}` placeholder'ını KORUYOR", () => {
    for (const d of [tr, en]) {
      expect(d.villasArchive.metaTitle).toContain("{brand}");
    }
  });
});

/* ===============================================================
   C) TR BYTE-IDENTITY
   =============================================================== */
describe("TR byte-identity — eski hardcoded metinler", () => {
  it("13) `villasArchive` TR değerleri BİREBİR", () => {
    const a = tr.villasArchive;
    expect(a.metaTitle).toBe("Kiralık Villalar — {brand}");
    expect(a.metaDescription).toBe(
      "Akdeniz'in seçkin koleksiyonu. Özel havuz, deniz manzarası ve butik konforla tasarlanmış kiralık villaları keşfedin."
    );
    expect(a.breadcrumbHome).toBe("Ana sayfa");
    expect(a.breadcrumbCurrent).toBe("Kiralık Villalar");
    expect(a.heroEyebrow).toBe("Tüm Villalar");
    expect(a.heroTitle).toBe("Kiralık Villalar");
    expect(a.heroStatLabel).toBe("Aktif Villa");
    expect(a.collectionName).toBe("Kiralık Villalar");
    expect(a.collectionDescription).toBe(
      "Akdeniz'in seçkin kiralık villa koleksiyonu — özel havuz, deniz manzarası, butik konfor."
    );
    expect(a.emptyEyebrow).toBe("Koleksiyon");
    expect(a.emptyTitle).toBe("Yakında burada.");
    expect(a.emptyBody).toBe(
      "Koleksiyon henüz oluşturuluyor. Yakında keşfedilmeyi bekleyecek."
    );
    expect(a.aboutEyebrow).toBe("Hakkında");
    expect(a.aboutTitleLead).toBe("Bir konaklamadan");
    expect(a.aboutTitleAccent).toBe("fazlası.");
    expect(a.aboutParagraph3LinkLabel).toBe("arama sayfasından");
    expect(a.aboutParagraph3Trail).toBe("sonuçları görüntüleyebilirsiniz.");
  });

  it("14) PAYLAŞILAN toolbar metinleri `search` namespace'inden gelir (kopya YOK)", () => {
    /* Eski /kiralik-villalar hardcoded metinleri ile birebir. */
    expect(tr.search.sortLabel).toBe("Sırala");
    expect(tr.search.sortAriaLabel).toBe("Villa sıralaması");
    expect(tr.search.pageSizeLabel).toBe("Sayfa başına");
    expect(tr.search.pageSizeAriaLabel).toBe("Sayfa başına villa sayısı");
    expect(tr.search.paginationAriaLabel).toBe("Sayfalar");
    expect(tr.search.paginationPrev).toBe("Önceki");
    expect(tr.search.paginationNext).toBe("Sonraki");
  });

  it("15) sıralama etiketleri `PUBLIC_SORT_LABELS` ile lockstep (lib/pagination DEĞİŞMEDİ)", () => {
    expect(tr.search.sortOptions.smart).toBe(PUBLIC_SORT_LABELS.smart);
    expect(tr.search.sortOptions.priceAsc).toBe(
      PUBLIC_SORT_LABELS["price-asc"]
    );
    expect(tr.search.sortOptions.priceDesc).toBe(
      PUBLIC_SORT_LABELS["price-desc"]
    );
    expect(tr.search.sortOptions.capacityAsc).toBe(
      PUBLIC_SORT_LABELS["capacity-asc"]
    );
    expect(tr.search.sortOptions.capacityDesc).toBe(
      PUBLIC_SORT_LABELS["capacity-desc"]
    );
  });
});

/* ===============================================================
   D) GÖVDE RENDER — görünür metinler
   =============================================================== */
describe("Gövde render — TR/EN görünür metinler", () => {
  it.each(["tr", "en"] as const)(
    "16) %s: hero breadcrumb/eyebrow/başlık/stat kendi dilinde",
    async (locale) => {
      const d = { tr, en }[locale].villasArchive;
      await renderBody(locale);
      expect(screen.getByTestId("hero-breadcrumb")).toHaveTextContent(
        `${d.breadcrumbHome} / ${d.breadcrumbCurrent}`
      );
      expect(screen.getByTestId("hero-eyebrow")).toHaveTextContent(
        d.heroEyebrow
      );
      expect(screen.getByTestId("hero-title")).toHaveTextContent(d.heroTitle);
      expect(screen.getByTestId("hero-stat")).toHaveTextContent(
        `30|${d.heroStatLabel}`
      );
    }
  );

  it.each(["tr", "en"] as const)(
    "17) %s: 'Hakkında' bloğu kendi dilinde",
    async (locale) => {
      const d = { tr, en }[locale].villasArchive;
      await renderBody(locale);
      expect(screen.getByText(d.aboutEyebrow)).toBeInTheDocument();
      expect(screen.getByText(d.aboutParagraph1)).toBeInTheDocument();
      expect(screen.getByText(d.aboutParagraph2)).toBeInTheDocument();
      const link = screen.getByRole("link", {
        name: d.aboutParagraph3LinkLabel,
      });
      /* Arama route'u locale-aware. */
      expect(link).toHaveAttribute(
        "href",
        buildLocaleAlternates("/tr/arama", locale).canonical
      );
    }
  );

  it.each(["tr", "en"] as const)(
    "18) %s: boş koleksiyon durumu kendi dilinde",
    async (locale) => {
      villasMock.mockResolvedValue([]);
      const d = { tr, en }[locale].villasArchive;
      await renderBody(locale);
      expect(screen.getByText(d.emptyEyebrow)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: d.emptyTitle })
      ).toBeInTheDocument();
      expect(screen.getByText(d.emptyBody)).toBeInTheDocument();
      expect(screen.queryAllByTestId("villa-card")).toHaveLength(0);
    }
  );

  it("19) TR görünümünde EN metinleri SIZMAZ (regresyon)", async () => {
    await renderBody("tr");
    expect(screen.queryByText(en.villasArchive.heroEyebrow)).toBeNull();
    expect(screen.queryByText(en.villasArchive.aboutEyebrow)).toBeNull();
  });
});

/* ===============================================================
   E) FILTERSIDEBAR SÖZLEŞMESİ
   =============================================================== */
describe("FilterSidebar sözleşmesi", () => {
  it.each([
    ["tr", "/tr/arama"],
    ["en", "/arama"],
  ] as const)(
    "20) %s: mode='redirect' + locale + basePath='%s' (arama route'u, bu sayfa DEĞİL)",
    async (locale, expectedBasePath) => {
      await renderBody(locale);
      expect(sidebarProps).toHaveLength(1);
      const p = sidebarProps[0];
      expect(p.mode).toBe("redirect");
      expect(p.locale).toBe(locale);
      expect(p.basePath).toBe(expectedBasePath);
      /* Archive page: filtre state'i boş başlar (mevcut davranış). */
      expect(p.initial).toEqual({
        regions: [],
        categories: [],
        start: null,
        end: null,
        guests: 0,
      });
    }
  );

  it("21) bölge seçenekleri ÇEVRİLMEZ (Phase 10I canonical özel isim)", async () => {
    await renderBody("en");
    expect(sidebarProps[0].regionOptions).toEqual(REGION_OPTIONS);
  });

  it("22) villa ÖZELLİK seçenekleri sidebar'a geçer; `initial` BOŞ sözleşmesi korunur", async () => {
    await renderBody("tr");
    const p = sidebarProps[0];
    /* Seçenekler server'dan TEK SEFER prop olarak iner (client sorgu YOK). */
    expect(featuresTaxonomyMock).toHaveBeenCalledTimes(1);
    expect(
      (p.featureOptions as Array<{ id: string; name: string }>).map(
        (f) => f.name
      )
    ).toEqual(["Jakuzi", "Sauna"]);
    /* 🔒 Arşiv sözleşmesi: URL okunmaz → `initial.features` VERİLMEZ
       (bölüm seçim yokken KAPALI başlar). */
    expect(
      (p.initial as Record<string, unknown>).features
    ).toBeUndefined();
  });
});

/* ===============================================================
   F) VİLLA TİPİ ÇEVİRİSİ
   =============================================================== */
describe("Villa tipi çevirisi", () => {
  it("22) TR'de çeviri sorgusu HİÇ atılmaz (sorgu sayısı değişmedi)", async () => {
    await renderBody("tr");
    expect(typeNamesMock).not.toHaveBeenCalled();
    expect(sidebarProps[0].categoryOptions).toBe(
      await typesMock.mock.results[0].value
    );
  });

  it.each([
    ["en", "Conservative Villas", "Honeymoon Villas"],
  ] as const)(
    "23) %s: sidebar villa tipi adları çevrilir",
    async (locale, n1, n2) => {
      await renderBody(locale);
      const opts = sidebarProps[0].categoryOptions as Array<{
        id: string;
        name: string;
        slug: string;
      }>;
      expect(opts.map((o) => o.name)).toEqual([n1, n2]);
    }
  );

  it("24) TEK batch `.in()` sorgusu — N+1 YOK", async () => {
    await renderBody("en");
    expect(typeNamesMock).toHaveBeenCalledTimes(1);
    expect(typeNamesMock).toHaveBeenCalledWith(["t1", "t2"]);
  });

  it("25) CANONICAL id/slug DEĞİŞMEZ — yalnız görünen `name` çevrilir", async () => {
    await renderBody("en");
    const opts = sidebarProps[0].categoryOptions as Array<{
      id: string;
      slug: string;
    }>;
    expect(opts.map((o) => o.id)).toEqual(["t1", "t2"]);
    expect(opts.map((o) => o.slug)).toEqual([
      "muhafazakar-villalar",
      "balayi-villalari",
    ]);
  });

  it("26) çeviri okuması hata verirse TR canonical adına DÜŞER (sayfa çökmez)", async () => {
    typeNamesMock.mockRejectedValue(new Error("db down"));
    await renderBody("en");
    const opts = sidebarProps[0].categoryOptions as Array<{ name: string }>;
    expect(opts.map((o) => o.name)).toEqual([
      "Muhafazakar Villalar",
      "Balayı Villaları",
    ]);
  });

  it("27) VillaCard `locale` prop'u alır (kart metinleri + detay linki)", async () => {
    await renderBody("en");
    expect(cardProps.length).toBeGreaterThan(0);
    for (const p of cardProps) expect(p.locale).toBe("en");
  });
});

/* ===============================================================
   G) URL / PAGINATION / SORT KONTRATI
   =============================================================== */
describe("URL kontratı — pagination / sort / pageSize", () => {
  it("28) archivePath() her locale için doğru", () => {
    /* Taban (locale'siz) arşiv path'i; TR adresi `/tr` prefix'iyle türetilir. */
    expect(ARCHIVE_TR_PATH).toBe("/kiralik-villalar");
    expect(archivePath("tr")).toBe("/tr/kiralik-villalar");
    expect(archivePath("en")).toBe("/kiralik-villalar");
  });

  it.each([
    ["tr", "/tr/kiralik-villalar"],
    ["en", "/kiralik-villalar"],
  ] as const)(
    "29) %s: pagination linkleri locale'li basePath kullanır, query adları AYNI",
    async (locale, base) => {
      const d = { tr, en }[locale].search;
      await renderBody(locale, { pageSize: "12" });
      const nav = screen.getByRole("navigation", {
        name: d.paginationAriaLabel,
      });
      const next = screen.getByRole("link", { name: d.paginationNext });
      expect(next).toHaveAttribute("href", `${base}?page=2`);
      /* 2. sayfa linki de aynı basePath'te. */
      expect(
        nav.querySelector('a[href="' + base + '?page=2"]')
      ).toBeTruthy();
    }
  );

  it("30) sort default ('smart') URL'e YAZILMAZ; page=1 reset korunur", async () => {
    await renderBody("en");
    const smart = screen.getByRole("menuitemradio", {
      name: en.search.sortOptions.smart,
    });
    expect(smart).toHaveAttribute("href", "/kiralik-villalar");
    const priceAsc = screen.getByRole("menuitemradio", {
      name: en.search.sortOptions.priceAsc,
    });
    expect(priceAsc).toHaveAttribute(
      "href",
      "/kiralik-villalar?sort=price-asc"
    );
  });

  it("31) pageSize default (12) URL'e YAZILMAZ; diğerleri yazılır + sort korunur", async () => {
    await renderBody("en", { sort: "price-desc" });
    const group = screen.getByRole("group", {
      name: en.search.pageSizeAriaLabel,
    });
    const hrefs = Array.from(group.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toEqual([
      "/kiralik-villalar?sort=price-desc",
      "/kiralik-villalar?pageSize=30&sort=price-desc",
      "/kiralik-villalar?pageSize=50&sort=price-desc",
      "/kiralik-villalar?pageSize=100&sort=price-desc",
    ]);
  });

  it("32) pagination dilimleme davranışı DEĞİŞMEDİ (30 villa / 12 per page)", async () => {
    await renderBody("tr");
    expect(screen.getAllByTestId("villa-card")).toHaveLength(12);
  });

  it("33) `?page=3` → son dilim (30 villa, 12/sayfa → 6 kart)", async () => {
    await renderBody("en", { page: "3" });
    expect(screen.getAllByTestId("villa-card")).toHaveLength(6);
  });
});

/* ===============================================================
   H) LOCALE SWITCH — QUERY STRING KORUNMASI
   =============================================================== */
describe("Locale switch — query string korunması", () => {
  const Q =
    "villa-turleri=2027-kiralik-villalar%2Cmuhafazakar-villalar&flexible=3";

  it("34) /kiralik-villalar + query → EN'de AYNI query (kullanıcı senaryosu)", () => {
    const t = getLocaleSwitchTargets("/tr/kiralik-villalar", Q);
    expect(t.en).toBe(`/kiralik-villalar?${Q}`);
    expect(t.tr).toBe(`/tr/kiralik-villalar?${Q}`);
  });

  it("35) canonical token'lar ÇEVRİLMEZ / yeniden yorumlanmaz", () => {
    const t = getLocaleSwitchTargets("/tr/kiralik-villalar", Q);
    for (const href of [t.tr, t.en]) {
      expect(href).toContain("2027-kiralik-villalar%2Cmuhafazakar-villalar");
      expect(href).toContain("flexible=3");
    }
  });

  it("36) pagination query'si de korunur", () => {
    const t = getLocaleSwitchTargets(
      "/kiralik-villalar",
      "page=3&pageSize=50&sort=price-asc"
    );
    expect(t.tr).toBe("/tr/kiralik-villalar?page=3&pageSize=50&sort=price-asc");
  });

  it("37) query YOKSA mevcut davranış BİREBİR (soru işareti eklenmez)", () => {
    expect(getLocaleSwitchTargets("/tr/kiralik-villalar")).toEqual({
      tr: "/tr/kiralik-villalar",
      en: "/kiralik-villalar",
    });
  });
});

/* ===============================================================
   I) SOURCE-LOCK
   =============================================================== */
describe("SOURCE-LOCK — gövdede hardcoded TR kalmadı", () => {
  const code = stripComments(readSrc(BODY_SRC));

  it("38) eski hardcoded TR metinleri KODDA yok", () => {
    for (const s of [
      "Tüm Villalar",
      "Aktif Villa",
      "Koleksiyon henüz oluşturuluyor",
      "Yakında burada.",
      "Hakkında",
      "Bir konaklamadan",
      "Sayfa başına",
      "Sayfalar",
      "Önceki",
      "Sonraki",
      "Sırala",
      "Villa sıralaması",
      "arama sayfasından",
    ]) {
      expect(code.includes(s), s).toBe(false);
    }
  });

  it("39) `PUBLIC_SORT_LABELS` ARTIK kullanılmıyor (dictionary köprüsü var)", () => {
    expect(code.includes("PUBLIC_SORT_LABELS")).toBe(false);
    expect(code.includes("SORT_DICT_KEY")).toBe(true);
  });

  it("40) URL query anahtarları DEĞİŞMEDİ", () => {
    for (const key of ['"page"', '"pageSize"', '"sort"']) {
      expect(code.includes(key), key).toBe(true);
    }
  });

  it("41) hardcoded '/kiralik-villalar' ve '/arama' literal'i sayfa linklerinde YOK (basePath türetilir)", () => {
    /* Tek izinli literal: ARCHIVE_TR_PATH (taban path) tanımı. */
    const occurrences = code.split('"/kiralik-villalar"').length - 1;
    expect(occurrences).toBe(1);
    expect(code.includes('href="/arama"')).toBe(false);
    expect(code.includes('href="/tr/arama"')).toBe(false);
  });
});

/* ===============================================================
   F) VILLA ROZETİ KALDIRILDI
   ===============================================================
   villa.badge / villa_translations.badge sistemden kaldırıldı. Satırda
   eski bir `badge` değeri gelse bile VillaCard'a rozet GEÇMEZ.
   =============================================================== */
describe("F) villa rozeti kaldırıldı", () => {
  const LEGACY = [
    { ...villa(1), badge: "Yeni" },
    { ...villa(2), badge: "Popüler" },
  ];

  it.each(["tr", "en"] as const)(
    "30) %s — VillaCard'a `badge` prop'u gitmez",
    async (locale) => {
      villasMock.mockResolvedValue(LEGACY);
      await renderBody(locale);

      expect(cardProps.length).toBeGreaterThan(0);
      for (const p of cardProps) {
        expect(p).not.toHaveProperty("badge");
      }
    }
  );
});
