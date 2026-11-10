import type { Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/locale-href";
import { SCHEMA_IN_LANGUAGE } from "@/app/components/seo/StructuredData";
import { saleDetailPath, type SalePublicCard } from "@/lib/sale-listing-public.helper";
import type { SaleVillaDetailData } from "./sale-villa-detail.types";

/* ===============================================================
   🔎 SATILIK İLAN — schema.org yapısal veri
   Detay: RealEstateListing (offers → Offer; about → SingleFamilyResidence
   / Apartment / Place). Liste: ItemList. Kiralık `VacationRental`
   builder'ına DOKUNULMADI. URL'ler absolute (NEXT_PUBLIC_SITE_URL).
=============================================================== */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

export function absUrl(path: string): string {
  if (!SITE_URL || /^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const RESIDENCE_TYPE: Record<string, string> = {
  villa: "SingleFamilyResidence",
  detached_house: "SingleFamilyResidence",
  duplex: "SingleFamilyResidence",
  apartment: "Apartment",
  land: "Place",
  commercial: "Place",
  other: "Place",
};

const AVAILABILITY: Record<string, string> = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/LimitedAvailability",
  sold: "https://schema.org/SoldOut",
};

export function buildSaleListingJsonLd(
  data: SaleVillaDetailData,
  locale: Locale,
  description: string | null
) {
  const url = absUrl(localeHref(saleDetailPath(data.slug || ""), locale));
  const l = data.listing;
  const residence: Record<string, unknown> = {
    "@type": RESIDENCE_TYPE[l.propertyType] ?? "Place",
    name: data.title,
  };
  if (l.bedrooms) residence.numberOfBedrooms = l.bedrooms;
  if (l.bathrooms) residence.numberOfBathroomsTotal = l.bathrooms;
  if (l.roomLayout) residence.numberOfRooms = l.roomLayout;
  if (l.builtAreaM2) {
    residence.floorSize = { "@type": "QuantitativeValue", value: l.builtAreaM2, unitCode: "MTK" };
  }
  if (l.yearBuilt) residence.yearBuilt = l.yearBuilt;
  if (data.locationName) {
    residence.address = { "@type": "PostalAddress", addressLocality: data.locationName, addressCountry: "TR" };
  }
  if (data.map.mapType === "coords" && data.map.latitude && data.map.longitude) {
    residence.geo = { "@type": "GeoCoordinates", latitude: data.map.latitude, longitude: data.map.longitude };
  }

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: data.title,
    inLanguage: SCHEMA_IN_LANGUAGE[locale],
    about: residence,
  };
  if (description) ld.description = description.slice(0, 500);
  if (data.imageUrls.length > 0) ld.image = data.imageUrls.slice(0, 10).map(absUrl);
  if (!l.priceOnRequest && l.salePrice !== null) {
    ld.offers = {
      "@type": "Offer",
      price: l.salePrice,
      priceCurrency: l.saleCurrency,
      availability: AVAILABILITY[l.saleStatus] ?? AVAILABILITY.available,
      businessFunction: "http://purl.org/goodrelations/v1#Sell",
      url,
    };
  }
  if (l.referenceCode) ld.identifier = l.referenceCode;
  return ld;
}

export function buildSaleItemListJsonLd(cards: SalePublicCard[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: cards.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(localeHref(saleDetailPath(c.slug), locale)),
      name: c.title,
      ...(c.coverImage ? { image: absUrl(c.coverImage) } : {}),
    })),
  };
}
