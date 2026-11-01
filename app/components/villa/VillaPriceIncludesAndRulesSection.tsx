import { Check, Info, ScrollText, Ticket } from "lucide-react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ VillaPriceIncludesAndRulesSection — PHASE 8D-2
   ===============================================================
   TR villa detay sayfasının (`app/(public)/kiralik-villa/[slug]/
   page.tsx`, satır ~769-846) "INCLUDES + RULES" bloğunun
   SALT-SUNUM extraction'ı — TR'nin AYNI koşullu wrapper mantığı
   (ikisi de boşsa hiçbir şey render edilmez; ikisi de doluysa lg+
   ekranda 2-kolon yan yana). TR dosyası bu component'i KULLANMIYOR —
   kendi inline JSX'i AYNEN, DOKUNULMADAN duruyor; yalnız EN/DE villa
   detay sayfaları import eder.

   Server component; server-only translation/repository koduna HİÇ
   erişmez. Hardcoded TR metinleri ("Konaklama ücretine dahil",
   "Konaklama kuralları") BİLİNÇLİ OLARAK ÇEVRİLMEDİ (kapsam dışı).

   🎨 2026-10 GÖRSEL DÜZEN (yalnız sunum; veri/koşul DEĞİŞMEDİ):
     - TEK beyaz ana kart (açıklama / oda / havuz kartlarıyla aynı kap).
     - Üstte "Konaklama Ücretine Dahil Olanlar": bilet ikonlu başlık,
       lacivert onay işaretli 2 sütunlu sade liste (mobil tek sütun).
     - Hemen altında, ince ayraçla "Konaklama Kuralları": ince
       çerçeveli küçük satır kutuları (2 sütun / mobil tek sütun).
     - Emerald/rose renkli zeminler, hover gölgesi kaldırıldı.
     - Veri modelinde "dahil olmayan" hizmet alanı YOK → çarpı işaretli
       liste render EDİLMEZ (içerik uydurulmaz).
   =============================================================== */

export type TranslatedPriceInclude = {
  id: string;
  displayTitle: string;
};

export type TranslatedRule = {
  id: string;
  displayTitle: string;
};

export default function VillaPriceIncludesAndRulesSection({
  priceIncludes,
  rules,
  locale,
}: {
  priceIncludes: TranslatedPriceInclude[];
  rules: TranslatedRule[];
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış). */
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  if (priceIncludes.length === 0 && rules.length === 0) {
    return null;
  }

  const hasIncludes = priceIncludes.length > 0;
  const hasRules = rules.length > 0;

  return (
    <div className="pub-card pub-card-pad">
      {hasIncludes && (
        <section aria-labelledby="villa-price-includes-title">
          <div className="flex items-center gap-2.5">
            <Ticket
              size={20}
              strokeWidth={1.8}
              aria-hidden
              className="shrink-0 text-ink"
            />
            <h2
              id="villa-price-includes-title"
              className="font-display text-2xl md:text-3xl text-[var(--color-stone-900)] tracking-[-0.015em]"
            >
              {dict.villa.priceIncludesTitle}
            </h2>
          </div>

          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {priceIncludes.map((p) => (
              <li
                key={p.id}
                className="flex min-w-0 items-start gap-3 text-[14px] leading-snug text-[var(--color-stone-700)]"
              >
                <Check
                  size={17}
                  strokeWidth={2.2}
                  aria-hidden
                  className="mt-px shrink-0 text-ink"
                />
                <span className="min-w-0 break-words">{p.displayTitle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasRules && (
        <section
          aria-labelledby="villa-rules-title"
          className={
            hasIncludes
              ? "mt-7 border-t border-[var(--color-stone-200)] pt-7"
              : ""
          }
        >
          <div className="flex items-center gap-2.5">
            <ScrollText
              size={20}
              strokeWidth={1.8}
              aria-hidden
              className="shrink-0 text-ink"
            />
            <h2
              id="villa-rules-title"
              className="font-display text-2xl md:text-3xl text-[var(--color-stone-900)] tracking-[-0.015em]"
            >
              {dict.villa.rulesTitle}
            </h2>
          </div>

          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex min-w-0 items-start gap-2.5 pub-card-sm px-3.5 py-2.5 text-[13.5px] leading-snug text-[var(--color-stone-700)]"
              >
                <Info
                  size={15}
                  strokeWidth={2}
                  aria-hidden
                  className="mt-px shrink-0 text-brand"
                />
                <span className="min-w-0 break-words">{r.displayTitle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
