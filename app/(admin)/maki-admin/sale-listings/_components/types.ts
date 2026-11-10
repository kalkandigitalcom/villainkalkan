import type {
  SaleListingSource,
  SaleListingTranslationValues,
  SaleListingValues,
} from "@/lib/sale-listing.helper";

/* Admin client tarafında API'den gelen satılık ilan şekli
   (app/services/sale-listing.service.ts > SaleListingRow ile aynı). */
export type SaleListingVillaLite = {
  id: string;
  title: string | null;
  slug: string | null;
  is_active: boolean | null;
  deleted_at: string | null;
  listed_for_rent: boolean | null;
  listed_for_sale: boolean | null;
};

export type SaleListingClientRow = SaleListingValues & {
  /** İlan kimliği (108). */
  id: string;
  /** Mevcut villadan oluşturulan ilanda dolu; bağımsız gayrimenkulde null. */
  villa_id: string | null;
  source: SaleListingSource;
  /* Yalnız bağımsız gayrimenkul (108) — villa kaynaklı ilanda null. */
  title: string | null;
  slug: string | null;
  location_id: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  location?: { id: string; name: string | null } | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  villa?: SaleListingVillaLite | null;
};

export type SaleListingClientDetail = {
  listing: SaleListingClientRow;
  /** Bağımsız ilanın olanakları (villa kaynaklı ilanda boş). */
  feature_ids?: string[];
  translation_tr: SaleListingTranslationValues | null;
};

export type SaleVillaOptionLite = {
  id: string;
  title: string | null;
  slug: string | null;
  is_active: boolean | null;
  listed_for_rent: boolean | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
};

export type SaleFormOptionsLite = {
  locations: { id: string; name: string | null }[];
  features: { id: string; name: string | null }[];
};

export type SaleListingImageLite = {
  id: string;
  image_url: string;
  url: string | null;
  sort_order: number;
  is_cover: boolean;
};
