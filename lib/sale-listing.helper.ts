/* ===============================================================
   🛡️ SATILIK İLAN — SAF TİPLER, SABİTLER ve DOĞRULAMA (client-safe)
   ===============================================================
   DB şeması: migration 104 (villa_sale_listings +
   villa_sale_listing_translations) + 106 (admin alanları) + 108
   (ilan kimliği `id`, kaynak: mevcut villa | bağımsız gayrimenkul). Bu dosya DB'ye
   dokunmaz; admin formu (client) ve servis (server) AYNI kuralları
   buradan kullanır → doğrulama tek yerde.

   Proje konvansiyonu: harici şema kütüphanesi YOK (zod bağımlılık değil);
   doğrulama elle, `{ ok, value } | { ok:false, error }` zarfıyla
   (bkz. villa-translation.service.ts).

   DİL: İngilizce canonical (villa_sale_listings.sale_description /
   seo_*), Türkçe çeviri `villa_sale_listing_translations` (locale='tr').
=============================================================== */

import { slugifyTr } from "@/lib/slug";

/* ---------------- İLAN TÜRÜ (villa.listed_for_rent / listed_for_sale) */

export const LISTING_TYPES = ["rent", "sale", "both"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  rent: "Sadece kiralık",
  sale: "Sadece satılık",
  both: "Kiralık ve satılık",
};

export function isListingType(v: unknown): v is ListingType {
  return typeof v === "string" && (LISTING_TYPES as readonly string[]).includes(v);
}

/** DB bayraklarından ilan türü. Alan yok/NULL → kiralık (migration 103
 *  DEFAULT'u ile birebir: listed_for_rent=TRUE, listed_for_sale=FALSE). */
export function listingTypeFromFlags(row: {
  listed_for_rent?: boolean | null;
  listed_for_sale?: boolean | null;
} | null | undefined): ListingType {
  const rent = row?.listed_for_rent !== false;
  const sale = row?.listed_for_sale === true;
  if (rent && sale) return "both";
  if (sale) return "sale";
  return "rent";
}

/** İlan türü → DB bayrakları. İkisi birden false OLAMAZ (DB CHECK
 *  villa_listing_type_present ile de kilitli). */
export function listingFlagsFor(type: ListingType): {
  listed_for_rent: boolean;
  listed_for_sale: boolean;
} {
  return {
    listed_for_rent: type === "rent" || type === "both",
    listed_for_sale: type === "sale" || type === "both",
  };
}

/* ---------------- İLAN KAYNAĞI (migration 108) */

export const SALE_LISTING_SOURCES = ["villa", "standalone"] as const;
export type SaleListingSource = (typeof SALE_LISTING_SOURCES)[number];
export const SALE_LISTING_SOURCE_LABELS: Record<SaleListingSource, string> = {
  villa: "Mevcut Villa",
  standalone: "Bağımsız Gayrimenkul",
};

export function isSaleListingSource(v: unknown): v is SaleListingSource {
  return typeof v === "string" && (SALE_LISTING_SOURCES as readonly string[]).includes(v);
}

/* ---------------- SATILIK İLAN ALANLARI */

export const SALE_CURRENCIES = ["EUR", "GBP", "USD", "TRY"] as const;
export type SaleCurrency = (typeof SALE_CURRENCIES)[number];

export const SALE_STATUSES = ["available", "reserved", "sold"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  available: "Satışta",
  reserved: "Opsiyonlu",
  sold: "Satıldı",
};

export const PUBLICATION_STATUSES = ["draft", "published", "unpublished"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  unpublished: "Yayından kaldırıldı",
};

export const PROPERTY_TYPES = [
  "villa",
  "detached_house",
  "apartment",
  "duplex",
  "land",
  "commercial",
  "other",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  villa: "Villa",
  detached_house: "Müstakil ev",
  apartment: "Daire",
  duplex: "Dubleks",
  land: "Arsa",
  commercial: "Ticari",
  other: "Diğer",
};

/** Admin formunun gönderdiği / servisin yazdığı NORMALİZE alan kümesi. */
export type SaleListingValues = {
  sale_price: number | null;
  sale_currency: SaleCurrency;
  price_on_request: boolean;
  sale_status: SaleStatus;
  property_type: PropertyType;
  plot_area_m2: number | null;
  built_area_m2: number | null;
  room_layout: string | null;
  /** 108 — iki kaynakta da geçerli; villa kaynağında boşsa villa değeri. */
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  year_built: number | null;
  title_deed_type: string | null;
  has_garden: boolean;
  garden_area_m2: number | null;
  sale_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  sale_sort_order: number;
  is_featured: boolean;
  publication_status: PublicationStatus;
};

/** Türkçe çeviri alanları (villa_sale_listing_translations, locale='tr'). */
export type SaleListingTranslationValues = {
  /** 108 — yalnız bağımsız ilan başlığının Türkçesi (villa adı çevrilmez). */
  title: string | null;
  sale_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export const SALE_LIMITS = {
  title: 160,
  slug: 120, // DB CHECK villa_sale_listings_slug_format_check ile AYNI
  maxFeatures: 200,
  roomLayout: 20,
  titleDeedType: 60,
  description: 10000,
  seoTitle: 120, // SeoStep ile AYNI
  seoDescription: 300, // SeoStep ile AYNI
  maxPrice: 999_999_999_999.99, // numeric(14,2)
  maxArea: 99_999_999.99, // numeric(10,2)
} as const;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function optionalNumber(
  v: unknown,
  label: string,
  opts: { min: number; max: number; integer?: boolean }
): ValidationResult<number | null> {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
    return { ok: true, value: null };
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return { ok: false, error: `${label} geçerli bir sayı olmalı` };
  if (opts.integer && !Number.isInteger(n)) {
    return { ok: false, error: `${label} tam sayı olmalı` };
  }
  if (n < opts.min || n > opts.max) {
    return { ok: false, error: `${label} ${opts.min} ile ${opts.max} arasında olmalı` };
  }
  return { ok: true, value: n };
}

function maxLen(
  value: string | null,
  max: number,
  label: string
): string | null {
  return value && value.length > max ? `${label} ${max} karakteri geçemez` : null;
}

function pick<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string
): ValidationResult<T> {
  if (v === null || v === undefined || v === "") return { ok: true, value: fallback };
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) {
    return { ok: true, value: v as T };
  }
  return { ok: false, error: `Geçersiz ${label}` };
}

/**
 * Ham admin girdisini doğrular + normalize eder. Bilinmeyen anahtarlar
 * YOK SAYILIR (yalnız beyaz listedeki alanlar yazılır → yanlışlıkla
 * kiralık fiyat / villa kolonlarına yazma imkânsız).
 */
export function validateSaleListingInput(
  raw: unknown
): ValidationResult<SaleListingValues> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Geçersiz istek" };
  const r = raw as Record<string, unknown>;

  const currency = pick(r.sale_currency, SALE_CURRENCIES, "EUR", "para birimi");
  if (!currency.ok) return currency;
  const saleStatus = pick(r.sale_status, SALE_STATUSES, "available", "satış durumu");
  if (!saleStatus.ok) return saleStatus;
  const propertyType = pick(r.property_type, PROPERTY_TYPES, "villa", "gayrimenkul tipi");
  if (!propertyType.ok) return propertyType;
  const publication = pick(r.publication_status, PUBLICATION_STATUSES, "draft", "yayın durumu");
  if (!publication.ok) return publication;

  const price = optionalNumber(r.sale_price, "Satış fiyatı", { min: 0, max: SALE_LIMITS.maxPrice });
  if (!price.ok) return price;
  const plot = optionalNumber(r.plot_area_m2, "Arsa alanı", { min: 0, max: SALE_LIMITS.maxArea });
  if (!plot.ok) return plot;
  const built = optionalNumber(r.built_area_m2, "Kapalı alan", { min: 0, max: SALE_LIMITS.maxArea });
  if (!built.ok) return built;
  const garden = optionalNumber(r.garden_area_m2, "Bahçe alanı", { min: 0, max: SALE_LIMITS.maxArea });
  if (!garden.ok) return garden;
  const bedrooms = optionalNumber(r.bedrooms, "Yatak odası sayısı", { min: 0, max: 100, integer: true });
  if (!bedrooms.ok) return bedrooms;
  const bathrooms = optionalNumber(r.bathrooms, "Banyo sayısı", { min: 0, max: 100, integer: true });
  if (!bathrooms.ok) return bathrooms;
  const floors = optionalNumber(r.floors, "Kat sayısı", { min: 0, max: 100, integer: true });
  if (!floors.ok) return floors;
  const year = optionalNumber(r.year_built, "Yapım yılı", { min: 1800, max: 2200, integer: true });
  if (!year.ok) return year;
  const sort = optionalNumber(r.sale_sort_order, "Sıralama", { min: -100000, max: 100000, integer: true });
  if (!sort.ok) return sort;

  const roomLayout = text(r.room_layout);
  const titleDeed = text(r.title_deed_type);
  const description = text(r.sale_description);
  const seoTitle = text(r.seo_title);
  const seoDescription = text(r.seo_description);

  const lenError =
    maxLen(roomLayout, SALE_LIMITS.roomLayout, "Oda sayısı") ||
    maxLen(titleDeed, SALE_LIMITS.titleDeedType, "Tapu tipi") ||
    maxLen(description, SALE_LIMITS.description, "Satış açıklaması") ||
    maxLen(seoTitle, SALE_LIMITS.seoTitle, "SEO başlık") ||
    maxLen(seoDescription, SALE_LIMITS.seoDescription, "SEO açıklama");
  if (lenError) return { ok: false, error: lenError };

  const priceOnRequest = r.price_on_request === true;
  const hasGarden = r.has_garden === true;

  /* Yayın kuralı (DB CHECK villa_sale_listings_price_present_check ile
     aynı): yayındaki ilan ya fiyatlı ya "fiyat sorunuz" olmalı. */
  if (publication.value === "published" && !priceOnRequest && price.value === null) {
    return {
      ok: false,
      error: "Yayına almak için satış fiyatı girin veya “Fiyat sorunuz” seçin",
    };
  }

  return {
    ok: true,
    value: {
      sale_price: price.value,
      sale_currency: currency.value,
      price_on_request: priceOnRequest,
      sale_status: saleStatus.value,
      property_type: propertyType.value,
      plot_area_m2: plot.value,
      built_area_m2: built.value,
      room_layout: roomLayout,
      bedrooms: bedrooms.value,
      bathrooms: bathrooms.value,
      floors: floors.value,
      year_built: year.value,
      title_deed_type: titleDeed,
      has_garden: hasGarden,
      garden_area_m2: hasGarden ? garden.value : null,
      sale_description: description,
      seo_title: seoTitle,
      seo_description: seoDescription,
      sale_sort_order: sort.value ?? 0,
      is_featured: r.is_featured === true,
      publication_status: publication.value,
    },
  };
}

/** Türkçe çeviri girdisi (başlık + 3 metin alanı). */
export function validateSaleListingTranslationInput(
  raw: unknown
): ValidationResult<SaleListingTranslationValues> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = text(r.title);
  const description = text(r.sale_description);
  const seoTitle = text(r.seo_title);
  const seoDescription = text(r.seo_description);
  const lenError =
    maxLen(title, SALE_LIMITS.title, "Türkçe başlık") ||
    maxLen(description, SALE_LIMITS.description, "Türkçe açıklama") ||
    maxLen(seoTitle, SALE_LIMITS.seoTitle, "Türkçe SEO başlık") ||
    maxLen(seoDescription, SALE_LIMITS.seoDescription, "Türkçe SEO açıklama");
  if (lenError) return { ok: false, error: lenError };
  return {
    ok: true,
    value: { title, sale_description: description, seo_title: seoTitle, seo_description: seoDescription },
  };
}

export function isEmptyTranslation(t: SaleListingTranslationValues): boolean {
  return !t.title && !t.sale_description && !t.seo_title && !t.seo_description;
}

/* ---------------- BAĞIMSIZ GAYRİMENKUL (migration 108) */

/** Bağımsız ilanın kendi mülk bilgileri (villa kaydı YOK). */
export type StandalonePropertyValues = {
  title: string;
  slug: string;
  location_id: string | null;
  feature_ids: string[];
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Başlık / serbest metin → URL slug'ı (Türkçe karakter dönüşümlü,
 *  [a-z0-9-], en fazla SALE_LIMITS.slug). DB CHECK ile aynı biçim. */
export function normalizeSaleSlug(v: unknown): string {
  return slugifyTr(typeof v === "string" ? v : "")
    .slice(0, SALE_LIMITS.slug)
    .replace(/-+$/g, "");
}

export function isValidSaleSlug(v: unknown): v is string {
  return typeof v === "string" && v.length <= SALE_LIMITS.slug && SLUG_RE.test(v);
}

/**
 * Bağımsız gayrimenkul alanları. Slug boşsa başlıktan üretilir; verilen
 * slug normalize edilir (büyük harf / Türkçe karakter / boşluk). Bilinmeyen
 * anahtarlar yok sayılır.
 */
export function validateStandalonePropertyInput(
  raw: unknown
): ValidationResult<StandalonePropertyValues> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Gayrimenkul bilgileri eksik" };
  const r = raw as Record<string, unknown>;

  const title = text(r.title);
  if (!title) return { ok: false, error: "Başlık zorunludur" };
  const titleErr = maxLen(title, SALE_LIMITS.title, "Başlık");
  if (titleErr) return { ok: false, error: titleErr };

  const slug = normalizeSaleSlug(text(r.slug) ?? title);
  if (!isValidSaleSlug(slug)) {
    return { ok: false, error: "Geçerli bir URL (slug) girin: harf, rakam ve tire" };
  }

  const loc = text(r.location_id);
  if (loc && !isUuid(loc)) return { ok: false, error: "Geçersiz bölge" };

  /* Enlem / boylam artık formda yok (satılık detayda harita yok).
     Gönderilse bile yok sayılır; DB kolonlarına yazılmaz. */

  const rawFeatures = r.feature_ids === undefined || r.feature_ids === null ? [] : r.feature_ids;
  if (!Array.isArray(rawFeatures)) return { ok: false, error: "Geçersiz özellik listesi" };
  if (rawFeatures.length > SALE_LIMITS.maxFeatures) {
    return { ok: false, error: "Çok fazla özellik seçildi" };
  }
  if (!rawFeatures.every((f) => isUuid(f))) return { ok: false, error: "Geçersiz özellik" };
  const featureIds = [...new Set(rawFeatures as string[])];

  return {
    ok: true,
    value: {
      title,
      slug,
      location_id: loc,
      feature_ids: featureIds,
    },
  };
}

/** UUID biçim kontrolü (path param'lar DB'ye gitmeden önce). */
export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/* ---------------- PUBLIC GÖRÜNÜRLÜK (Aşama 5 + önizleme) */

/**
 * Satılık ilanın NORMAL ziyaretçiye gösterilip gösterilemeyeceği — tek
 * kural. Taslak / yayından kaldırılmış ilan, satılık olmayan, pasif veya
 * silinmiş villa → ASLA. Admin önizlemesi bu kontrolü BİLİNÇLİ olarak
 * atlar (yetki kontrolünden sonra); public sorgular bunu kullanmak
 * zorundadır.
 */
export function isPublicSaleListingVisible(
  listing:
    | {
        is_published?: boolean | null;
        publication_status?: string | null;
        source?: string | null;
        slug?: string | null;
      }
    | null
    | undefined,
  villa:
    | {
        is_active?: boolean | null;
        deleted_at?: string | null;
        listed_for_sale?: boolean | null;
      }
    | null
    | undefined
): boolean {
  if (!listing) return false;
  if (listing.is_published !== true) return false;
  if (listing.publication_status !== "published") return false;
  /* 108 — bağımsız gayrimenkul: villa kaydı YOK; yalnız yayın durumu
     + kendi slug'ı. (Villa bayrakları bu ilan için anlamsız.) */
  if (listing.source === "standalone") return !!listing.slug;
  if (!villa) return false;
  if (villa.listed_for_sale !== true) return false;
  if (villa.is_active === false) return false;
  if (villa.deleted_at) return false;
  return true;
}

/**
 * WhatsApp bağlantısı — YALNIZ Genel Ayarlar'dan (ilan bazlı numara yok).
 * Site geneliyle (FloatingSocial / kiralık detay) aynı sıra:
 *   1) settings.whatsapp_link (admin'in girdiği tam URL)
 *   2) settings.phone hanelerinden wa.me
 * Mesaj eklenir; uygun bağlantı yoksa null (buton gösterilmez).
 */
export function buildSaleWhatsappHref(
  siteWhatsappLink: string | null | undefined,
  sitePhone: string | null | undefined,
  message: string
): string | null {
  const site = (siteWhatsappLink || "").trim();
  if (!site) {
    const digits = (sitePhone || "").replace(/\D/g, "");
    if (digits.length < 8) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  try {
    const u = new URL(site);
    if (!/^(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp\.com)$/i.test(u.hostname)) {
      return site;
    }
    u.searchParams.set("text", message);
    return u.toString();
  } catch {
    return null;
  }
}

/** tel: bağlantısı (yalnız rakam ve baştaki +). */
export function buildSalePhoneHref(phone: string | null | undefined): string | null {
  const raw = (phone || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned.replace(/\D/g, "").length >= 6 ? `tel:${cleaned}` : null;
}

/** Satış fiyatı biçimi (kuruşsuz). EN → en-GB, TR → tr-TR gruplama. */
export function formatSalePrice(
  amount: number,
  currency: string,
  locale: "en" | "tr"
): string {
  try {
    return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/* ---------------- ADMIN ÖNİZLEME YOLU */

/** Admin önizleme adresi (yalnız /maki-admin altında — public rotada
 *  önizleme modu YOK). */
export function saleListingPreviewHref(listingId: string, locale?: "en" | "tr"): string {
  const base = `/maki-admin/sale-listings/${encodeURIComponent(listingId)}/onizleme`;
  return locale === "tr" ? `${base}?lang=tr` : base;
}

/** /maki-admin/sale-listings/<ilanId>/onizleme — admin kabuğu olmadan
 *  render edilen önizleme yolu (maki-admin/layout.tsx). */
export function isSaleListingPreviewPath(pathname: string | null | undefined): boolean {
  return /^\/maki-admin\/sale-listings\/[^/]+\/onizleme\/?$/.test(pathname || "");
}
