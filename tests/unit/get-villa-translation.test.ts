/* ===============================================================
   🛡️ PHASE 6B / 8B / 8C — VILLA DETAIL TITLE + DESCRIPTION +
   SEO_DESCRIPTION TRANSLATION: TESTLER
   ===============================================================
   Hedef: lib/i18n/get-villa-translation.server.ts
     (getVillaTranslatedDescription —
      Phase 8B, getVillaTranslatedSeoDescription — Phase 8C)

   Mock SEVİYESİ bilinçli seçildi: Phase 5'in `get-translation.test.ts`'i
   gibi, en ALT sınırda — `@/lib/db/translation.repository.server`'ın
   `findOne`'ı — mock'lanır. Böylece `getTranslation` (Phase 5, EN
   kısayolu dahil) ve `resolveTranslatedField` (fallback) GERÇEK
   kodlarıyla çalışır; bu dosya yalnız "doğru villaId/locale ile doğru
   sorgu + doğru fallback" ZİNCİRİNİ uçtan uca doğrular. GERÇEK DB'YE
   HİÇ DOKUNULMAZ, production villa_translations'a test verisi
   YAZILMAZ.

   React `cache()` bu ortamda (Vitest/Node, aktif RSC dispatcher yok)
   memoize ETMEZ — her çağrı taze çalışır (bkz. request-locale.test.ts
   ampirik notu). Bu, aşağıdaki testlerin doğruluğunu ETKİLEMEZ (her
   test tek bir çağrı yapıyor); yalnız request-içi dedupe'un KENDİSİ
   bu dosyada ayrıca test edilmiyor (Next.js/React'ın kendi garantisi,
   Phase 4B'de zaten doğrulandı).

   Mevcut price-engine / discount / pool-heating / reservation / TR
   route / Phase 1B-2-4A-4B-5 testlerine HİÇ dokunulmadı.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getVillaTranslatedDescription,
  getVillaTranslatedSeoDescription,
  getVillaTranslatedSeoTitle,
} from "@/lib/i18n/get-villa-translation.server";

const findOneMock = vi.fn();

vi.mock("@/lib/db/translation.repository.server", () => ({
  translationRepository: {
    findOne: (...args: unknown[]) => findOneMock(...args),
  },
}));

beforeEach(() => {
  findOneMock.mockReset();
});

const VILLA_ID = "villa-uuid-1";

/* 🛡️ `getVillaTranslatedTitle` KALDIRILDI — villa adı özel isimdir,
   hiçbir locale'de çevrilmez; TR sayfalar canonical `villa.title`
   kullanır. Bu dosyadaki diğer getter testleri DEĞİŞMEDİ. */

/* ===============================================================
   🛡️ PHASE 8B — getVillaTranslatedDescription
   ===============================================================
   Title testleriyle (yukarıda) BİREBİR AYNI desen/mock seviyesi —
   yalnız `translationRepository.findOne` mock'lanır, `getTranslation`
   ve `resolveTranslatedField` GERÇEK kodlarıyla çalışır.
   =============================================================== */
const ORIGINAL_DESCRIPTION = "<p>A wonderful villa description.</p>";

describe("getVillaTranslatedDescription", () => {
  /* --- 1) EN --- */
  it("1) locale='en' → orijinal villa.description döner, translation sorgusu ATILMAZ", async () => {
    const result = await getVillaTranslatedDescription(
      VILLA_ID,
      ORIGINAL_DESCRIPTION,
      "en"
    );
    expect(result).toBe(ORIGINAL_DESCRIPTION);
    expect(findOneMock).not.toHaveBeenCalled();
  });

  /* --- 2) TR + mevcut --- */
  it("2) locale='tr' + çeviri mevcut → çevrilmiş description döner", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t1",
        villa_id: VILLA_ID,
        locale: "tr",
        title: null,
        description: "<p>Muhteşem bir villa açıklaması.</p>",
        seo_title: null,
        seo_description: null,
        created_at: "",
        updated_at: "",
      },
      error: null,
    });
    const result = await getVillaTranslatedDescription(
      VILLA_ID,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).toBe("<p>Muhteşem bir villa açıklaması.</p>");
  });

  /* --- 4) çeviri satırı yok --- */
  it("4) çeviri satırı YOK (translation null) → orijinal villa.description'a düşer", async () => {
    findOneMock.mockResolvedValue({ data: null, error: null });
    const result = await getVillaTranslatedDescription(
      VILLA_ID,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).toBe(ORIGINAL_DESCRIPTION);
  });

  /* --- 5) description kolonu boş/null --- */
  it("5) çeviri satırı var ama description boş/null → orijinal villa.description'a düşer", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t3",
        villa_id: VILLA_ID,
        locale: "tr",
        title: "Villa In Love",
        description: null,
        seo_title: null,
        seo_description: null,
        created_at: "",
        updated_at: "",
      },
      error: null,
    });
    const result = await getVillaTranslatedDescription(
      VILLA_ID,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).toBe(ORIGINAL_DESCRIPTION);
  });

  it("5b) çeviri satırı var ama description yalnız whitespace → orijinal villa.description'a düşer", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t3b",
        villa_id: VILLA_ID,
        locale: "tr",
        title: null,
        description: "   ",
        seo_title: null,
        seo_description: null,
        created_at: "",
        updated_at: "",
      },
      error: null,
    });
    const result = await getVillaTranslatedDescription(
      VILLA_ID,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).toBe(ORIGINAL_DESCRIPTION);
  });

  /* --- 6) DB hatası --- */
  it("6) DB hatası dönerse → exception FIRLATMADAN orijinal villa.description'a düşer", async () => {
    findOneMock.mockResolvedValue({
      data: null,
      error: { message: "connection lost" },
    });
    await expect(
      getVillaTranslatedDescription(VILLA_ID, ORIGINAL_DESCRIPTION, "tr")
    ).resolves.toBe(ORIGINAL_DESCRIPTION);
  });

  /* --- 7) doğru locale + entity ile çağrılır --- */
  it("7) helper, findOne'ı TAM OLARAK geçirilen locale ile çağırır ('tr')", async () => {
    findOneMock.mockResolvedValue({ data: null, error: null });
    await getVillaTranslatedDescription(VILLA_ID, ORIGINAL_DESCRIPTION, "tr");
    expect(findOneMock).toHaveBeenCalledWith("villa", VILLA_ID, "tr");
  });

  /* --- 8) title + description AYNI cache-anahtarını (entity/villaId/locale)
     kullanıyor — Phase 8B'nin PERF iddiasının regresyon kilidi. ---
     ⚠️ ÖNEMLİ SINIRLAMA (dosya başı yoruma bkz.): React `cache()` bu
     Vitest/Node ortamında memoize ETMEZ — bu yüzden burada
     `findOneMock`'un TEK SEFER çağrıldığı iddia EDİLEMEZ/test
     EDİLEMEZ (gerçek request-scoped tek-sorgu garantisi yalnız
     Next.js'in GERÇEK RSC dispatcher'ında geçerlidir, Phase 4B/6B'de
     zaten belirlendi, bu ortamda YENİDEN kanıtlanamaz — "test geçiyor"
     diye gerçek request davranışı hakkında varsayım YAPILMIYOR). Bu
     test yalnız title ve description helper'larının BİREBİR AYNI
     (entity="villa", villaId, locale) anahtarıyla `findOne`'ı
     çağırdığını doğruluyor — yani GERÇEK bir RSC request'inde
     `getVillaTranslationCached`'in ikisi için de AYNI cache girişini
     paylaşacağı tasarımı (aynı fonksiyon + aynı argümanlar) kod
     seviyesinde teyit ediyor. */
  it("8) seo_title ve description helper'ları AYNI (entity, villaId, locale) anahtarıyla findOne çağırır — gerçek RSC'de TEK sorguya indirgenecek tasarımın kilidi", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t4",
        villa_id: VILLA_ID,
        locale: "tr",
        title: "Villa In Love",
        description: "<p>Muhteşem bir villa açıklaması.</p>",
        seo_title: null,
        seo_description: null,
        created_at: "",
        updated_at: "",
      },
      error: null,
    });

    await getVillaTranslatedSeoTitle(VILLA_ID, "Orijinal SEO Başlık", "tr");
    await getVillaTranslatedDescription(VILLA_ID, ORIGINAL_DESCRIPTION, "tr");

    expect(findOneMock).toHaveBeenCalledTimes(2);
    const [seoTitleCallArgs, descriptionCallArgs] = findOneMock.mock.calls;
    expect(seoTitleCallArgs).toEqual(["villa", VILLA_ID, "tr"]);
    expect(descriptionCallArgs).toEqual(["villa", VILLA_ID, "tr"]);
    expect(seoTitleCallArgs).toEqual(descriptionCallArgs);
  });
});

/* ===============================================================
   🛡️ PHASE 8C — getVillaTranslatedSeoDescription
   ===============================================================
   Aynı mock seviyesi (yalnız `translationRepository.findOne`) —
   `getTranslation`, `resolveTranslatedField` VE bu dosyanın private
   `makeExcerpt`'i (export edilmiyor, doğrudan test edilemez — yalnız
   `getVillaTranslatedSeoDescription`'ın dönen değeri üzerinden
   dolaylı doğrulanıyor) GERÇEK kodlarıyla çalışır. `stripHtml`
   (`@/lib/html-sanitize`) de MOCK'LANMAZ — gerçek implementasyonuyla
   çalışır (locale-routes.test.tsx'in Phase 8B'deki page-body
   testlerinde zaten aynı şekilde unmocked kullanılıyor).
   =============================================================== */
const ORIGINAL_SEO_DESCRIPTION = "Orijinal EN seo açıklaması.";
const LONG_DESCRIPTION_HTML =
  "<p>" +
  "Bu villa, muhteşem deniz manzarası, geniş özel havuzu ve modern " +
  "mimarisiyle unutulmaz bir tatil deneyimi sunar. Her biri özenle " +
  "tasarlanmış geniş yatak odaları, ferah salonu ve donanımlı mutfağı " +
  "ile hem aile tatilleri hem de arkadaş grupları için idealdir. Villa " +
  "içindeki her detay konfor düşünülerek planlanmıştır." +
  "</p>";

describe("getVillaTranslatedSeoDescription", () => {
  /* --- 1) EN --- */
  it("1) locale='en' → translation sorgusu ATILMAZ, orijinal seo_description (trim'lenmiş) döner", async () => {
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      "  Orijinal EN seo açıklaması.  ",
      ORIGINAL_DESCRIPTION,
      "en"
    );
    expect(result).toBe("Orijinal EN seo açıklaması.");
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it("1b) locale='en' + seo_description boş/null → orijinal description'dan 160 karakter excerpt", async () => {
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      null,
      LONG_DESCRIPTION_HTML,
      "en"
    );
    expect(findOneMock).not.toHaveBeenCalled();
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).not.toMatch(/<[^>]*>/);
    expect(result.endsWith("…")).toBe(true);
  });

  /* --- 2) TR + translation.seo_description mevcut (A) --- */
  it("2) locale='tr' + çeviri seo_description'ı DOLU → AYNEN döner (excerpt ÜRETİLMEZ)", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t1",
        villa_id: VILLA_ID,
        locale: "tr",
        title: null,
        description: "<p>Muhteşem bir villa açıklaması.</p>",
        seo_title: null,
        seo_description: "A stunning villa with sea view.",
        created_at: "",
        updated_at: "",
      },
      error: null,
    });
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      ORIGINAL_SEO_DESCRIPTION,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).toBe("A stunning villa with sea view.");
  });

  /* --- 4) seo_description boş/null, description çevrilmiş (B) --- */
  it("4) çeviri satırı var ama seo_description null → çevrilmiş description'dan excerpt üretir", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t3",
        villa_id: VILLA_ID,
        locale: "tr",
        title: null,
        description: LONG_DESCRIPTION_HTML.replace("Bu villa", "This villa"),
        seo_title: null,
        seo_description: null,
        created_at: "",
        updated_at: "",
      },
      error: null,
    });
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      ORIGINAL_SEO_DESCRIPTION,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).not.toMatch(/<[^>]*>/); // HTML strip edilmiş
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.startsWith("This villa")).toBe(true);
  });

  /* --- 4b) seo_description whitespace-only (D) --- */
  it("4b) çeviri satırı var ama seo_description yalnız whitespace → çevrilmiş description'dan excerpt üretir", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t3b",
        villa_id: VILLA_ID,
        locale: "tr",
        title: null,
        description: "<p>Short TR description.</p>",
        seo_title: null,
        seo_description: "   ",
        created_at: "",
        updated_at: "",
      },
      error: null,
    });
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      ORIGINAL_SEO_DESCRIPTION,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).toBe("Short TR description.");
  });

  /* --- 5) çeviri satırı HİÇ yok (C) --- */
  it("5) çeviri satırı YOK (translation null) → ana içerik (EN) seo_description'ına düşer", async () => {
    findOneMock.mockResolvedValue({ data: null, error: null });
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      ORIGINAL_SEO_DESCRIPTION,
      LONG_DESCRIPTION_HTML,
      "tr"
    );
    /* Alan bazında fallback: TR seo/açıklama yok → EN seo_description. */
    expect(result).toBe(ORIGINAL_SEO_DESCRIPTION.trim());
  });

  it("5b) çeviri ve EN seo_description YOK → EN description'dan excerpt", async () => {
    findOneMock.mockResolvedValue({ data: null, error: null });
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      null,
      LONG_DESCRIPTION_HTML,
      "tr"
    );
    expect(result).not.toMatch(/<[^>]*>/);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
  });

  /* --- 6) DB hatası (E) --- */
  it("6) DB hatası dönerse → exception FIRLATMADAN ana içerik (EN) seo_description'ı döner", async () => {
    findOneMock.mockResolvedValue({
      data: null,
      error: { message: "connection lost" },
    });
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      ORIGINAL_SEO_DESCRIPTION,
      ORIGINAL_DESCRIPTION,
      "tr"
    );
    expect(result).not.toMatch(/<[^>]*>/);
    expect(result).toBe(ORIGINAL_SEO_DESCRIPTION.trim());
  });

  /* --- 7) doğru locale + entity ile çağrılır, title/description ile AYNI
     cache-anahtarını reuse eder (Phase 8B test #8 ile AYNI desen/AYNI
     kısıtlama notu — bkz. dosya başı yorum) --- */
  it("7) helper, findOne'ı seo_title ile AYNI (entity, villaId, locale) anahtarıyla çağırır", async () => {
    findOneMock.mockResolvedValue({
      data: {
        id: "t4",
        villa_id: VILLA_ID,
        locale: "tr",
        title: "Villa In Love",
        description: "<p>Muhteşem bir villa açıklaması.</p>",
        seo_title: null,
        seo_description: "A stunning villa with sea view.",
        created_at: "",
        updated_at: "",
      },
      error: null,
    });

    await getVillaTranslatedSeoTitle(VILLA_ID, "Orijinal SEO Başlık", "tr");
    await getVillaTranslatedSeoDescription(
      VILLA_ID,
      ORIGINAL_SEO_DESCRIPTION,
      ORIGINAL_DESCRIPTION,
      "tr"
    );

    expect(findOneMock).toHaveBeenCalledTimes(2);
    const [titleCallArgs, seoDescriptionCallArgs] = findOneMock.mock.calls;
    expect(titleCallArgs).toEqual(["villa", VILLA_ID, "tr"]);
    expect(seoDescriptionCallArgs).toEqual(["villa", VILLA_ID, "tr"]);
    expect(titleCallArgs).toEqual(seoDescriptionCallArgs);
  });

  /* --- 8) 160 karakter + "…" davranışı EN'nin makeExcerpt'iyle
     BİREBİR AYNI (uzunluk sınırı + ellipsis karakteri) --- */
  it("8) excerpt TAM OLARAK 160 karaktere kırpılır ve '…' ile biter (EN makeExcerpt ile aynı davranış)", async () => {
    findOneMock.mockResolvedValue({ data: null, error: null });
    const veryLong = "A".repeat(300);
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      null,
      veryLong,
      "tr"
    );
    expect(result.length).toBe(160);
    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, 159)).toBe("A".repeat(159));
  });

  it("8b) description 160 karakterden KISAYSA excerpt AYNEN döner ('…' EKLENMEZ)", async () => {
    findOneMock.mockResolvedValue({ data: null, error: null });
    const short = "Kısa bir açıklama.";
    const result = await getVillaTranslatedSeoDescription(
      VILLA_ID,
      null,
      short,
      "tr"
    );
    expect(result).toBe(short);
  });
});
