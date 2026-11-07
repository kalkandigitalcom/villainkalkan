/* ===============================================================
   🛡️ SATILIK MODÜLÜ — SATILIK-ONLY MÜLKE REZERVASYON YOK (guard testleri)
   ===============================================================
   1) assertVillaAcceptsRentalBooking — birim davranışı.
   2) POST /api/public/reservations — DOĞRUDAN API isteği: satılık-only
      mülk reddedilir (400), fiyat hesaplanmaz, INSERT çağrılmaz;
      kiralık mülkte akış DEĞİŞMEDİ (200).
   3) Admin rezervasyon create / edit route'ları.
   4) Manuel blok server action'ları.
   5) /api/admin/villas seçim listesi (kiralık + includeId).
   Mevcut rezervasyon satırları hiçbir senaryoda güncellenmez/silinmez.
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ---------- ortak mock'lar ---------- */
const findRentalListingStatusById = vi.fn();
const findAdminSelectList = vi.fn();
vi.mock("@/lib/db/villa.repository.server", () => ({
  villaAdminRepository: {
    findRentalListingStatusById: (...a: unknown[]) => findRentalListingStatusById(...a),
    findAdminSelectList: (...a: unknown[]) => findAdminSelectList(...a),
  },
}));

const findVillaCleaningConfig = vi.fn();
const getVillaPrices = vi.fn();
const createReservation = vi.fn();
const updateReservationFull = vi.fn();
const verifyStay = vi.fn();
const reservationFindById = vi.fn();
const reservationUpdate = vi.fn();
const reservationDelete = vi.fn();

vi.mock("@/lib/db/reservation.repository", () => ({
  reservationRepository: {
    findVillaCleaningConfig: (...a: unknown[]) => findVillaCleaningConfig(...a),
  },
}));
vi.mock("@/app/services/villa-price.service", () => ({
  getVillaPrices: (...a: unknown[]) => getVillaPrices(...a),
}));
vi.mock("@/app/services/exchange-rate.service", () => ({
  getExchangeRatesMap: async () => ({ rates: { EUR: 40, TRY: 1, USD: 35, GBP: 47 }, updatedAt: null }),
}));
vi.mock("@/app/services/settings.service", () => ({
  getPublicSettings: async () => ({ prepayment_rate: 20 }),
}));
vi.mock("@/app/services/villa-discount.service", () => ({
  getVillaDiscounts: async () => [],
}));
vi.mock("@/app/services/reservation.service", () => ({
  createReservation: (...a: unknown[]) => createReservation(...a),
  updateReservationFull: (...a: unknown[]) => updateReservationFull(...a),
  updateReservationStatus: vi.fn(),
  getReservationById: vi.fn(),
  deleteReservationById: vi.fn(),
}));
vi.mock("@/lib/db/reservation.repository.server", () => ({
  reservationServerRepository: {
    insert: vi.fn(),
    findById: (...a: unknown[]) => reservationFindById(...a),
    updateById: (...a: unknown[]) => reservationUpdate(...a),
    deleteById: (...a: unknown[]) => reservationDelete(...a),
  },
}));
vi.mock("@/app/services/reservation/_helpers/stay-verify", () => ({
  verifyPublicReservationStayRules: (...a: unknown[]) => verifyStay(...a),
}));
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: async () => null }));

vi.mock("@/lib/admin-route-auth", () => ({
  authorizeAdminCaller: async () => ({
    ok: true,
    caller: { id: "admin-1", authUserId: "au-1", email: "a@a.com", is_active: true },
  }),
}));
vi.mock("@/lib/auth/action-authz", () => ({
  callerHasPermission: async () => true,
  requirePermission: async () => undefined,
  FORBIDDEN_MESSAGE: "Yetkiniz yok",
}));
vi.mock("@/lib/db/villa-discount.repository.server", () => ({
  villaDiscountRepository: { findDistinctVillaIdsWithDiscounts: vi.fn() },
}));
vi.mock("@/app/services/villa-admin.service", () => ({ createVillaFull: vi.fn() }));
vi.mock("@/lib/villas-cache-invalidation.server", () => ({ invalidateVillasCache: vi.fn() }));

const createManualService = vi.fn();
const updateManualService = vi.fn();
const manualFindById = vi.fn();
vi.mock("@/app/services/manualReservation.service", () => ({
  createManualReservation: (...a: unknown[]) => createManualService(...a),
  updateManualReservation: (...a: unknown[]) => updateManualService(...a),
  deleteManualReservation: vi.fn(),
  getVillaAvailabilitySnapshot: vi.fn(),
}));
vi.mock("@/lib/db/manual-reservation.repository.server", () => ({
  manualReservationServerRepository: {
    findById: (...a: unknown[]) => manualFindById(...a),
  },
}));

import {
  assertVillaAcceptsRentalBooking,
  SALE_ONLY_RESERVATION_ERROR,
  RENTAL_LISTING_CHECK_FAILED_ERROR,
} from "@/app/services/reservation/_helpers/rental-listing-verify";
import { POST as publicPOST } from "@/app/api/public/reservations/route";
import { POST as adminPOST } from "@/app/api/admin/reservations/route";
import { PATCH as adminPATCH } from "@/app/api/admin/reservations/[id]/route";
import { GET as adminVillasGET } from "@/app/api/admin/villas/route";
import {
  createManualReservationAction,
  updateManualReservationAction,
} from "@/app/(admin)/maki-admin/manual-reservations/manual-reservation.action";

type Json = Record<string, unknown>;

const STATUS: Record<string, { id: string; listed_for_rent: boolean; deleted_at: null }> = {
  rent: { id: "rent", listed_for_rent: true, deleted_at: null },
  both: { id: "both", listed_for_rent: true, deleted_at: null },
  sale: { id: "sale", listed_for_rent: false, deleted_at: null },
  sale2: { id: "sale2", listed_for_rent: false, deleted_at: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  findRentalListingStatusById.mockImplementation(async (id: string) => ({
    data: STATUS[id] ?? null,
    error: null,
  }));
  findVillaCleaningConfig.mockResolvedValue({
    data: {
      cleaning_fee: 0,
      cleaning_currency: "EUR",
      cleaning_limit: 0,
      custom_prepayment_rate: null,
      pool_heating_fee: null,
      pool_heating_currency: null,
      pool_heating_months: null,
      deposit: 0,
    },
    error: null,
  });
  getVillaPrices.mockResolvedValue([
    { start_date: "2027-06-01", end_date: "2027-06-30", price: 200, currency: "EUR" },
  ]);
  verifyStay.mockResolvedValue(undefined);
  createReservation.mockResolvedValue({ id: "r1", reservation_no: "TY-1" });
  updateReservationFull.mockResolvedValue(undefined);
  createManualService.mockResolvedValue({ id: "m1" });
  updateManualService.mockResolvedValue({ ok: true });
});

/* ---------------------------------------------------------------- 1 */
describe("assertVillaAcceptsRentalBooking", () => {
  it("kiralık ve kiralık+satılık → geçer", async () => {
    await expect(assertVillaAcceptsRentalBooking("rent")).resolves.toBeUndefined();
    await expect(assertVillaAcceptsRentalBooking("both")).resolves.toBeUndefined();
  });

  it("satılık-only → reddedilir", async () => {
    await expect(assertVillaAcceptsRentalBooking("sale")).rejects.toThrow(
      SALE_ONLY_RESERVATION_ERROR
    );
  });

  it("listed_for_rent NULL/yok → kiralık sayılır (geriye dönük uyum)", async () => {
    findRentalListingStatusById.mockResolvedValueOnce({
      data: { id: "x", listed_for_rent: null, deleted_at: null },
      error: null,
    });
    await expect(assertVillaAcceptsRentalBooking("x")).resolves.toBeUndefined();
  });

  it("villa bulunamadı / boş id → karar mevcut katmanlara bırakılır", async () => {
    await expect(assertVillaAcceptsRentalBooking("yok")).resolves.toBeUndefined();
    await expect(assertVillaAcceptsRentalBooking(undefined)).resolves.toBeUndefined();
    await expect(assertVillaAcceptsRentalBooking("")).resolves.toBeUndefined();
  });

  it("DB hatası → FAIL-CLOSED", async () => {
    findRentalListingStatusById.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(assertVillaAcceptsRentalBooking("rent")).rejects.toThrow(
      RENTAL_LISTING_CHECK_FAILED_ERROR
    );
    findRentalListingStatusById.mockRejectedValueOnce(new Error("conn"));
    await expect(assertVillaAcceptsRentalBooking("rent")).rejects.toThrow(
      RENTAL_LISTING_CHECK_FAILED_ERROR
    );
  });

  it("villa değişmiyorsa (currentVillaId === hedef) DB hiç okunmaz → geçer", async () => {
    await expect(
      assertVillaAcceptsRentalBooking("sale", { currentVillaId: "sale" })
    ).resolves.toBeUndefined();
    expect(findRentalListingStatusById).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- 2 */
function publicBody(villa_id: string): Json {
  return {
    villa_id,
    start_date: "2027-06-02",
    end_date: "2027-06-05",
    name: "Guard Test",
    phone: "+905551112233",
    phone2: "+905551112244",
    email: "t@example.test",
    guests: 2,
    total_price: 1,
    total_price_try: 1,
    prepayment_amount: 1,
    remaining_payment: 0,
    paid_amount: 0,
    payment_preference: "prepayment",
  };
}

async function postPublic(b: Json) {
  const res = await publicPOST(
    new Request("http://localhost/api/public/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(b),
    })
  );
  return { status: res.status, json: (await res.json()) as Json };
}

describe("POST /api/public/reservations — doğrudan API isteği", () => {
  it("satılık-only mülk → 400, fiyat hesaplanmaz, rezervasyon OLUŞTURULMAZ", async () => {
    const { status, json } = await postPublic(publicBody("sale"));
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: SALE_ONLY_RESERVATION_ERROR });
    expect(createReservation).not.toHaveBeenCalled();
    expect(getVillaPrices).not.toHaveBeenCalled();
    expect(verifyStay).not.toHaveBeenCalled();
  });

  it("kiralık mülk → mevcut akış AYNEN (200, INSERT bir kez)", async () => {
    const { status, json } = await postPublic(publicBody("rent"));
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it("kiralık+satılık mülk → rezervasyon alınabilir", async () => {
    const { status } = await postPublic(publicBody("both"));
    expect(status).toBe(200);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it("villa durumu okunamazsa → 400 (fail-closed), INSERT yok", async () => {
    findRentalListingStatusById.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    const { status, json } = await postPublic(publicBody("rent"));
    expect(status).toBe(400);
    expect(json.error).toBe(RENTAL_LISTING_CHECK_FAILED_ERROR);
    expect(createReservation).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- 3 */
describe("admin rezervasyon route'ları", () => {
  it("POST /api/admin/reservations: satılık-only → 400, INSERT yok", async () => {
    const res = await adminPOST(
      new Request("http://localhost/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ villa_id: "sale", start_date: "2027-06-02", end_date: "2027-06-05" }),
      })
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as Json).error).toBe(SALE_ONLY_RESERVATION_ERROR);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("POST /api/admin/reservations: kiralık → mevcut akış", async () => {
    const res = await adminPOST(
      new Request("http://localhost/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ villa_id: "rent", start_date: "2027-06-02", end_date: "2027-06-05" }),
      })
    );
    expect(res.status).toBe(200);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  const patch = (id: string, body: Json) =>
    adminPATCH(
      new Request(`http://localhost/api/admin/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    );

  it("PATCH: mevcut rezervasyonun villası satılık-only olsa bile villa DEĞİŞMEDEN düzenlenebilir", async () => {
    reservationFindById.mockResolvedValue({ data: { id: "res-1", villa_id: "sale" }, error: null });
    const res = await patch("res-1", { villa_id: "sale", note: "x" });
    expect(res.status).toBe(200);
    expect(updateReservationFull).toHaveBeenCalledTimes(1);
    expect(findRentalListingStatusById).not.toHaveBeenCalled();
  });

  it("PATCH: villa_id taşımayan düzenleme hiç kontrol edilmez", async () => {
    const res = await patch("res-1", { note: "yalnız not" });
    expect(res.status).toBe(200);
    expect(reservationFindById).not.toHaveBeenCalled();
    expect(updateReservationFull).toHaveBeenCalledTimes(1);
  });

  it("PATCH: başka bir satılık-only villaya TAŞIMA → 400, güncelleme yok", async () => {
    reservationFindById.mockResolvedValue({ data: { id: "res-1", villa_id: "rent" }, error: null });
    const res = await patch("res-1", { villa_id: "sale" });
    expect(res.status).toBe(400);
    expect(updateReservationFull).not.toHaveBeenCalled();
  });

  it("PATCH: kiralık bir villaya taşıma → mevcut akış", async () => {
    reservationFindById.mockResolvedValue({ data: { id: "res-1", villa_id: "rent" }, error: null });
    const res = await patch("res-1", { villa_id: "both" });
    expect(res.status).toBe(200);
    expect(updateReservationFull).toHaveBeenCalledTimes(1);
  });

  it("hiçbir senaryoda mevcut rezervasyon satırı doğrudan güncellenmez/silinmez", () => {
    expect(reservationUpdate).not.toHaveBeenCalled();
    expect(reservationDelete).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- 4 */
describe("manuel blok server action'ları", () => {
  const range = { start_date: "2027-06-02", end_date: "2027-06-05" };

  it("create: satılık-only → reddedilir, servis çağrılmaz", async () => {
    await expect(
      createManualReservationAction({ villa_id: "sale", ...range })
    ).rejects.toThrow(SALE_ONLY_RESERVATION_ERROR);
    expect(createManualService).not.toHaveBeenCalled();
  });

  it("create: kiralık → servis aynen çağrılır", async () => {
    await createManualReservationAction({ villa_id: "rent", ...range });
    expect(createManualService).toHaveBeenCalledWith({ villa_id: "rent", ...range });
  });

  it("update: villa değişmiyorsa (satılık-only olsa bile) geçer", async () => {
    manualFindById.mockResolvedValue({ data: { id: "m1", villa_id: "sale" }, error: null });
    await updateManualReservationAction("m1", { villa_id: "sale", ...range });
    expect(updateManualService).toHaveBeenCalledTimes(1);
  });

  it("update: satılık-only villaya taşıma → reddedilir", async () => {
    manualFindById.mockResolvedValue({ data: { id: "m1", villa_id: "rent" }, error: null });
    await expect(
      updateManualReservationAction("m1", { villa_id: "sale", ...range })
    ).rejects.toThrow(SALE_ONLY_RESERVATION_ERROR);
    expect(updateManualService).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- 5 */
describe("GET /api/admin/villas — kiralık seçim listesi", () => {
  const ROWS = [
    { id: "rent", title: "R", slug: "r", is_active: true, deleted_at: null, listed_for_rent: true },
    { id: "both", title: "B", slug: "b", is_active: true, deleted_at: null, listed_for_rent: true },
    { id: "sale", title: "S", slug: "s", is_active: true, deleted_at: null, listed_for_rent: false },
    { id: "legacy", title: "L", slug: "l", is_active: true, deleted_at: null },
  ];
  const ids = async (url: string) => {
    findAdminSelectList.mockResolvedValue({ data: ROWS, error: null });
    const res = await adminVillasGET(new Request(url));
    const json = (await res.json()) as { villas: Array<{ id: string }> };
    return json.villas.map((v) => v.id);
  };

  it("varsayılan: satılık-only çıkarılır; kiralık / kiralık+satılık / eski satır kalır", async () => {
    expect(await ids("http://localhost/api/admin/villas")).toEqual(["rent", "both", "legacy"]);
  });

  it("activeOnly=1 tüketicileri (koleksiyon/yorum) de satılık-only görmez", async () => {
    expect(await ids("http://localhost/api/admin/villas?activeOnly=1")).toEqual([
      "rent",
      "both",
      "legacy",
    ]);
  });

  it("includeId: düzenlenen kaydın mevcut villası korunur", async () => {
    expect(await ids("http://localhost/api/admin/villas?includeId=sale")).toEqual([
      "rent",
      "both",
      "sale",
      "legacy",
    ]);
  });
});
