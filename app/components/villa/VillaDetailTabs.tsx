"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  VILLA_TABS_ANCHOR_ID,
  VILLA_TAB_CHANGED_EVENT,
  VILLA_TAB_OPEN_EVENT,
  isVillaTabId,
} from "@/app/components/villa/villa-detail-events";

/* ===============================================================
   🛡️ VillaDetailTabs — tab-content switching (scroll/anchor DEĞİL)
   ===============================================================
   Açıklama altında tek aktif panel: seçilen sekmenin content'i
   görünür, diğerleri DOM'dan kalkar. Default: Fiyatlar. Sekme seçimi
   üst navigasyon şeridinden (VillaSectionNav) / kart kısayolundan
   `villa-detail:tab-open` olayıyla gelir; kendi sekme bandı YOK.

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
};

export default function VillaDetailTabs({
  fiyatlar,
  musaitlik,
  konum,
  ozellikler,
}: Props) {
  const tabs: { id: string; content: ReactNode }[] = [
    { id: "fiyatlar", content: fiyatlar },
    { id: "musaitlik", content: musaitlik },
    { id: "konum", content: konum },
    { id: "ozellikler", content: ozellikler },
  ];

  /* Default: Fiyatlar (Option A). */
  const [active, setActive] = useState(tabs[0].id);
  const activeContent = tabs.find((t) => t.id === active)?.content ?? null;

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
      new CustomEvent(VILLA_TAB_CHANGED_EVENT, { detail: { id: active } }),
    );
  }, [active]);

  return (
    <div id={VILLA_TABS_ANCHOR_ID} className="scroll-mt-28 md:scroll-mt-32">
      {/* CONTENT PANEL — yalnız aktif tab; key ile smooth fade.
          Eski sekme bandı kaldırıldı: sekme seçimi artık YALNIZ üst
          navigasyon şeridinden (VillaSectionNav) olay ile gelir. */}
      <div key={active} className="fade-in">
        {activeContent}
      </div>
    </div>
  );
}
