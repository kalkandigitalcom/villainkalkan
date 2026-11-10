import "server-only";

import {
  saleListingRepository,
  type SaleListingImageRow,
} from "@/lib/db/sale-listing.repository.server";
import { headObjectInfo, presignPutObject } from "@/lib/storage/s3-storage.provider";
import { removeServer } from "@/lib/storage/server";
import { resolveVillaImageUrl } from "@/lib/storage.helpers";
import {
  VILLA_IMAGES_BUCKET,
  buildVillaImageFilename,
  nextGallerySequenceFromUrls,
} from "@/lib/villa-image.helpers";
import { isUuid } from "@/lib/sale-listing.helper";
import {
  GALLERY_UPLOAD_CONTENT_TYPE,
  GALLERY_UPLOAD_MAX_BYTES,
  GALLERY_UPLOAD_URL_TTL_SECONDS,
} from "@/app/services/villa-image/villa-image.direct-upload";

/* ===============================================================
   🛡️ BAĞIMSIZ SATILIK İLAN — FOTOĞRAF GALERİSİ (server-only, 108)
   ===============================================================
   Villa galerisiyle AYNI depolama deseni (direct-to-R2, imzalı PUT,
   WebP, aynı bucket) ama AYRI klasör ve AYRI tablo:
     key : sale-listings/<slug>__<ilan id ilk 8 hex>/<slug>-NNNN-xxxx.webp
     DB  : sale_listing_images (listing_id FK, ON DELETE CASCADE)
   Villa galerisine (villa_images) ve villa klasörlerine DOKUNMAZ.
   Yalnız source='standalone' ilanlar fotoğraf alır (villa kaynaklı ilan
   villanın kendi galerisini kullanır).
   Yetki kontrolü (oturum + "sale_listings") çağıran route'ta.
   =============================================================== */

export const SALE_IMAGE_FOLDER_PREFIX = "sale-listings";

type Fail = { ok: false; status: number; error: string };
const fail = (error: string, status = 400): Fail => ({ ok: false, status, error });

export type SaleListingImage = SaleListingImageRow & { url: string | null };

function shortIdOf(listingId: string): string {
  return String(listingId || "").replace(/[^a-f0-9]/gi, "").slice(0, 8).toLowerCase();
}

function folderSlug(slug: string | null | undefined): string {
  const s = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "ilan";
}

/** Key yalnız bu ilanın klasöründe ve beklenen biçimde mi? (`.` ve `/`
 *  karakter sınıfında yok → path traversal mümkün değil.) */
export function isSaleImageKeyForListing(listingId: string, key: unknown): key is string {
  const shortId = shortIdOf(listingId);
  if (shortId.length !== 8 || typeof key !== "string") return false;
  const re = new RegExp(
    `^${SALE_IMAGE_FOLDER_PREFIX}/[a-z0-9-]+__${shortId}/[a-z0-9-]+-\\d{4}-[0-9a-f]{4}\\.webp$`
  );
  return re.test(key);
}

export function buildSaleImageKey(
  listing: { id: string; slug: string | null },
  sequence: number
): string {
  const folder = `${SALE_IMAGE_FOLDER_PREFIX}/${folderSlug(listing.slug)}__${shortIdOf(listing.id)}`;
  return `${folder}/${buildVillaImageFilename(folderSlug(listing.slug), sequence, "webp")}`;
}

async function loadStandalone(
  listingId: string
): Promise<{ ok: true; listing: { id: string; source: string; slug: string | null } } | Fail> {
  if (!isUuid(listingId)) return fail("Geçersiz ilan", 400);
  const { data, error } = await saleListingRepository.findById(listingId);
  if (error) {
    console.error("[saleImage] listing read FAILED", { code: error.code ?? null, message: error.message });
    return fail("İlan okunamadı", 500);
  }
  const row = data as unknown as { id: string; source: string; slug: string | null } | null;
  if (!row) return fail("İlan bulunamadı", 404);
  if (row.source !== "standalone") {
    return fail("Mevcut villadan oluşturulan ilanlar villanın kendi galerisini kullanır", 409);
  }
  return { ok: true, listing: row };
}

async function readImages(listingId: string): Promise<SaleListingImageRow[] | Fail> {
  const { data, error } = await saleListingRepository.findImages(listingId);
  if (error) {
    console.error("[saleImage] images read FAILED", { code: error.code ?? null, message: error.message });
    return fail("Fotoğraflar okunamadı", 500);
  }
  return (data || []) as SaleListingImageRow[];
}

function withUrls(rows: SaleListingImageRow[]): SaleListingImage[] {
  return rows.map((r) => ({ ...r, url: resolveVillaImageUrl(r.image_url) }));
}

export async function listSaleListingImages(
  listingId: string
): Promise<{ ok: true; images: SaleListingImage[] } | Fail> {
  const l = await loadStandalone(listingId);
  if (!l.ok) return l;
  const rows = await readImages(listingId);
  if (!Array.isArray(rows)) return rows;
  return { ok: true, images: withUrls(rows) };
}

export async function createSaleImageUploadTicket(
  listingId: string,
  input: { size: unknown; contentType: unknown }
): Promise<
  | { ok: true; uploadUrl: string; key: string; contentType: string; expiresIn: number }
  | Fail
> {
  if (input.contentType !== GALLERY_UPLOAD_CONTENT_TYPE) return fail("Geçersiz dosya tipi", 400);
  const size = Number(input.size);
  if (!Number.isInteger(size) || size <= 0) return fail("Geçersiz dosya boyutu", 400);
  if (size > GALLERY_UPLOAD_MAX_BYTES) return fail("Dosya çok büyük", 413);

  const l = await loadStandalone(listingId);
  if (!l.ok) return l;
  const rows = await readImages(listingId);
  if (!Array.isArray(rows)) return rows;

  const key = buildSaleImageKey(l.listing, nextGallerySequenceFromUrls(rows.map((r) => r.image_url)));
  try {
    const uploadUrl = await presignPutObject(VILLA_IMAGES_BUCKET, key, {
      contentType: GALLERY_UPLOAD_CONTENT_TYPE,
      contentLength: size,
      expiresIn: GALLERY_UPLOAD_URL_TTL_SECONDS,
    });
    return {
      ok: true,
      uploadUrl,
      key,
      contentType: GALLERY_UPLOAD_CONTENT_TYPE,
      expiresIn: GALLERY_UPLOAD_URL_TTL_SECONDS,
    };
  } catch (err) {
    console.error("[saleImage] presign FAILED", err instanceof Error ? err.message : err);
    return fail("Yükleme adresi oluşturulamadı", 500);
  }
}

/** R2'ye yüklenen nesneyi doğrular ve kaydeder. Doğrulama veya kayıt
 *  başarısızsa nesne SUNUCUDA silinir (orphan kalmaz). */
export async function registerSaleListingImage(
  listingId: string,
  key: unknown
): Promise<{ ok: true; image: SaleListingImage } | Fail> {
  const l = await loadStandalone(listingId);
  if (!l.ok) return l;
  if (!isSaleImageKeyForListing(listingId, key)) return fail("Dosya bu ilana ait değil", 400);

  const cleanup = async () => {
    try {
      await removeServer(VILLA_IMAGES_BUCKET, [key]);
    } catch (err) {
      console.error("[saleImage] cleanup FAILED", err instanceof Error ? err.message : err);
    }
  };

  let info: Awaited<ReturnType<typeof headObjectInfo>>;
  try {
    info = await headObjectInfo(VILLA_IMAGES_BUCKET, key);
  } catch (err) {
    console.error("[saleImage] head FAILED", err instanceof Error ? err.message : err);
    return fail("Yüklenen dosya doğrulanamadı", 502);
  }
  if (!info) return fail("Yüklenen dosya bulunamadı", 400);
  if (
    info.contentLength <= 0 ||
    info.contentLength > GALLERY_UPLOAD_MAX_BYTES ||
    (info.contentType && info.contentType !== GALLERY_UPLOAD_CONTENT_TYPE)
  ) {
    await cleanup();
    return fail("Yüklenen dosya geçersiz", 400);
  }

  const rows = await readImages(listingId);
  if (!Array.isArray(rows)) {
    await cleanup();
    return rows;
  }
  const nextOrder = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1) + 1;
  const { data, error } = await saleListingRepository.insertImage({
    listing_id: listingId,
    image_url: key,
    sort_order: nextOrder,
    is_cover: !rows.some((r) => r.is_cover),
  });
  if (error || !data) {
    console.error("[saleImage] insert FAILED", { code: error?.code ?? null, message: error?.message });
    await cleanup();
    return fail("Fotoğraf kaydedilemedi", 500);
  }
  return { ok: true, image: withUrls([data as SaleListingImageRow])[0] };
}

export async function deleteSaleListingImage(
  listingId: string,
  imageId: string
): Promise<{ ok: true } | Fail> {
  if (!isUuid(imageId)) return fail("Geçersiz fotoğraf", 400);
  const l = await loadStandalone(listingId);
  if (!l.ok) return l;
  const rows = await readImages(listingId);
  if (!Array.isArray(rows)) return rows;
  const target = rows.find((r) => r.id === imageId);
  if (!target) return fail("Fotoğraf bulunamadı", 404);

  const { error } = await saleListingRepository.deleteImage(listingId, imageId);
  if (error) {
    console.error("[saleImage] delete FAILED", { code: error.code ?? null, message: error.message });
    return fail("Fotoğraf silinemedi", 500);
  }
  /* Kapak silindiyse sıradaki ilk fotoğraf kapak olur. */
  if (target.is_cover) {
    const next = rows.filter((r) => r.id !== imageId).sort((a, b) => a.sort_order - b.sort_order)[0];
    if (next) await saleListingRepository.updateImage(listingId, next.id, { is_cover: true });
  }
  try {
    await removeServer(VILLA_IMAGES_BUCKET, [target.image_url]);
  } catch (err) {
    console.error("[saleImage] R2 remove FAILED", err instanceof Error ? err.message : err);
  }
  return { ok: true };
}

export async function setSaleListingCover(
  listingId: string,
  imageId: string
): Promise<{ ok: true } | Fail> {
  if (!isUuid(imageId)) return fail("Geçersiz fotoğraf", 400);
  const l = await loadStandalone(listingId);
  if (!l.ok) return l;
  const rows = await readImages(listingId);
  if (!Array.isArray(rows)) return rows;
  if (!rows.some((r) => r.id === imageId)) return fail("Fotoğraf bulunamadı", 404);
  const clear = await saleListingRepository.clearCover(listingId);
  if (clear.error) return fail("Kapak güncellenemedi", 500);
  const set = await saleListingRepository.updateImage(listingId, imageId, { is_cover: true });
  if (set.error) return fail("Kapak güncellenemedi", 500);
  return { ok: true };
}

/** Sıralama: gönderilen id listesi ilanın fotoğraflarıyla BİREBİR aynı
 *  küme olmalı (eksik/fazla/yabancı id reddedilir). */
export async function reorderSaleListingImages(
  listingId: string,
  orderedIds: unknown
): Promise<{ ok: true } | Fail> {
  if (!Array.isArray(orderedIds) || !orderedIds.every((x) => isUuid(x))) {
    return fail("Geçersiz sıralama", 400);
  }
  const l = await loadStandalone(listingId);
  if (!l.ok) return l;
  const rows = await readImages(listingId);
  if (!Array.isArray(rows)) return rows;
  const ids = orderedIds as string[];
  const current = new Set(rows.map((r) => r.id));
  if (ids.length !== rows.length || new Set(ids).size !== ids.length || !ids.every((id) => current.has(id))) {
    return fail("Sıralama listesi fotoğraflarla eşleşmiyor", 400);
  }
  for (let i = 0; i < ids.length; i++) {
    const { error } = await saleListingRepository.updateImage(listingId, ids[i], { sort_order: i });
    if (error) return fail("Sıralama kaydedilemedi", 500);
  }
  return { ok: true };
}
