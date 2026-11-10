import "server-only";

import { saleListingRepository } from "@/lib/db/sale-listing.repository.server";
import { translationRepository } from "@/lib/db/translation.repository.server";
import { TRANSLATION_LOCALE } from "@/lib/i18n/config";
import {
  isEmptyTranslation,
  isUuid,
  validateSaleListingInput,
  validateSaleListingTranslationInput,
  type PublicationStatus,
  type SaleListingTranslationValues,
  type SaleListingValues,
} from "@/lib/sale-listing.helper";
import type { VillaSaleListingTranslationRow } from "@/lib/i18n/translations.types";

/* ===============================================================
   🛡️ SATILIK İLAN SERVİSİ (admin) — iş kuralları
   ===============================================================
   KURALLAR:
     • İlan yalnız VAR OLAN, SİLİNMEMİŞ ve `listed_for_sale=true` villaya
       bağlanabilir (villa başına en fazla 1 ilan — PK villa_id).
     • reference_code / agent_whatsapp / agent_phone kolonları DB'de duruyor
       ama kod artık OKUMAZ/YAZMAZ (iletişim yalnız Genel Ayarlar).
     • Yalnız beyaz listedeki alanlar yazılır (validateSaleListingInput);
       kiralık fiyat / villa / rezervasyon tablolarına YAZILMAZ.
     • Yayın durumu: publication_status ⇔ is_published senkron
       (migration 106 CHECK ile de kilitli).
     • Çeviri: İngilizce canonical ana tabloda; Türkçe
       villa_sale_listing_translations (locale='tr'). Mevcut generic
       translationRepository kullanılır (yeni çeviri altyapısı YOK).
     • Silme: yalnız ilan + çevirisi (FK CASCADE). Villa satırı ve
       ilan türü bayrakları DEĞİŞMEZ.
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
  villa_id: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  villa?: SaleListingVilla | null;
};

export type SaleListingDetail = {
  listing: SaleListingRow;
  translation_tr: SaleListingTranslationValues | null;
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
  "Satılık ilan veritabanı şeması güncel değil (eksik kolon veya tablo). Satılık modülü migration'larının (103, 104, 106) veritabanında uygulandığını doğrulayın; ayrıntı sunucu logunda.";

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

export async function getSaleListing(
  villaId: string
): Promise<({ ok: true } & SaleListingDetail) | Fail> {
  if (!isUuid(villaId)) return fail("Geçersiz villa", 400);
  const { data, error } = await saleListingRepository.findByVillaId(villaId);
  if (error) {
    return dbFail("get", error, "İlan okunamadı", { villaId });
  }
  if (!data) return fail("İlan bulunamadı", 404);

  const tr = await translationRepository.findOne(
    "villa_sale_listing",
    villaId,
    TRANSLATION_LOCALE
  );
  if (tr.error) {
    return dbFail("get.translation", tr.error, "Türkçe çeviri okunamadı", { villaId });
  }
  return {
    ok: true,
    listing: data as unknown as SaleListingRow,
    translation_tr: tr.data ? pickTranslation(tr.data) : null,
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
  const takenIds = new Set((taken.data || []).map((r) => r.villa_id));
  return {
    ok: true,
    villas: (villas.data || []).filter(
      (v) => !takenIds.has(v.id) || v.id === includeVillaId
    ),
  };
}

/* ---------------- YAZMA */

function pickTranslation(
  row: Pick<VillaSaleListingTranslationRow, "sale_description" | "seo_title" | "seo_description">
): SaleListingTranslationValues {
  return {
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

function mapWriteError(error: { message: string; code?: string }): Fail {
  if (error.code === "23505") return fail("Bu villa için zaten bir ilan var", 409);
  if (error.code === "23514") return fail("İlan bilgileri veritabanı kurallarına uymuyor", 400);
  if (error.code === "23503") return fail("Villa bulunamadı", 404);
  if (isSaleSchemaError(error)) return fail(SALE_SCHEMA_OUTDATED_ERROR, 503);
  return fail(error.code ? `İlan kaydedilemedi (DB hata kodu: ${error.code})` : "İlan kaydedilemedi", 500);
}

async function saveTranslation(
  villaId: string,
  rawTranslation: unknown,
  hadTranslation: boolean
): Promise<{ ok: true; value: SaleListingTranslationValues | null } | Fail> {
  if (rawTranslation === undefined) return { ok: true, value: null };
  const tr = validateSaleListingTranslationInput(rawTranslation);
  if (!tr.ok) return fail(tr.error, 400);
  /* Boş çeviri ve önceden kayıt yoksa satır OLUŞTURULMAZ; varsa
     alanlar NULL'a güncellenir (silme yerine — idempotent). */
  if (isEmptyTranslation(tr.value) && !hadTranslation) return { ok: true, value: null };
  const { data, error } = await translationRepository.upsertOne(
    "villa_sale_listing",
    villaId,
    TRANSLATION_LOCALE,
    { ...tr.value }
  );
  if (error || !data) {
    logDbError("translationUpsert", error, { villaId });
    return fail("İlan kaydedildi ancak Türkçe çeviri kaydedilemedi", 500);
  }
  return { ok: true, value: pickTranslation(data) };
}

export type SaleListingWriteInput = {
  villa_id?: unknown;
  listing?: unknown;
  translation_tr?: unknown;
};

export async function createSaleListing(
  input: SaleListingWriteInput
): Promise<({ ok: true } & SaleListingDetail) | Fail> {
  const villaId = input?.villa_id;
  if (!isUuid(villaId)) return fail("Bağlı villa seçilmedi", 400);

  const v = validateSaleListingInput(input.listing);
  if (!v.ok) return fail(v.error, 400);
  const trCheck =
    input.translation_tr === undefined
      ? null
      : validateSaleListingTranslationInput(input.translation_tr);
  if (trCheck && !trCheck.ok) return fail(trCheck.error, 400);

  const villa = await assertSaleVilla(villaId);
  if ("ok" in villa) return villa;

  const existing = await saleListingRepository.findByVillaId(villaId);
  if (existing.error) return dbFail("create.existing", existing.error, "İlan doğrulanamadı", { villaId });
  if (existing.data) return fail("Bu villa için zaten bir satılık ilan var", 409);

  const { publication_status, ...rest } = v.value;
  const { data, error } = await saleListingRepository.insert({
    villa_id: villaId,
    ...rest,
    ...publicationColumns(publication_status, null),
  });
  if (error || !data) {
    logDbError("create", error, { villaId });
    return mapWriteError(error ?? { message: "no row" });
  }

  const tr = await saveTranslation(villaId, input.translation_tr, false);
  if (!tr.ok) return tr;

  return {
    ok: true,
    listing: { ...(data as unknown as SaleListingRow), villa },
    translation_tr: tr.value,
  };
}

export async function updateSaleListing(
  villaId: string,
  input: SaleListingWriteInput
): Promise<({ ok: true; before: SaleListingDetail } & SaleListingDetail) | Fail> {
  const current = await getSaleListing(villaId);
  if (!current.ok) return current;

  const v = validateSaleListingInput(input.listing);
  if (!v.ok) return fail(v.error, 400);
  const trCheck =
    input.translation_tr === undefined
      ? null
      : validateSaleListingTranslationInput(input.translation_tr);
  if (trCheck && !trCheck.ok) return fail(trCheck.error, 400);

  /* Yayına alma, villanın HÂLÂ satılık işaretli olmasını gerektirir.
     Taslak / yayından kaldırma her durumda serbest (ilan kapatılabilsin). */
  if (v.value.publication_status === "published") {
    const villa = await assertSaleVilla(villaId);
    if ("ok" in villa) return villa;
  }

  const { publication_status, ...rest } = v.value;
  const { data, error } = await saleListingRepository.updateByVillaId(villaId, {
    ...rest,
    ...publicationColumns(publication_status, current.listing),
  });
  if (error) {
    logDbError("update", error, { villaId });
    return mapWriteError(error);
  }
  if (!data) return fail("İlan bulunamadı", 404);

  const tr = await saveTranslation(
    villaId,
    input.translation_tr,
    current.translation_tr !== null
  );
  if (!tr.ok) return tr;

  return {
    ok: true,
    before: { listing: current.listing, translation_tr: current.translation_tr },
    listing: { ...(data as unknown as SaleListingRow), villa: current.listing.villa },
    translation_tr:
      input.translation_tr === undefined ? current.translation_tr : tr.value,
  };
}

export async function deleteSaleListing(
  villaId: string
): Promise<({ ok: true; before: SaleListingDetail }) | Fail> {
  const current = await getSaleListing(villaId);
  if (!current.ok) return current;
  const { error } = await saleListingRepository.deleteByVillaId(villaId);
  if (error) {
    return dbFail("delete", error, "İlan silinemedi", { villaId });
  }
  return {
    ok: true,
    before: { listing: current.listing, translation_tr: current.translation_tr },
  };
}
