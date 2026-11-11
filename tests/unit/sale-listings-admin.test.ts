/* ===============================================================
   🛡️ SATILIK İLANLAR — ADMIN MODÜLÜ TESTLERİ
   ===============================================================
   1) Saf yardımcılar: ilan türü ↔ bayraklar, girdi doğrulama (beyaz
      liste), çeviri doğrulama.
   2) Servis CRUD (repository + çeviri repository mock'lu).
   3) API yetkilendirme (401 / 403 / izinli) + audit.
   4) Villa ilan türü: payload, servis spread, "sadece satılık" geçiş
      kapısı ve /full route.
   5) Kiralık sistem koruması (kaynak kilitleri) + migration 106/107.
   Gerçek PostgreSQL üzerinde ayrıca uçtan uca CRUD provası yapıldı
   (rapor); burada DB'siz, deterministik sözleşmeler.
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------- mock'lar ---------------- */
const { repo, trRepo } = vi.hoisted(() => ({
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
    findFeatureIds: vi.fn(),
    findImages: vi.fn(),
  },
  trRepo: { findOne: vi.fn(), upsertOne: vi.fn() },
}));
vi.mock("@/lib/db/sale-listing.repository.server", () => ({ saleListingRepository: repo }));

vi.mock("@/lib/db/translation.repository.server", () => ({ translationRepository: trRepo }));
vi.mock("@/lib/storage/server", () => ({ removeServer: vi.fn() }));

const authorizeAdminCaller = vi.fn();
vi.mock("@/lib/admin-route-auth", () => ({
  authorizeAdminCaller: (...a: unknown[]) => authorizeAdminCaller(...a),
}));
const callerHasPermission = vi.fn();
vi.mock("@/lib/auth/action-authz", () => ({
  callerHasPermission: (...a: unknown[]) => callerHasPermission(...a),
  FORBIDDEN_MESSAGE: "Bu işlem için yetkiniz yok",
}));
const insertAdminActivityLog = vi.fn();
vi.mock("@/app/services/admin-activity-log.service", () => ({
  insertAdminActivityLog: (...a: unknown[]) => insertAdminActivityLog(...a),
  extractAdminContextFromRequest: () => ({ admin_user_id: "admin-1", admin_email: "a@a" }),
}));

const findRentalListingStatusById = vi.fn();
const insertVilla = vi.fn();
const updateVillaById = vi.fn();
vi.mock("@/lib/db/villa.repository.server", () => ({
  villaAdminRepository: {
    findRentalListingStatusById: (...a: unknown[]) => findRentalListingStatusById(...a),
    insertVilla: (...a: unknown[]) => insertVilla(...a),
    updateVillaById: (...a: unknown[]) => updateVillaById(...a),
  },
}));
const findUpcomingActiveIdForVilla = vi.fn();
vi.mock("@/lib/db/reservation.repository.server", () => ({
  reservationServerRepository: {
    findUpcomingActiveIdForVilla: (...a: unknown[]) => findUpcomingActiveIdForVilla(...a),
  },
}));
vi.mock("@/app/services/villa-admin/_helpers/slug", () => ({
  generateUniqueSlug: async () => "villa-slug",
}));
vi.mock("@/app/services/villa-admin/_helpers/relations", () => ({
  insertVillaTypeRelations: vi.fn(),
  insertVillaFeatureRelations: vi.fn(),
  insertVillaRuleRelations: vi.fn(),
  insertVillaPriceIncludeRelations: vi.fn(),
  replaceVillaTypeRelations: vi.fn(),
  replaceVillaFeatureRelations: vi.fn(),
  replaceVillaRuleRelations: vi.fn(),
  replaceVillaPriceIncludeRelations: vi.fn(),
}));
const setVillaPricesServer = vi.fn();
vi.mock("@/app/services/villa-price.service.server", () => ({
  setVillaPricesServer: (...a: unknown[]) => setVillaPricesServer(...a),
}));
vi.mock("@/app/services/villa-distance.service.server", () => ({
  setVillaDistancesServer: vi.fn(),
}));
const updateVillaFullMock = vi.fn();
vi.mock("@/app/services/villa-admin.service", () => ({
  updateVillaFull: (...a: unknown[]) => updateVillaFullMock(...a),
}));
vi.mock("@/lib/villas-cache-invalidation.server", () => ({ invalidateVillasCache: vi.fn() }));

import {
  listingFlagsFor,
  listingTypeFromFlags,
  validateSaleListingInput,
  validateSaleListingTranslationInput,
} from "@/lib/sale-listing.helper";
import {
  createSaleListing,
  deleteSaleListing,
  getSaleListing,
  listSaleVillaOptions,
  updateSaleListing,
} from "@/app/services/sale-listing.service";
import { GET as listGET, POST as createPOST } from "@/app/api/admin/sale-listings/route";
import {
  DELETE as itemDELETE,
  PUT as itemPUT,
} from "@/app/api/admin/sale-listings/[id]/route";
import { GET as optionsGET } from "@/app/api/admin/sale-listings/villa-options/route";
import { listingTypeColumns } from "@/app/services/villa-admin/_helpers/listing-type";
import {
  checkListingTypeChange,
  LISTING_TYPE_UPCOMING_RESERVATION_ERROR,
  LISTING_TYPE_CHECK_FAILED_ERROR,
} from "@/app/services/villa-admin/listing-type.service";
import { createVillaFull } from "@/app/services/villa-admin/create.service";
import { updateVillaFull } from "@/app/services/villa-admin/update.service";
import { PUT as villaFullPUT } from "@/app/api/admin/villas/[id]/full/route";
import {
  buildVillaCreatePayload,
  buildVillaUpdatePayload,
} from "@/app/(admin)/maki-admin/villas/_helpers/payload";
import { filterSaleListings } from "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingList";
import { buildSaleListingRequestBody, initialSaleFormState } from "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingForm";

const V_SALE = "22222222-2222-2222-2222-222222222222";
const V_RENT = "11111111-1111-1111-1111-111111111111";
const V_BOTH = "33333333-3333-3333-3333-333333333333";

const villaCtx = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: "Villa " + id.slice(0, 2),
  slug: "v",
  is_active: true,
  deleted_at: null,
  listed_for_rent: id !== V_SALE,
  listed_for_sale: id !== V_RENT,
  ...over,
});

/* Villa kaynaklı ilan (108: `id` + source). Bu dosyada sadelik için ilan
   id = villa id; id ≠ villa_id ayrımı sale-listings-standalone testinde. */
const listingRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  villa_id: id,
  source: "villa",
  reference_code: null,
  sale_price: 100000,
  sale_currency: "EUR",
  price_on_request: false,
  sale_status: "available",
  property_type: "villa",
  publication_status: "draft",
  is_published: false,
  published_at: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  villa: villaCtx(id),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  repo.findVillaContext.mockImplementation(async (id: string) => ({
    data: [V_SALE, V_RENT, V_BOTH].includes(id) ? villaCtx(id) : null,
    error: null,
  }));
  repo.findById.mockResolvedValue({ data: null, error: null });
  repo.findByVillaId.mockResolvedValue({ data: null, error: null });
  repo.insert.mockImplementation(async (p: Record<string, unknown>) => ({
    data: { id: p.villa_id ?? "99999999-9999-9999-9999-999999999999", ...p, created_at: "x", updated_at: "x" },
    error: null,
  }));
  repo.updateById.mockImplementation(async (id: string, p: Record<string, unknown>) => ({ data: { id, villa_id: id, source: "villa", ...p }, error: null }));
  repo.deleteById.mockResolvedValue({ error: null });
  repo.findFeatureIds.mockResolvedValue({ data: [], error: null });
  repo.findImages.mockResolvedValue({ data: [], error: null });
  trRepo.findOne.mockResolvedValue({ data: null, error: null });
  trRepo.upsertOne.mockImplementation(async (_e: string, id: string, locale: string, f: Record<string, unknown>) => ({
    data: { id: "t1", listing_id: id, locale, ...f },
    error: null,
  }));
  authorizeAdminCaller.mockResolvedValue({
    ok: true,
    caller: { id: "admin-1", authUserId: "au", email: "a@a", is_active: true },
  });
  callerHasPermission.mockResolvedValue(true);
  insertAdminActivityLog.mockResolvedValue({ ok: true });
  insertVilla.mockResolvedValue({ data: { id: "new-villa" }, error: null });
  updateVillaById.mockResolvedValue({ error: null });
  findRentalListingStatusById.mockResolvedValue({ data: { id: V_RENT, listed_for_rent: true, deleted_at: null }, error: null });
  findUpcomingActiveIdForVilla.mockResolvedValue({ data: [], error: null });
  updateVillaFullMock.mockResolvedValue(true);
});

/* ================================================================ 1 */
describe("ilan türü ↔ bayraklar", () => {
  it("üç seçenek doğru bayraklara dönüşür; ikisi birden false üretilemez", () => {
    expect(listingFlagsFor("rent")).toEqual({ listed_for_rent: true, listed_for_sale: false });
    expect(listingFlagsFor("sale")).toEqual({ listed_for_rent: false, listed_for_sale: true });
    expect(listingFlagsFor("both")).toEqual({ listed_for_rent: true, listed_for_sale: true });
  });
  it("DB satırından tür; alan yok → kiralık (geriye dönük)", () => {
    expect(listingTypeFromFlags({})).toBe("rent");
    expect(listingTypeFromFlags(null)).toBe("rent");
    expect(listingTypeFromFlags({ listed_for_rent: true, listed_for_sale: true })).toBe("both");
    expect(listingTypeFromFlags({ listed_for_rent: false, listed_for_sale: true })).toBe("sale");
  });
  it("listingTypeColumns: undefined → {} (eski çağıranlar etkilenmez), geçersiz → throw", () => {
    expect(listingTypeColumns(undefined)).toEqual({});
    expect(listingTypeColumns("both")).toEqual({ listed_for_rent: true, listed_for_sale: true });
    expect(() => listingTypeColumns("none")).toThrow("Geçersiz ilan türü");
  });
});

describe("validateSaleListingInput", () => {
  it("varsayılanlar + normalize (sayılar)", () => {
    const r = validateSaleListingInput({ sale_price: "450.000".replace(".", ""), bathrooms: "3" });
    expect(r.ok && r.value).toMatchObject({
      sale_price: 450000,
      bathrooms: 3,
      sale_currency: "EUR",
      publication_status: "draft",
      property_type: "villa",
      sale_status: "available",
    });
  });
  it("kaldırılan alanlar: referans kodu ve ilan bazlı WhatsApp/telefon gönderilse bile yazılmaz", () => {
    const r = validateSaleListingInput({
      sale_price: 1,
      reference_code: "VIK-1",
      agent_whatsapp: "+90 555 111 22 33",
      agent_phone: "+90 555 111 22 44",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const k of ["reference_code", "agent_whatsapp", "agent_phone"]) {
      expect(Object.keys(r.value)).not.toContain(k);
    }
    // Eski "geçersiz referans" doğrulaması da yok (alan tamamen yok sayılır).
    expect(validateSaleListingInput({ reference_code: "ab cd" }).ok).toBe(true);
  });
  it("beyaz liste: kiralık fiyat / villa alanları DÜŞÜRÜLÜR", () => {
    const r = validateSaleListingInput({
      sale_price: 1,
      villa_prices: [{ price: 1 }],
      price: 999,
      cleaning_fee: 50,
      listed_for_rent: false,
      is_published: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const k of ["villa_prices", "price", "cleaning_fee", "listed_for_rent", "is_published"]) {
      expect(Object.keys(r.value)).not.toContain(k);
    }
  });
  it.each([
    [{ sale_currency: "DEM" }, "Geçersiz para birimi"],
    [{ property_type: "castle" }, "Geçersiz gayrimenkul tipi"],
    [{ publication_status: "archived" }, "Geçersiz yayın durumu"],
    [{ bathrooms: "2.5" }, "Banyo sayısı tam sayı olmalı"],
    [{ year_built: 1700 }, "Yapım yılı 1800 ile 2200 arasında olmalı"],
    [{ sale_price: -1 }, "Satış fiyatı 0 ile"],
    [{ seo_title: "x".repeat(121) }, "SEO başlık 120"],
  ])("geçersiz girdi reddedilir %#", (input, msg) => {
    const r = validateSaleListingInput(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });
  it("yayın: fiyat yoksa ve 'fiyat sorunuz' değilse reddedilir", () => {
    expect(validateSaleListingInput({ publication_status: "published" }).ok).toBe(false);
    expect(validateSaleListingInput({ publication_status: "published", price_on_request: true }).ok).toBe(true);
    expect(validateSaleListingInput({ publication_status: "published", sale_price: 1 }).ok).toBe(true);
  });
  it("bahçe yoksa bahçe alanı yazılmaz", () => {
    const r = validateSaleListingInput({ has_garden: false, garden_area_m2: 200 });
    expect(r.ok && r.value.garden_area_m2).toBeNull();
  });
  it("Türkçe çeviri doğrulama: boş → null, uzun → hata", () => {
    const ok = validateSaleListingTranslationInput({ sale_description: "  ", seo_title: "Başlık" });
    expect(ok.ok && ok.value).toEqual({ title: null, sale_description: null, seo_title: "Başlık", seo_description: null });
    expect(validateSaleListingTranslationInput({ seo_description: "x".repeat(301) }).ok).toBe(false);
  });
});

/* ================================================================ 2 */
describe("servis — oluşturma", () => {
  it("kiralık-only villaya ilan bağlanamaz (409), yazma yok", async () => {
    const r = await createSaleListing({ villa_id: V_RENT, listing: {} });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(repo.insert).not.toHaveBeenCalled();
  });
  it("silinmiş / olmayan villa → 404; geçersiz id → 400", async () => {
    repo.findVillaContext.mockResolvedValueOnce({ data: villaCtx(V_SALE, { deleted_at: "2026-01-01" }), error: null });
    expect(await createSaleListing({ villa_id: V_SALE, listing: {} })).toMatchObject({ ok: false, status: 404 });
    expect(await createSaleListing({ villa_id: "x'; DROP TABLE villa;--", listing: {} })).toMatchObject({ ok: false, status: 400 });
    expect(repo.findVillaContext).toHaveBeenCalledTimes(1);
  });
  it("villa başına tek ilan → 409", async () => {
    repo.findByVillaId.mockResolvedValueOnce({ data: listingRow(V_SALE), error: null });
    expect(await createSaleListing({ villa_id: V_SALE, listing: {} })).toMatchObject({ ok: false, status: 409 });
    expect(repo.insert).not.toHaveBeenCalled();
  });
  it("satılık ve kiralık+satılık villalarda oluşturur; yalnız beyaz liste + yayın kolonları yazılır", async () => {
    for (const id of [V_SALE, V_BOTH]) {
      repo.insert.mockClear();
      const r = await createSaleListing({
        villa_id: id,
        listing: { sale_price: 5, publication_status: "published", cleaning_fee: 1 },
      });
      expect(r.ok).toBe(true);
      const payload = repo.insert.mock.calls[0][0];
      expect(payload.villa_id).toBe(id);
      expect(payload.is_published).toBe(true);
      expect(payload.publication_status).toBe("published");
      expect(typeof payload.published_at).toBe("string");
      expect(payload).not.toHaveProperty("cleaning_fee");
      expect(payload).not.toHaveProperty("listed_for_rent");
    }
  });
  it("Türkçe çeviri locale='tr' ile kaydedilir; boş çeviri satır oluşturmaz", async () => {
    await createSaleListing({ villa_id: V_SALE, listing: {}, translation_tr: { sale_description: "Satılık" } });
    expect(trRepo.upsertOne).toHaveBeenCalledWith("villa_sale_listing", V_SALE, "tr", {
      title: null,
      sale_description: "Satılık",
      seo_title: null,
      seo_description: null,
    });
    trRepo.upsertOne.mockClear();
    await createSaleListing({ villa_id: V_BOTH, listing: {}, translation_tr: { sale_description: "" } });
    expect(trRepo.upsertOne).not.toHaveBeenCalled();
  });
  it("DB unique ihlali (yarış) → 409", async () => {
    repo.insert.mockResolvedValueOnce({ data: null, error: { message: "dup", code: "23505" } });
    expect(await createSaleListing({ villa_id: V_SALE, listing: {} })).toMatchObject({ ok: false, status: 409 });
  });
});

describe("servis — okuma / güncelleme / silme", () => {
  it("get: ilan yok → 404; çeviri ile birlikte döner", async () => {
    expect(await getSaleListing(V_SALE)).toMatchObject({ ok: false, status: 404 });
    repo.findByVillaId.mockResolvedValueOnce({ data: listingRow(V_SALE), error: null });
    trRepo.findOne.mockResolvedValueOnce({ data: { sale_description: "TR", seo_title: null, seo_description: null }, error: null });
    const r = await getSaleListing(V_SALE);
    expect(r.ok && r.translation_tr).toEqual({ title: null, sale_description: "TR", seo_title: null, seo_description: null });
    expect(trRepo.findOne).toHaveBeenCalledWith("villa_sale_listing", V_SALE, "tr");
  });
  it("update: yayından kaldırma villa satılık olmasa da serbest; yayına alma satılık villa ister", async () => {
    repo.findByVillaId.mockResolvedValue({ data: listingRow(V_RENT, { publication_status: "published", is_published: true, published_at: "2026-10-01T00:00:00Z" }), error: null });
    const off = await updateSaleListing(V_RENT, { listing: { publication_status: "unpublished", sale_price: 1 } });
    expect(off.ok).toBe(true);
    const payload = repo.updateById.mock.calls[0][1];
    expect(payload).toMatchObject({ is_published: false, publication_status: "unpublished", published_at: "2026-10-01T00:00:00Z" });
    const on = await updateSaleListing(V_RENT, { listing: { publication_status: "published", sale_price: 1 } });
    expect(on).toMatchObject({ ok: false, status: 409 });
  });
  it("update: eski reference_code / agent_* kolonlarına YAZILMAZ (DB'deki mevcut değer korunur)", async () => {
    repo.findByVillaId.mockResolvedValue({ data: listingRow(V_SALE, { reference_code: "VIK-OLD" }), error: null });
    const r = await updateSaleListing(V_SALE, {
      listing: { sale_price: 3, reference_code: "NEW", agent_whatsapp: "+90 1", agent_phone: "+90 2" },
    });
    expect(r.ok).toBe(true);
    const payload = repo.updateById.mock.calls[0][1] as Record<string, unknown>;
    for (const k of ["reference_code", "agent_whatsapp", "agent_phone"]) {
      expect(payload).not.toHaveProperty(k);
    }
  });
  it("update: çeviri gönderilmezse çeviriye dokunulmaz; mevcut çeviri boşaltılabilir", async () => {
    repo.findByVillaId.mockResolvedValue({ data: listingRow(V_SALE), error: null });
    await updateSaleListing(V_SALE, { listing: { sale_price: 2 } });
    expect(trRepo.upsertOne).not.toHaveBeenCalled();
    trRepo.findOne.mockResolvedValue({ data: { sale_description: "Eski", seo_title: null, seo_description: null }, error: null });
    await updateSaleListing(V_SALE, { listing: { sale_price: 2 }, translation_tr: { sale_description: "" } });
    expect(trRepo.upsertOne).toHaveBeenCalledWith("villa_sale_listing", V_SALE, "tr", {
      title: null,
      sale_description: null,
      seo_title: null,
      seo_description: null,
    });
  });
  it("delete: yalnız ilan satırı silinir", async () => {
    expect(await deleteSaleListing(V_SALE)).toMatchObject({ ok: false, status: 404 });
    repo.findByVillaId.mockResolvedValueOnce({ data: listingRow(V_SALE), error: null });
    expect((await deleteSaleListing(V_SALE)).ok).toBe(true);
    expect(repo.deleteById).toHaveBeenCalledWith(V_SALE);
  });
  it("villa seçenekleri: ilanı olanlar düşer, includeId korunur", async () => {
    repo.findSaleVillaOptions.mockResolvedValue({ data: [villaCtx(V_SALE), villaCtx(V_BOTH)], error: null });
    repo.findAllVillaIds.mockResolvedValue({ data: [{ villa_id: V_SALE }], error: null });
    const a = await listSaleVillaOptions();
    expect(a.ok && a.villas.map((v) => v.id)).toEqual([V_BOTH]);
    const b = await listSaleVillaOptions(V_SALE);
    expect(b.ok && b.villas.map((v) => v.id)).toEqual([V_SALE, V_BOTH]);
  });
});

/* ================================================================ 3 */
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("API yetkilendirme", () => {
  const calls = () => [
    listGET(req("/api/admin/sale-listings")),
    createPOST(req("/api/admin/sale-listings", { method: "POST", body: JSON.stringify({ villa_id: V_SALE, listing: {} }) })),
    itemPUT(req(`/api/admin/sale-listings/${V_SALE}`, { method: "PUT", body: "{}" }), ctx(V_SALE)),
    itemDELETE(req(`/api/admin/sale-listings/${V_SALE}`, { method: "DELETE" }), ctx(V_SALE)),
    optionsGET(req("/api/admin/sale-listings/villa-options")),
  ];

  it("oturumsuz → 401, hiçbir DB işlemi yok", async () => {
    authorizeAdminCaller.mockResolvedValue({ ok: false, error: "Yetkisiz", status: 401 });
    const res = await Promise.all(calls());
    expect(res.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    for (const fn of Object.values(repo)) expect(fn).not.toHaveBeenCalled();
  });

  it("'sale_listings' izni yok → 403, hiçbir DB işlemi yok", async () => {
    callerHasPermission.mockResolvedValue(false);
    const res = await Promise.all(calls());
    expect(res.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect(callerHasPermission).toHaveBeenCalledWith("admin-1", "sale_listings");
    for (const fn of Object.values(repo)) expect(fn).not.toHaveBeenCalled();
  });

  it("izinli: oluştur → 200 + audit (sale_listing.created)", async () => {
    const res = await createPOST(
      req("/api/admin/sale-listings", { method: "POST", body: JSON.stringify({ villa_id: V_SALE, listing: { sale_price: 1 } }) })
    );
    expect(res.status).toBe(200);
    expect(insertAdminActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "sale_listing.created", entity_type: "sale_listing", entity_id: V_SALE })
    );
  });

  it("izinli: güncelle / sil → audit; başarısız işlemde audit YOK", async () => {
    const bad = await itemPUT(req(`/api/admin/sale-listings/${V_SALE}`, { method: "PUT", body: JSON.stringify({ listing: {} }) }), ctx(V_SALE));
    expect(bad.status).toBe(404);
    expect(insertAdminActivityLog).not.toHaveBeenCalled();
    repo.findByVillaId.mockResolvedValue({ data: listingRow(V_SALE), error: null });
    const ok = await itemPUT(req(`/api/admin/sale-listings/${V_SALE}`, { method: "PUT", body: JSON.stringify({ listing: { sale_price: 3 } }) }), ctx(V_SALE));
    expect(ok.status).toBe(200);
    const del = await itemDELETE(req(`/api/admin/sale-listings/${V_SALE}`, { method: "DELETE" }), ctx(V_SALE));
    expect(del.status).toBe(200);
    expect(insertAdminActivityLog.mock.calls.map((c) => c[1].action)).toEqual([
      "sale_listing.updated",
      "sale_listing.deleted",
    ]);
  });

  it("geçersiz JSON → 400", async () => {
    const res = await createPOST(req("/api/admin/sale-listings", { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
  });
});

/* ================================================================ 4 */
describe("villa ilan türü — servis ve route", () => {
  const base = { form: { title: "Villa X" }, mapData: { map_type: "coords" } };

  it("create: ilan türü yoksa bayrak kolonu GÖNDERİLMEZ (DB default = kiralık)", async () => {
    await createVillaFull(base as never);
    expect(insertVilla.mock.calls[0][0]).not.toHaveProperty("listed_for_rent");
    expect(insertVilla.mock.calls[0][0]).not.toHaveProperty("listed_for_sale");
  });
  it("create / update: seçilen tür bayraklara yazılır; kiralık fiyatlar AYNEN", async () => {
    await createVillaFull({ ...base, listingType: "sale" } as never);
    expect(insertVilla.mock.calls[0][0]).toMatchObject({ listed_for_rent: false, listed_for_sale: true });
    const prices = [{ start_date: "2027-01-01", end_date: "2027-01-31", price: 200, currency: "EUR" }];
    await updateVillaFull({ ...base, id: V_BOTH, listingType: "both", prices } as never);
    expect(updateVillaById.mock.calls[0][1]).toMatchObject({ listed_for_rent: true, listed_for_sale: true });
    expect(setVillaPricesServer).toHaveBeenCalledWith(V_BOTH, prices);
    updateVillaById.mockClear();
    await updateVillaFull({ ...base, id: V_BOTH } as never);
    expect(updateVillaById.mock.calls[0][1]).not.toHaveProperty("listed_for_rent");
  });
  it("geçersiz tür → hata, villa yazılmaz", async () => {
    await expect(createVillaFull({ ...base, listingType: "x" } as never)).rejects.toThrow("Geçersiz ilan türü");
    expect(insertVilla).not.toHaveBeenCalled();
  });

  it("'sadece satılık' geçiş kapısı", async () => {
    expect(await checkListingTypeChange(V_RENT, "rent")).toBeNull();
    expect(await checkListingTypeChange(V_RENT, "both")).toBeNull();
    expect(await checkListingTypeChange(V_RENT, undefined)).toBeNull();
    expect(findRentalListingStatusById).not.toHaveBeenCalled();

    expect(await checkListingTypeChange(V_RENT, "sale")).toBeNull();
    findUpcomingActiveIdForVilla.mockResolvedValueOnce({ data: [{ id: "r1" }], error: null });
    expect(await checkListingTypeChange(V_RENT, "sale")).toBe(LISTING_TYPE_UPCOMING_RESERVATION_ERROR);

    findRentalListingStatusById.mockResolvedValueOnce({ data: { id: V_SALE, listed_for_rent: false }, error: null });
    findUpcomingActiveIdForVilla.mockClear();
    expect(await checkListingTypeChange(V_SALE, "sale")).toBeNull();
    expect(findUpcomingActiveIdForVilla).not.toHaveBeenCalled();

    findRentalListingStatusById.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    expect(await checkListingTypeChange(V_RENT, "sale")).toBe(LISTING_TYPE_CHECK_FAILED_ERROR);
  });

  it("/api/admin/villas/[id]/full: aktif rezervasyonlu villa satılık-only yapılamaz (409, update yok)", async () => {
    findUpcomingActiveIdForVilla.mockResolvedValue({ data: [{ id: "r1" }], error: null });
    const put = (body: unknown) =>
      villaFullPUT(
        req(`/api/admin/villas/${V_RENT}/full`, { method: "PUT", body: JSON.stringify(body) }),
        { params: Promise.resolve({ id: V_RENT }) }
      );
    const res = await put({ ...base, listingType: "sale" });
    expect(res.status).toBe(409);
    expect(updateVillaFullMock).not.toHaveBeenCalled();
    const ok = await put({ ...base, listingType: "both" });
    expect(ok.status).toBe(200);
    expect(insertAdminActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "villa.listing_type_changed",
        before_data: { listing_type: "rent" },
        after_data: { listing_type: "both" },
      })
    );
    insertAdminActivityLog.mockClear();
    const legacy = await put(base);
    expect(insertAdminActivityLog).not.toHaveBeenCalled();
    expect(legacy.status).toBe(200);
    expect(updateVillaFullMock).toHaveBeenCalledTimes(2);
  });

  it("client payload: listingType verilmezse anahtar YOK (eski key-set), verilirse üst seviyede", () => {
    const common = {
      form: { title: "T" } as never,
      selectedLocation: "",
      selectedTypes: [],
      selectedFeatures: [],
      mapData: { map_type: "coords" } as never,
      distances: [],
      prices: [],
      selectedRules: [],
      selectedPriceIncludes: [],
      youtubeVideos: [],
    };
    expect(buildVillaCreatePayload(common)).not.toHaveProperty("listingType");
    expect(buildVillaCreatePayload({ ...common, listingType: "both" })).toMatchObject({ listingType: "both" });
    expect(buildVillaUpdatePayload({ ...common, id: "v", slug: "s" })).not.toHaveProperty("listingType");
    expect(buildVillaUpdatePayload({ ...common, id: "v", slug: "s", listingType: "sale" }).listingType).toBe("sale");
  });
});

/* ================================================================ 5 */
describe("admin liste / form saf yardımcıları", () => {
  const rows = [
    listingRow(V_SALE, { reference_code: "VIK-1", publication_status: "published", villa: villaCtx(V_SALE, { title: "Deniz Villası" }) }),
    listingRow(V_BOTH, { reference_code: "VIK-2", publication_status: "draft", villa: villaCtx(V_BOTH, { title: "Şelale Evi" }) }),
    listingRow(V_RENT, { reference_code: "OLD-9", publication_status: "unpublished", villa: villaCtx(V_RENT, { title: "Eski" }) }),
  ] as never[];
  it("durum filtresi + villa adı araması (TR-tolerant); referans kodu ile arama yok", () => {
    expect(filterSaleListings(rows, "all", "").length).toBe(3);
    expect(filterSaleListings(rows, "published", "").map((r) => r.villa_id)).toEqual([V_SALE]);
    expect(filterSaleListings(rows, "unpublished", "").map((r) => r.villa_id)).toEqual([V_RENT]);
    expect(filterSaleListings(rows, "all", "selale").map((r) => r.villa_id)).toEqual([V_BOTH]);
    expect(filterSaleListings(rows, "all", "deniz").map((r) => r.villa_id)).toEqual([V_SALE]);
    expect(filterSaleListings(rows, "all", "vik-1")).toEqual([]);
  });
  it("form gövdesi: EN canonical + translation_tr; villa_id yalnız oluşturmada", () => {
    const st = { ...initialSaleFormState(null), sale_description: "EN", tr_sale_description: "TR" };
    const create = buildSaleListingRequestBody(st, V_SALE) as Record<string, unknown>;
    expect(create.villa_id).toBe(V_SALE);
    expect((create.listing as Record<string, unknown>).sale_description).toBe("EN");
    expect(create.translation_tr).toEqual({ title: "", sale_description: "TR", seo_title: "", seo_description: "" });
    expect(buildSaleListingRequestBody(st)).not.toHaveProperty("villa_id");
  });
});

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf-8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--") && !l.trim().startsWith("//"))
    .join("\n");

describe("kiralık sistem koruması (kaynak kilitleri)", () => {
  it("satılık ilan repository/servisi kiralık fiyat, rezervasyon, takvim tablolarına erişmez", () => {
    for (const p of [
      "lib/db/sale-listing.repository.server.ts",
      "app/services/sale-listing.service.ts",
      "app/api/admin/sale-listings/route.ts",
      "app/api/admin/sale-listings/[id]/route.ts",
      "app/services/sale-listing-image.service.ts",
      "app/services/sale-villa-detail.service.ts",
      "app/services/sale-listing-public.service.ts",
      "app/api/admin/sale-listings/[id]/images/route.ts",
      "app/api/admin/sale-listings/[id]/images/upload-url/route.ts",
      "app/api/admin/sale-listings/[id]/images/[imageId]/route.ts",
    ]) {
      const src = code(p);
      expect(src, p).not.toMatch(/villa_prices|reservations|manual_reservations|external_calendar|villa_discounts|villa_short_gaps/);
    }
    const repoSrc = code("lib/db/sale-listing.repository.server.ts");
    const writeTargets = [...repoSrc.matchAll(/\.from\("([a-z_]+)"\)\s*\.(insert|update|delete)\(/g)].map((m) => m[1]);
    /* 108: yalnız satılık tablolarına yazar; `villa` (kiralık) tablosuna ASLA. */
    expect(new Set(writeTargets)).toEqual(
      new Set(["villa_sale_listings", "sale_listing_features", "sale_listing_images"])
    );
  });
  it("villa güncellemede satılık-only geçişi rezervasyonlara yalnız OKUMA yapar", () => {
    const src = code("lib/db/reservation.repository.server.ts");
    const m = src.slice(src.indexOf("async findUpcomingActiveIdForVilla"));
    const body = m.slice(0, m.indexOf("},") + 2);
    expect(body).toContain('.select("id")');
    expect(body).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });
  it("menü + izin haritası + kullanıcı izin kataloğu 'sale_listings' içerir", () => {
    expect(read("app/(admin)/maki-admin/layout.tsx")).toMatch(/href: "\/maki-admin\/sale-listings",[\s\S]*?permissionKey: "sale_listings"/);
    expect(read("lib/auth/admin-permission-map.ts")).toContain('{ href: "/maki-admin/sale-listings", need: "sale_listings" }');
    expect(read("app/services/admin-user.service.ts")).toContain('key: "sale_listings"');
  });
});

describe("migration 106 / 107", () => {
  const up = code("db/migrations/106_sale_listing_admin_fields.sql");
  it("eksik alanlar eklenir; yayın durumu is_published ile CHECK senkron", () => {
    for (const col of ["bathrooms", "property_type", "is_featured", "publication_status", "published_at"]) {
      expect(up).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`));
    }
    expect(up).toContain("CHECK (is_published = (publication_status = 'published'))");
    expect(up).toContain("CHECK (publication_status IN ('draft', 'published', 'unpublished'))");
  });
  it("yalnız villa_sale_listings'e dokunur; RLS/GRANT yok", () => {
    const tables = [...up.matchAll(/(?:ALTER TABLE|UPDATE|ON)\s+public\.([a-z_]+)/g)].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(["villa_sale_listings"]));
    expect(up).not.toMatch(/POLICY|GRANT|DELETE FROM|DROP TABLE/i);
  });
  it("107: yalnız 'villas' yetkili adminlere idempotent 'sale_listings' eklenir", () => {
    const g = code("db/migrations/107_admin_sale_listings_permission.sql");
    expect(g).toContain(`WHERE sidebar_permissions @> '["villas"]'::jsonb`);
    expect(g).toContain(`AND NOT (sidebar_permissions @> '["sale_listings"]'::jsonb)`);
    expect(code("db/rollback/107_admin_sale_listings_permission.down.sql")).toContain("- 'sale_listings'");
    expect(code("db/rollback/106_sale_listing_admin_fields.down.sql")).toContain("DROP COLUMN IF EXISTS publication_status");
  });
  it("105 (kısa süreli fırsatlar yalnız kiralık) korunuyor", () => {
    expect(code("db/migrations/105_short_gaps_rental_only.sql")).toMatch(/AND v\.listed_for_rent = true;/);
  });
});

/* ================================================================ 6
   🛡️ "İlan okunamadı" KÖK NEDEN KİLİDİ (2026-11)
   Production'da kod deploy edildi ama migration 106 uygulanmadı →
   `column "property_type" does not exist` (42703) her okumayı düşürüyordu
   ve admin yalnız genel "İlan okunamadı" görüyordu (yerel PG'de yeniden
   üretildi). Artık şema hatası ayrı ve açık raporlanır; sorgu kolonları
   migration'larla senkron kilitlenir.
================================================================ */
import {
  SALE_SCHEMA_OUTDATED_ERROR,
  listSaleListings,
} from "@/app/services/sale-listing.service";
import { GET as itemGET } from "@/app/api/admin/sale-listings/[id]/route";

describe("hata sınıflandırma — şema eksikliği vs. bulunamadı vs. yetki", () => {
  const undefinedColumn = { message: 'column "property_type" does not exist', code: "42703" };

  it("eksik kolon (migration 106 yok) → 503 + açık şema mesajı; güvenli log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    repo.findByVillaId.mockResolvedValueOnce({ data: null, error: undefinedColumn });
    const r = await getSaleListing(V_SALE);
    expect(r).toEqual({ ok: false, status: 503, error: SALE_SCHEMA_OUTDATED_ERROR });
    expect(spy).toHaveBeenCalledWith("[saleListing.get] FAILED", {
      code: "42703",
      message: 'column "property_type" does not exist',
      id: V_SALE,
    });
    repo.findAllForAdmin.mockResolvedValueOnce({ data: null, error: undefinedColumn });
    expect(await listSaleListings()).toMatchObject({ ok: false, status: 503 });
  });

  it("eksik tablo (42P01) da şema hatası sayılır", async () => {
    repo.findByVillaId.mockResolvedValueOnce({ data: null, error: { message: 'relation "x" does not exist', code: "42P01" } });
    expect(await getSaleListing(V_SALE)).toMatchObject({ status: 503 });
  });

  it("diğer DB hatası → 500 + hata kodu; çeviri hatası ayrı mesaj", async () => {
    repo.findByVillaId.mockResolvedValueOnce({ data: null, error: { message: "timeout", code: "57014" } });
    expect(await getSaleListing(V_SALE)).toEqual({
      ok: false,
      status: 500,
      error: "İlan okunamadı (DB hata kodu: 57014)",
    });
    repo.findByVillaId.mockResolvedValueOnce({ data: listingRow(V_SALE), error: null });
    trRepo.findOne.mockResolvedValueOnce({ data: null, error: { message: "x", code: "08006" } });
    expect(await getSaleListing(V_SALE)).toMatchObject({ status: 500, error: "Türkçe çeviri okunamadı (DB hata kodu: 08006)" });
  });

  it("route GET: 503 / 404 / 403 / 400 ayrı durum ve mesaj taşır", async () => {
    const get = (id: string) => itemGET(req(`/api/admin/sale-listings/${id}`), ctx(id));
    repo.findByVillaId.mockResolvedValueOnce({ data: null, error: undefinedColumn });
    const schema = await get(V_SALE);
    expect(schema.status).toBe(503);
    expect((await schema.json()).error).toBe(SALE_SCHEMA_OUTDATED_ERROR);

    const missing = await get(V_SALE);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toBe("İlan bulunamadı");

    expect((await get("not-a-uuid")).status).toBe(400);

    callerHasPermission.mockResolvedValueOnce(false);
    const forbidden = await get(V_SALE);
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error).toBe("Bu işlem için yetkiniz yok");
  });

  it("108: detay sayfası ve liste ilan kimliği (PK id) kullanır; eski villa id bağlantısı çözülür", async () => {
    const page = read("app/(admin)/maki-admin/sale-listings/[id]/page.tsx");
    expect(page).toContain("adminFetch(`/api/admin/sale-listings/${encodeURIComponent(id)}`)");
    expect(read("app/(admin)/maki-admin/sale-listings/_components/SaleListingList.tsx")).toContain(
      "href={`/maki-admin/sale-listings/${r.id}`}"
    );
    expect(code("db/migrations/108_sale_listings_standalone.sql")).toContain(
      "ADD CONSTRAINT villa_sale_listings_pkey PRIMARY KEY (id)"
    );
    /* Eski bağlantı (villa id): id ile bulunamaz → villa_id ile çözülür. */
    repo.findByVillaId.mockResolvedValueOnce({ data: listingRow(V_SALE), error: null });
    expect((await getSaleListing(V_SALE)).ok).toBe(true);
    expect(repo.findById).toHaveBeenCalledWith(V_SALE);
    expect(repo.findByVillaId).toHaveBeenCalledWith(V_SALE);
  });

  it("repository'nin okuduğu her kolon 104, 106 veya 108 migration'ında tanımlı (şema drift kilidi)", async () => {
    const { SALE_LISTING_COLUMNS } = await vi.importActual<
      typeof import("@/lib/db/sale-listing.repository.server")
    >("@/lib/db/sale-listing.repository.server");
    const cols = SALE_LISTING_COLUMNS.split(",").map((c) => c.trim()).filter(Boolean);
    const m104 = code("db/migrations/104_villa_sale_listings.sql");
    const t104 = m104.slice(
      m104.indexOf("CREATE TABLE IF NOT EXISTS public.villa_sale_listings ("),
      m104.indexOf("CREATE TABLE IF NOT EXISTS public.villa_sale_listing_translations")
    );
    const m106 = code("db/migrations/106_sale_listing_admin_fields.sql");
    const defined104 = new Set([...t104.matchAll(/^\s{2}([a-z_0-9]+)\s+(?:uuid|text|numeric|boolean|integer|timestamptz)/gm)].map((x) => x[1]));
    const defined106 = new Set([...m106.matchAll(/ADD COLUMN IF NOT EXISTS ([a-z_0-9]+)/g)].map((x) => x[1]));
    const m108 = code("db/migrations/108_sale_listings_standalone.sql");
    const t108 = m108.slice(0, m108.indexOf("ALTER TABLE public.villa_sale_listing_translations"));
    const defined108 = new Set([...t108.matchAll(/ADD COLUMN IF NOT EXISTS ([a-z_0-9]+)/g)].map((x) => x[1]));
    const missing = cols.filter((c) => !defined104.has(c) && !defined106.has(c) && !defined108.has(c));
    expect(missing).toEqual([]);
    /* 108 kolonları sorguda → 108 production ön koşulu. */
    expect(cols.filter((c) => defined108.has(c)).sort()).toEqual(
      ["bedrooms", "id", "location_id", "slug", "source", "title"]
    );
    /* 106 kolonları gerçekten sorguda → 106 production ön koşulu. */
    expect(cols.filter((c) => defined106.has(c)).sort()).toEqual(
      ["bathrooms", "is_featured", "property_type", "publication_status", "published_at"]
    );
  });
});
