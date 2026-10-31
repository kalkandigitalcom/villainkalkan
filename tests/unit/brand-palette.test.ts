/* ===============================================================
   🥇 MARKA PALETİ (2026-10) — kilit testi
   ===============================================================
   Sitenin tüm mavi (#278BD0 ailesi, admin cyan/sky) ve turuncu
   (#FF805E mercan ailesi) vurguları tek ALTIN aileye taşındı:
   temel #C8973A. Nötrler (beyaz, krem, koyu lacivert #1B2E5E, gri/
   stone/sand) korunur. Altın zeminde metin koyu (ink) olmalıdır —
   beyaz metin altın üzerinde ≈2.6:1 ile okunaksızdır.

   🛡️ ADMIN İSTİSNASI: admin panel bu dönüşüme DAHİL DEĞİLDİR; altın
   dönüşümünden önceki (65c0873^) mavi/turkuaz düzenini korur. Public
   kontroller admin kaynaklarını ve globals.css admin bölümünü hariç
   tutar; admin bölümü ayrıca eski değerlerle doğrulanır.
   =============================================================== */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/* Eski mavi / turuncu / cyan vurgu değerleri (hex + rgb üçlüleri). */
const OLD_ACCENTS =
  /#(278bd0|1f73ad|1a6496|eaf4fb|2179b7|1c6aa1|185985|78b7e3|4aa0da|a9d1ee|d3e8f6|ff805e|f2683f|c44a26|fff1ec|ff9a7f|e8673f|ffe1d7|ffc2b0|ff9f86|ff653f|06b6d4|0ea5e9|0891b2|0e7490|ecfeff|cffafe|a5f3fc|67e8f9|02aae5|0287bd|03729c|045d7e|54c8f3|1fb2ec|90dcf8|c4ecfb|e8f7fd|7dd3fc|ed7926|0973ba|c84a20|7a2912)\b|rgba?\(\s*(39[\s,]+139[\s,]+208|255[\s,]+128[\s,]+94|255[\s,]+101[\s,]+63|6[\s,]+182[\s,]+212|14[\s,]+165[\s,]+233|2[\s,]+170[\s,]+229|125[\s,]+211[\s,]+252|9[\s,]+115[\s,]+186)\b/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ---------------------------------------------------------------
   Kapsam ayrımı
   --------------------------------------------------------------- */
const ADMIN_SOURCE = /(^|[\\/])app[\\/](\(admin\)|components[\\/]admin)[\\/]|AdminGallery\.tsx$/;
const isAdminSource = (f: string) => ADMIN_SOURCE.test(f);

const CSS = readFileSync("app/globals.css", "utf-8");
const ADMIN_START = CSS.indexOf("🌿 ADMIN RENK PİNİ");
const ADMIN_END = CSS.indexOf("VILLA DESCRIPTION");
/* Admin bölümü: admin pinleri + admin'e özgü tüm kurallar. */
const ADMIN_CSS = CSS.slice(ADMIN_START, ADMIN_END);
/* Public CSS: admin bölümü çıkarılmış hâli. */
const PUBLIC_CSS = CSS.slice(0, ADMIN_START) + CSS.slice(ADMIN_END);
/* Altın dönüşümüne karşı eklenen admin eski-renk pini. */
const ADMIN_LEGACY_PIN = ADMIN_CSS.slice(ADMIN_CSS.indexOf("ADMIN ESKİ RENK PİNİ"));

/** `selector {…}` bloğunun gövdesi (ilk eşleşme). */
function block(src: string, selector: string): string {
  const i = src.indexOf(selector + " {");
  expect(i, selector).toBeGreaterThan(-1);
  return src.slice(i, src.indexOf("}", i));
}
/** Yalnız bildirim değerleri (seçicilerdeki escape'li sınıf adları hariç). */
const declValues = (src: string) =>
  [...stripComments(src).matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1]).join("\n");

/* Altın ailesi (dönüşümde eklenen değerler) — admin'de OLMAMALI. */
const GOLD =
  /#(c8973a|d4a64e|bf8d32|b08330|926b27|74551f|dfbd7e|d4aa5a|ecd7ac|f5ead3|fbf6ec)\b|rgba?\(\s*(200[\s,]+151[\s,]+58|223[\s,]+189[\s,]+126|176[\s,]+131[\s,]+48|146[\s,]+107[\s,]+39)\b/i;

describe("Marka paleti — public altın #C8973A", () => {
  const css = CSS;

  it("public @theme semantik tokenları altın ailede; nötrler korunur", () => {
    const theme = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf("@theme"));
    expect(theme).toMatch(/--color-brand:\s*#c8973a;/i);
    expect(theme).toMatch(/--color-accent:\s*#c8973a;/i);
    expect(theme).toMatch(/--brand-coral:\s+#c8973a;/i);
    expect(theme).toMatch(/--color-brand-strong:\s*#926b27;/i);
    /* Nötrler: koyu lacivert #1B2E5E. */
    expect(theme).toMatch(/--color-ink:\s*#1b2e5e;/i);
    expect(theme).toMatch(/--color-stone-900:\s*#1b2e5e;/i);
    /* Public CSS'te admin eski marka değerleri yok. */
    expect(PUBLIC_CSS).not.toMatch(/--color-brand:\s*#278bd0;/i);
  });

  /* 2026-10 — public sayfa zemini #EAF0F6 (`--color-page-bg`); önce #fffaf1. */
  it("sayfa zemini: bg-[var(--color-ivory)] tek tanım, --color-page-bg (#EAF0F6); html/body aynı token; admin istisnası ve token korunur", () => {
    const defs = css.match(/\.bg-\\\[var\\\(--color-ivory\\\)\\\]\s*\{[^}]*\}/g) ?? [];
    expect(defs).toHaveLength(2); /* kural + admin istisnası */
    expect(css).toMatch(/--color-page-bg:\s*#eaf0f6;/);
    expect(css).toMatch(/\n  \.bg-\\\[var\\\(--color-ivory\\\)\\\] \{\n    background-color: var\(--color-page-bg\);\n  \}/);
    expect(css).toMatch(/\nhtml \{\n  background-color: var\(--color-page-bg\);/);
    expect(css).toMatch(/\nbody \{[^}]*background: var\(--color-page-bg\);/);
    expect(css).toMatch(/html:has\(\.admin-shell\) \{\s*background-color: var\(--background\);/);
    expect(css).not.toContain("#fffaf1");
    expect(css).toMatch(/body:has\(\.admin-shell\)\.bg-\\\[var\\\(--color-ivory\\\)\\\] \{\s*background-color: var\(--color-ivory\);/);
    expect(css).toMatch(/--color-ivory:\s*#f6f8fb;/);
    expect(css).not.toContain("#ffede8d1");
  });

  it("koyu lacivert #24364B → #1B2E5E (public'te eski değer yok; yalnız admin pini)", () => {
    const OLD_NAVY = /#24364b\b|rgba?\(\s*36[\s,]+54[\s,]+75\b/i;
    expect(PUBLIC_CSS).not.toMatch(OLD_NAVY);
    const offenders = [...walk("app"), ...walk("lib")]
      .filter((f) => !f.endsWith("globals.css") && !isAdminSource(f))
      .filter((f) => OLD_NAVY.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });

  it("altın CTA'da koyu metin (beyaz değil)", () => {
    expect(block(PUBLIC_CSS, ".btn-primary")).toMatch(/color:\s*#1b2e5e;/);
  });

  it("public kaynaklarda eski mavi/turuncu vurgu değeri kalmadı", () => {
    expect(stripComments(PUBLIC_CSS)).not.toMatch(OLD_ACCENTS);
    const offenders = [...walk("app"), ...walk("lib")]
      .filter((f) => !f.endsWith("globals.css") && !isAdminSource(f))
      .filter((f) => OLD_ACCENTS.test(stripComments(readFileSync(f, "utf-8"))));
    expect(offenders).toEqual([]);
  });

  it("public düz altın zeminli sınıf dizilerinde beyaz metin yok", () => {
    const gold =
      /(?<![\w:-])bg-(?:brand|accent)(?:-hover|-active)?(?![\w/-])|(?<![\w:-])bg-\[var\(--brand-coral\)\](?!\/)/;
    const offenders: string[] = [];
    for (const f of walk("app").filter((p) => p.endsWith(".tsx") && !isAdminSource(p))) {
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(/"[^"]*"|`[^`]*`/g)) {
        const lit = m[0];
        if (gold.test(lit) && /(?<![\w:-])text-white(?![\w-])/.test(lit)) {
          offenders.push(`${f}: ${lit.replace(/\s+/g, " ").slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("Admin paneli — altın dönüşümü öncesi renkler korunur", () => {
  it("admin bölümü globals.css içinde ve public kurallardan ayrık", () => {
    expect(ADMIN_START).toBeGreaterThan(-1);
    expect(ADMIN_END).toBeGreaterThan(ADMIN_START);
    expect(ADMIN_LEGACY_PIN).toContain(".admin-shell {");
  });

  it("admin token pinleri eski mavi/turkuaz değerlerde", () => {
    expect(ADMIN_CSS).toMatch(/--brand-coral:\s*#02aae5;/i);
    expect(ADMIN_CSS).toMatch(/--color-champagne-500:\s*#02aae5;/i);
    expect(ADMIN_CSS).toMatch(/--color-champagne-500:\s*#06b6d4;/i);
    expect(ADMIN_CSS).toMatch(/--admin-accent:\s*#06b6d4;/i);
    expect(ADMIN_CSS).toMatch(/--admin-accent-strong:\s*#0ea5e9;/i);
    expect(ADMIN_CSS).toMatch(/--ring:\s*#02aae5;/i);
    /* Admin kendi nötrleri (lacivert dönüşümünden bağımsız). */
    expect(ADMIN_CSS).toMatch(/--color-stone-900:\s*#0f172a;/i);
  });

  it("public marka/metin rolleri admin'de eski public değerlere sabit", () => {
    const pin = block(ADMIN_LEGACY_PIN, ".admin-shell");
    const expected: Record<string, string> = {
      "--color-brand": "#278bd0",
      "--color-brand-hover": "#1f73ad",
      "--color-brand-active": "#1a6496",
      "--color-brand-soft": "#eaf4fb",
      "--color-accent": "#ff805e",
      "--color-accent-hover": "#f2683f",
      "--color-accent-strong": "#c44a26",
      "--color-accent-soft": "#fff1ec",
      "--color-ink": "#24364b",
    };
    for (const [k, v] of Object.entries(expected)) {
      expect(pin, k).toMatch(new RegExp(`${k}:\\s*${v};`, "i"));
    }
  });

  it("sidebar, butonlar, form odağı, takvim ve seçim eski renklerde", () => {
    expect(block(ADMIN_CSS, ".admin-nav-item.is-active .admin-icon")).toMatch(/#7dd3fc/i);
    expect(block(ADMIN_CSS, ".admin-nav-item.is-active::before")).toMatch(
      /#7dd3fc 0%, #06b6d4 100%/i,
    );
    expect(ADMIN_CSS).toMatch(/\.admin-brand-mark \{[^}]*#1d4ed8 0%,\s*#06b6d4/i);
    expect(block(ADMIN_CSS, ".admin-btn-primary:hover")).toMatch(/rgb\(6 182 212 \/ 0\.55\)/);
    expect(block(ADMIN_CSS, ".admin-search:focus-within")).toMatch(/rgb\(6 182 212 \/ 0\.12\)/);
    expect(ADMIN_CSS).toMatch(
      /\.admin-shell \.react-datepicker__day--in-range \{\s*background: #03729c !important;/,
    );
    expect(block(ADMIN_CSS, ".admin-shell ::selection")).toMatch(/color:\s*#045d7e;/);
  });

  it("admin CSS bildirimlerinde altın değer yok", () => {
    expect(declValues(ADMIN_CSS)).not.toMatch(GOLD);
  });

  it("admin kaynaklarında altın değer ve altın-zemin koyu metni (text-ink) yok", () => {
    const admin = [...walk("app")].filter(isAdminSource);
    expect(admin.length).toBeGreaterThan(20);
    const gold = admin.filter((f) => GOLD.test(stripComments(readFileSync(f, "utf-8"))));
    expect(gold).toEqual([]);
    const ink = admin.filter((f) => /(?<![\w:-])text-ink(?![\w-])/.test(readFileSync(f, "utf-8")));
    expect(ink).toEqual([]);
  });

  it("admin global etkileri: eyebrow, kaydırma çubuğu, sayfa zemini eski değerde", () => {
    expect(block(ADMIN_LEGACY_PIN, ".admin-shell .eyebrow")).toMatch(
      /rgb\(120 183 227 \/ 0\.06\)/,
    );
    expect(ADMIN_LEGACY_PIN).toMatch(/::-webkit-scrollbar-thumb:hover \{\s*background: #78b7e3;/);
    expect(block(ADMIN_LEGACY_PIN, "body:has(.admin-shell)")).toMatch(/rgb\(39 139 208 \/ 0\.10\)/);
  });

  it("admin VillaCard önizlemesi eski renklerde; public VillaCard altın kalır", () => {
    const card = readFileSync("app/components/villa/VillaCard.tsx", "utf-8");
    /* Public kart DEĞİŞMEDİ. */
    expect(card).toContain('className="text-brand shrink-0"');
    expect(card).toMatch(/rounded-tl-\[44px\] bg-brand [^\n]*text-ink/);
    expect(card).toContain('surface: "bg-[#FBF6EC] group-hover:bg-[#F5EAD3]"');
    expect(card).toContain("text-brand-strong");
    /* Admin kapsamında eski değerler. */
    const pin = ADMIN_LEGACY_PIN;
    expect(block(pin, ".admin-shell .lucide-star.text-brand")).toMatch(/oklch\(82\.8% 0\.189 84\.429\)/);
    expect(pin).toMatch(/\.admin-shell \[data-price-panel\] \.text-ink,[^{]*\{\s*color: #fff;/);
    expect(block(pin, ".admin-shell .bg-\\[\\#FBF6EC\\]")).toMatch(/#fff1eb/);
    expect(block(pin, ".admin-shell .text-\\[\\#926b27\\]")).toMatch(/#c84a20/);
    expect(block(pin, ".admin-shell .text-\\[\\#74551f\\]")).toMatch(/#7a2c12/);
    expect(block(pin, ".admin-shell .text-\\[\\#b08330\\]")).toMatch(/#c25a30/);
    expect(pin).toMatch(/group-hover\\:bg-\\\[\\#F5EAD3\\\][^{]*\{\s*background-color: #ffe6d9;/);
  });
});
