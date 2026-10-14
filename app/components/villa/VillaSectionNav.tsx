"use client";

import { useEffect, useState } from "react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import {
  VILLA_TAB_CHANGED_EVENT,
  isVillaTabId,
  openVillaTab,
  scrollToVillaDescription,
  type VillaTabId,
} from "@/app/components/villa/villa-detail-events";

/* ===============================================================
   🛡️ VillaSectionNav — villa detay üst navigasyon şeridi
   ===============================================================
   Yalnız MEVCUT bölümlere yönlendirir (yeni işlev/bölüm YOK):
     - Açıklama   → açıklama bölümüne kaydırır
     - Fiyatlar / Müsaitlik / Konum / Özellikler → mevcut
       VillaDetailTabs sekmesini açar + sekme bandına kaydırır.
   URL/hash/query DEĞİŞMEZ. Mevcut sekme tıklamaları aynen çalışır;
   şerit, sekmenin yayınladığı "değişti" olayını dinleyerek aktif
   öğeyi senkron gösterir.
   =============================================================== */

type NavId = "aciklama" | VillaTabId;

export default function VillaSectionNav({ locale }: { locale?: Locale }) {
  const dict = getDictionary(locale);
  const items: { id: NavId; label: string }[] = [
    { id: "aciklama", label: dict.villaTabs.description },
    { id: "fiyatlar", label: dict.villaTabs.prices },
    { id: "musaitlik", label: dict.villaTabs.availability },
    { id: "konum", label: dict.villaTabs.location },
    { id: "ozellikler", label: dict.villaTabs.features },
  ];

  const [current, setCurrent] = useState<NavId>("aciklama");

  useEffect(() => {
    function onChanged(e: Event) {
      const id = (e as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isVillaTabId(id)) setCurrent(id);
    }
    window.addEventListener(VILLA_TAB_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(VILLA_TAB_CHANGED_EVENT, onChanged);
  }, []);

  function handleClick(id: NavId) {
    setCurrent(id);
    if (id === "aciklama") scrollToVillaDescription();
    else openVillaTab(id);
  }

  return (
    <nav
      aria-label={dict.villaTabs.sectionNavAriaLabel}
      data-villa-section-nav
      className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex h-14 min-w-max items-stretch">
        {items.map((item) => {
          const isActive = current === item.id;
          return (
            <li key={item.id} className="flex">
              <button
                type="button"
                onClick={() => handleClick(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={
                  "relative flex items-center whitespace-nowrap px-4 md:px-5 text-[13.5px] tracking-[0.01em] transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50 " +
                  (isActive
                    ? "bg-brand text-white font-semibold"
                    : "text-ink font-medium hover:bg-brand-soft hover:text-brand")
                }
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
