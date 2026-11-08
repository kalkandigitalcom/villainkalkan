import type {
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
  villa_id: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  villa?: SaleListingVillaLite | null;
};

export type SaleListingClientDetail = {
  listing: SaleListingClientRow;
  translation_tr: SaleListingTranslationValues | null;
};

export type SaleVillaOptionLite = {
  id: string;
  title: string | null;
  slug: string | null;
  is_active: boolean | null;
  listed_for_rent: boolean | null;
};
