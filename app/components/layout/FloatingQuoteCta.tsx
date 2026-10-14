"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquareText } from "lucide-react";

import { DEFAULT_LOCALE, localeFromPathname } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localeHref } from "@/lib/i18n/locale-href";

/* ===============================================================
   🛡️ FLOATING "TEKLİF AL" — sol kenardan çıkan sabit CTA
   ===============================================================
   - Header'daki "Teklif Al" butonunun yerini alır. Public layout'ta
     (app/(public)/layout.tsx) TEK kez render edilir → admin'de YOK.
   - Metin: mevcut sözlük anahtarı `header.offer` (Teklif Al / Get a
     Quote / Angebot anfordern). Hedef: mevcut locale-aware rota
     `localeHref("/teklif-al", locale)` (yeni rota YOK).
   - Teklif formunun kendi sayfasında (/teklif-al, /en/teklif-al,
     /de/teklif-al) gizlenir — kullanıcı zaten oradadır.
   - Masaüstü (md+): ekranın sol kenarına yaslı, dikey yazılı "sekme";
     hover/focus'ta kenardan hafifçe dışarı açılır.
   - Mobil (<md): yalnız ikonlu, ~22px görünen ince sekme (erişilebilir
     ad metinle aynı) → sayfa kenar boşluğu (px-5) içinde kalır; içerik,
     BottomNav, WhatsApp/scroll-to-top (alt köşeler) ve çerez bandıyla
     ÇAKIŞMAZ; dikeyde ortada durur.
   - Işık efekti: yavaş (3.6 sn) yumuşak parıltı + seyrek (6 sn) ışık
     süpürmesi. `prefers-reduced-motion` → tüm animasyonlar kapalı.
   - z-40: FloatingSocial / BottomNav ile aynı katman; Header (50),
     çerez bandı (50) ve modaller (1000+) üstte kalır.
   =============================================================== */

/** Teklif sayfasının kendisi mi? (locale prefix'i dikkate alır) */
function isQuotePage(pathname: string | null): boolean {
  if (!pathname) return false;
  const locale = localeFromPathname(pathname);
  const base =
    locale === DEFAULT_LOCALE ? pathname : pathname.slice(locale.length + 1);
  return base === "/teklif-al" || base.startsWith("/teklif-al/");
}

export default function FloatingQuoteCta() {
  const pathname = usePathname();
  if (isQuotePage(pathname)) return null;

  const locale = localeFromPathname(pathname);
  const label = getDictionary(locale).header.offer;
  const href = localeHref("/teklif-al", locale);

  return (
    <>
      <style>{`
        @keyframes quoteCtaGlow {
          0%, 100% { box-shadow: 0 10px 26px -12px rgba(255,128,94,0.75), 0 0 0 0 rgba(255,128,94,0.0); }
          50%      { box-shadow: 0 14px 34px -12px rgba(255,128,94,0.95), 0 0 22px 2px rgba(255,128,94,0.45); }
        }
        @keyframes quoteCtaSweep {
          0%, 70% { transform: translateY(-120%); }
          100%    { transform: translateY(220%); }
        }
        .quote-cta { animation: quoteCtaGlow 3.6s ease-in-out infinite; }
        .quote-cta__sweep { animation: quoteCtaSweep 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .quote-cta, .quote-cta__sweep { animation: none; }
          .quote-cta__sweep { display: none; }
        }
      `}</style>
      <Link
        href={href}
        aria-label={label}
        className="
          quote-cta group
          fixed left-0 top-1/2 -translate-y-1/2 z-40
          flex flex-col items-center gap-2 md:gap-3
          overflow-hidden
          rounded-r-2xl border border-l-0 !border-white/25
          bg-gradient-to-b from-accent via-accent to-accent-hover
          text-ink
          px-1.5 py-2.5 md:pl-2.5 md:pr-3 md:py-5
          -translate-x-1.5 md:-translate-x-1 hover:translate-x-0 focus-visible:translate-x-0
          md:hover:pl-4 md:focus-visible:pl-4
          transition-[transform,padding,filter] duration-300 ease-out
          hover:brightness-105
          motion-reduce:transition-none
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand
        "
      >
        {/* Işık süpürmesi — dekoratif, tıklamayı engellemez. */}
        <span
          aria-hidden
          className="
            quote-cta__sweep pointer-events-none absolute inset-x-0 top-0 h-1/2
            bg-gradient-to-b from-transparent via-white/45 to-transparent
          "
        />
        <MessageSquareText
          aria-hidden
          strokeWidth={2}
          className="relative w-4 h-4 md:w-5 md:h-5 shrink-0"
        />
        {/* Dikey metin (aşağıdan yukarı okunur) — yalnız md+ görünür;
            mobilde erişilebilir ad `aria-label`'dan gelir. */}
        <span
          aria-hidden
          className="
            relative hidden md:block
            [writing-mode:vertical-rl] rotate-180
            text-[13.5px] font-semibold tracking-[0.08em] uppercase whitespace-nowrap
          "
        >
          {label}
        </span>
      </Link>
    </>
  );
}
