"use client";

/* ===============================================================
   🛡️ VillaMapModal — "Nerede?" kartının Harita/Yol Tarifi butonları
   + tıklanınca açılan harita modalı.
   ===============================================================
   AMAÇ:
     Sağ kolondaki "Nerede?" kartında artık harita iframe/embed'i
     KART İÇİNDE HER ZAMAN GÖRÜNMÜYOR — yalnız "Harita" butonuna
     basılınca bu modal içinde açılıyor. "Yol Tarifi" butonu ise
     (öncekiyle birebir aynı davranış) Google Maps yol tarifi
     linkini yeni sekmede açar.

     Harita render mantığı (map_type/coords/iframe/embed/fallback,
     dangerouslySetInnerHTML, villa.latitude/longitude/map_embed)
     BİREBİR aynı; yalnız DOM konumu (artık her zaman görünen kart
     yerine, modal içine) değişti — hiçbir koşul/veri silinmedi.

     Modal pattern'i (ESC → close, backdrop click → close, body
     scroll lock, role="dialog" aria-modal) mevcut VillaVideoModal
     ile AYNI mimariyi izler (bkz. app/components/villa/VillaVideoModal.tsx)
     — proje için yeni bir "harita sistemi" icat edilmedi, var olan
     modal deseni haritaya uygulandı.

   ASLA dokunulmadı: koordinat/harita verisi, booking/reservation,
   pricing, availability, Gallery, BookingSidebar.
   =============================================================== */

import { useEffect, useState } from "react";
import { X, Map as MapIcon, MapPin, Navigation, Navigation2 } from "lucide-react";

/* 🛡️ PHASE 10G — locale-aware UI metinleri + Google Maps embed `hl=`
   parametresi. `locale` OPSİYONEL, default "tr" → TR çıktısı BİREBİR
   AYNI. Harita verisi/koşulları (map_type/coords/embed) DEĞİŞMEDİ. */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { extractSafeMapEmbedSrc } from "@/lib/map-embed.helper";

type Props = {
  mapType?: string;
  latitude?: number;
  longitude?: number;
  mapEmbed?: string;
  villaTitle?: string;
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış). */
  locale?: Locale;
  /** 2026-10 — "buttons" (varsayılan): sağ kolon "Nerede?" kartındaki
   *  iki buton. "panel": Yakındaki Noktalar bölümünün sağ paneli —
   *  üst üste iki eşit aksiyon alanı. Modal, harita verisi ve yol
   *  tarifi URL'i iki varyantta da BİREBİR aynı. */
  variant?: "buttons" | "panel";
};

export default function VillaMapModal({
  mapType,
  latitude,
  longitude,
  mapEmbed,
  villaTitle,
  locale,
  variant = "buttons",
}: Props) {
  const dict = getDictionary(locale);
  const [isOpen, setIsOpen] = useState(false);

  /* === ESC tuşu → close (VillaVideoModal ile aynı desen) === */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  /* === Body scroll lock === */
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const hasCoords =
    mapType === "coords" && !!latitude && !!longitude;
  /* 🛡️ SEC-05 — ham iframe HTML basmak yerine yalnız güvenli
     (allow-list'li) Google Maps `src` URL'ini çıkar; iframe'i biz
     üretiriz. Geçerli embed yoksa harita bölümü gösterilmez. */
  const safeMapEmbedSrc =
    mapType === "iframe" ? extractSafeMapEmbedSrc(mapEmbed) : null;
  const hasEmbed = !!safeMapEmbedSrc;
  const hasDirections = !!latitude && !!longitude;
  /* Yol tarifi URL'i — iki varyantta da AYNI. */
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  /* Panel varyantı — aksiyon alanı ortak sınıfları. `lang` — kök
     <html lang> varsayılan dilde sabit; TR "İ" büyük harfi için
     CSS uppercase'e doğru dili bildirir. */
  const panelActionClass =
    "group flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 md:py-10 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40";
  const panelCircleClass =
    "flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-stone-200)] bg-white text-brand transition-colors duration-200 motion-reduce:transition-none group-hover:border-brand";
  const panelLabelClass =
    "text-[13px] md:text-[14px] font-extrabold uppercase tracking-[0.06em] text-ink";

  return (
    <>
      {variant === "panel" ? (
        <div className="flex h-full flex-col">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className={panelActionClass}
          >
            <span aria-hidden="true" className={panelCircleClass}>
              <MapPin size={24} strokeWidth={2} />
            </span>
            <span lang={dict.map.embedLanguage} className={panelLabelClass}>
              {dict.map.showOnMap}
            </span>
          </button>

          <span aria-hidden="true" className="h-px w-full shrink-0 bg-[var(--color-stone-200)]" />

          {hasDirections ? (
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className={panelActionClass}
            >
              <span aria-hidden="true" className={panelCircleClass}>
                <Navigation2 size={24} strokeWidth={2} />
              </span>
              <span lang={dict.map.embedLanguage} className={panelLabelClass}>
                {dict.map.getDirections}
              </span>
            </a>
          ) : (
            <div
              aria-disabled="true"
              title={dict.map.directionsUnavailableTitle}
              className={panelActionClass + " cursor-not-allowed opacity-50"}
            >
              <span aria-hidden="true" className={panelCircleClass}>
                <Navigation2 size={24} strokeWidth={2} />
              </span>
              <span lang={dict.map.embedLanguage} className={panelLabelClass}>
                {dict.map.getDirections}
              </span>
            </div>
          )}
        </div>
      ) : (
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="
            inline-flex items-center justify-center gap-2
            rounded-xl bg-brand hover:bg-brand-hover px-4 py-3.5
            text-[13px] font-semibold text-ink
            shadow-[0_10px_24px_-12px_rgba(200,151,58,0.55)]
            transition-[transform,box-shadow,background-color] duration-200 motion-reduce:transition-none
            hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-12px_rgba(200,151,58,0.65)]
            motion-reduce:hover:translate-y-0
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40
          "
        >
          <MapIcon size={16} strokeWidth={1.8} />
          {dict.map.openMap}
        </button>

        {hasDirections ? (
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center justify-center gap-2
              rounded-xl border-2 border-brand bg-white px-4 py-3.5
              text-[13px] font-semibold text-ink
              transition-[transform,box-shadow,background-color] duration-200 motion-reduce:transition-none
              hover:-translate-y-0.5 hover:bg-brand/5
              hover:shadow-[0_14px_28px_-16px_rgba(27,46,94,0.45)]
              motion-reduce:hover:translate-y-0
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40
            "
          >
            <Navigation size={16} strokeWidth={1.8} />
            {dict.map.directions}
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={dict.map.directionsUnavailableTitle}
            className="
              inline-flex items-center justify-center gap-2
              rounded-xl border-2 border-[var(--color-stone-200)] bg-white px-4 py-3.5
              text-[13px] font-semibold text-[var(--color-stone-300)]
              cursor-not-allowed
            "
          >
            <Navigation size={16} strokeWidth={1.8} />
            {dict.map.directions}
          </button>
        )}
      </div>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            villaTitle
              ? formatDictionaryString(dict.map.modalAriaLabel, {
                  title: villaTitle,
                })
              : dict.map.modalAriaLabelFallback
          }
          className="fade-in fixed inset-0 z-[1100] flex items-center justify-center p-4"
        >
          {/* Backdrop — click → close (VillaVideoModal ile aynı desen) */}
          <div
            aria-hidden
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          <div className="relative w-full max-w-2xl">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={dict.map.closeAriaLabel}
              className="
                absolute -top-12 right-0 sm:-top-2 sm:-right-12
                w-10 h-10 rounded-full
                bg-white/15 hover:bg-white/25
                border border-white/25
                backdrop-blur-md
                flex items-center justify-center
                text-white
                transition-colors motion-reduce:transition-none
                focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60
                z-10
              "
            >
              <X size={18} />
            </button>

            <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--color-stone-100)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/15 to-brand/15 text-brand">
                  <MapIcon size={15} strokeWidth={1.8} />
                </span>
                <h2 className="font-display text-[16px] text-[var(--color-stone-900)] tracking-[-0.01em]">
                  {dict.map.whereTitle}
                </h2>
              </div>

              {hasCoords && (
                <iframe
                  src={`https://www.google.com/maps?q=${latitude},${longitude}&hl=${dict.map.embedLanguage}&z=14&output=embed`}
                  className="w-full h-[60vh] max-h-[480px] border-0"
                  loading="lazy"
                />
              )}

              {hasEmbed && (
                <>
                  <iframe
                    src={safeMapEmbedSrc as string}
                    title={villaTitle || dict.map.whereTitle}
                    className="w-full h-[60vh] max-h-[480px] border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="p-4 md:px-5 border-t border-[var(--color-stone-100)] text-sm text-[var(--color-stone-500)]">
                    {dict.map.poweredByGoogle}
                  </div>
                </>
              )}

              {!hasCoords && !hasEmbed && (
                <div className="h-[240px] flex items-center justify-center text-[var(--color-stone-400)] italic">
                  {dict.map.noLocation}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
