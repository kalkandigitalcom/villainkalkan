/* ===============================================================
   🛡️ SATILIK İLAN — SAF TİPLER, SABİTLER ve DOĞRULAMA (client-safe)
   ===============================================================
   DB şeması: migration 104 (villa_sale_listings +
   villa_sale_listing_translations) + 106 (admin alanları). Bu dosya DB'ye
   dokunmaz; admin formu (client) ve servis (server) AYNI kuralları
   buradan kullanır → doğrulama tek yerde.

   Proje konvansiyonu: harici şema kütüphanesi YOK (zod bağımlılık değil);
   doğrulama elle, `{ ok, value } | { ok:false, error }` zarfıyla
   (bkz. villa-translation.service.ts).

   DİL: İngilizce canonical (villa_sale_listings.sale_description /
   seo_*), Türkçe çeviri `villa_sale_listing_translations` (locale='tr').
=============================================================== */

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
  reference_code: string | null;
  sale_price: number | null;
  sale_currency: SaleCurrency;
  price_on_request: boolean;
  sale_status: SaleStatus;
  property_type: PropertyType;
  plot_area_m2: number | null;
  built_area_m2: number | null;
  room_layout: string | null;
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
  agent_whatsapp: string | null;
  agent_phone: string | null;
  publication_status: PublicationStatus;
};

/** Türkçe çeviri alanları (villa_sale_listing_translations, locale='tr'). */
export type SaleListingTranslationValues = {
  sale_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export const SALE_LIMITS = {
  referenceCode: 40,
  roomLayout: 20,
  titleDeedType: 60,
  description: 10000,
  seoTitle: 120, // SeoStep ile AYNI
  seoDescription: 300, // SeoStep ile AYNI
  phone: 32,
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
  const bathrooms = optionalNumber(r.bathrooms, "Banyo sayısı", { min: 0, max: 100, integer: true });
  if (!bathrooms.ok) return bathrooms;
  const floors = optionalNumber(r.floors, "Kat sayısı", { min: 0, max: 100, integer: true });
  if (!floors.ok) return floors;
  const year = optionalNumber(r.year_built, "Yapım yılı", { min: 1800, max: 2200, integer: true });
  if (!year.ok) return year;
  const sort = optionalNumber(r.sale_sort_order, "Sıralama", { min: -100000, max: 100000, integer: true });
  if (!sort.ok) return sort;

  const referenceCode = text(r.reference_code);
  if (referenceCode && !/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(referenceCode)) {
    return {
      ok: false,
      error: "Referans kodu yalnız harf, rakam ve . _ - / içerebilir",
    };
  }
  const roomLayout = text(r.room_layout);
  const titleDeed = text(r.title_deed_type);
  const description = text(r.sale_description);
  const seoTitle = text(r.seo_title);
  const seoDescription = text(r.seo_description);
  const whatsapp = text(r.agent_whatsapp);
  const phone = text(r.agent_phone);

  const lenError =
    maxLen(referenceCode, SALE_LIMITS.referenceCode, "Referans kodu") ||
    maxLen(roomLayout, SALE_LIMITS.roomLayout, "Oda sayısı") ||
    maxLen(titleDeed, SALE_LIMITS.titleDeedType, "Tapu tipi") ||
    maxLen(description, SALE_LIMITS.description, "Satış açıklaması") ||
    maxLen(seoTitle, SALE_LIMITS.seoTitle, "SEO başlık") ||
    maxLen(seoDescription, SALE_LIMITS.seoDescription, "SEO açıklama") ||
    maxLen(whatsapp, SALE_LIMITS.phone, "WhatsApp") ||
    maxLen(phone, SALE_LIMITS.phone, "Telefon");
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
      reference_code: referenceCode ? referenceCode.toUpperCase() : null,
      sale_price: price.value,
      sale_currency: currency.value,
      price_on_request: priceOnRequest,
      sale_status: saleStatus.value,
      property_type: propertyType.value,
      plot_area_m2: plot.value,
      built_area_m2: built.value,
      room_layout: roomLayout,
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
      agent_whatsapp: whatsapp,
      agent_phone: phone,
      publication_status: publication.value,
    },
  };
}

/** Türkçe çeviri girdisi (yalnız 3 metin alanı). */
export function validateSaleListingTranslationInput(
  raw: unknown
): ValidationResult<SaleListingTranslationValues> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const description = text(r.sale_description);
  const seoTitle = text(r.seo_title);
  const seoDescription = text(r.seo_description);
  const lenError =
    maxLen(description, SALE_LIMITS.description, "Türkçe açıklama") ||
    maxLen(seoTitle, SALE_LIMITS.seoTitle, "Türkçe SEO başlık") ||
    maxLen(seoDescription, SALE_LIMITS.seoDescription, "Türkçe SEO açıklama");
  if (lenError) return { ok: false, error: lenError };
  return {
    ok: true,
    value: { sale_description: description, seo_title: seoTitle, seo_description: seoDescription },
  };
}

export function isEmptyTranslation(t: SaleListingTranslationValues): boolean {
  return !t.sale_description && !t.seo_title && !t.seo_description;
}

/** UUID biçim kontrolü (path param'lar DB'ye gitmeden önce). */
export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}
