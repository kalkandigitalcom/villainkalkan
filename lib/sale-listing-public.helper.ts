/* ===============================================================
   🌐 SATILIK İLAN — PUBLIC LİSTE (saf yardımcılar, client-safe)
   ===============================================================
   /satilik-villalar (EN) ve /tr/satilik-villalar (TR) için:
     • kart tipi (`SalePublicCard`)
     • URL filtre sözleşmesi (`bolge`, `tip`, `min`, `max`, `sort`, `page`)
     • filtreleme / sıralama / sayfalama / EUR dönüşümü
   DB'ye dokunmaz; veri `sale-listing-public.service.ts`'den gelir.
=============================================================== */
import {
  PROPERTY_TYPES,
  isUuid,
  type PropertyType,
  type SaleCurrency,
  type SaleStatus,
} from "@/lib/sale-listing.helper";

export const SALE_ARCHIVE_PATH = "/satilik-villalar";
export const SALE_DETAIL_BASE_PATH = "/satilik-villa";
export const SALE_PAGE_SIZE = 12;

export function saleDetailPath(slug: string): string {
  return `${SALE_DETAIL_BASE_PATH}/${encodeURIComponent(slug)}`;
}

export type SalePublicCard = {
  villaId: string;
  slug: string;
  title: string;
  locationId: string | null;
  locationName: string | null;
  coverImage: string | null;
  salePrice: number | null;
  saleCurrency: SaleCurrency;
  priceOnRequest: boolean;
  saleStatus: SaleStatus;
  propertyType: PropertyType;
  roomLayout: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaM2: number | null;
  plotAreaM2: number | null;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string | null;
};

export const SALE_SORTS = ["featured", "price-asc", "price-desc", "newest"] as const;
export type SaleSort = (typeof SALE_SORTS)[number];

export type SaleArchiveFilters = {
  regionId: string | null;
  propertyType: PropertyType | null;
  minEur: number | null;
  maxEur: number | null;
  sort: SaleSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

function positiveNumber(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[.\s]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** URL parametrelerini GÜVENLİ biçimde çözer; geçersiz değer → yok sayılır. */
export function parseSaleArchiveParams(sp: RawParams | null | undefined): SaleArchiveFilters {
  const p = sp || {};
  const region = first(p.bolge);
  const type = first(p.tip);
  const sort = first(p.sort);
  const page = Number(first(p.page));
  let minEur = positiveNumber(first(p.min));
  let maxEur = positiveNumber(first(p.max));
  if (minEur !== null && maxEur !== null && minEur > maxEur) {
    [minEur, maxEur] = [maxEur, minEur];
  }
  return {
    regionId: isUuid(region) ? region : null,
    propertyType: (PROPERTY_TYPES as readonly string[]).includes(type)
      ? (type as PropertyType)
      : null,
    minEur,
    maxEur,
    sort: (SALE_SORTS as readonly string[]).includes(sort) ? (sort as SaleSort) : "featured",
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/** Filtreleri URL'e yazar (varsayılanlar yazılmaz — temiz URL). */
export function buildSaleArchiveHref(
  basePath: string,
  f: Partial<SaleArchiveFilters>
): string {
  const usp = new URLSearchParams();
  if (f.regionId) usp.set("bolge", f.regionId);
  if (f.propertyType) usp.set("tip", f.propertyType);
  if (f.minEur !== null && f.minEur !== undefined) usp.set("min", String(f.minEur));
  if (f.maxEur !== null && f.maxEur !== undefined) usp.set("max", String(f.maxEur));
  if (f.sort && f.sort !== "featured") usp.set("sort", f.sort);
  if (f.page && f.page > 1) usp.set("page", String(f.page));
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Kurlar: 1 birim döviz = X TRY (exchange_rates tablosu sözleşmesi;
 *  TRY her zaman 1). EUR karşılığı hesaplanamazsa null. */
export function toEur(
  amount: number,
  currency: string,
  ratesToTry: Record<string, number | undefined>
): number | null {
  if (currency === "EUR") return amount;
  const eur = ratesToTry.EUR;
  const cur = currency === "TRY" ? 1 : ratesToTry[currency];
  if (!eur || !cur || eur <= 0 || cur <= 0) return null;
  return (amount * cur) / eur;
}

export function filterSaleCards(
  cards: ReadonlyArray<SalePublicCard>,
  f: SaleArchiveFilters,
  ratesToTry: Record<string, number | undefined>
): SalePublicCard[] {
  const hasPrice = f.minEur !== null || f.maxEur !== null;
  return cards.filter((c) => {
    if (f.regionId && c.locationId !== f.regionId) return false;
    if (f.propertyType && c.propertyType !== f.propertyType) return false;
    if (hasPrice) {
      if (c.priceOnRequest || c.salePrice === null) return false;
      const eur = toEur(c.salePrice, c.saleCurrency, ratesToTry);
      if (eur === null) return false;
      if (f.minEur !== null && eur < f.minEur) return false;
      if (f.maxEur !== null && eur > f.maxEur) return false;
    }
    return true;
  });
}

export function sortSaleCards(
  cards: ReadonlyArray<SalePublicCard>,
  sort: SaleSort,
  ratesToTry: Record<string, number | undefined>
): SalePublicCard[] {
  const eur = (c: SalePublicCard) =>
    c.priceOnRequest || c.salePrice === null
      ? null
      : toEur(c.salePrice, c.saleCurrency, ratesToTry);
  const out = [...cards];
  if (sort === "price-asc" || sort === "price-desc") {
    const dir = sort === "price-asc" ? 1 : -1;
    out.sort((a, b) => {
      const pa = eur(a);
      const pb = eur(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1; // fiyatsız her zaman sonda
      if (pb === null) return -1;
      return (pa - pb) * dir;
    });
  } else if (sort === "newest") {
    out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } else {
    out.sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        a.sortOrder - b.sortOrder ||
        (b.createdAt || "").localeCompare(a.createdAt || "")
    );
  }
  return out;
}

export function paginateSaleCards<T>(items: ReadonlyArray<T>, page: number, size = SALE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * size, current * size),
    currentPage: current,
    totalPages,
  };
}

/* ---------------- ANA NAVİGASYON ---------------- */

/** Kod ile eklenen "Satılık Villalar" menü öğesi (DB'ye yazılmaz).
 *  Canonical ad İngilizce (EN ana dil), Türkçe karşılık `nameByLocale.tr`. */
export const SALE_NAV_ITEM = {
  id: "builtin-satilik-villalar",
  name: "Villas for Sale",
  href: SALE_ARCHIVE_PATH,
  order: 0,
  parent_id: null,
  source_type: "manual",
  source_id: null,
  children: [],
  nameByLocale: { tr: "Satılık Villalar" },
} as const;

type NavNode = { href?: string | null; children?: NavNode[] | null };

function containsHref(nodes: ReadonlyArray<NavNode>, href: string): boolean {
  return nodes.some(
    (n) => n?.href === href || (Array.isArray(n?.children) && containsHref(n.children, href))
  );
}

/**
 * Menüye "Satılık Villalar" bağlantısını ekler — admin menüsünde zaten
 * `/satilik-villalar`'a giden bir öğe varsa HİÇBİR şey değişmez (admin
 * yönetimi önceliklidir). Yoksa kiralık villalar öğesinin hemen sağına,
 * o da yoksa sona eklenir. Saf: yeni dizi döner.
 */
export function withSaleVillasNavItem<T extends NavNode>(items: ReadonlyArray<T>): T[] {
  const list = [...items];
  if (containsHref(list, SALE_ARCHIVE_PATH)) return list;
  const item = { ...SALE_NAV_ITEM, children: [] } as unknown as T;
  const rentalIdx = list.findIndex((n) => n?.href === "/kiralik-villalar");
  if (rentalIdx >= 0) list.splice(rentalIdx + 1, 0, item);
  else list.push(item);
  return list;
}
