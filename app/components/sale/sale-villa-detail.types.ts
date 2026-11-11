import type { WatermarkPosition } from "@/app/services/settings.types";
import type { TranslatedFeature } from "@/app/components/villa/VillaFeaturesSection";
import type {
  PropertyType,
  PublicationStatus,
  SaleCurrency,
  SaleListingSource,
  SaleStatus,
} from "@/lib/sale-listing.helper";

/* ===============================================================
   Satılık villa detay görünüm modeli — `loadSaleVillaDetail` üretir,
   `SaleVillaDetail` tüketir (önizleme ve Aşama 5 public sayfa ortak).
   Tamamen çözülmüş (dil + fallback) değerler; bileşen DB'ye dokunmaz.
=============================================================== */
export type SaleVillaDetailData = {
  /** İlan kimliği (108). */
  listingId: string;
  /** villa = mevcut villadan; standalone = bağımsız gayrimenkul. */
  source: SaleListingSource;
  title: string;
  slug: string | null;
  locationName: string | null;
  imageUrls: string[];
  watermark: {
    logo: string | null;
    enabled: boolean;
    opacity: number;
    position: WatermarkPosition;
    size: number;
  };
  listing: {
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
    floors: number | null;
    yearBuilt: number | null;
    titleDeedType: string | null;
    hasGarden: boolean;
    gardenAreaM2: number | null;
    description: string | null;
    publicationStatus: PublicationStatus;
  };
  features: TranslatedFeature[];
  /** İletişim — YALNIZ Genel Ayarlar (settings.whatsapp_link / settings.phone).
   *  İlan bazlı numara yok; önizleme ve public aynı değerleri kullanır. */
  siteWhatsappLink: string | null;
  sitePhone: string | null;
  /** İlanın SEO alanları (TR'de çeviri, boşsa İngilizce canonical). */
  seo: {
    title: string | null;
    description: string | null;
  };
};
