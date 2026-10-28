// @vitest-environment node
/* ===============================================================
   🛡️ URL YAPISI — ESKİ `/en` ADRESLERİ → YENİ ADRESLER (308)
   ===============================================================
   İngilizce varsayılan dildir ve prefix'siz yaşar; Türkçe `/tr`.
   Eski `/en/...` bağlantıları kalıcı (308) olarak prefix'siz adrese
   taşınır, query string korunur. Admin auth akışı DEĞİŞMEZ.
=============================================================== */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

import { legacyEnRedirectPath } from "@/lib/i18n/legacy-en-redirect";
import { middleware, config } from "@/middleware";

describe("legacyEnRedirectPath", () => {
  it.each([
    ["/en", "/"],
    ["/en/", "/"],
    ["/en/kiralik-villa/villa-x", "/kiralik-villa/villa-x"],
    ["/en/arama", "/arama"],
    ["/en/p/hakkimizda", "/p/hakkimizda"],
  ])("%s → %s", (input, expected) => {
    expect(legacyEnRedirectPath(input)).toBe(expected);
  });

  it.each(["/", "/tr", "/tr/arama", "/energy", "/english-villas", "/kiralik-villalar", "/maki-admin"])(
    "%s → yönlendirme YOK",
    (input) => {
      expect(legacyEnRedirectPath(input)).toBeNull();
    }
  );
});

describe("middleware — eski /en adresleri", () => {
  it("/en/kiralik-villa/x?start=1 → 308 /kiralik-villa/x?start=1 (query korunur)", async () => {
    const res = await middleware(
      new NextRequest("https://example.com/en/kiralik-villa/x?start=2026-10-01&adults=2")
    );
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(
      "https://example.com/kiralik-villa/x?start=2026-10-01&adults=2"
    );
  });

  it("/en → 308 /", async () => {
    const res = await middleware(new NextRequest("https://example.com/en"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://example.com/");
  });

  it("matcher eski /en adreslerini ve admin'i kapsar; diğer public sayfalar matcher DIŞINDA", () => {
    expect(config.matcher).toEqual(["/maki-admin/:path*", "/en", "/en/:path*"]);
  });

  it("admin akışı DEĞİŞMEDİ: oturumsuz /maki-admin → login yönlendirmesi", async () => {
    const res = await middleware(new NextRequest("https://example.com/maki-admin/villas"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://example.com/maki-admin/login?redirect=%2Fmaki-admin%2Fvillas"
    );
  });
});
