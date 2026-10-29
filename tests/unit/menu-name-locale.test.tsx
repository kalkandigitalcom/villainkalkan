/* ===============================================================
   🛡️ MIGRATION 086 — DİNAMİK MENÜ ADI TR/EN
   ===============================================================
   Kapsam:
     A) Migration 086 SQL şeması (statik metin doğrulaması —
        `translation-schema.test.ts` ile AYNI yaklaşım; canlı DB YOK)
     B) Registry — `menu` entity'si TRANSLATION_ENTITY_CONFIG'te
     C) Servis — getMenuTranslations / upsertMenuTranslation
     D) Public batch okuma — getMenuNamesByLocale (N+1 YOK)
     E) HeaderWrapper — ağaç birleştirme, öncelik, parent/child,
        href/slug korunması, TR davranışının değişmemesi
     F) Header (client) — EN görünen ad, TR canonical

   `villa-type-name-locale.test.tsx` (Phase 10H) ile AYNI desen ve
   AYNI mock katmanı — yeni bir test altyapısı kurulmadı.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

/* ===============================================================
   A) MIGRATION ŞEMASI
   =============================================================== */
describe("migration 086 — menu_translations şeması", () => {
  const sql = readFileSync(
    join(process.cwd(), "db/migrations/086_menu_translations.sql"),
    "utf-8"
  );

  it("1) tabloyu idempotent oluşturur", () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.menu_translations/
    );
  });

  it("2) parent FK public.menu(id) + ON DELETE CASCADE", () => {
    expect(sql).toMatch(
      /menu_id\s+uuid NOT NULL REFERENCES public\.menu \(id\) ON DELETE CASCADE/
    );
  });

  it("3) locale CHECK ('tr','en','de')", () => {
    expect(sql).toMatch(
      /menu_translations_locale_check CHECK \(locale IN \('tr', 'en', 'de'\)\)/
    );
  });

  it("4) UNIQUE(menu_id, locale)", () => {
    expect(sql).toMatch(
      /menu_translations_menu_id_locale_key UNIQUE \(menu_id, locale\)/
    );
  });

  it("5) çevrilebilir TEK kolon `name` (nullable)", () => {
    expect(sql).toMatch(/^\s*name\s+text,\s*$/m);
    /* href/slug/source ÇEVRİLMEZ — kolon olarak bile YOK. */
    expect(sql).not.toMatch(/^\s*href\s+text/m);
    expect(sql).not.toMatch(/^\s*source_id\s+/m);
    expect(sql).not.toMatch(/^\s*slug\s+text/m);
  });

  it("6) mevcut `menu` tablosuna DOKUNMAZ (ALTER/UPDATE/INSERT yok)", () => {
    const statements = sql
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n");
    expect(statements).not.toMatch(/ALTER TABLE\s+public\.menu\b/i);
    expect(statements).not.toMatch(/UPDATE\s+public\.menu\b/i);
    expect(statements).not.toMatch(/INSERT INTO\s+public\.menu\b/i);
    expect(statements).not.toMatch(/DROP TABLE\s+public\.menu\b/i);
  });

  it("7) TR backfill YOK (menu_translations'a veri yazılmaz)", () => {
    const statements = sql
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n");
    expect(statements).not.toMatch(/INSERT INTO public\.menu_translations/i);
  });

  it("8) migration 082'nin genel touch trigger'ını REUSE eder", () => {
    expect(sql).toMatch(/EXECUTE FUNCTION public\.trg_touch_updated_at\(\)/);
  });

  it("8b) kapsam açıkça MANUAL ile sınırlı olarak belgelenmiş", () => {
    expect(sql).toMatch(/source_type = 'manual'/);
    expect(sql).toMatch(/page_translations/);
    expect(sql).toMatch(/villa_type_translations/);
  });

  it("8c) diğer çeviri tablolarına DOKUNMAZ (yalnız referans/yorum)", () => {
    const statements = sql
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n");
    expect(statements).not.toMatch(
      /(ALTER|DROP|UPDATE|INSERT INTO)\s+(TABLE\s+)?public\.(page|villa_type|villa_location)_translations/i
    );
  });
});

/* ===============================================================
   B) REGISTRY
   =============================================================== */
import {
  TRANSLATION_ENTITY_CONFIG,
} from "@/lib/i18n/translations.types";

describe("TRANSLATION_ENTITY_CONFIG — menu entity", () => {
  it("9) menu → menu_translations / menu_id", () => {
    expect(TRANSLATION_ENTITY_CONFIG.menu).toEqual({
      table: "menu_translations",
      parentIdColumn: "menu_id",
    });
  });
});

/* ===============================================================
   C+D) SERVİS + PUBLIC BATCH OKUMA
   En alttaki DB primitive'i mock'lanır; aradaki GERÇEK kod çalışır.
   =============================================================== */
const findAllForParentMock = vi.fn();
const upsertOneMock = vi.fn();
const findManyForLocaleMock = vi.fn();
vi.mock("@/lib/db/translation.repository.server", () => ({
  translationRepository: {
    findAllForParent: (...a: unknown[]) => findAllForParentMock(...a),
    upsertOne: (...a: unknown[]) => upsertOneMock(...a),
    findManyForLocale: (...a: unknown[]) => findManyForLocaleMock(...a),
  },
}));

/* 🛡️ KAPSAM DARALTMASI — yazma yolunda parent `source_type`
   ön-kontrolü (`menu_translations` YALNIZ manual satırlar için). */
const findSourceTypeByIdMock = vi.fn();
vi.mock("@/lib/db/menu.repository.server", () => ({
  menuServerRepository: {
    findSourceTypeById: (...a: unknown[]) => findSourceTypeByIdMock(...a),
  },
}));

import {
  getMenuTranslations,
  upsertMenuTranslation,
} from "@/app/services/menu-translation.service";
import { getMenuNamesByLocale } from "@/lib/i18n/get-menu-translations.server";

describe("menu-translation.service", () => {
  beforeEach(() => {
    findAllForParentMock.mockReset();
    upsertOneMock.mockReset();
    findSourceTypeByIdMock.mockReset();
    findSourceTypeByIdMock.mockResolvedValue({
      data: { id: "m1", source_type: "manual" },
      error: null,
    });
    findAllForParentMock.mockResolvedValue({ data: [], error: null });
    upsertOneMock.mockResolvedValue({
      data: { id: "x", menu_id: "m1", locale: "tr", name: "Kiralık Villalar" },
      error: null,
    });
  });

  it("10) getMenuTranslations → doğru entity + id ile okur", async () => {
    await getMenuTranslations("m1");
    expect(findAllForParentMock).toHaveBeenCalledWith("menu", "m1");
  });

  it("11) getMenuTranslations yalnız en satırlarını döner (tr/de sızmaz)", async () => {
    findAllForParentMock.mockResolvedValue({
      data: [
        { locale: "en", name: "Rental Villas" },
        { locale: "tr", name: "Kiralık Villalar" },
        { locale: "de", name: "Mietvillen" },
      ],
      error: null,
    });
    const res = await getMenuTranslations("m1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows.map((r) => r.locale)).toEqual(["tr"]);
  });

  it("12) boş menuId → hata, DB'ye gidilmez", async () => {
    const res = await getMenuTranslations("   ");
    expect(res).toEqual({ ok: false, error: "Geçersiz menü" });
    expect(findAllForParentMock).not.toHaveBeenCalled();
  });

  it("13) upsert — TR adı yazılır", async () => {
    const res = await upsertMenuTranslation({
      menuId: "m1",
      locale: "tr",
      name: "Kiralık Villalar",
    });
    expect(res.ok).toBe(true);
    expect(upsertOneMock).toHaveBeenCalledWith("menu", "m1", "tr", {
      name: "Kiralık Villalar",
    });
  });

  it("14) upsert — DE artık desteklenmiyor → reddedilir, DB'ye yazılmaz", async () => {
    const res = await upsertMenuTranslation({
      menuId: "m1",
      locale: "de" as never,
      name: "Mietvillen",
    });
    expect(res.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("15) upsert — ad TRIM edilir", async () => {
    await upsertMenuTranslation({
      menuId: "m1",
      locale: "tr",
      name: "  Kiralık Villalar  ",
    });
    expect(upsertOneMock.mock.calls[0][3]).toEqual({ name: "Kiralık Villalar" });
  });

  it("16) upsert — BOŞ/whitespace değer çeviriyi TEMİZLER (null), hata DEĞİL", async () => {
    upsertOneMock.mockResolvedValue({
      data: { id: "x", menu_id: "m1", locale: "tr", name: null },
      error: null,
    });
    const res = await upsertMenuTranslation({
      menuId: "m1",
      locale: "tr",
      name: "   ",
    });
    expect(res.ok).toBe(true);
    expect(upsertOneMock.mock.calls[0][3]).toEqual({ name: null });
  });

  it("17) upsert — 'en' ve geçersiz locale REDDEDİLİR (DB'ye gidilmez)", async () => {
    for (const locale of ["en", "fr", "", "TR"]) {
      const res = await upsertMenuTranslation({
        menuId: "m1",
        locale,
        name: "X",
      });
      expect(res.ok, locale).toBe(false);
    }
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("18) upsert — DB hatası kullanıcı mesajına çevrilir", async () => {
    upsertOneMock.mockResolvedValue({ data: null, error: new Error("fk") });
    const res = await upsertMenuTranslation({
      menuId: "m1",
      locale: "tr",
      name: "X",
    });
    expect(res).toEqual({ ok: false, error: "Çeviri kaydedilemedi" });
  });

  /* 🛡️ KAPSAM KİLİDİ — tablo YALNIZ manual menü etiketlerini tutar. */
  it.each(["page", "category", "region"] as const)(
    "18%s) source_type='%s' → çeviri YAZILMAZ (kendi kaynağı var)",
    async (sourceType) => {
      findSourceTypeByIdMock.mockResolvedValue({
        data: { id: "m1", source_type: sourceType },
        error: null,
      });
      const res = await upsertMenuTranslation({
        menuId: "m1",
        locale: "tr",
        name: "Kiralık Villalar",
      });
      expect(res.ok).toBe(false);
      expect(upsertOneMock).not.toHaveBeenCalled();
    }
  );

  it("18d) menü satırı BULUNAMAZSA yazılmaz", async () => {
    findSourceTypeByIdMock.mockResolvedValue({ data: null, error: null });
    const res = await upsertMenuTranslation({
      menuId: "m1",
      locale: "tr",
      name: "X",
    });
    expect(res).toEqual({ ok: false, error: "Menü bulunamadı" });
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("18e) parent okuma hatası → fail-closed (yazılmaz)", async () => {
    findSourceTypeByIdMock.mockResolvedValue({
      data: null,
      error: new Error("db"),
    });
    const res = await upsertMenuTranslation({
      menuId: "m1",
      locale: "tr",
      name: "X",
    });
    expect(res).toEqual({ ok: false, error: "Menü okunamadı" });
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("18f) geçersiz locale ön-kontrolden ÖNCE reddedilir (gereksiz sorgu yok)", async () => {
    const res = await upsertMenuTranslation({
      menuId: "m1",
      locale: "en",
      name: "X",
    });
    expect(res.ok).toBe(false);
    expect(findSourceTypeByIdMock).not.toHaveBeenCalled();
  });
});

describe("getMenuNamesByLocale — batch okuma (N+1 YOK)", () => {
  beforeEach(() => {
    findManyForLocaleMock.mockReset();
    findManyForLocaleMock.mockResolvedValue({ data: [], error: null });
  });

  it("19) locale başına TAM 1 sorgu (yalnız en) — satır başına sorgu YOK", async () => {
    await getMenuNamesByLocale(["m1", "m2", "m3", "m4", "m5"]);
    expect(findManyForLocaleMock).toHaveBeenCalledTimes(1);
    for (const call of findManyForLocaleMock.mock.calls) {
      expect(call[0]).toBe("menu");
      expect(call[1]).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    }
    expect(findManyForLocaleMock.mock.calls.map((c) => c[2]).sort()).toEqual([
      "tr",
    ]);
  });

  it("20) id listesi boşsa HİÇ sorgu atılmaz", async () => {
    expect(await getMenuNamesByLocale([])).toEqual({});
    expect(findManyForLocaleMock).not.toHaveBeenCalled();
  });

  it("21) tekrarlı id'ler tekilleştirilir", async () => {
    await getMenuNamesByLocale(["m1", "m1", "m2"]);
    expect(findManyForLocaleMock.mock.calls[0][1]).toEqual(["m1", "m2"]);
  });

  it("22) satırlar menu_id → {tr} haritasına dönüşür", async () => {
    findManyForLocaleMock.mockImplementation(
      (_e: string, _ids: string[], locale: string) =>
        Promise.resolve({
          data: [
            {
              menu_id: "m1",
              locale,
              name: "Kiralık Villalar",
            },
          ],
          error: null,
        })
    );
    expect(await getMenuNamesByLocale(["m1"])).toEqual({
      m1: { tr: "Kiralık Villalar" },
    });
  });

  it("23) boş/whitespace çeviri haritaya GİRMEZ → EN fallback", async () => {
    findManyForLocaleMock.mockImplementation(
      (_e: string, _ids: string[], locale: string) =>
        Promise.resolve({
          data: [
            {
              menu_id: "m1",
              locale,
              name: "   ",
            },
          ],
          error: null,
        })
    );
    expect(await getMenuNamesByLocale(["m1"])).toEqual({});
  });

  it("24) DB hatası → boş harita (çökmez)", async () => {
    findManyForLocaleMock.mockResolvedValue({
      data: null,
      error: new Error("db"),
    });
    expect(await getMenuNamesByLocale(["m1"])).toEqual({});
  });
});

/* ===============================================================
   E+F) HEADER / HEADERWRAPPER
   =============================================================== */
const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  /* Header dil çipleri (header redesign) query string'i korumak için
     useSearchParams kullanır. */
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/app/components/layout/VillaSearchBox", () => ({
  default: () => null,
}));
vi.mock("@/app/components/favorites/HeaderFavoritesLink", () => ({
  default: () => null,
}));

const getPublicSettingsMock = vi.fn();
vi.mock("@/app/services/settings.service", () => ({
  getPublicSettings: (...a: unknown[]) => getPublicSettingsMock(...a),
}));

const getMenuMock = vi.fn();
vi.mock("@/app/services/menu.service", () => ({
  getMenu: (...a: unknown[]) => getMenuMock(...a),
}));

/* 🔄 HeaderWrapper artık `getPublicSettings`/`getMenu`'yü DOĞRUDAN değil,
   `lib/cache.helpers.ts`'teki `unstable_cache` sarmalayıcıları üzerinden
   okuyor. Sarmalayıcılar aynı fonksiyonu çağırdığı için testin AMACI ve
   TÜM assertion'ları DEĞİŞMEDİ — yalnız mock seam'i taşındı: aşağıdaki
   mock, YUKARIDAKİ AYNI mock fonksiyonlarına delege eder. */
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: (...a: unknown[]) => getPublicSettingsMock(...a),
  getCachedMenu: (...a: unknown[]) => getMenuMock(...a),
}));

import Header from "@/app/components/layout/Header";
import HeaderWrapper from "@/app/components/layout/HeaderWrapper";

/** Manuel menü satırı — adı `menu.name`'den gelir. */
const MANUAL_ITEM = {
  id: "m1",
  name: "Rental Villas",
  href: "/tr/kiralik-villalar",
  source_type: "manual",
  source_id: null,
};

/** Villa tipi kaynaklı satır — adı `villa_types.name`'den gelir. */
const CATEGORY_ITEM = {
  id: "m9",
  name: "Luxury Villa",
  href: "/tr/arama?villa-turleri=luks-villa",
  source_type: "category",
  source_id: "type-1",
};

/** `findManyForLocale` — entity'ye göre farklı satır döndüren mock. */
function mockTranslations(opts: {
  menu?: Record<string, { tr?: string }>;
  villaType?: Record<string, { tr?: string }>;
}) {
  findManyForLocaleMock.mockImplementation(
    (entity: string, ids: string[], locale: "tr") => {
      const src = entity === "menu" ? opts.menu : opts.villaType;
      if (!src) return Promise.resolve({ data: [], error: null });
      const idCol = entity === "menu" ? "menu_id" : "type_id";
      const data = ids
        .filter((id) => src[id]?.[locale] !== undefined)
        .map((id) => ({ [idCol]: id, locale, name: src[id]![locale] }));
      return Promise.resolve({ data, error: null });
    }
  );
}

describe("HeaderWrapper — menü adı çevirisi", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/tr");
    getPublicSettingsMock.mockReset();
    getMenuMock.mockReset();
    findManyForLocaleMock.mockReset();
    findManyForLocaleMock.mockResolvedValue({ data: [], error: null });
    getMenuMock.mockResolvedValue([MANUAL_ITEM]);
    getPublicSettingsMock.mockResolvedValue({ multilingual_enabled: true });
  });

  it("25) multilingual KAPALI olsa bile TR sayfada çeviri okunur (URL yapısı gereği iki dilli)", async () => {
    getPublicSettingsMock.mockResolvedValue({ multilingual_enabled: false });
    mockTranslations({ menu: { m1: { tr: "Kiralık Villalar" } } });
    render(await HeaderWrapper());
    expect(findManyForLocaleMock).toHaveBeenCalled();
    expect(screen.getAllByText("Kiralık Villalar").length).toBeGreaterThan(0);
  });

  it("26) TR → menü çevirisi gösterilir", async () => {
    mockTranslations({
      menu: { m1: { tr: "Kiralık Villalar" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Kiralık Villalar").length).toBeGreaterThan(0);
    expect(screen.queryByText("Rental Villas")).not.toBeInTheDocument();
  });

  it("27) '/de' artık desteklenmiyor → varsayılan EN (canonical gösterilir)", async () => {
    usePathnameMock.mockReturnValue("/de");
    mockTranslations({
      menu: { m1: { tr: "Kiralık Villalar" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Rental Villas").length).toBeGreaterThan(0);
    expect(screen.queryByText("Kiralık Villalar")).not.toBeInTheDocument();
  });

  it("28) EN → canonical `menu.name` (çeviri DOLU olsa bile)", async () => {
    usePathnameMock.mockReturnValue("/");
    mockTranslations({
      menu: { m1: { tr: "Kiralık Villalar" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Rental Villas").length).toBeGreaterThan(0);
    expect(screen.queryByText("Kiralık Villalar")).not.toBeInTheDocument();
  });

  it("29) çeviri YOKSA → EN fallback", async () => {
    mockTranslations({ menu: {} });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Rental Villas").length).toBeGreaterThan(0);
  });

  it("30) BOŞ/whitespace çeviri → EN fallback", async () => {
    mockTranslations({ menu: { m1: { tr: "   " } } });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Rental Villas").length).toBeGreaterThan(0);
  });

  /* 🛡️ NAVIGATION LOCALE PERSISTENCE — sözleşme güncellendi: menü
     href'inin SLUG/TOKEN kısmı hâlâ ÇEVRİLMEZ (canonical), ancak link
     aktif locale prefix'ini taşır — aksi halde TR'de menüye
     tıklayan kullanıcı EN route'una düşüyordu. */
  it("31) href SLUG'ı ÇEVRİLMEZ; yalnız locale prefix'i eklenir", async () => {
    mockTranslations({
      menu: { m1: { tr: "Kiralık Villalar" } },
    });
    render(await HeaderWrapper());
    for (const link of screen.getAllByRole("link", { name: "Kiralık Villalar" })) {
      /* slug canonical ("kiralik-villalar") KALIR; TR sayfada /tr prefix'i. */
      expect(link).toHaveAttribute("href", "/tr/kiralik-villalar");
    }
  });

  it("32) category öğesi `menu_translations`'ı YOK SAYAR — villa tipi çevirisi kullanılır", async () => {
    getMenuMock.mockResolvedValue([CATEGORY_ITEM]);
    /* Kasıtlı olarak bu category satırı için bir menü çevirisi de
       "var" gibi davranılır; kaynak ayrışması gereği KULLANILMAMALI. */
    mockTranslations({
      menu: { m9: { tr: "İmza Koleksiyonu" } },
      villaType: { "type-1": { tr: "Lüks Villa" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Lüks Villa").length).toBeGreaterThan(0);
    expect(screen.queryByText("İmza Koleksiyonu")).not.toBeInTheDocument();
  });

  it("32b) menüde manual satır YOKSA `menu_translations` sorgusu HİÇ atılmaz", async () => {
    getMenuMock.mockResolvedValue([CATEGORY_ITEM]);
    mockTranslations({
      villaType: { "type-1": { tr: "Lüks Villa" } },
    });
    render(await HeaderWrapper());
    expect(
      findManyForLocaleMock.mock.calls.filter((c) => c[0] === "menu")
    ).toHaveLength(0);
    /* Villa tipi sorgusu ETKİLENMEDİ. */
    expect(
      findManyForLocaleMock.mock.calls.filter((c) => c[0] === "villa_type")
    ).toHaveLength(1);
  });

  it("32c) page / region öğeleri `menu_translations` sorgusuna GİRMEZ", async () => {
    getMenuMock.mockResolvedValue([
      {
        id: "m-page",
        name: "Hakkımızda",
        href: "/tr/p/hakkimizda",
        source_type: "page",
        source_id: "p1",
      },
      {
        id: "m-region",
        name: "Kalkan",
        href: "/tr/arama?bolgeler=kalkan",
        source_type: "region",
        source_id: "loc-1",
      },
      MANUAL_ITEM,
    ]);
    mockTranslations({ menu: { m1: { tr: "Kiralık Villalar" } } });
    render(await HeaderWrapper());

    const menuCalls = findManyForLocaleMock.mock.calls.filter(
      (c) => c[0] === "menu"
    );
    expect(menuCalls).toHaveLength(1);
    /* YALNIZ manual satırın id'si sorguya girer. */
    expect(menuCalls[0][1]).toEqual(["m1"]);

    /* page ve region adları canonical kalır. */
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kalkan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kiralık Villalar").length).toBeGreaterThan(0);
  });

  it("33) menü çevirisi YOKSA villa tipi çevirisi KORUNUR (Phase 10H regresyon)", async () => {
    getMenuMock.mockResolvedValue([CATEGORY_ITEM]);
    mockTranslations({
      villaType: { "type-1": { tr: "Lüks Villa" } },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Lüks Villa").length).toBeGreaterThan(0);
  });

  it("35) PARENT/CHILD yapısı korunur; manual alt menü de çevrilir — TEK batch", async () => {
    getMenuMock.mockResolvedValue([
      {
        ...MANUAL_ITEM,
        children: [
          {
            id: "m2",
            name: "Özel Koleksiyon",
            href: "/tr/kiralik-villalar?ozel=1",
            source_type: "manual",
            source_id: null,
          },
        ],
      },
    ]);
    mockTranslations({
      menu: {
        m1: { tr: "Kiralık Villalar" },
        m2: { tr: "İmza Koleksiyonu" },
      },
    });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Kiralık Villalar").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("İmza Koleksiyonu").length
    ).toBeGreaterThan(0);
    /* Parent + child TEK `.in()` sorgusunda (locale başına 1) → N+1 YOK. */
    const menuCalls = findManyForLocaleMock.mock.calls.filter(
      (c) => c[0] === "menu"
    );
    expect(menuCalls).toHaveLength(1);
    expect(menuCalls[0][1].sort()).toEqual(["m1", "m2"]);
  });

  it("36) çeviri okuması patlarsa header ÇÖKMEZ, EN adına düşer", async () => {
    findManyForLocaleMock.mockRejectedValue(new Error("db down"));
    render(await HeaderWrapper());
    expect(screen.getAllByText("Rental Villas").length).toBeGreaterThan(0);
  });

  it("37) legacy auto-include sayfa düğümleri çeviri haritasında YOK → EN adı", async () => {
    getMenuMock.mockResolvedValue([
      {
        id: "page-uuid-1",
        name: "Hakkımızda",
        href: "/tr/p/hakkimizda",
        source_type: "page",
        source_id: "page-uuid-1",
      },
    ]);
    mockTranslations({ menu: {} });
    render(await HeaderWrapper());
    expect(screen.getAllByText("Hakkımızda").length).toBeGreaterThan(0);
  });
});

describe("Header (client) — nameByLocale sözleşmesi", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  const ITEM = {
    id: "m1",
    name: "Rental Villas",
    href: "/tr/kiralik-villalar",
    nameByLocale: { tr: "Kiralık Villalar" },
  };

  it("38) EN path → canonical ad (ÖNCEKİ davranış, DEĞİŞMEDİ)", () => {
    usePathnameMock.mockReturnValue("/");
    render(<Header menu={[ITEM]} />);
    expect(screen.getAllByText("Rental Villas").length).toBeGreaterThan(0);
  });

  /* 🛡️ NAVIGATION LOCALE PERSISTENCE — sözleşme güncellendi: menü
     href'inin SLUG/TOKEN kısmı hâlâ ÇEVRİLMEZ (canonical), ancak link
     aktif locale prefix'ini taşır — aksi halde TR'de menüye
     tıklayan kullanıcı EN route'una düşüyordu. */
  it("39) TR path → TR adı; href slug'ı canonical, prefix '/tr'", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(<Header menu={[ITEM]} />);
    const links = screen.getAllByRole("link", { name: "Kiralık Villalar" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/tr/kiralik-villalar");
  });

  it("40) '/de' path (desteklenmiyor) → varsayılan EN (canonical) ad", () => {
    usePathnameMock.mockReturnValue("/de");
    render(<Header menu={[ITEM]} />);
    expect(screen.getAllByText("Rental Villas").length).toBeGreaterThan(0);
    expect(screen.queryByText("Kiralık Villalar")).not.toBeInTheDocument();
  });

  it("41) nameByLocale HİÇ YOKSA (eski caller) → EN adı, çökme yok", () => {
    usePathnameMock.mockReturnValue("/");
    render(<Header menu={[{ id: "m1", name: "İletişim", href: "/tr/iletisim" }]} />);
    expect(screen.getAllByText("İletişim").length).toBeGreaterThan(0);
  });

  it("42) dropdown (children) yapısı korunur; child href'i aktif locale'i taşır", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(
      <Header
        menu={[
          {
            ...ITEM,
            children: [
              {
                id: "m2",
                name: "Luxury Villa",
                href: "/tr/arama?villa-turleri=luks-villa",
                nameByLocale: { tr: "Lüks Villa" },
              },
            ],
          },
        ]}
      />
    );
    const child = screen.getAllByRole("link", { name: "Lüks Villa" })[0];
    /* Token (`luks-villa`) ve query kontratı AYNEN; yalnız prefix. */
    expect(child).toHaveAttribute(
      "href",
      "/tr/arama?villa-turleri=luks-villa"
    );
  });
});
