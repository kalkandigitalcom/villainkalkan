import type { WatermarkPosition } from "@/app/services/settings.types";
import type { TranslatedDistance } from "@/app/components/villa/VillaDistancesSection";
import type { TranslatedFeature } from "@/app/components/villa/VillaFeaturesSection";
import type {
  PropertyType,
  PublicationStatus,
  SaleCurrency,
  SaleStatus,
} from "@/lib/sale-listing.helper";

/* ===============================================================
   Satılık villa detay görünüm modeli — `loadSaleVillaDetail` üretir,
   `SaleVillaDetail` tüketir (önizleme ve Aşama 5 public sayfa ortak).
   Tamamen çözülmüş (dil + fallback) değerler; bileşen DB'ye dokunmaz.
=============================================================== */
export type SaleVillaDetailData = {
  villaId: string;
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
    referenceCode: string | null;
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
    agentWhatsapp: string | null;
    agentPhone: string | null;
    publicationStatus: PublicationStatus;
  };
  features: TranslatedFeature[];
  distances: TranslatedDistance[];
  map: {
    mapType: string | null;
    latitude: number | null;
    longitude: number | null;
    mapEmbed: string | null;
  };
  siteWhatsappLink: string | null;
  sitePhone: string | null;
};
