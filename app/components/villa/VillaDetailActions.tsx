"use client";

import { CalendarDays, Images } from "lucide-react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import type { Locale } from "@/lib/i18n/config";
import {
  openVillaGallery,
  openVillaAvailability,
} from "@/app/components/villa/villa-detail-events";

/* ===============================================================
   🛡️ Villa detay — küçük EK tetikleyiciler (yalnız görünüm)
   ===============================================================
   - VillaShowPhotosButton: MEVCUT Gallery lightbox'ını açar.
   - VillaAvailabilityShortcut: rezervasyon kartının MEVCUT takvimini
     popup'ta açar (aynı tarih state'i). Kart mantığına dokunmaz.
     Görünüm: beyaz zemin + koyu lacivert metin (altın şerit üzerinde
     ayrışır); hover/aktif'te açık altın ton ve altın kenar.
   =============================================================== */

export function VillaShowPhotosButton({
  count,
  locale,
}: {
  count: number;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={openVillaGallery}
      data-villa-show-photos
      className="
        inline-flex items-center gap-2.5
        rounded-full bg-[var(--color-section-nav-bg)] hover:bg-white active:bg-[var(--color-stone-100)]
        px-6 py-3
        text-[13px] font-semibold text-ink
        shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)]
        transition-colors duration-200 motion-reduce:transition-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink
      "
    >
      <Images size={17} strokeWidth={1.8} aria-hidden />
      {formatDictionaryString(dict.villaHero.showPhotos, { count })}
    </button>
  );
}

export function VillaAvailabilityShortcut({ locale }: { locale?: Locale }) {
  const dict = getDictionary(locale);
  /* 🎨 2026-10 — premium görünüm (yalnız tasarım; işlev AYNI).
     Dış kap bant yüksekliğinde (h-14 = 56px) kalır → lg'de aside'ın
     `-mt-14` hizası bozulmaz; buton h-11 ile bandın içinde dikeyde
     ortalanır, üst/alt ~6px nefes payı. Zemin: açık altın geçiş
     (brand-soft → champagne-100), ince altın kenarlık (ring — global
     `* { border-color }` kuralı border utility'sini ezdiği için), lacivert metin,
     lacivert daire içinde altın takvim ikonu. Hover: hafif yükselme +
     altın gölge + tek seferlik yumuşak parlama (sürekli animasyon YOK). */
  return (
    <div className="flex h-14 items-center">
      <button
        type="button"
        onClick={openVillaAvailability}
        aria-haspopup="dialog"
        data-villa-availability-shortcut
        className="
          group relative flex h-11 w-full items-center justify-center gap-2.5 overflow-hidden
          rounded-full ring-1 ring-inset ring-brand/60
          bg-gradient-to-r from-brand-soft via-[var(--color-champagne-100)] to-brand-soft
          px-5
          text-[13px] font-semibold tracking-[0.01em] text-ink
          shadow-[0_10px_24px_-14px_rgba(27,46,94,0.45),0_4px_12px_-8px_rgba(200,151,58,0.55)]
          transition-[transform,box-shadow] duration-300 ease-out motion-reduce:transition-none
          hover:-translate-y-0.5 hover:ring-brand
          hover:shadow-[0_14px_28px_-14px_rgba(27,46,94,0.5),0_8px_22px_-10px_rgba(200,151,58,0.75)]
          active:translate-y-0
          motion-reduce:hover:translate-y-0
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2
        "
      >
        {/* Hover parlaması — tek geçiş, yalnız transform (GPU). */}
        <span
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-y-0 -left-1/2 w-1/2
            -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent
            -translate-x-full opacity-0
            transition-[transform,opacity] duration-700 ease-out
            group-hover:translate-x-[300%] group-hover:opacity-100
            motion-reduce:hidden
          "
        />
        <span
          aria-hidden="true"
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-brand shadow-[0_2px_6px_-2px_rgba(27,46,94,0.5)]"
        >
          <CalendarDays size={15} strokeWidth={2} />
        </span>
        <span className="relative">{dict.villaHero.availabilityCalendar}</span>
      </button>
    </div>
  );
}
