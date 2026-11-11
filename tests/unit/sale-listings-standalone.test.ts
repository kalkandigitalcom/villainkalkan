/* ===============================================================
   🛡️ SATILIK İLANLAR — BAĞIMSIZ GAYRİMENKUL (migration 108)
   ===============================================================
   Senaryolar (talep listesindeki numaralarla):
     1) Mevcut villadan ilan (id ≠ villa_id; çeviri ilan id'sine bağlı)
     2) Bağımsız gayrimenkul oluşturma / güncelleme / silme
     3) Bağımsız ilana fotoğraf yükleme / silme / kapak / sıralama
     4) Çevirilerin kaydı ve görüntülenmesi (TR başlık dahil)
     5) İki ilan türü aynı public listede (+ filtre)
     6) İki türün detay sayfası (slug çözümleme önceliği)
     7) İki türün admin önizlemesi (yükleyici preview modu)
     8) Yayın durumları (taslak / kaldırılmış public'e sızmaz)
     9) Slug ve SEO (sitemap, canonical)
    10) Kiralık sistem izolasyonu (kaynak kilitleri)
    11) Migration 108: mevcut ilanlar korunur (SQL kilitleri; gerçek
        PostgreSQL provası raporda)
    12) Yetki ve güvenlik (401 / 403, yabancı dosya anahtarı)
   DB'siz, deterministik; repository / storage mock'lu.
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  repo: {
    findAllForAdmin: vi.fn(),
    findById: vi.fn(),
    findByVillaId: vi.fn(),
    insert: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
    findVillaContext: vi.fn(),
    findSaleVillaOptions: vi.fn(),
    findAllVillaIds: vi.fn(),
    findListingIdBySlug: vi.fn(),
    findVillaIdBySlug: vi.fn(),
    findLocationOptions: vi.fn(),
    findFeatureOptions: vi.fn(),
    findFeatureIds: vi.fn(),
    findFeaturesByIds: vi.fn(),
    deleteFeatures: vi.fn(),
    insertFeatures: vi.fn(),
    findImages: vi.fn(),
    insertImage: vi.fn(),
    deleteImage: vi.fn(),
    clearCover: vi.fn(),
    updateImage: vi.fn(),
    findPublishedPublicCards: vi.fn(),
    findPublishedSitemapRows: vi.fn(),
    findSaleVillaIdBySlug: vi.fn(),
    findListingIdByVillaId: vi.fn(),
    findStandaloneIdBySlug: vi.fn(),
  },
  trRepo: { findOne: vi.fn(), upsertOne: vi.fn() },
  villaRepo: { findById: vi.fn() },
  removeServer: vi.fn(),
  presign: vi.fn(),
  head: vi.fn(),
  authorizeAdminCaller: vi.fn(),
  callerHasPermission: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db/sale-listing.repository.server", () => ({ saleListingRepository: h.repo }));
vi.mock("@/lib/db/translation.repository.server", () => ({ translationRepository: h.trRepo }));
vi.mock("@/lib/db/villa.repository.server", () => ({ villaAdminRepository: h.villaRepo }));
vi.mock("@/lib/storage/server", () => ({ removeServer: (...a: unknown[]) => h.removeServer(...a) }));
vi.mock("@/lib/storage/s3-storage.provider", () => ({
  presignPutObject: (...a: unknown[]) => h.presign(...a),
  headObjectInfo: (...a: unknown[]) => h.head(...a),
}));
vi.mock("@/lib/storage.helpers", () => ({
  resolveVillaImageUrl: (u: string | null) => (u ? `https://cdn.test/${u}` : null),
  resolveAssetUrlVersioned: () => null,
}));
vi.mock("@/app/services/villa-image/villa-image.read", () => ({
  getVillaImages: async () => [{ image_url: "villas/v.webp" }],
}));
vi.mock("@/app/services/villa-distance.service", () => ({
  getVillaDistances: async () => [{ id: "d1", title: "Plaj", distance: "1 km" }],
}));
vi.mock("@/app/services/villa-feature.service", () => ({
  getVillaFeaturesByVilla: async () => [{ id: "fv", name: "Villa pool" }],
}));
vi.mock("@/lib/i18n/get-translation.server", () => ({
  getTranslationsForParents: async (_e: string, _ids: string[], locale: string) =>
    locale === "tr"
      ? new Map([["66666666-6666-6666-6666-666666666666", { name: "Sonsuzluk havuzu" }]])
      : new Map(),
  resolveTranslatedField: (t: string | null | undefined, p: unknown) =>
    typeof t === "string" && t.trim() ? t : p,
}));
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: async () => ({ site_name: "Villa In Kalkan", whatsapp_link: "https://wa.me/905550000000", phone: "+90 242 000 00 00" }),
}));
vi.mock("@/lib/admin-route-auth", () => ({
  authorizeAdminCaller: (...a: unknown[]) => h.authorizeAdminCaller(...a),
}));
vi.mock("@/lib/auth/action-authz", () => ({
  callerHasPermission: (...a: unknown[]) => h.callerHasPermission(...a),
  FORBIDDEN_MESSAGE: "Bu işlem için yetkiniz yok",
}));
vi.mock("@/app/services/admin-activity-log.service", () => ({
  insertAdminActivityLog: (...a: unknown[]) => h.audit(...a),
  extractAdminContextFromRequest: () => ({ admin_user_id: "admin-1" }),
}));

import {
  createSaleListing,
  deleteSaleListing,
  getSaleListing,
  updateSaleListing,
} from "@/app/services/sale-listing.service";
import {
  buildSaleImageKey,
  createSaleImageUploadTicket,
  deleteSaleListingImage,
  isSaleImageKeyForListing,
  registerSaleListingImage,
  reorderSaleListingImages,
  setSaleListingCover,
} from "@/app/services/sale-listing-image.service";
import { loadSaleVillaDetail } from "@/app/services/sale-villa-detail.service";
import {
  findPublicSaleListingIdsBySlug,
  listPublicSaleCards,
  listPublicSaleSitemapRows,
} from "@/app/services/sale-listing-public.service";
import {
  filterSaleCards,
  parseSaleArchiveParams,
} from "@/lib/sale-listing-public.helper";
import {
  isPublicSaleListingVisible,
  normalizeSaleSlug,
  validateStandalonePropertyInput,
} from "@/lib/sale-listing.helper";
import { POST as createPOST } from "@/app/api/admin/sale-listings/route";
import { GET as formOptionsGET } from "@/app/api/admin/sale-listings/form-options/route";
import {
  GET as imagesGET,
  PATCH as imagesPATCH,
  POST as imagesPOST,
} from "@/app/api/admin/sale-listings/[id]/images/route";
import { POST as uploadUrlPOST } from "@/app/api/admin/sale-listings/[id]/images/upload-url/route";
import { DELETE as imageDELETE } from "@/app/api/admin/sale-listings/[id]/images/[imageId]/route";

const V = "22222222-2222-2222-2222-222222222222"; // villa
const LV = "44444444-4444-4444-4444-444444444444"; // villa kaynaklı ilan
const LS = "abcdef12-3456-4789-8abc-def012345678"; // bağımsız ilan
const LOC = "55555555-5555-5555-5555-555555555555";
const F1 = "66666666-6666-6666-6666-666666666666";
const F2 = "77777777-7777-7777-7777-777777777777";
const IMG1 = "88888888-8888-8888-8888-888888888888";
const IMG2 = "99999999-9999-9999-9999-999999999999";

const villaListing = (over: Record<string, unknown> = {}) => ({
  id: LV,
  villa_id: V,
  source: "villa",
  title: null,
  slug: null,
  location_id: null,
  bedrooms: null,
  latitude: null,
  longitude: null,
  sale_price: 450000,
  sale_currency: "EUR",
  price_on_request: false,
  sale_status: "available",
  property_type: "villa",
  publication_status: "published",
  is_published: true,
  published_at: "2026-11-01T00:00:00Z",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-02T00:00:00Z",
  sale_sort_order: 0,
  villa: { id: V, title: "Villa Azure", slug: "villa-azure", is_active: true, deleted_at: null, listed_for_rent: true, listed_for_sale: true },
  ...over,
});

const standaloneListing = (over: Record<string, unknown> = {}) => ({
  id: LS,
  villa_id: null,
  source: "standalone",
  title: "Sea View Plot",
  slug: "sea-view-plot",
  location_id: LOC,
  bedrooms: 3,
  bathrooms: 2,
  latitude: "36.265400",
  longitude: "29.412600",
  sale_price: 300000,
  sale_currency: "GBP",
  price_on_request: false,
  sale_status: "available",
  property_type: "detached_house",
  sale_description: "Detached house with sea view.",
  seo_title: null,
  seo_description: null,
  publication_status: "draft",
  is_published: false,
  published_at: null,
  created_at: "2026-11-03T00:00:00Z",
  updated_at: "2026-11-04T00:00:00Z",
  sale_sort_order: 0,
  villa: null,
  location: { id: LOC, name: "Kalkan" },
  ...over,
});

const standaloneInput = (over: Record<string, unknown> = {}) => ({
  source: "standalone",
  property: {
    title: "Deniz Manzaralı Müstakil Ev",
    location_id: LOC,
    latitude: "36.2654",
    longitude: "29.4126",
    feature_ids: [F1, F2, F1],
    ...over,
  },
  listing: { sale_price: "300000", sale_currency: "GBP", property_type: "detached_house", bedrooms: "3" },
  translation_tr: { title: "Deniz manzaralı müstakil ev", sale_description: "Türkçe açıklama" },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const fn of Object.values(h.repo)) fn.mockResolvedValue({ data: null, error: null });
  h.repo.insert.mockImplementation(async (p: Record<string, unknown>) => ({
    data: { id: p.source === "standalone" ? LS : LV, ...p, created_at: "x", updated_at: "x" },
    error: null,
  }));
  h.repo.updateById.mockImplementation(async (id: string, p: Record<string, unknown>) => ({
    data: { ...standaloneListing(), id, ...p },
    error: null,
  }));
  h.repo.findFeatureIds.mockResolvedValue({ data: [], error: null });
  h.repo.findImages.mockResolvedValue({ data: [], error: null });
  h.repo.findVillaContext.mockResolvedValue({
    data: { id: V, title: "Villa Azure", slug: "villa-azure", is_active: true, deleted_at: null, listed_for_rent: true, listed_for_sale: true },
    error: null,
  });
  h.trRepo.findOne.mockResolvedValue({ data: null, error: null });
  h.trRepo.upsertOne.mockImplementation(async (_e: string, id: string, locale: string, f: Record<string, unknown>) => ({
    data: { id: "t1", listing_id: id, locale, ...f },
    error: null,
  }));
  h.villaRepo.findById.mockResolvedValue({
    id: V, title: "Villa Azure", slug: "villa-azure", is_active: true, deleted_at: null, listed_for_sale: true,
    bedrooms: 4, bathrooms: 3, map_type: "coords", latitude: 36.2, longitude: 29.4, map_embed: null, location: { name: "Kalkan" },
  });
  h.presign.mockResolvedValue("https://r2.test/signed");
  h.head.mockResolvedValue({ contentLength: 1000, contentType: "image/webp" });
  h.removeServer.mockResolvedValue({ ok: true });
  h.authorizeAdminCaller.mockResolvedValue({ ok: true, caller: { id: "admin-1" } });
  h.callerHasPermission.mockResolvedValue(true);
  h.audit.mockResolvedValue({ ok: true });
});

/* ================================================================ 1 */
describe("1) mevcut villadan ilan", () => {
  it("villa_id dolu, source=villa; çeviri ilan id'sine (≠ villa id) bağlı, başlık çevirisi yok", async () => {
    const r = await createSaleListing({
      villa_id: V,
      listing: { sale_price: 1 },
      translation_tr: { title: "yok sayılır", sale_description: "TR" },
    });
    expect(r.ok).toBe(true);
    expect(h.repo.insert.mock.calls[0][0]).toMatchObject({ source: "villa", villa_id: V });
    expect(h.repo.insert.mock.calls[0][0]).not.toHaveProperty("slug");
    expect(h.trRepo.upsertOne).toHaveBeenCalledWith("villa_sale_listing", LV, "tr", expect.objectContaining({ title: null, sale_description: "TR" }));
    expect(h.repo.insertFeatures).not.toHaveBeenCalled();
  });
  it("villa kaynaklı ilan fotoğraf almaz (villanın kendi galerisi) → 409", async () => {
    h.repo.findById.mockResolvedValue({ data: villaListing(), error: null });
    expect(await createSaleImageUploadTicket(LV, { size: 10, contentType: "image/webp" })).toMatchObject({ ok: false, status: 409 });
    expect(h.presign).not.toHaveBeenCalled();
  });
});

/* ================================================================ 2 */
describe("2) bağımsız gayrimenkul — oluştur / güncelle / sil", () => {
  it("villa tablosu hiç okunmaz/yazılmaz; slug başlıktan; olanaklar tekilleştirilir; TR başlık kaydedilir", async () => {
    const r = await createSaleListing(standaloneInput());
    expect(r.ok).toBe(true);
    const payload = h.repo.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      source: "standalone",
      villa_id: null,
      title: "Deniz Manzaralı Müstakil Ev",
      slug: "deniz-manzarali-mustakil-ev",
      location_id: LOC,
      bedrooms: 3,
      property_type: "detached_house",
      publication_status: "draft",
      is_published: false,
    });
    expect(h.repo.findVillaContext).not.toHaveBeenCalled();
    expect(h.repo.findVillaIdBySlug).toHaveBeenCalledWith("deniz-manzarali-mustakil-ev");
    expect(h.repo.insertFeatures).toHaveBeenCalledWith([
      { listing_id: LS, feature_id: F1 },
      { listing_id: LS, feature_id: F2 },
    ]);
    expect(h.trRepo.upsertOne).toHaveBeenCalledWith("villa_sale_listing", LS, "tr", {
      title: "Deniz manzaralı müstakil ev",
      sale_description: "Türkçe açıklama",
      seo_title: null,
      seo_description: null,
    });
    expect(r.ok && r.feature_ids).toEqual([F1, F2]);
  });

  it("enlem / boylam: gönderilse bile yok sayılır; oluşturma ve güncelleme bu alanlara bağımlı değil", async () => {
    const r = await createSaleListing(standaloneInput({ latitude: "abc", longitude: "999" }));
    expect(r.ok).toBe(true);
    const payload = h.repo.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("latitude");
    expect(payload).not.toHaveProperty("longitude");
    const v = validateStandalonePropertyInput({ title: "X", latitude: "36.1" });
    expect(v.ok && Object.keys(v.value).sort()).toEqual(["feature_ids", "location_id", "slug", "title"]);

    /* Güncelleme: mevcut DB koordinatlarına YAZILMAZ (kolon değeri korunur). */
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
    await updateSaleListing(LS, { property: { title: "Sea View Plot", slug: "sea-view-plot" }, listing: { sale_price: 1 } });
    const upd = h.repo.updateById.mock.calls[0][1];
    expect(upd).not.toHaveProperty("latitude");
    expect(upd).not.toHaveProperty("longitude");
  });

  it("slug çakışması: başka ilan veya HERHANGİ bir villa → 409, kayıt yok", async () => {
    h.repo.findListingIdBySlug.mockResolvedValueOnce({ data: { id: "other" }, error: null });
    expect(await createSaleListing(standaloneInput())).toMatchObject({ ok: false, status: 409 });
    h.repo.findVillaIdBySlug.mockResolvedValueOnce({ data: { id: V }, error: null });
    expect(await createSaleListing(standaloneInput())).toMatchObject({
      ok: false,
      status: 409,
      error: expect.stringContaining("villa kaydında"),
    });
    expect(h.repo.insert).not.toHaveBeenCalled();
  });

  it.each([
    [{ title: "" }, "Başlık zorunludur"],
    [{ location_id: "x" }, "Geçersiz bölge"],
    [{ feature_ids: ["nope"] }, "Geçersiz özellik"],
    [{ title: "!!!", slug: "" }, "slug"],
  ])("geçersiz bağımsız ilan girdisi reddedilir %#", async (over, msg) => {
    const r = await createSaleListing(standaloneInput(over));
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.error).toContain(msg);
    expect(h.repo.insert).not.toHaveBeenCalled();
  });

  it("geçersiz kaynak → 400; source verilmezse geriye uyumlu villa akışı", async () => {
    expect(await createSaleListing({ source: "airbnb", listing: {} })).toMatchObject({ ok: false, status: 400 });
    expect(await createSaleListing({ listing: {} })).toMatchObject({ ok: false, error: "Bağlı villa seçilmedi" });
  });

  it("güncelle: alanlar + olanaklar değişir; aynı slug tekrar kontrol edilmez; yeni slug kontrol edilir", async () => {
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
    const same = await updateSaleListing(LS, {
      property: { title: "Sea View Plot", slug: "sea-view-plot", location_id: LOC, feature_ids: [F2] },
      listing: { sale_price: 1, publication_status: "published" },
    });
    expect(same.ok).toBe(true);
    expect(h.repo.findListingIdBySlug).not.toHaveBeenCalled();
    expect(h.repo.updateById.mock.calls[0][0]).toBe(LS);
    expect(h.repo.updateById.mock.calls[0][1]).toMatchObject({ title: "Sea View Plot", is_published: true, publication_status: "published" });
    expect(h.repo.deleteFeatures).toHaveBeenCalledWith(LS);
    expect(h.repo.insertFeatures).toHaveBeenCalledWith([{ listing_id: LS, feature_id: F2 }]);
    /* Yayına alma bağımsız ilanda villa kontrolü GEREKTİRMEZ. */
    expect(h.repo.findVillaContext).not.toHaveBeenCalled();

    await updateSaleListing(LS, { property: { title: "New Name", slug: "New Name!" }, listing: {} });
    expect(h.repo.findListingIdBySlug).toHaveBeenCalledWith("new-name");
  });

  it("güncelle: property gönderilmezse bağımsız alanlar ve olanaklar korunur", async () => {
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
    await updateSaleListing(LS, { listing: { sale_price: 2 } });
    expect(h.repo.updateById.mock.calls[0][1]).not.toHaveProperty("title");
    expect(h.repo.deleteFeatures).not.toHaveBeenCalled();
  });

  it("villa kaynaklı ilanda `property` yok sayılır (villa alanları değişmez)", async () => {
    h.repo.findById.mockResolvedValue({ data: villaListing(), error: null });
    await updateSaleListing(LV, { property: { title: "Hack", slug: "hack" }, listing: { sale_price: 2 } });
    expect(h.repo.updateById.mock.calls[0][1]).not.toHaveProperty("title");
    expect(h.repo.updateById.mock.calls[0][1]).not.toHaveProperty("slug");
  });

  it("sil: ilan satırı + R2 fotoğrafları; villa ilanında R2 temizliği yok", async () => {
    h.repo.findById.mockResolvedValueOnce({ data: standaloneListing(), error: null });
    h.repo.findImages.mockResolvedValueOnce({
      data: [
        { id: IMG1, listing_id: LS, image_url: "sale-listings/a.webp", sort_order: 0, is_cover: true },
        { id: IMG2, listing_id: LS, image_url: "sale-listings/b.webp", sort_order: 1, is_cover: false },
      ],
      error: null,
    });
    expect((await deleteSaleListing(LS)).ok).toBe(true);
    expect(h.repo.deleteById).toHaveBeenCalledWith(LS);
    expect(h.removeServer).toHaveBeenCalledWith(expect.any(String), ["sale-listings/a.webp", "sale-listings/b.webp"]);

    h.removeServer.mockClear();
    h.repo.findById.mockResolvedValueOnce({ data: villaListing(), error: null });
    expect((await deleteSaleListing(LV)).ok).toBe(true);
    expect(h.removeServer).not.toHaveBeenCalled();
  });

  it("get: bağımsız ilan olanak id'leriyle döner", async () => {
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
    h.repo.findFeatureIds.mockResolvedValue({ data: [{ feature_id: F1 }], error: null });
    const r = await getSaleListing(LS);
    expect(r.ok && r.feature_ids).toEqual([F1]);
    expect(r.ok && r.listing.source).toBe("standalone");
  });
});

/* ================================================================ 3 */
describe("3) bağımsız ilan fotoğrafları", () => {
  beforeEach(() => {
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
  });

  it("yükleme adresi: anahtar sunucuda, ilanın klasöründe; imzalı PUT", async () => {
    h.repo.findImages.mockResolvedValue({
      data: [{ id: IMG1, listing_id: LS, image_url: "sale-listings/sea-view-plot__abcdef12/sea-view-plot-0004-aaaa.webp", sort_order: 0, is_cover: true }],
      error: null,
    });
    const r = await createSaleImageUploadTicket(LS, { size: 5000, contentType: "image/webp" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.key).toMatch(/^sale-listings\/sea-view-plot__abcdef12\/sea-view-plot-0005-[0-9a-f]{4}\.webp$/);
    expect(isSaleImageKeyForListing(LS, r.key)).toBe(true);
    expect(h.presign).toHaveBeenCalledWith(expect.any(String), r.key, expect.objectContaining({ contentType: "image/webp", contentLength: 5000 }));
  });

  it("yükleme adresi: tip / boyut / ilan doğrulaması", async () => {
    expect(await createSaleImageUploadTicket(LS, { size: 10, contentType: "image/png" })).toMatchObject({ status: 400 });
    expect(await createSaleImageUploadTicket(LS, { size: 0, contentType: "image/webp" })).toMatchObject({ status: 400 });
    expect(await createSaleImageUploadTicket(LS, { size: 50 * 1024 * 1024, contentType: "image/webp" })).toMatchObject({ status: 413 });
    expect(await createSaleImageUploadTicket("not-uuid", { size: 10, contentType: "image/webp" })).toMatchObject({ status: 400 });
    h.repo.findById.mockResolvedValue({ data: null, error: null });
    expect(await createSaleImageUploadTicket(LS, { size: 10, contentType: "image/webp" })).toMatchObject({ status: 404 });
  });

  it("kayıt: ilk fotoğraf kapak; başka ilanın / villanın anahtarı reddedilir", async () => {
    const key = buildSaleImageKey({ id: LS, slug: "sea-view-plot" }, 1);
    h.repo.insertImage.mockImplementation(async (p: Record<string, unknown>) => ({ data: { id: IMG1, created_at: "x", ...p }, error: null }));
    const r = await registerSaleListingImage(LS, key);
    expect(r.ok).toBe(true);
    expect(h.repo.insertImage).toHaveBeenCalledWith({ listing_id: LS, image_url: key, sort_order: 0, is_cover: true });

    const foreign = buildSaleImageKey({ id: LV, slug: "x" }, 1);
    expect(await registerSaleListingImage(LS, foreign)).toMatchObject({ ok: false, status: 400 });
    expect(await registerSaleListingImage(LS, "villas/villa-azure__22222222/villa-azure-0001-abcd.webp")).toMatchObject({ status: 400 });
    expect(await registerSaleListingImage(LS, "sale-listings/../../etc/passwd")).toMatchObject({ status: 400 });
  });

  it("kayıt: R2'de olmayan / geçersiz nesne → kayıt yok, geçersiz nesne silinir; DB hatası → nesne silinir", async () => {
    const key = buildSaleImageKey({ id: LS, slug: "sea-view-plot" }, 2);
    h.head.mockResolvedValueOnce(null);
    expect(await registerSaleListingImage(LS, key)).toMatchObject({ ok: false, status: 400 });
    h.head.mockResolvedValueOnce({ contentLength: 10, contentType: "text/html" });
    expect(await registerSaleListingImage(LS, key)).toMatchObject({ ok: false });
    expect(h.removeServer).toHaveBeenCalledWith(expect.any(String), [key]);
    expect(h.repo.insertImage).not.toHaveBeenCalled();
    h.removeServer.mockClear();
    h.repo.insertImage.mockResolvedValueOnce({ data: null, error: { message: "dup", code: "23505" } });
    expect(await registerSaleListingImage(LS, key)).toMatchObject({ ok: false, status: 500 });
    expect(h.removeServer).toHaveBeenCalledWith(expect.any(String), [key]);
  });

  it("silme: yalnız bu ilanın fotoğrafı; kapak silinince sıradaki kapak olur; R2'den silinir", async () => {
    h.repo.findImages.mockResolvedValue({
      data: [
        { id: IMG1, listing_id: LS, image_url: "sale-listings/a.webp", sort_order: 0, is_cover: true },
        { id: IMG2, listing_id: LS, image_url: "sale-listings/b.webp", sort_order: 1, is_cover: false },
      ],
      error: null,
    });
    expect(await deleteSaleListingImage(LS, "33333333-3333-3333-3333-333333333333")).toMatchObject({ status: 404 });
    expect(h.repo.deleteImage).not.toHaveBeenCalled();
    expect((await deleteSaleListingImage(LS, IMG1)).ok).toBe(true);
    expect(h.repo.deleteImage).toHaveBeenCalledWith(LS, IMG1);
    expect(h.repo.updateImage).toHaveBeenCalledWith(LS, IMG2, { is_cover: true });
    expect(h.removeServer).toHaveBeenCalledWith(expect.any(String), ["sale-listings/a.webp"]);
  });

  it("kapak ve sıralama: küme birebir aynı olmalı", async () => {
    h.repo.findImages.mockResolvedValue({
      data: [
        { id: IMG1, listing_id: LS, image_url: "a", sort_order: 0, is_cover: true },
        { id: IMG2, listing_id: LS, image_url: "b", sort_order: 1, is_cover: false },
      ],
      error: null,
    });
    expect((await setSaleListingCover(LS, IMG2)).ok).toBe(true);
    expect(h.repo.clearCover).toHaveBeenCalledWith(LS);
    expect(h.repo.updateImage).toHaveBeenCalledWith(LS, IMG2, { is_cover: true });
    expect(await reorderSaleListingImages(LS, [IMG2])).toMatchObject({ status: 400 });
    expect(await reorderSaleListingImages(LS, [IMG2, IMG2])).toMatchObject({ status: 400 });
    expect((await reorderSaleListingImages(LS, [IMG2, IMG1])).ok).toBe(true);
    expect(h.repo.updateImage).toHaveBeenCalledWith(LS, IMG2, { sort_order: 0 });
    expect(h.repo.updateImage).toHaveBeenCalledWith(LS, IMG1, { sort_order: 1 });
  });
});

/* ================================================================ 4 + 7 */
describe("4/7) çeviriler ve önizleme yükleyicisi (iki kaynak)", () => {
  it("bağımsız: kendi başlığı/bölgesi/fotoğrafları/olanakları; harita/konum yok; villa tablosu okunmaz", async () => {
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
    h.repo.findImages.mockResolvedValue({
      data: [
        { id: IMG2, listing_id: LS, image_url: "sale-listings/b.webp", sort_order: 0, is_cover: false },
        { id: IMG1, listing_id: LS, image_url: "sale-listings/a.webp", sort_order: 1, is_cover: true },
      ],
      error: null,
    });
    h.repo.findFeatureIds.mockResolvedValue({ data: [{ feature_id: F1 }], error: null });
    h.repo.findFeaturesByIds.mockResolvedValue({ data: [{ id: F1, name: "Infinity pool" }], error: null });
    const d = await loadSaleVillaDetail(LS, { locale: "en", mode: "preview" });
    expect(d).toMatchObject({
      listingId: LS,
      source: "standalone",
      title: "Sea View Plot",
      slug: "sea-view-plot",
      locationName: "Kalkan",
      imageUrls: ["https://cdn.test/sale-listings/a.webp", "https://cdn.test/sale-listings/b.webp"],
      siteWhatsappLink: "https://wa.me/905550000000",
      sitePhone: "+90 242 000 00 00",
    });
    expect(d?.listing).toMatchObject({ bedrooms: 3, bathrooms: 2, propertyType: "detached_house" });
    expect(d?.features).toEqual([{ id: F1, displayName: "Infinity pool" }]);
    /* DB'de eski koordinat olsa bile harita / konum üretilmez. */
    expect(d).not.toHaveProperty("map");
    expect(d).not.toHaveProperty("distances");
    expect(h.villaRepo.findById).not.toHaveBeenCalled();
  });

  it("bağımsız TR: başlık + açıklama çeviriden, boşsa İngilizce; olanak çevrilir", async () => {
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
    h.repo.findFeatureIds.mockResolvedValue({ data: [{ feature_id: F1 }], error: null });
    h.repo.findFeaturesByIds.mockResolvedValue({ data: [{ id: F1, name: "Infinity pool" }], error: null });
    h.trRepo.findOne.mockResolvedValue({ data: { title: "Deniz Manzaralı Arsa", sale_description: "" }, error: null });
    const tr = await loadSaleVillaDetail(LS, { locale: "tr", mode: "preview" });
    expect(tr?.title).toBe("Deniz Manzaralı Arsa");
    expect(tr?.listing.description).toBe("Detached house with sea view.");
    expect(tr?.features[0].displayName).toBe("Sonsuzluk havuzu");
    expect(h.trRepo.findOne).toHaveBeenCalledWith("villa_sale_listing", LS, "tr");
  });

  it("villa kaynaklı: villa başlığı/galerisi; harita/mesafe okunmaz; ilan yatak odası boşsa villa değeri", async () => {
    h.repo.findById.mockResolvedValue({ data: villaListing(), error: null });
    const d = await loadSaleVillaDetail(LV, { locale: "en", mode: "public" });
    expect(d).toMatchObject({ listingId: LV, source: "villa", title: "Villa Azure", slug: "villa-azure" });
    expect(d?.listing.bedrooms).toBe(4);
    expect(d?.imageUrls).toEqual(["https://cdn.test/villas/v.webp"]);
    expect(d).not.toHaveProperty("distances");
    expect(d).not.toHaveProperty("map");
    h.repo.findById.mockResolvedValue({ data: villaListing({ bedrooms: 6 }), error: null });
    expect((await loadSaleVillaDetail(LV, { locale: "en", mode: "public" }))?.listing.bedrooms).toBe(6);
  });

  it("8) taslak bağımsız ilan: önizlemede açılır, public'te ASLA", async () => {
    h.repo.findById.mockResolvedValue({ data: standaloneListing({ publication_status: "draft", is_published: false }), error: null });
    expect(await loadSaleVillaDetail(LS, { locale: "en", mode: "preview" })).not.toBeNull();
    expect(await loadSaleVillaDetail(LS, { locale: "en", mode: "public" })).toBeNull();
    h.repo.findById.mockResolvedValue({ data: standaloneListing({ publication_status: "unpublished", is_published: false }), error: null });
    expect(await loadSaleVillaDetail(LS, { locale: "en", mode: "public" })).toBeNull();
    h.repo.findById.mockResolvedValue({ data: standaloneListing({ publication_status: "published", is_published: true }), error: null });
    expect(await loadSaleVillaDetail(LS, { locale: "en", mode: "public" })).not.toBeNull();
  });
});

/* ================================================================ 5 + 6 + 8 + 9 */
const standaloneCardRow = (over: Record<string, unknown> = {}) => ({
  ...standaloneListing({ publication_status: "published", is_published: true }),
  location: { name: "Kaş" },
  location_id: LOC,
  sale_listing_images: [{ image_url: "sale-listings/a.webp", is_cover: true, sort_order: 0 }],
  ...over,
});
const villaCardRow = (over: Record<string, unknown> = {}) => ({
  ...villaListing(),
  villa: {
    id: V, title: "Villa Azure", slug: "villa-azure", is_active: true, deleted_at: null, listed_for_sale: true,
    location_id: "11111111-1111-1111-1111-111111111111", bedrooms: 4, bathrooms: 3, location: { name: "Kalkan" },
    villa_images: [{ image_url: "villas/v.webp", is_cover: true, sort_order: 0 }],
  },
  ...over,
});

describe("5) iki tür aynı public listede", () => {
  it("villa + bağımsız kartlar; taslak bağımsız elenir; bölge filtresi bağımsız ilanda da çalışır", async () => {
    h.repo.findPublishedPublicCards.mockResolvedValue({
      data: [
        villaCardRow(),
        standaloneCardRow(),
        standaloneCardRow({ id: "draft", slug: "draft-x", publication_status: "draft", is_published: false }),
      ],
      error: null,
    });
    const cards = await listPublicSaleCards();
    expect(cards.map((c) => [c.source, c.slug])).toEqual([
      ["villa", "villa-azure"],
      ["standalone", "sea-view-plot"],
    ]);
    const s = cards[1];
    expect(s).toMatchObject({
      listingId: LS,
      title: "Sea View Plot",
      locationId: LOC,
      locationName: "Kaş",
      coverImage: "https://cdn.test/sale-listings/a.webp",
      bedrooms: 3,
      bathrooms: 2,
      propertyType: "detached_house",
    });
    const f = parseSaleArchiveParams({ bolge: LOC });
    expect(filterSaleCards(cards, f, { EUR: 40, GBP: 50 }).map((c) => c.listingId)).toEqual([LS]);
    expect(filterSaleCards(cards, parseSaleArchiveParams({ tip: "detached_house" }), {}).map((c) => c.source)).toEqual(["standalone"]);
  });

  it("aynı slug iki kaynakta (beklenmeyen) → villa kaynaklı kart tutulur", async () => {
    h.repo.findPublishedPublicCards.mockResolvedValue({
      data: [standaloneCardRow({ slug: "villa-azure" }), villaCardRow()],
      error: null,
    });
    expect((await listPublicSaleCards()).map((c) => c.source)).toEqual(["villa"]);
  });
});

describe("6) detay: slug çözümleme önceliği", () => {
  it("villa slug'ı → villa ilanı önce; bağımsız slug → bağımsız ilan; ikisi yoksa boş", async () => {
    h.repo.findSaleVillaIdBySlug.mockResolvedValueOnce({ data: { id: V }, error: null });
    h.repo.findListingIdByVillaId.mockResolvedValueOnce({ data: { id: LV }, error: null });
    expect(await findPublicSaleListingIdsBySlug("villa-azure")).toEqual([LV]);

    h.repo.findStandaloneIdBySlug.mockResolvedValueOnce({ data: { id: LS }, error: null });
    expect(await findPublicSaleListingIdsBySlug("sea-view-plot")).toEqual([LS]);
    expect(h.repo.findStandaloneIdBySlug).toHaveBeenCalledWith("sea-view-plot");

    expect(await findPublicSaleListingIdsBySlug("nope")).toEqual([]);
    expect(await findPublicSaleListingIdsBySlug("")).toEqual([]);
    expect(await findPublicSaleListingIdsBySlug("x".repeat(201))).toEqual([]);
  });
});

describe("8) yayın durumu kuralı (bağımsız ilan)", () => {
  it("yalnız published + is_published + slug; villa bayrakları aranmaz", () => {
    const base = { source: "standalone", slug: "s" };
    expect(isPublicSaleListingVisible({ ...base, is_published: true, publication_status: "published" }, null)).toBe(true);
    expect(isPublicSaleListingVisible({ ...base, is_published: false, publication_status: "draft" }, null)).toBe(false);
    expect(isPublicSaleListingVisible({ ...base, is_published: true, publication_status: "draft" }, null)).toBe(false);
    expect(isPublicSaleListingVisible({ ...base, slug: null, is_published: true, publication_status: "published" }, null)).toBe(false);
    /* villa kaynağında villa yoksa → görünmez (değişmedi) */
    expect(isPublicSaleListingVisible({ source: "villa", is_published: true, publication_status: "published" }, null)).toBe(false);
  });
});

describe("9) slug ve SEO", () => {
  it("slug normalizasyonu Türkçe karakter + biçim (DB CHECK ile aynı)", () => {
    expect(normalizeSaleSlug("Kalkan'da Şık Çatı Katı — 3+1")).toBe("kalkan-da-sik-cati-kati-3-1");
    expect(normalizeSaleSlug("x".repeat(200))).toHaveLength(120);
    const v = validateStandalonePropertyInput({ title: "Villa", slug: "  Özel URL  " });
    expect(v.ok && v.value.slug).toBe("ozel-url");
  });

  it("sitemap: yayındaki bağımsız ilan kendi slug'ıyla; taslak / slug'sız yok", async () => {
    h.repo.findPublishedSitemapRows.mockResolvedValue({
      data: [
        { source: "villa", is_published: true, publication_status: "published", published_at: "p", updated_at: "u1", villa: { slug: "villa-azure", is_active: true, deleted_at: null, listed_for_sale: true } },
        { source: "standalone", slug: "sea-view-plot", is_published: true, publication_status: "published", published_at: "p", updated_at: "u2", villa: null },
        { source: "standalone", slug: "draft-x", is_published: false, publication_status: "draft", published_at: null, updated_at: "u3", villa: null },
      ],
      error: null,
    });
    expect(await listPublicSaleSitemapRows()).toEqual([
      { slug: "villa-azure", lastModified: "u1" },
      { slug: "sea-view-plot", lastModified: "u2" },
    ]);
  });
});

/* ================================================================ 10 + 11 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf-8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--") && !l.trim().startsWith("//"))
    .join("\n");

describe("10) kiralık sistem izolasyonu", () => {
  it("satılık repository `villa` tablosuna YAZMAZ; yazma hedefleri yalnız satılık tabloları", () => {
    const src = code("lib/db/sale-listing.repository.server.ts");
    const targets = [...src.matchAll(/\.from(?:<[^>]*>)?\("([a-z_]+)"\)\s*\.(insert|update|delete)\(/g)].map((m) => m[1]);
    expect(new Set(targets)).toEqual(new Set(["villa_sale_listings", "sale_listing_features", "sale_listing_images"]));
  });

  it("kiralık liste / arama / rezervasyon / kısa fırsat kodu satılık tablolarını okumaz", () => {
    for (const p of [
      "lib/db/villa-visibility.ts",
      "lib/db/villa.repository.server.ts",
      "lib/cache.helpers.ts",
      "app/services/reservation/_helpers/rental-listing-verify.ts",
    ]) {
      expect(code(p), p).not.toMatch(/villa_sale_listings|sale_listing_images|sale_listing_features/);
    }
  });

  it("108 migration'ı villa / kiralık tablolarını DEĞİŞTİRMEZ", () => {
    const up = code("db/migrations/108_sale_listings_standalone.sql").replace(/COMMENT ON[\s\S]*?;/g, "");
    expect(up).not.toMatch(/ALTER TABLE public\.villa\b(?!_)/);
    expect(up).not.toMatch(/villa_prices|reservations|villa_images|villa_feature_relations|external_calendar|short_gaps/);
    expect(up).not.toMatch(/INSERT INTO public\.villa\b|DELETE FROM/);
  });
});

describe("11) migration 108 — mevcut ilanlar korunur", () => {
  const up = code("db/migrations/108_sale_listings_standalone.sql");
  const down = code("db/rollback/108_sale_listings_standalone.down.sql");

  it("yeni PK id; mevcut satırlar gen_random_uuid ile; villa_id NULL olabilir + UNIQUE; villa FK aynen", () => {
    expect(up).toContain("ADD COLUMN IF NOT EXISTS id          uuid    NOT NULL DEFAULT gen_random_uuid()");
    expect(up).toContain("ADD CONSTRAINT villa_sale_listings_pkey PRIMARY KEY (id)");
    expect(up).toContain("ADD CONSTRAINT villa_sale_listings_villa_id_key UNIQUE (villa_id)");
    expect(up).toContain("ALTER COLUMN villa_id DROP NOT NULL");
    expect(up).not.toMatch(/DROP CONSTRAINT[^;]*villa_sale_listings_villa_id_fkey/);
    expect(up).toContain("ADD COLUMN IF NOT EXISTS source      text    NOT NULL DEFAULT 'villa'");
  });

  it("çeviriler villa_id → listing_id eşlenir; eşlenemeyen satır varsa migration durur", () => {
    expect(up).toMatch(/SET listing_id = l\.id\s+FROM public\.villa_sale_listings l\s+WHERE t\.listing_id IS NULL\s+AND l\.villa_id = t\.villa_id/);
    expect(up).toContain("RAISE EXCEPTION '108: eşlenemeyen satılık ilan çevirisi var");
    expect(up).toContain("FOREIGN KEY (listing_id) REFERENCES public.villa_sale_listings (id) ON DELETE CASCADE");
    expect(up).toContain("UNIQUE (listing_id, locale)");
  });

  it("kaynak tutarlılığı CHECK + slug biçimi + tekil slug + silme davranışları", () => {
    expect(up).toContain("CHECK (source IN ('villa', 'standalone'))");
    expect(up).toMatch(/source = 'standalone'\s+AND villa_id IS NULL\s+AND title IS NOT NULL/);
    expect(up).toMatch(/source = 'villa'\s+AND villa_id IS NOT NULL/);
    expect(up).toContain("CREATE UNIQUE INDEX IF NOT EXISTS villa_sale_listings_slug_unique");
    expect(up).toContain("REFERENCES public.villa_locations (id) ON DELETE SET NULL");
    expect(up).toMatch(/sale_listing_images[\s\S]*?REFERENCES public\.villa_sale_listings \(id\) ON DELETE CASCADE/);
    expect(up).toMatch(/sale_listing_features[\s\S]*?REFERENCES public\.villa_features \(id\) ON DELETE CASCADE/);
    expect(up).toContain("CREATE UNIQUE INDEX IF NOT EXISTS sale_listing_images_one_cover");
    expect(up).not.toMatch(/POLICY|GRANT/i);
  });

  it("geri alma: bağımsız ilan varsa DURUR; aksi halde villa_id PK'ye döner", () => {
    expect(down).toContain("RAISE EXCEPTION '108 rollback: bağımsız satılık ilan mevcut");
    expect(down).toContain("ADD CONSTRAINT villa_sale_listings_pkey PRIMARY KEY (villa_id)");
    expect(down).toMatch(/SET villa_id = l\.villa_id/);
  });
});

/* ================================================================ 12 */
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const ictx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("12) yetki ve güvenlik", () => {
  const calls = () => [
    formOptionsGET(req("/api/admin/sale-listings/form-options")),
    imagesGET(req(`/api/admin/sale-listings/${LS}/images`), ictx(LS)),
    imagesPOST(req(`/api/admin/sale-listings/${LS}/images`, { method: "POST", body: JSON.stringify({ key: "k" }) }), ictx(LS)),
    imagesPATCH(req(`/api/admin/sale-listings/${LS}/images`, { method: "PATCH", body: JSON.stringify({ coverId: IMG1 }) }), ictx(LS)),
    uploadUrlPOST(req(`/api/admin/sale-listings/${LS}/images/upload-url`, { method: "POST", body: JSON.stringify({ size: 1, contentType: "image/webp" }) }), ictx(LS)),
    imageDELETE(req(`/api/admin/sale-listings/${LS}/images/${IMG1}`, { method: "DELETE" }), { params: Promise.resolve({ id: LS, imageId: IMG1 }) }),
    createPOST(req("/api/admin/sale-listings", { method: "POST", body: JSON.stringify(standaloneInput()) })),
  ];

  it("oturumsuz → 401; hiçbir DB / depolama işlemi yok", async () => {
    h.authorizeAdminCaller.mockResolvedValue({ ok: false, error: "Yetkisiz", status: 401 });
    expect((await Promise.all(calls())).map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
    for (const fn of Object.values(h.repo)) expect(fn).not.toHaveBeenCalled();
    expect(h.presign).not.toHaveBeenCalled();
    expect(h.removeServer).not.toHaveBeenCalled();
  });

  it("'sale_listings' izni yok → 403 (\"villas\" izni yeterli DEĞİL)", async () => {
    h.callerHasPermission.mockImplementation(async (_id: string, key: string) => key === "villas");
    expect((await Promise.all(calls())).map((r) => r.status)).toEqual([403, 403, 403, 403, 403, 403, 403]);
    for (const fn of Object.values(h.repo)) expect(fn).not.toHaveBeenCalled();
  });

  it("izinli: bağımsız ilan oluşturma audit'i ilan id'si ile; fotoğraf ekleme/silme audit'li", async () => {
    const res = await createPOST(req("/api/admin/sale-listings", { method: "POST", body: JSON.stringify(standaloneInput()) }));
    expect(res.status).toBe(200);
    expect((await res.json()).listing.id).toBe(LS);
    expect(h.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "sale_listing.created", entity_id: LS, entity_title: "Deniz Manzaralı Müstakil Ev" })
    );
    h.repo.findById.mockResolvedValue({ data: standaloneListing(), error: null });
    h.repo.insertImage.mockImplementation(async (p: Record<string, unknown>) => ({ data: { id: IMG1, created_at: "x", ...p }, error: null }));
    const key = buildSaleImageKey({ id: LS, slug: "sea-view-plot" }, 1);
    const up = await imagesPOST(req(`/api/admin/sale-listings/${LS}/images`, { method: "POST", body: JSON.stringify({ key }) }), ictx(LS));
    expect(up.status).toBe(200);
    expect(h.audit).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ action: "sale_listing.image_added", entity_id: LS }));
  });

  it("geçersiz gövde → 400; PATCH bilinmeyen işlem → 400", async () => {
    expect((await imagesPOST(req(`/api/admin/sale-listings/${LS}/images`, { method: "POST", body: "{x" }), ictx(LS))).status).toBe(400);
    expect((await imagesPATCH(req(`/api/admin/sale-listings/${LS}/images`, { method: "PATCH", body: "{}" }), ictx(LS))).status).toBe(400);
  });
});
