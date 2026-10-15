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
        rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active
        px-6 py-3
        text-[14px] font-semibold text-ink
        shadow-[0_12px_28px_-14px_rgba(200,151,58,0.9)]
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
  return (
    <button
      type="button"
      onClick={openVillaAvailability}
      aria-haspopup="dialog"
      data-villa-availability-shortcut
      className="
        flex h-14 w-full items-center justify-center gap-2.5
        rounded-2xl bg-brand hover:bg-brand-hover active:bg-brand-active
        px-5
        text-[14px] font-semibold tracking-[0.01em] text-ink
        shadow-[0_14px_30px_-18px_rgba(200,151,58,0.95)]
        transition-colors duration-200 motion-reduce:transition-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2
      "
    >
      <CalendarDays size={18} strokeWidth={1.8} aria-hidden />
      {dict.villaHero.availabilityCalendar}
    </button>
  );
}
