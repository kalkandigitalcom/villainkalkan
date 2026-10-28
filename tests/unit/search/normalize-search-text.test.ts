/* ===============================================================
   🔎 lib/search.ts — normalizeSearchText REGRESSION TEST
   ===============================================================
   AMAÇ:
     villa adı araması (`searchByTitle`), `normalizeSearchText` ile
     üretilen `needle`'ı search_title (migration 065, GENERATED STORED)
     kolonuna karşı ILIKE ile arar. Kolon formülü (translate ç/Ç→c ğ/Ğ→g
     ı→i İ→i ö/Ö→o ş/Ş→s ü/Ü→u â/Â→a î/Î→i û/Û→u → lower → whitespace
     sadeleştir → btrim) ile bu fonksiyonun AYNI kanonu üretmesi gerekir.
     Bu test o varsayımı KİLİTLER — DB'ye bağımlı DEĞİL, saf fonksiyon testi.

   Senaryo (title = "Villa Aydoğdu"):
    "Aydoğdu" / "Aydogdu" / "aydoğdu" / "aydogdu" → AYNI needle "aydogdu"
    "Doğdu" / "Dogdu" / "doğdu" / "dogdu"         → AYNI needle "dogdu"
   =============================================================== */

import { describe, it, expect } from "vitest";
import { normalizeSearchText, escapeLikePattern } from "@/lib/search";

describe("normalizeSearchText — search_title needle kanonu", () => {
  it("'Villa Aydoğdu' için 8 terim de AYNI needle'a foldlanır", () => {
    const aydogduVariants = ["Aydoğdu", "Aydogdu", "aydoğdu", "aydogdu"];
    const dogduVariants = ["Doğdu", "Dogdu", "doğdu", "dogdu"];

    for (const term of aydogduVariants) {
      expect(normalizeSearchText(term)).toBe("aydogdu");
    }
    for (const term of dogduVariants) {
      expect(normalizeSearchText(term)).toBe("dogdu");
    }
  });

  it("normalize edilmiş title ('villa aydogdu') tüm 8 terimin needle'ını substring olarak içerir", () => {
    // search_title GENERATED STORED kolonunun üreteceği değeri simüle eder
    // (aynı translate/lower formülü — migration 065, TR-fold + lower).
    const simulatedSearchTitle = normalizeSearchText("Villa Aydoğdu");
    expect(simulatedSearchTitle).toBe("villa aydogdu");

    const terms = [
      "Aydoğdu",
      "Aydogdu",
      "aydoğdu",
      "aydogdu",
      "Doğdu",
      "Dogdu",
      "doğdu",
      "dogdu",
    ];
    for (const term of terms) {
      const needle = normalizeSearchText(term);
      expect(simulatedSearchTitle.includes(needle)).toBe(true);
    }
  });

  it("tek başına Türkçe harfler doğru ASCII karşılığına foldlanır (ç,ğ,ı,İ,ö,ş,ü)", () => {
    expect(normalizeSearchText("ç")).toBe("c");
    expect(normalizeSearchText("ğ")).toBe("g");
    expect(normalizeSearchText("ı")).toBe("i");
    expect(normalizeSearchText("İ")).toBe("i");
    expect(normalizeSearchText("ö")).toBe("o");
    expect(normalizeSearchText("ş")).toBe("s");
    expect(normalizeSearchText("ü")).toBe("u");
  });

  it("regresyon — mevcut villa adı (title/search_title) araması davranışı DEĞİŞMEDİ", () => {
    // search_title (migration 065) hâmâ AYNI formülü kullanıyor; bu test
    // yalnızca normalizeSearchText'in title-arama senaryosunda da tutarlı
    // kaldığını doğrular (regression guard, DB'ye dokunmaz).
    expect(normalizeSearchText("Villa Irmak")).toBe("villa irmak");
    expect(normalizeSearchText("villa ırmak")).toBe("villa irmak");
    expect(normalizeSearchText("VİLLA IRMAK")).toBe("villa irmak");
  });

  it("boş/whitespace-only terim → boş needle (searchByTitle needle.length===0 erken [] davranışı bununla tutarlı)", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   ")).toBe("");
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
  });

  it("escapeLikePattern — needle ILIKE wildcard karakterlerini literal'e çevirir (davranış korunuyor)", () => {
    expect(escapeLikePattern("50%_off")).toBe("50\\%\\_off");
    expect(escapeLikePattern(normalizeSearchText("Doğdu"))).toBe("dogdu");
  });
});
