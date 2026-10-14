"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* 🛡️ PHASE 10G — locale-aware sekme etiketleri. `locale` OPSİYONEL,
   default "tr" → TR çıktısı BİREBİR AYNI (dictionary TR değerleri bu
   dosyanın eski hardcoded metinleriyle byte-identical). */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import {
  VILLA_TABS_ANCHOR_ID,
  VILLA_TAB_CHANGED_EVENT,
  VILLA_TAB_OPEN_EVENT,
  isVillaTabId,
} from "@/app/components/villa/villa-detail-events";

/* ===============================================================
   🛡️ VillaDetailTabs — tab-content switching (scroll/anchor DEĞİL)
   ===============================================================
   Açıklama altında tab band. Tek aktif panel: tıklanan tab'ın
   content'i görünür, diğerleri DOM'dan kalkar. Default: Fiyatlar.

   ⚠️ Section'lar PROP olarak gelir (page'de zaten mevcut JSX taşındı —
   duplicate render yok). Bu component yalnız UI + görünürlük yönetir;
   pricing / calendar / map / distances logic'ine HİÇ dokunmaz.
   =============================================================== */

type Props = {
  fiyatlar: ReactNode;
  musaitlik: ReactNode;
  /** Konum paneli — harita + Mesafeler (Yakındaki Noktalar) birlikte. */
  konum: ReactNode;
  ozellikler: ReactNode;
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış). */
  locale?: Locale;
};

export default function VillaDetailTabs({
  fiyatlar,
  musaitlik,
  konum,
  ozellikler,
  locale,
}: Props) {
  const dict = getDictionary(locale);
  const tabs: { id: string; label: string; content: ReactNode }[] = [
    { id: "fiyatlar", label: dict.villaTabs.prices, content: fiyatlar },
    { id: "musaitlik", label: dict.villaTabs.availability, content: musaitlik },
    { id: "konum", label: dict.villaTabs.location, content: konum },
    { id: "ozellikler", label: dict.villaTabs.features, content: ozellikler },
  ];

  /* Default: Fiyatlar (Option A). */
  const [active, setActive] = useState(tabs[0].id);
  const activeContent =
    tabs.find((t) => t.id === active)?.content ?? null;

  /* 🛡️ EK — üst navigasyon şeridi / kart kısayolu aynı `setActive`'i
     tetikleyebilsin diye window olayı dinlenir. Mevcut tab tıklaması
     DEĞİŞMEDİ; URL/hash kullanılmaz. */
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isVillaTabId(id)) setActive(id);
    }
    window.addEventListener(VILLA_TAB_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VILLA_TAB_OPEN_EVENT, onOpen);
  }, []);

  /* 🛡️ EK — aktif sekme değişince şeridin vurgusu senkron kalsın
     (ilk render'da yayın yapılmaz; şerit "Açıklama" ile başlar). */
  const lastEmitted = useRef(active);
  useEffect(() => {
    if (lastEmitted.current === active) return;
    lastEmitted.current = active;
    window.dispatchEvent(
      new CustomEvent(VILLA_TAB_CHANGED_EVENT, { detail: { id: active } })
    );
  }, [active]);

  return (
    <div id={VILLA_TABS_ANCHOR_ID} className="scroll-mt-28 md:scroll-mt-32">
      {/* TAB BAND — modern segmented navigation rail: klasik altı-çizili
          tab DEĞİL. Solid beyaz yüzey + ince border; active öğenin
          arka planı mevcut soft/nötr zemininde kalır, yalnız
          metin/ikon rengi marka turuncusu (#FF805E) ile öne çıkar
          (sol gradient accent çizgisi kaldırıldı). Tab switching
          state/logic'i (useState `active`, onClick) AYNEN; yalnız
          renk tasarımı değişti. */}
      <nav aria-label={dict.villaTabs.navAriaLabel}>
        <div className="rounded-2xl border border-[var(--color-stone-100)] bg-white shadow-sm p-1.5 overflow-x-auto">
          <ul className="flex items-center gap-1 min-w-max md:min-w-0 md:w-full">
            {tabs.map((t) => {
              const isActive = active === t.id;
              return (
                <li key={t.id} className="md:flex-1">
                  <button
                    type="button"
                    onClick={() => setActive(t.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={
                      "flex items-center md:w-full md:justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] tracking-[0.01em] transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]/40 " +
                      (isActive
                        ? "bg-[var(--color-stone-50)] text-brand font-semibold"
                        : "text-[var(--color-stone-500)] font-medium hover:text-brand hover:bg-[var(--color-stone-50)]/60")
                    }
                  >
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* CONTENT PANEL — yalnız aktif tab; key ile smooth fade. */}
      <div key={active} className="fade-in mt-6 md:mt-7">
        {activeContent}
      </div>
    </div>
  );
}
