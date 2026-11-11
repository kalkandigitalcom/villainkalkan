import "server-only";

import {
  saleListingRepository,
  type SaleListingImageRow,
} from "@/lib/db/sale-listing.repository.server";
import { translationRepository } from "@/lib/db/translation.repository.server";
import { TRANSLATION_LOCALE } from "@/lib/i18n/config";
import { removeServer } from "@/lib/storage/server";
import { VILLA_IMAGES_BUCKET } from "@/lib/villa-image.helpers";
import {
  isEmptyTranslation,
  isSaleListingSource,
  isUuid,
  validateSaleListingInput,
  validateSaleListingTranslationInput,
  validateStandalonePropertyInput,
  type PublicationStatus,
  type SaleListingSource,
  type SaleListingTranslationValues,
  type SaleListingValues,
  type StandalonePropertyValues,
} from "@/lib/sale-listing.helper";
import type { VillaSaleListingTranslationRow } from "@/lib/i18n/translations.types";

/* ===============================================================
   🛡️ SATILIK İLAN SERVİSİ (admin) — iş kuralları
   ===============================================================
   İKİ KAYNAK (migration 108):
     • "villa"      → VAR OLAN, SİLİNMEMİŞ ve `listed_for_sale=true`
       villaya bağlanır (villa başına en fazla 1 ilan — UNIQUE villa_id).
       Başlık / slug / galeri / olanak / konum villadan okunur; villa
       kaydı ve kiralık verisi DEĞİŞMEZ.
     • "standalone" → kiralık villa kaydı YOK. Başlık, slug, bölge,
       koordinat, olanaklar ve fotoğraflar ilanın kendisine bağlıdır.
       `villa` tablosuna ASLA yazılmaz → kiralık liste/rezervasyon/
       takvim/iCal bu kaydı göremez.
   ORTAK:
     • İlan kimliği `id`. Eski admin bağlantıları (villa id) için okuma
       `id` bulunamazsa `villa_id` ile de çözümlenir.
     • reference_code / agent_whatsapp / agent_phone kolonları DB'de
       duruyor ama kod OKUMAZ/YAZMAZ (iletişim yalnız Genel Ayarlar).
     • Yalnız beyaz listedeki alanlar yazılır (validate* yardımcıları).
     • Yayın durumu: publication_status ⇔ is_published senkron
       (migration 106 CHECK ile de kilitli).
     • Çeviri: İngilizce canonical ana tabloda; Türkçe
       villa_sale_listing_translations (locale='tr', parent = ilan id).
     • Silme: ilan + çeviri + fotoğraf/olanak satırları (FK CASCADE);
       bağımsız ilanın R2 fotoğrafları da temizlenir (best-effort).
   Dönüş zarfı: { ok:true, ... } | { ok:false, error, status }.
=============================================================== */

export type SaleListingVilla = {
  id: string;
  title: string | null;
  slug: string | null;
  is_active: boolean | null;
  deleted_at: string | null;
  listed_for_rent: boolean | null;
  listed_for_sale: boolean | null;
};

export type SaleListingRow = SaleListingValues & {
  id: string;
  villa_id: string | null;
  source: SaleListingSource;
  title: string | null;
  slug: string | null;
  location_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  villa?: SaleListingVilla | null;
  location?: { id: string; name: string | null } | null;
};

export type SaleListingDetail = {
  listing: SaleListingRow;
  translation_tr: SaleListingTranslationValues | null;
  /** Yalnız bağımsız ilan (villa kaynaklı ilanda olanaklar villadan). */
  feature_ids: string[];
};

type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });

/* ===============================================================
   🛡️ DB HATA SINIFLANDIRMA + GÜVENLİ LOG
   ===============================================================
   Kök neden (2026-11): kod, migration 106 production'da uygulanmadan
   deploy edildiğinde her okuma `column "property_type" does not exist`
   (SQLSTATE 42703) ile düşüyor, admin yalnız genel "İlan okunamadı"
   görüyordu. Artık:
     • 42703 (undefined_column) / 42P01 (undefined_table) → 503 + açık
       "veritabanı şeması güncel değil" mesajı (hangi migration).
     • Diğer DB hataları → 500 + bağlama özel mesaj + hata kodu.
   Log: yalnız bağlam, SQLSTATE ve PostgreSQL mesajı (kolon/tablo adı
   içerir; kullanıcı verisi, bağlantı dizesi, şifre İÇERMEZ). */
export const SALE_SCHEMA_OUTDATED_ERROR =
  "Satılık ilan veritabanı şeması güncel değil (eksik kolon veya tablo). Satılık modülü migration'larının (103, 104, 106, 108) veritabanında uygulandığını doğrulayın; ayrıntı sunucu logunda.";

const SCHEMA_ERROR_CODES = new Set(["42703", "42P01"]);

export function isSaleSchemaError(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && SCHEMA_ERROR_CODES.has(error.code);
}

function logDbError(
  context: string,
  error: { message?: string; code?: string } | null | undefined,
  extra?: Record<string, string>
) {
  console.error(`[saleListing.${context}] FAILED`, {
    code: error?.code ?? null,
    message: error?.message ?? "unknown",
    ...extra,
  });
}

function dbFail(
  context: string,
  error: { message?: string; code?: string } | null | undefined,
  fallbackMessage: string,
  extra?: Record<string, string>
): Fail {
  logDbError(context, error, extra);
  if (isSaleSchemaError(error)) return fail(SALE_SCHEMA_OUTDATED_ERROR, 503);
  return fail(
    error?.code ? `${fallbackMessage} (DB hata kodu: ${error.code})` : fallbackMessage,
    500
  );
}

export type SaleVillaOption = {
  id: string;
  title: string | null;
  slug: string | null;
  is_active: boolean | null;
  listed_for_rent: boolean | null;
  bedrooms: number | null;
  bathrooms: number | null;
};

export type SaleFormOptions = {
  locations: { id: string; name: string | null }[];
  features: { id: string; name: string | null }[];
};

/* ---------------- OKUMA */

export async function listSaleListings(): Promise<
  { ok: true; listings: SaleListingRow[] } | Fail
> {
  const { data, error } = await saleListingRepository.findAllForAdmin();
  if (error) {
    return dbFail("list", error, "Satılık ilanlar okunamadı");
  }
  return { ok: true, listings: (data || []) as unknown as SaleListingRow[] };
}

/** İlan id → satır; bulunamazsa (eski bağlantılar) villa id ile. */
async function findListingRow(
  idOrVillaId: string
): Promise<{ ok: true; row: SaleListingRow | null } | Fail> {
  const byId = await saleListingRepository.findById(idOrVillaId);
  if (byId.error) return dbFail("get", byId.error, "İlan okunamadı", { id: idOrVillaId });
  if (byId.data) return { ok: true, row: byId.data as unknown as SaleListingRow };
  const byVilla = await saleListingRepository.findByVillaId(idOrVillaId);
  if (byVilla.error) return dbFail("get", byVilla.error, "İlan okunamadı", { id: idOrVillaId });
  return { ok: true, row: (byVilla.data as unknown as SaleListingRow | null) ?? null };
}

export async function getSaleListing(
  idOrVillaId: string
): Promise<({ ok: true } & SaleListingDetail) | Fail> {
  if (!isUuid(idOrVillaId)) return fail("Geçersiz ilan", 400);
  const found = await findListingRow(idOrVillaId);
  if (!found.ok) return found;
  const row = found.row;
  if (!row) return fail("İlan bulunamadı", 404);

  const [tr, features] = await Promise.all([
    translationRepository.findOne("villa_sale_listing", row.id, TRANSLATION_LOCALE),
    row.source === "standalone"
      ? saleListingRepository.findFeatureIds(row.id)
      : Promise.resolve({ data: [] as { feature_id: string }[], error: null }),
  ]);
  if (tr.error) {
    return dbFail("get.translation", tr.error, "Türkçe çeviri okunamadı", { id: row.id });
  }
  if (features.error) {
    return dbFail("get.features", features.error, "İlan özellikleri okunamadı", { id: row.id });
  }
  return {
    ok: true,
    listing: row,
    translation_tr: tr.data ? pickTranslation(tr.data) : null,
    feature_ids: (features.data || []).map((f) => f.feature_id),
  };
}

/** Form "Bağlı villa" seçenekleri: satılık işaretli, silinmemiş ve
 *  henüz ilanı OLMAYAN villalar (+ düzenlenen ilanın kendi villası). */
export async function listSaleVillaOptions(
  includeVillaId?: string | null
): Promise<{ ok: true; villas: SaleVillaOption[] } | Fail> {
  const [villas, taken] = await Promise.all([
    saleListingRepository.findSaleVillaOptions(),
    saleListingRepository.findAllVillaIds(),
  ]);
  if (villas.error || taken.error) {
    return dbFail("villaOptions", villas.error || taken.error, "Villa listesi okunamadı");
  }
  const takenIds = new Set((taken.data || []).map((r) => r.villa_id).filter(Boolean));
  return {
    ok: true,
    villas: (villas.data || []).filter(
      (v) => !takenIds.has(v.id) || v.id === includeVillaId
    ),
  };
}

/** Bağımsız ilan formu: bölge + olanak seçenekleri (mevcut
 *  taksonomiler PAYLAŞILIR; yeni taksonomi yok). */
export async function getSaleFormOptions(): Promise<({ ok: true } & SaleFormOptions) | Fail> {
  const [locations, features] = await Promise.all([
    saleListingRepository.findLocationOptions(),
    saleListingRepository.findFeatureOptions(),
  ]);
  if (locations.error || features.error) {
    return dbFail("formOptions", locations.error || features.error, "Form seçenekleri okunamadı");
  }
  return { ok: true, locations: locations.data || [], features: features.data || [] };
}

/* ---------------- YAZMA */

function pickTranslation(
  row: Partial<
    Pick<VillaSaleListingTranslationRow, "title" | "sale_description" | "seo_title" | "seo_description">
  >
): SaleListingTranslationValues {
  return {
    title: row.title ?? null,
    sale_description: row.sale_description ?? null,
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
  };
}

function publicationColumns(
  status: PublicationStatus,
  previous?: { published_at: string | null } | null
) {
  const isPublished = status === "published";
  return {
    publication_status: status,
    is_published: isPublished,
    published_at:
      isPublished && !previous?.published_at
        ? new Date().toISOString()
        : previous?.published_at ?? null,
  };
}

async function assertSaleVilla(villaId: string): Promise<SaleListingVilla | Fail> {
  const { data, error } = await saleListingRepository.findVillaContext(villaId);
  if (error) {
    return dbFail("villaContext", error, "Villa doğrulanamadı", { villaId });
  }
  if (!data || data.deleted_at) return fail("Villa bulunamadı", 404);
  if (data.listed_for_sale !== true) {
    return fail(
      "Bu villa satılık olarak işaretli değil. Önce villa düzenleme ekranında ilan türünü “Sadece satılık” veya “Kiralık ve satılık” yapın.",
      409
    );
  }
  return data;
}

/** Bağımsız ilan slug'ı: başka bir ilan VEYA herhangi bir villa aynı
 *  slug'ı kullanıyorsa reddedilir (public /satilik-villa/<slug> tek
 *  anlamlı kalsın). */
async function assertStandaloneSlugFree(slug: string, selfId: string | null): Promise<Fail | null> {
  const [listing, villa] = await Promise.all([
    saleListingRepository.findListingIdBySlug(slug),
    saleListingRepository.findVillaIdBySlug(slug),
  ]);
  if (listing.error || villa.error) {
    return dbFail("slugCheck", listing.error || villa.error, "URL (slug) doğrulanamadı");
  }
  if (listing.data && listing.data.id !== selfId) {
    return fail("Bu URL (slug) başka bir satılık ilanda kullanılıyor", 409);
  }
  if (villa.data) {
    return fail("Bu URL (slug) bir villa kaydında kullanılıyor; farklı bir slug girin", 409);
  }
  return null;
}

function mapWriteError(error: { message: string; code?: string }): Fail {
  if (error.code === "23505") return fail("Bu villa veya URL (slug) için zaten bir ilan var", 409);
  if (error.code === "23514") return fail("İlan bilgileri veritabanı kurallarına uymuyor", 400);
  if (error.code === "23503") return fail("Bağlı kayıt (villa / bölge / özellik) bulunamadı", 404);
  if (isSaleSchemaError(error)) return fail(SALE_SCHEMA_OUTDATED_ERROR, 503);
  return fail(error.code ? `İlan kaydedilemedi (DB hata kodu: ${error.code})` : "İlan kaydedilemedi", 500);
}

async function saveTranslation(
  listingId: string,
  source: SaleListingSource,
  rawTranslation: unknown,
  hadTranslation: boolean
): Promise<{ ok: true; value: SaleListingTranslationValues | null } | Fail> {
  if (rawTranslation === undefined) return { ok: true, value: null };
  const tr = validateSaleListingTranslationInput(rawTranslation);
  if (!tr.ok) return fail(tr.error, 400);
  /* Villa kaynaklı ilanda başlık villa adıdır (özel isim, çevrilmez). */
  const value = source === "villa" ? { ...tr.value, title: null } : tr.value;
  /* Boş çeviri ve önceden kayıt yoksa satır OLUŞTURULMAZ; varsa
     alanlar NULL'a güncellenir (silme yerine — idempotent). */
  if (isEmptyTranslation(value) && !hadTranslation) return { ok: true, value: null };
  const { data, error } = await translationRepository.upsertOne(
    "villa_sale_listing",
    listingId,
    TRANSLATION_LOCALE,
    { ...value }
  );
  if (error || !data) {
    logDbError("translationUpsert", error, { id: listingId });
    return fail("İlan kaydedildi ancak Türkçe çeviri kaydedilemedi", 500);
  }
  return { ok: true, value: pickTranslation(data) };
}

async function saveFeatures(listingId: string, featureIds: string[]): Promise<Fail | null> {
  const del = await saleListingRepository.deleteFeatures(listingId);
  if (del.error) return dbFail("features.delete", del.error, "İlan özellikleri kaydedilemedi", { id: listingId });
  if (featureIds.length === 0) return null;
  const ins = await saleListingRepository.insertFeatures(
    featureIds.map((feature_id) => ({ listing_id: listingId, feature_id }))
  );
  if (ins.error) {
    logDbError("features.insert", ins.error, { id: listingId });
    if (ins.error.code === "23503") return fail("Seçilen özelliklerden biri artık mevcut değil", 400);
    return fail("İlan kaydedildi ancak özellikler kaydedilemedi", 500);
  }
  return null;
}

function standaloneColumns(p: StandalonePropertyValues) {
  return {
    title: p.title,
    slug: p.slug,
    location_id: p.location_id,
  };
}

export type SaleListingWriteInput = {
  source?: unknown;
  villa_id?: unknown;
  listing?: unknown;
  property?: unknown;
  translation_tr?: unknown;
};

export async function createSaleListing(
  input: SaleListingWriteInput
): Promise<({ ok: true } & SaleListingDetail) | Fail> {
  /* Geriye uyum: `source` verilmezse mevcut villadan ilan. */
  const source: unknown = input?.source ?? "villa";
  if (!isSaleListingSource(source)) return fail("Geçersiz ilan kaynağı", 400);

  const v = validateSaleListingInput(input?.listing);
  if (!v.ok) return fail(v.error, 400);
  const trCheck =
    input.translation_tr === undefined
      ? null
      : validateSaleListingTranslationInput(input.translation_tr);
  if (trCheck && !trCheck.ok) return fail(trCheck.error, 400);

  const { publication_status, ...rest } = v.value;
  let payload: Record<string, unknown>;
  let villa: SaleListingVilla | null = null;
  let property: StandalonePropertyValues | null = null;

  if (source === "villa") {
    const villaId = input.villa_id;
    if (!isUuid(villaId)) return fail("Bağlı villa seçilmedi", 400);
    const ctx = await assertSaleVilla(villaId);
    if ("ok" in ctx) return ctx;
    villa = ctx;
    const existing = await saleListingRepository.findByVillaId(villaId);
    if (existing.error) return dbFail("create.existing", existing.error, "İlan doğrulanamadı", { villaId });
    if (existing.data) return fail("Bu villa için zaten bir satılık ilan var", 409);
    payload = { source: "villa", villa_id: villaId };
  } else {
    const p = validateStandalonePropertyInput(input.property);
    if (!p.ok) return fail(p.error, 400);
    property = p.value;
    const slugErr = await assertStandaloneSlugFree(property.slug, null);
    if (slugErr) return slugErr;
    payload = { source: "standalone", villa_id: null, ...standaloneColumns(property) };
  }

  const { data, error } = await saleListingRepository.insert({
    ...payload,
    ...rest,
    ...publicationColumns(publication_status, null),
  });
  if (error || !data) {
    logDbError("create", error, { source });
    return mapWriteError(error ?? { message: "no row" });
  }
  const row = data as unknown as SaleListingRow;

  if (property) {
    const fErr = await saveFeatures(row.id, property.feature_ids);
    if (fErr) return fErr;
  }
  const tr = await saveTranslation(row.id, source, input.translation_tr, false);
  if (!tr.ok) return tr;

  return {
    ok: true,
    listing: { ...row, villa },
    translation_tr: tr.value,
    feature_ids: property?.feature_ids ?? [],
  };
}

export async function updateSaleListing(
  idOrVillaId: string,
  input: SaleListingWriteInput
): Promise<({ ok: true; before: SaleListingDetail } & SaleListingDetail) | Fail> {
  const current = await getSaleListing(idOrVillaId);
  if (!current.ok) return current;
  const cur = current.listing;

  const v = validateSaleListingInput(input?.listing);
  if (!v.ok) return fail(v.error, 400);
  const trCheck =
    input.translation_tr === undefined
      ? null
      : validateSaleListingTranslationInput(input.translation_tr);
  if (trCheck && !trCheck.ok) return fail(trCheck.error, 400);

  let property: StandalonePropertyValues | null = null;
  if (cur.source === "villa") {
    /* Yayına alma, villanın HÂLÂ satılık işaretli olmasını gerektirir.
       Taslak / yayından kaldırma her durumda serbest (ilan kapatılabilsin). */
    if (v.value.publication_status === "published") {
      const villa = await assertSaleVilla(cur.villa_id as string);
      if ("ok" in villa) return villa;
    }
  } else if (input.property !== undefined) {
    const p = validateStandalonePropertyInput(input.property);
    if (!p.ok) return fail(p.error, 400);
    property = p.value;
    if (property.slug !== cur.slug) {
      const slugErr = await assertStandaloneSlugFree(property.slug, cur.id);
      if (slugErr) return slugErr;
    }
  }

  const { publication_status, ...rest } = v.value;
  const { data, error } = await saleListingRepository.updateById(cur.id, {
    ...rest,
    ...(property ? standaloneColumns(property) : {}),
    ...publicationColumns(publication_status, cur),
  });
  if (error) {
    logDbError("update", error, { id: cur.id });
    return mapWriteError(error);
  }
  if (!data) return fail("İlan bulunamadı", 404);

  if (property) {
    const fErr = await saveFeatures(cur.id, property.feature_ids);
    if (fErr) return fErr;
  }
  const tr = await saveTranslation(
    cur.id,
    cur.source,
    input.translation_tr,
    current.translation_tr !== null
  );
  if (!tr.ok) return tr;

  return {
    ok: true,
    before: {
      listing: cur,
      translation_tr: current.translation_tr,
      feature_ids: current.feature_ids,
    },
    listing: {
      ...(data as unknown as SaleListingRow),
      villa: cur.villa,
      location: property ? undefined : cur.location,
    },
    translation_tr:
      input.translation_tr === undefined ? current.translation_tr : tr.value,
    feature_ids: property ? property.feature_ids : current.feature_ids,
  };
}

export async function deleteSaleListing(
  idOrVillaId: string
): Promise<({ ok: true; before: SaleListingDetail }) | Fail> {
  const current = await getSaleListing(idOrVillaId);
  if (!current.ok) return current;
  const id = current.listing.id;

  /* Bağımsız ilan: R2 temizliği için fotoğraf anahtarları silmeden önce. */
  let imageKeys: string[] = [];
  if (current.listing.source === "standalone") {
    const imgs = await saleListingRepository.findImages(id);
    if (imgs.error) return dbFail("delete.images", imgs.error, "İlan fotoğrafları okunamadı", { id });
    imageKeys = ((imgs.data || []) as SaleListingImageRow[]).map((i) => i.image_url).filter(Boolean);
  }

  const { error } = await saleListingRepository.deleteById(id);
  if (error) {
    return dbFail("delete", error, "İlan silinemedi", { id });
  }

  if (imageKeys.length > 0) {
    try {
      await removeServer(VILLA_IMAGES_BUCKET, imageKeys);
    } catch (err) {
      console.error("[saleListing.delete] R2 cleanup FAILED", {
        id,
        count: imageKeys.length,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: true,
    before: {
      listing: current.listing,
      translation_tr: current.translation_tr,
      feature_ids: current.feature_ids,
    },
  };
}

/** Admin başlığı (liste / audit): villa adı veya bağımsız ilan başlığı. */
export function saleListingDisplayTitle(
  listing: Pick<SaleListingRow, "title" | "villa"> | null | undefined
): string {
  return (listing?.villa?.title || listing?.title || "").trim() || "Satılık ilan";
}
