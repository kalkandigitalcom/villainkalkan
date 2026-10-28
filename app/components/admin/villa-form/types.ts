/* ===============================================================
   🔥 VILLA FORM SHARED TYPES
   ===============================================================
   Bu types dosyası villa create/edit wizard'ı için presentational
   componentlerin prop'larını typeladığı yer.

   Page tarafında state hala useState<any>(...) — değişmedi.
   Buradaki tipler "page'den component'e geçen prop shape"i ifade
   eder; component içinde tip güvenliği sağlar, ama page'in
   mevcut state contract'ı bozulmaz.

   Yeni `any` introduced YOK — `Record<string, unknown>` ile bilinmeyen
   alan tolerated. Page'deki `useState<any>` aynen korunur.
   =============================================================== */

import type { Dispatch, SetStateAction } from "react";

/* ---------------- VILLA FORM SHAPE ---------------- */
export type VillaFormShape = {
  title?: string;
  description?: string;
  guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  deposit?: number;

  cleaning_fee?: number;
  cleaning_currency?: string;
  cleaning_limit?: number;

  /* 🛡️ HAVUZ ISITMA — 3. adım (admin form hazırlığı, hesaplama YOK).
   *  Gecelik ücret. Boş ("") / null → payload'da NULL'a normalize
   *  edilir ("hizmet sunulmuyor"); 0 da geçerli literal bir değerdir.
   *  cleaning_fee'den FARKLI: cleaning_fee her zaman number'a coerce
   *  edilir (0 fallback), pool_heating_fee NULL semantiğini korur
   *  (custom_prepayment_rate ile aynı desen). */
  pool_heating_fee?: number | string | null;
  pool_heating_currency?: string | null;

  /* 🛡️ Migration 076 — sezonluk ay kısıtı. NULL/undefined = "ay
   *  kısıtlaması yok" (12 ay aktif). [1..12] = yalnız listelenen
   *  aylarda aktif. Ay numarası: 1=Ocak. */
  pool_heating_months?: number[] | null;

  pool_type?: string;
  pool_depth?: string;
  pool_width?: string;
  pool_length?: string;

  indoor_pool?: boolean;
  indoor_pool_depth?: string;
  indoor_pool_width?: string;
  indoor_pool_length?: string;

  child_pool?: boolean;
  child_pool_depth?: string;
  child_pool_width?: string;
  child_pool_length?: string;

  pool_sheltered?: boolean;

  seo_title?: string;
  seo_description?: string;
  noindex?: boolean;

  custom_prepayment_rate?: string | number;

  /* 🛡️ MINIMUM STAY NIGHTS (Faz 26B/C).
   *  null → enforcement YOK (BookingSidebar bypass).
   *  >=2 → BookingSidebar warning + CTA disable enforcement aktif.
   *  Admin form UI input → PricingStep "Ekstra Ücretler" altı. */
  minimum_stay_nights?: number | null;

  /* 🛡️ COMMISSION RATE (% — accounting foundation).
   *  Villa bazlı komisyon oranı; muhasebe için. Booking/pricing/
   *  availability/reservation engine'lerine etkisi YOK — admin formu
   *  + service payload sınırlı. DB kolonu zaten production'da
   *  (villa.commission_rate). Range: 0-100 (form-side validation).
   *  Boş/invalid → service'te 20 fallback (DEFAULT_COMMISSION_RATE). */
  commission_rate?: number | null;
} & Record<string, unknown>;

export type VillaFormSetter = Dispatch<SetStateAction<VillaFormShape>>;

/* ---------------- LOOKUP OPTIONS ---------------- */
export type VillaLocationOption = {
  id: string;
  name: string;
} & Record<string, unknown>;

export type VillaTypeOption = {
  id: string;
  name: string;
} & Record<string, unknown>;

export type VillaFeatureOption = {
  id: string;
  name: string;
} & Record<string, unknown>;

export type VillaRuleOption = {
  id: string;
  title: string;
} & Record<string, unknown>;

export type VillaPriceIncludeOption = {
  id: string;
  title: string;
} & Record<string, unknown>;

/* ---------------- DISTANCE ROW ----------------
   `distance` field DB'ye yazılacak text-canonical değer:
     "500 m" / "1.2 km" / "" (boş) / legacy free-text (örn. "yakın")
   `unit` form-local convenience — admin formunda select dropdown
     ile yönetilir. Form save sırasında {value, unit} → text serialize
     edilir, DB'ye yalnız `distance` text yazılır.
   Backward-compat: `unit` opsiyonel. Eski caller'lar (object literal'a
   unit eklemeden geçen) sorunsuz çalışmaya devam eder; parseDistance
   ile text'ten unit çıkarılabilir. Default unit "km". */
export type VillaDistanceItem = {
  title: string;
  distance: string;
  unit?: "m" | "km";
};

/* ---------------- MAP DATA ---------------- */
export type VillaMapData = {
  map_type: string;
  latitude: number;
  longitude: number;
  map_embed: string;
};

export type VillaMapDataSetter = Dispatch<SetStateAction<VillaMapData>>;

/* ---------------- WIZARD STEPS ---------------- */
export type VillaWizardStep = {
  id: number;
  label: string;
};
