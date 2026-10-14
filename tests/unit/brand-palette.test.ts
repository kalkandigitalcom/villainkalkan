/* ===============================================================
   🎨 MARKA PALETİ (2026) — kilit testi
   ===============================================================
   Yeni palet: canlı mavi #278BD0 · beyaz · mercan #FF805E · koyu
   metin #24364B. Eski petrol (#244C45), altın (#C9A55A), koyu petrol
   (#1C3C36) ve lacivert (#0B1F3A) public arayüzde marka rengi olarak
   KULLANILMAZ. Admin paneli (`maki-admin`, `components/admin`) ve
   VillaCard'ın admin'e özgü curation tonları (AMENITY_TONE) kapsam
   dışıdır.
   =============================================================== */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const OLD = /#(244c45|c9a55a|1c3c36|0b1f3a|d4b25f|bb9649|a88438|e9d3a0|142c28|1f3d38)\b|rgba?\(\s*(36,\s*76,\s*69|201,\s*165,\s*90)\b/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (/maki-admin|components[\\/]admin/.test(p)) continue;
      walk(p, out);
    } else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("Marka paleti — public arayüz", () => {
  it("globals.css semantik tokenları yeni değerlerde", () => {
    const css = readFileSync("app/globals.css", "utf-8");
    expect(css).toMatch(/--color-brand:\s*#278bd0;/i);
    expect(css).toMatch(/--color-accent:\s*#ff805e;/i);
    expect(css).toMatch(/--color-ink:\s*#24364b;/i);
    expect(css).toMatch(/--color-stone-900:\s*#24364b;/i);
    expect(css).toMatch(/--brand-coral:\s+#278bd0;/i);
  });

  it("globals.css public bölümünde eski marka renkleri yok (admin pin bloğu hariç)", () => {
    const css = readFileSync("app/globals.css", "utf-8");
    const pub = stripComments(css.slice(0, css.indexOf("ADMIN RENK PİNİ")));
    expect(pub).not.toMatch(OLD);
  });

  it("public bileşenlerde eski marka rengi kodu kalmadı", () => {
    const files = [...walk("app/components"), ...walk("app/(public)")];
    const offenders: string[] = [];
    for (const f of files) {
      let src = stripComments(readFileSync(f, "utf-8"));
      if (f.endsWith("VillaCard.tsx")) {
        /* Admin curation varyantına özgü pastel tonlar kapsam dışı. */
        const i = src.indexOf("const AMENITY_TONE");
        if (i >= 0) src = src.slice(0, i);
      }
      if (OLD.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
