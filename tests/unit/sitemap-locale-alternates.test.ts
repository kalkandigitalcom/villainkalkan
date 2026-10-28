/* ===============================================================
   🛡️ PHASE 7D — SITEMAP LOCALE ALTERNATES TESTLERİ
   ===============================================================
   Hedef: app/sitemap.ts > default export (sitemap())

   `app/sitemap.ts` içindeki `SITE_URL` sabiti MODÜL YÜKLEME anında
   `process.env.NEXT_PUBLIC_SITE_URL`'i okuyor — bu yüzden her testte
   `vi.stubEnv` + `vi.resetModules()` + dinamik `import()` kullanılır
   (request-locale.test.ts'teki AYNI, kanıtlanmış desen — cache()'in
   modül-seviyesi sabitler için de geçerli bir analogu).

   Mock seviyesi: yalnız DB repository'leri (`villaAdminRepository`,
   `pagesRepository`, `blogRepository`) ve `getCachedSettings`
   mock'lanır — hiçbiri bu fazda GERÇEKTEN değiştirilmedi.
   `buildLocaleAlternates` (Phase 7B) mock'lanmıyor, gerçek
   implementasyonuyla çalışıyor.

   GERÇEK DB'YE HİÇ DOKUNULMAZ, production'a bağlanılmaz.
   =============================================================== */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const listPublicSlugsMock = vi.fn();
const findActivePagesMock = vi.fn();
const findActiveSlugsMock = vi.fn();
const getCachedSettingsMock = vi.fn();

vi.mock("@/lib/db/villa.repository.server", () => ({
  villaAdminRepository: {
    listPublicSlugs: (...args: unknown[]) => listPublicSlugsMock(...args),
  },
}));
vi.mock("@/lib/db/pages.repository", () => ({
  pagesRepository: {
    findActivePages: (...args: unknown[]) => findActivePagesMock(...args),
  },
}));
vi.mock("@/lib/db/blog.repository", () => ({
  blogRepository: {
    findActiveSlugs: (...args: unknown[]) => findActiveSlugsMock(...args),
  },
}));
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: (...args: unknown[]) => getCachedSettingsMock(...args),
}));

const VILLA_ROWS = [
  { slug: "villa-in-love", created_at: "2024-01-01T00:00:00.000Z" },
  { slug: "villa-sunset", created_at: "2024-02-01T00:00:00.000Z" },
];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

  listPublicSlugsMock.mockReset();
  findActivePagesMock.mockReset();
  findActiveSlugsMock.mockReset();
  getCachedSettingsMock.mockReset();

  listPublicSlugsMock.mockResolvedValue(VILLA_ROWS);
  findActivePagesMock.mockResolvedValue({
    data: [{ slug: "hakkimizda", created_at: "2024-01-01T00:00:00.000Z" }],
    error: null,
  });
  findActiveSlugsMock.mockResolvedValue({
    data: [
      {
        slug: "ilk-yazi",
        published_at: "2024-01-01T00:00:00.000Z",
        updated_at: null,
      },
    ],
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function runSitemap() {
  const mod = await import("@/app/sitemap");
  return mod.default();
}

function villaEntry(
  entries: Awaited<ReturnType<typeof runSitemap>>,
  slug: string
) {
  return entries.find((e) => e.url === `https://example.com/kiralik-villa/${slug}`);
}

describe("sitemap() — URL yapısı: EN prefix'siz (varsayılan), TR /tr", () => {
  /* --- 5) multilingual ayarı artık public URL yapısını DEĞİŞTİRMEZ --- */
  it("5) multilingual_enabled=false olsa bile alternates üretilir (site yapısal olarak iki dilli)", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: false });
    const entries = await runSitemap();
    const villa = villaEntry(entries, "villa-in-love") as {
      alternates?: { languages?: Record<string, string> };
    };
    expect(villa?.alternates?.languages).toBeDefined();
  });

  it("5b) getCachedSettings reddederse (fail-safe) sitemap yine tam üretilir", async () => {
    getCachedSettingsMock.mockRejectedValue(new Error("settings down"));
    const entries = await runSitemap();
    expect(villaEntry(entries, "villa-in-love")).toBeDefined();
  });

  /* --- 6) alternates doğru --- */
  it("6) villa entry'sinin alternates.languages doğru (absolute URL'ler)", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    const entries = await runSitemap();
    const villa = villaEntry(entries, "villa-in-love") as {
      alternates?: { languages?: Record<string, string> };
    };
    expect(villa.alternates?.languages).toEqual({
      tr: "https://example.com/tr/kiralik-villa/villa-in-love",
      en: "https://example.com/kiralik-villa/villa-in-love",
      "x-default": "https://example.com/kiralik-villa/villa-in-love",
    });
  });

  it("6b) Türkçe kardeş URL'ler AYRI entry olarak yayınlanır, aynı hreflang kümesiyle", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    const entries = await runSitemap();
    const tr = entries.find(
      (e) => e.url === "https://example.com/tr/kiralik-villa/villa-in-love"
    ) as { alternates?: { languages?: Record<string, string> } } | undefined;
    expect(tr).toBeDefined();
    expect(tr?.alternates?.languages).toEqual(
      (villaEntry(entries, "villa-in-love") as {
        alternates?: { languages?: Record<string, string> };
      }).alternates?.languages
    );
  });

  /* --- 7) EN canonical URL --- */
  it("7) villa entry'sinin `url` alanı prefix'siz İngilizce path'tir", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    const entries = await runSitemap();
    expect(villaEntry(entries, "villa-in-love")?.url).toBe(
      "https://example.com/kiralik-villa/villa-in-love"
    );
  });

  /* --- 8) /en hiçbir yerde oluşmuyor --- */
  it("8) HİÇBİR entry/alternates değeri eski '/en' prefix'ini İÇERMEZ", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    const entries = await runSitemap();
    const isEn = (u: string) =>
      u === "https://example.com/en" || u.startsWith("https://example.com/en/");
    for (const entry of entries) {
      expect(isEn(entry.url)).toBe(false);
      const alt = (entry as { alternates?: { languages?: Record<string, string> } })
        .alternates;
      for (const value of Object.values(alt?.languages ?? {})) {
        expect(isEn(value)).toBe(false);
      }
    }
  });

  /* --- 9) x-default EN --- */
  it("9) x-default HER ZAMAN İngilizce (prefix'siz) URL'e eşittir", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    const entries = await runSitemap();
    const villa = villaEntry(entries, "villa-sunset") as {
      alternates?: { languages?: Record<string, string> };
    };
    expect(villa.alternates?.languages?.["x-default"]).toBe(
      "https://example.com/kiralik-villa/villa-sunset"
    );
    expect(villa.alternates?.languages?.["x-default"]).toBe(
      villa.alternates?.languages?.en
    );
  });

  /* --- 10) tüm entry'ler + TR kardeşleri --- */
  it("10) tüm public entry'ler (blog dahil) alternates taşır; ana sayfa '/' + '/tr'", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    const entries = await runSitemap();
    const urls = entries.map((e) => e.url);

    const base = [
      "https://example.com/",
      "https://example.com/kiralik-villalar",
      "https://example.com/iletisim",
      "https://example.com/teklif-al",
      "https://example.com/p/hakkimizda",
      "https://example.com/blog",
      "https://example.com/blog/ilk-yazi",
    ];
    const byUrl = new Map(entries.map((e) => [e.url, e]));
    for (const u of base) {
      expect(urls).toContain(u);
      const trUrl = u === "https://example.com/" ? "https://example.com/tr" : u.replace("https://example.com/", "https://example.com/tr/");
      expect(urls).toContain(trUrl);
      const alt = (byUrl.get(u) as Record<string, unknown> | undefined)
        ?.alternates as { languages?: Record<string, string> } | undefined;
      expect(Object.keys(alt!.languages!).sort()).toEqual(["en", "tr", "x-default"]);
    }

    const homeAlt = (byUrl.get("https://example.com/") as Record<string, unknown>)
      .alternates as { languages: Record<string, string> };
    expect(homeAlt.languages).toEqual({
      tr: "https://example.com/tr",
      en: "https://example.com/",
      "x-default": "https://example.com/",
    });

    const blogAlt = (byUrl.get("https://example.com/blog/ilk-yazi") as Record<string, unknown>)
      .alternates as { languages: Record<string, string> };
    expect(blogAlt.languages.tr).toBe("https://example.com/tr/blog/ilk-yazi");
    expect(blogAlt.languages.en).toBe("https://example.com/blog/ilk-yazi");
    expect(blogAlt.languages["x-default"]).toBe(blogAlt.languages.en);

    // 9 İngilizce entry (4 statik + 2 villa + 1 page + 1 blog-index + 1 blog) + 9 Türkçe kardeş
    expect(entries).toHaveLength(18);
  });

  it("10b) villa fetch exception atarsa (fail-soft) diğer entry'ler yine döner (ÖNCEKİ davranış)", async () => {
    getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true });
    listPublicSlugsMock.mockRejectedValue(new Error("db down"));
    const entries = await runSitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://example.com/");
    expect(urls.some((u) => u.includes("/kiralik-villa/"))).toBe(false);
  });
});
