/* ===============================================================
   🛡️ SATILIK MODÜLÜ AŞAMA 1 — KİRALIK GÖRÜNÜRLÜK KİLİDİ (migration 103)
   ===============================================================
   Kural: kiralık public yüzeyler yalnız `listed_for_rent=true`
   mülkleri gösterir (yalnız kiralık + kiralık&satılık). Yalnız
   satılık mülk (listed_for_rent=false) kiralık liste/detay/arama/
   benzer/kısa süreli fırsat/koleksiyon/sitemap/favori yüzeylerine
   SIZMAZ. Mevcut mülkler DB DEFAULT ile kiralık kalır.

   1) Merkezi yardımcıların davranışı.
   2) GERÇEK repository kodu — en alt katman (`dbAdminNative`)
      in-memory tabloyla taklit edilir; `.eq/.is/.in` gerçekten
      uygulanır.
   3) Kaynak kilidi — public kiralık sorgular filtreyi ELLE yazmaz.
   4) Migration 103/104 sözleşmesi (geriye dönük uyumluluk).
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, unknown>;
const TABLES: Record<string, Row[]> = { villa: [] };
const calls: Array<{ table: string; op: string; args: unknown[] }> = [];

function builder(table: string) {
  let rows = [...(TABLES[table] || [])];
  const filtering = new Set(["eq", "is", "in"]);
  const result = () => ({ data: rows, error: null });
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") {
          return (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
            Promise.resolve(result()).then(res, rej);
        }
        if (prop === "maybeSingle" || prop === "single") {
          return () =>
            Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        return (...args: unknown[]) => {
          calls.push({ table, op: prop, args });
          if (filtering.has(prop)) {
            const [col, val] = args as [string, unknown];
            if (prop === "in") {
              const list = val as unknown[];
              rows = rows.filter((r) => list.includes(r[col]));
            } else if (prop === "is") {
              rows = rows.filter((r) => (r[col] ?? null) === val);
            } else {
              rows = rows.filter((r) => r[col] === val);
            }
          }
          return proxy;
        };
      },
    }
  );
  return proxy;
}

vi.mock("@/lib/db/native", () => ({
  dbNative: { from: (t: string) => builder(t) },
  dbAdminNative: { from: (t: string) => builder(t) },
}));

import {
  withPublicRentalVisibility,
  withRentalListing,
  isPublicRentalVillaRow,
} from "@/lib/db/villa-visibility";
import { villaAdminRepository as repo } from "@/lib/db/villa.repository.server";

const base = {
  is_active: true,
  deleted_at: null,
  location_id: "loc1",
  title: "T",
  created_at: "2026-01-01",
  private_access_token: null as string | null,
};
const RENT = { ...base, id: "rent", slug: "rent", listed_for_rent: true, listed_for_sale: false };
const BOTH = { ...base, id: "both", slug: "both", listed_for_rent: true, listed_for_sale: true };
const SALE = { ...base, id: "sale", slug: "sale", listed_for_rent: false, listed_for_sale: true, private_access_token: "tok-sale" };
const PASSIVE = { ...base, id: "passive", slug: "passive", is_active: false, listed_for_rent: true, listed_for_sale: false, private_access_token: "tok-passive" };
const DELETED = { ...base, id: "deleted", slug: "deleted", deleted_at: "2026-02-01", listed_for_rent: true, listed_for_sale: false };

const ids = (rows: unknown) =>
  ((rows as Row[] | null) || []).map((r) => r.id).sort();

beforeEach(() => {
  calls.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  TABLES.villa = [RENT, BOTH, SALE, PASSIVE, DELETED].map((r) => ({ ...r }));
});

/* ---------------------------------------------------------------- 1 */
describe("merkezi görünürlük yardımcıları", () => {
  function recorder() {
    const log: Array<[string, string, unknown]> = [];
    const q = {
      eq(c: string, v: unknown) {
        log.push(["eq", c, v]);
        return q;
      },
      is(c: string, v: null | boolean) {
        log.push(["is", c, v]);
        return q;
      },
    };
    return { q, log };
  }

  it("withPublicRentalVisibility = aktif + silinmemiş + kiralık", () => {
    const { q, log } = recorder();
    expect(withPublicRentalVisibility(q)).toBe(q);
    expect(log).toEqual([
      ["eq", "is_active", true],
      ["is", "deleted_at", null],
      ["eq", "listed_for_rent", true],
    ]);
  });

  it("withRentalListing yalnız kiralık bayrağını ekler (is_active'e dokunmaz)", () => {
    const { q, log } = recorder();
    withRentalListing(q);
    expect(log).toEqual([["eq", "listed_for_rent", true]]);
  });

  it("isPublicRentalVillaRow — geriye dönük uyum: alan yok/NULL → kiralık", () => {
    expect(isPublicRentalVillaRow({ is_active: true, deleted_at: null })).toBe(true);
    expect(isPublicRentalVillaRow({ is_active: true, deleted_at: null, listed_for_rent: null })).toBe(true);
    expect(isPublicRentalVillaRow({ is_active: null, deleted_at: null })).toBe(true);
    expect(isPublicRentalVillaRow({ is_active: true, deleted_at: null, listed_for_rent: true })).toBe(true);
    expect(isPublicRentalVillaRow({ is_active: true, deleted_at: null, listed_for_rent: false })).toBe(false);
    expect(isPublicRentalVillaRow({ is_active: false, deleted_at: null })).toBe(false);
    expect(isPublicRentalVillaRow({ is_active: true, deleted_at: "2026-01-01" })).toBe(false);
    expect(isPublicRentalVillaRow(null)).toBe(false);
  });
});

/* ---------------------------------------------------------------- 2 */
describe("gerçek repository — satılık-only mülk kiralık yüzeylere sızmaz", () => {
  it("listPublic: yalnız kiralık + kiralık&satılık (pasif/silinmiş zaten yok)", async () => {
    expect(ids(await repo.listPublic())).toEqual(["both", "rent"]);
  });

  it("findBySlug: satılık-only → null; kiralık&satılık → bulunur", async () => {
    expect(await repo.findBySlug("sale")).toBeNull();
    TABLES.villa = [RENT, BOTH, SALE].map((r) => ({ ...r }));
    expect((await repo.findBySlug("both"))?.id).toBe("both");
  });

  it("findByIds (favoriler/paylaşılan favoriler)", async () => {
    expect(ids(await repo.findByIds(["rent", "both", "sale"]))).toEqual(["both", "rent"]);
  });

  it("findNotFoundSuggestions", async () => {
    expect(ids(await repo.findNotFoundSuggestions(10))).toEqual(["both", "rent"]);
  });

  it("findSearchResults (/arama)", async () => {
    const { data } = await repo.findSearchResults({
      categoryVillaIds: null,
      expandedRegions: [],
      guests: null,
    });
    expect(ids(data)).toEqual(["both", "rent"]);
  });

  it("findSimilarCards (Benzer Villalar)", async () => {
    const { data } = await repo.findSimilarCards({ locationId: null, excludeIds: [], limit: 10 });
    expect(ids(data)).toEqual(["both", "rent"]);
  });

  it("findShortGapVillas (Kısa Süreli Fırsatlar)", async () => {
    const { data } = await repo.findShortGapVillas({
      gapVillaIds: ["rent", "both", "sale"],
      expandedRegions: [],
      typeIdFilter: null,
      guests: 0,
    });
    expect(ids(data)).toEqual(["both", "rent"]);
  });

  it("findActiveImagesByIds / findActiveVillaIdsByLocationIds / findActiveLocationIds", async () => {
    const imgs = await repo.findActiveImagesByIds(["rent", "both", "sale"]);
    expect(ids(imgs.data)).toEqual(["both", "rent"]);
    const byLoc = await repo.findActiveVillaIdsByLocationIds(["loc1"]);
    expect(ids(byLoc.data)).toEqual(["both", "rent"]);
    const locs = await repo.findActiveLocationIds();
    expect((locs.data as Row[]).length).toBe(2);
  });

  it("listPublicSlugs (sitemap)", async () => {
    const slugs = (await repo.listPublicSlugs()).map((r) => r.slug).sort();
    expect(slugs).toEqual(["both", "rent"]);
  });

  it("findByPrivateToken: pasif kiralık açılır, satılık-only açılmaz", async () => {
    expect((await repo.findByPrivateToken("tok-passive"))?.id).toBe("passive");
    TABLES.villa = [SALE].map((r) => ({ ...r }));
    expect(await repo.findByPrivateToken("tok-sale")).toBeNull();
  });

  it("findCardsByIds (/liste/[token]): pasif kalır (caller kuralı), satılık-only düşer", async () => {
    const { data } = await repo.findCardsByIds(["rent", "sale", "passive"]);
    expect(ids(data)).toEqual(["passive", "rent"]);
  });

  it("admin sorguları DEĞİŞMEDİ: findById satılık-only mülkü de döndürür", async () => {
    TABLES.villa = [SALE].map((r) => ({ ...r }));
    expect((await repo.findById("sale"))?.id).toBe("sale");
    expect(calls.some((c) => c.op === "eq" && c.args[0] === "listed_for_rent")).toBe(false);
  });
});

/* ---------------------------------------------------------------- 3 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf-8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function methodBody(src: string, name: string): string {
  const start = src.indexOf(`async ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const next = src.indexOf("\n  async ", start + 10);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("kaynak kilidi — public kiralık sorgular merkezi filtreyi kullanır", () => {
  const repoSrc = stripComments(read("lib/db/villa.repository.server.ts"));

  const PUBLIC_RENTAL = [
    "findActiveLocationIds",
    "findActiveVillaIdsByLocationIds",
    "findBySlug",
    "listPublic",
    "findNotFoundSuggestions",
    "findSearchResults",
    "findSimilarCards",
    "findShortGapVillas",
    "findActiveImagesByIds",
    "searchByTitle",
    "findByIds",
    "listPublicSlugs",
  ];

  it.each(PUBLIC_RENTAL)("%s → withPublicRentalVisibility", (name) => {
    const body = methodBody(repoSrc, name);
    expect(body).toContain("withPublicRentalVisibility(");
    expect(body).not.toContain('.eq("is_active", true)');
  });

  it.each(["findByPrivateToken", "findCardsByIds"])(
    "%s → withRentalListing (is_active kuralı caller'da kalır)",
    (name) => {
      expect(methodBody(repoSrc, name)).toContain("withRentalListing(");
    }
  );

  it("repository'de elle yazılmış public filtre kalmadı (yalnız admin select listesi)", () => {
    const hits = repoSrc.match(/\.eq\("is_active", true\)/g) || [];
    expect(hits.length).toBe(1);
    expect(methodBody(repoSrc, "findAdminSelectList")).toContain('.eq("is_active", true)');
    expect(repoSrc).not.toMatch(/\.eq\("listed_for_rent"/);
  });

  it("koleksiyon/yorum embed'leri listed_for_rent seçer ve JS predicate kullanır", () => {
    for (const p of [
      "lib/db/homepage.repository.ts",
      "lib/db/discount.repository.ts",
      "lib/db/villa-review.repository.server.ts",
    ]) {
      expect(read(p), p).toMatch(/deleted_at,\s*listed_for_rent,/);
    }
    const cache = stripComments(read("lib/cache.helpers.ts"));
    expect(cache.match(/isPublicRentalVillaRow\(v\)/g)?.length).toBe(2);
    expect(cache).not.toContain("v.is_active === false || v.deleted_at != null");
    const review = stripComments(read("app/services/villa-review.service.ts"));
    expect(review).toContain("isPublicRentalVillaRow(v)");
  });
});

/* ---------------------------------------------------------------- 4 */
const sqlCode = (p: string) =>
  read(p)
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

describe("migration 103 — ilan türü bayrakları", () => {
  const sql = sqlCode("db/migrations/103_villa_listing_flags.sql");

  it("mevcut mülkler kiralık kalır: NOT NULL DEFAULT TRUE / FALSE", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS listed_for_rent BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS listed_for_sale BOOLEAN NOT NULL DEFAULT FALSE/);
  });

  it("veri değiştirmez: UPDATE / DELETE / DROP yok; transaction içinde", () => {
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i);
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it("en az bir ilan türü kısıtı, guard'lı (idempotent)", () => {
    expect(sql).toContain("CHECK (listed_for_rent OR listed_for_sale)");
    expect(sql).toContain("conname = 'villa_listing_type_present'");
  });

  it("RLS/policy/grant yok (native PG)", () => {
    expect(sql).not.toMatch(/POLICY|ROW LEVEL SECURITY|GRANT/i);
  });

  it("rollback dosyası mevcut", () => {
    const down = sqlCode("db/rollback/103_villa_listing_flags.down.sql");
    expect(down).toContain("DROP COLUMN IF EXISTS listed_for_rent");
    expect(down).toContain("DROP COLUMN IF EXISTS listed_for_sale");
  });
});

describe("migration 104 — satılık ilan tabloları", () => {
  const sql = sqlCode("db/migrations/104_villa_sale_listings.sql");

  it("1:1 tablo, villa silinirse CASCADE; yayın varsayılan KAPALI", () => {
    expect(sql).toMatch(/villa_id\s+uuid PRIMARY KEY REFERENCES public\.villa \(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/is_published\s+boolean NOT NULL DEFAULT false/);
    expect(sql).toContain("CHECK (sale_currency IN ('EUR', 'GBP', 'USD', 'TRY'))");
    expect(sql).toContain("CHECK (sale_status IN ('available', 'reserved', 'sold'))");
  });

  it("çeviri tablosu yalnız TR (EN canonical, DE yok)", () => {
    expect(sql).toContain("CHECK (locale IN ('tr'))");
    expect(sql).not.toMatch(/'de'/);
  });

  it("mevcut tablolara dokunmaz", () => {
    expect(sql).not.toMatch(/ALTER TABLE|^\s*UPDATE\s|DELETE\s+FROM|DROP TABLE|POLICY|GRANT/im);
  });

  it("rollback dosyası mevcut", () => {
    const down = sqlCode("db/rollback/104_villa_sale_listings.down.sql");
    expect(down).toContain("DROP TABLE IF EXISTS public.villa_sale_listings;");
  });
});

describe("migration 105 — kısa süreli fırsatlar SQL seviyesinde kiralık", () => {
  const up = sqlCode("db/migrations/105_short_gaps_rental_only.sql");
  const base = sqlCode("db/migrations/055_fix_short_gaps_refresh_truncate.sql");
  const fnBody = (s: string) =>
    s.slice(
      s.indexOf("CREATE OR REPLACE FUNCTION public.refresh_villa_short_gaps()"),
      s.indexOf("$$;", s.indexOf("AS $$")) + 3
    );

  it("son WHERE'e listed_for_rent = true eklendi", () => {
    expect(fnBody(up)).toMatch(
      /AND v\.deleted_at IS NULL\s+AND v\.listed_for_rent = true;/
    );
  });

  it("gövde 055 ile BİREBİR (yalnız eklenen satır + yorum farkı)", () => {
    const norm = (s: string) =>
      fnBody(s)
        .split("\n")
        .map((l) => l.replace(/--.*$/, "").trimEnd())
        .filter((l) => l.trim().length > 0)
        .join("\n");
    const expected = norm(base).replace(
      "AND v.deleted_at IS NULL;",
      "AND v.deleted_at IS NULL\n     AND v.listed_for_rent = true;"
    );
    expect(norm(up)).toBe(expected);
  });

  it("imza / güvenlik ayarları aynı; fonksiyon çalıştırılmaz, tablo değişmez", () => {
    expect(up).toContain("RETURNS integer");
    expect(up).toContain("SECURITY DEFINER");
    expect(up).toContain("SET search_path = public, pg_temp");
    expect(up).not.toMatch(/SELECT public\.refresh_villa_short_gaps\(\)/);
    expect(up).not.toMatch(/ALTER TABLE|DROP |GRANT|POLICY/i);
  });

  it("rollback 055 gövdesine döner", () => {
    const down = sqlCode("db/rollback/105_short_gaps_rental_only.down.sql");
    expect(fnBody(down)).toBe(fnBody(base));
  });
});

describe("admin kiralık seçim listeleri (kaynak kilidi)", () => {
  it("manuel blok ekle listesi kiralık filtreli", () => {
    const repoSrc = stripComments(read("lib/db/villa.repository.server.ts"));
    expect(methodBody(repoSrc, "findAllIdTitleSlug")).toContain("withRentalListing(");
  });

  it("düzenleme ekranları mevcut villayı includeId ile korur", () => {
    expect(read("app/(admin)/maki-admin/reservations/[id]/page.tsx")).toContain(
      "/api/admin/villas?includeId=${encodeURIComponent(originalVillaId)}"
    );
    expect(read("app/(admin)/maki-admin/manual-reservations/[id]/page.tsx")).toContain(
      "/api/admin/villas?includeId=${encodeURIComponent(currentVillaId)}"
    );
  });
});
