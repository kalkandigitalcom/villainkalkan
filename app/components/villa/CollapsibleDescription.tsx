"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

/* 🛡️ PHASE 10G — locale-aware buton metni. `locale` OPSİYONEL,
   default "tr" → TR çıktısı BİREBİR AYNI. */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ COLLAPSIBLE DESCRIPTION — "Villa hakkında" aç/kapa
   ===============================================================
   Villa detay açıklaması uzun olduğunda dikey alanı azaltmak için
   önce kısa bir önizleme (max-height clamp), altında "Devamını Oku"
   butonu gösterir. Tık → tam metin yumuşak açılır, buton "Daha Az
   Göster" olur.

   SEO / SSR:
     Client component olsa da App Router bunu server'da da render eder;
     `dangerouslySetInnerHTML` ile TAM sanitize'lı HTML ilk SSR
     çıktısında DOM'da bulunur → crawler tam metni görür. Clamp yalnız
     CSS (max-height + mask-image); metin gizlenmez, sadece görsel.

   FADE:
     Renk eşleştirme yerine `mask-image` linear-gradient kullanılır;
     metnin kendisi alttan şeffaflaşır, zemin renginden BAĞIMSIZ (her
     zaman temiz) — kart artık düz beyaz.

   KART KABI (2026-10): Beyaz kart kutusu artık çağıran tarafta
   (VillaDetailBody açıklama `<section>`'ı: başlık + etiketler + metin
   + buton TEK kartta). Bu component yalnız metni ve butonu render eder.

   TİPOGRAFİ KORUMA:
     `.villa-description` sınıfı HTML'i DOĞRUDAN saran div'de kalır
     (`.villa-description > :first-child` direct-child CSS kuralı
     bozulmasın). Kart kutusu / padding dış wrapper'da.
   =============================================================== */

export default function CollapsibleDescription({
  html,
  collapsible,
  locale,
}: {
  html: string;
  collapsible: boolean;
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış). */
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const [expanded, setExpanded] = useState(false);
  const clamped = collapsible && !expanded;

  return (
    <div className="mt-4">
      <div
        className={
          "villa-description text-[var(--color-stone-600)] leading-[1.75] text-[14px] " +
          "overflow-hidden transition-[max-height] duration-500 ease-in-out " +
          (clamped
            ? "max-h-[7.5rem] md:max-h-[10.5rem] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
            : "max-h-[3000px]")
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="
            group mt-5 inline-flex items-center gap-3 rounded-full
            border border-[var(--color-stone-200)] bg-white
            py-1.5 pl-4 pr-1.5 text-[13.5px] font-semibold text-ink
            hover:border-[var(--color-stone-300)] transition-colors motion-reduce:transition-none
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]/40
          "
        >
          {expanded ? dict.villa.readLess : dict.villa.readMore}
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-white"
          >
            <ChevronRight
              size={15}
              strokeWidth={2.2}
              className={
                "transition-transform duration-300 motion-reduce:transition-none " +
                (expanded ? "-rotate-90" : "")
              }
            />
          </span>
        </button>
      )}
    </div>
  );
}
