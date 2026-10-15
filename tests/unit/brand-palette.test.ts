/* ===============================================================
   🥇 MARKA PALETİ (2026-10) — kilit testi
   ===============================================================
   Sitenin tüm mavi (#278BD0 ailesi, admin cyan/sky) ve turuncu
   (#FF805E mercan ailesi) vurguları tek ALTIN aileye taşındı:
   temel #C8973A. Nötrler (beyaz, krem, koyu lacivert #24364B, gri/
   stone/sand) korunur. Altın zeminde metin koyu (ink) olmalıdır —
   beyaz metin altın üzerinde ≈2.6:1 ile okunaksızdır.
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

describe("Marka paleti — altın #C8973A", () => {
  const css = readFileSync("app/globals.css", "utf-8");

  it("globals.css semantik tokenları altın ailede; nötrler korunur", () => {
    expect(css).toMatch(/--color-brand:\s*#c8973a;/i);
    expect(css).toMatch(/--color-accent:\s*#c8973a;/i);
    expect(css).toMatch(/--brand-coral:\s+#c8973a;/i);
    expect(css).toMatch(/--color-champagne-500:\s*#c8973a;/i);
    expect(css).toMatch(/--color-brand-strong:\s*#926b27;/i);
    expect(css).toMatch(/--admin-accent:\s*#c8973a;/i);
    /* Nötrler DEĞİŞMEDİ. */
    expect(css).toMatch(/--color-ink:\s*#24364b;/i);
    expect(css).toMatch(/--color-stone-900:\s*#24364b;/i);
  });

  it("altın CTA'da koyu metin (beyaz değil)", () => {
    const btn = css.slice(css.indexOf(".btn-primary {"));
    expect(btn.slice(0, btn.indexOf("}"))).toMatch(/color:\s*#24364b;/);
  });

  it("proje genelinde (public + admin) eski mavi/turuncu vurgu değeri kalmadı", () => {
    const offenders = [...walk("app"), ...walk("lib")].filter((f) =>
      OLD_ACCENTS.test(stripComments(readFileSync(f, "utf-8"))),
    );
    expect(offenders).toEqual([]);
  });

  it("düz altın zeminli sınıf dizilerinde beyaz metin yok", () => {
    const gold =
      /(?<![\w:-])bg-(?:brand|accent)(?:-hover|-active)?(?![\w/-])|(?<![\w:-])bg-\[var\(--brand-coral\)\](?!\/)/;
    const offenders: string[] = [];
    for (const f of walk("app").filter((p) => p.endsWith(".tsx"))) {
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
