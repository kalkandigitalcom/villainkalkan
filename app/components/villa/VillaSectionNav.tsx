"use client";

import { useEffect, useRef, useState } from "react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import {
  VILLA_SECTION_IDS,
  VILLA_SECTION_SCROLL_EVENT,
  getFixedHeaderHeight,
  getVillaStickyOffset,
  isVillaSectionId,
  scrollToVillaSection,
  villaSectionAnchorId,
  type VillaSectionId,
} from "@/app/components/villa/villa-detail-events";

/* ===============================================================
   🛡️ VillaSectionNav — villa detay üst navigasyon şeridi
   ===============================================================
   - Sayfa akışında doğal yerinde durur; kullanıcı şeride ulaşınca
     sabit Header'ın (TopBar dahil, ölçülen GERÇEK yükseklik) hemen
     altında yapışkan kalır (CSS `position: sticky`).
   - Öğeler sayfada hep açık duran bölümlere yumuşak kaydırır:
     Açıklama · Fiyatlar · Mesafeler · Özellikler · Yorumlar.
     Müsaitlik takvimi sağdaki "Müsaitlik Takvimi" butonuyla popup'ta.
   - Aktif öğe: tıklanan öğe hemen; kullanıcı kendisi kaydırınca
     ekrandaki bölüm. Tek (rAF ile seyreltilmiş) scroll dinleyicisi.
   URL/hash/query DEĞİŞMEZ.
   =============================================================== */

/** SSR / ilk boya için Header yüksekliği (Header spacer'ı ile aynı). */
const DEFAULT_HEADER_OFFSET = 108;

export default function VillaSectionNav({ locale }: { locale?: Locale }) {
  const dict = getDictionary(locale);
  /* Müsaitlik takvimi şeritte değil: sağdaki "Müsaitlik Takvimi"
     butonu (rezervasyon kartı) popup'ta açar. */
  const labels: Record<VillaSectionId, string> = {
    aciklama: dict.villaTabs.description,
    fiyatlar: dict.villaTabs.prices,
    konum: dict.villaTabs.distances,
    ozellikler: dict.villaTabs.features,
    yorumlar: dict.villaTabs.reviews,
  };

  const [current, setCurrent] = useState<VillaSectionId>("aciklama");
  const [headerOffset, setHeaderOffset] = useState(DEFAULT_HEADER_OFFSET);
  const [stuck, setStuck] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /* Tıklamayla başlayan yumuşak kaydırma sürerken scroll-spy aradaki
     bölümleri aktif yapıp "titretmesin" diye kısa kilit. */
  const lockRef = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let frame = 0;

    function scheduleUnlock(ms: number) {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      unlockTimer.current = setTimeout(() => {
        lockRef.current = false;
        update();
      }, ms);
    }

    function update() {
      const header = getFixedHeaderHeight();
      if (header > 0) setHeaderOffset(header);
      const topPx = header > 0 ? header : DEFAULT_HEADER_OFFSET;

      const bar = barRef.current;
      if (bar) setStuck(bar.getBoundingClientRect().top <= topPx + 1);

      if (lockRef.current) {
        /* Kaydırma bitene kadar (son olaydan 150 ms sonra) bekle. */
        scheduleUnlock(150);
        return;
      }

      const offset = getVillaStickyOffset();
      let next: VillaSectionId = "aciklama";
      for (const id of VILLA_SECTION_IDS) {
        const el = document.getElementById(villaSectionAnchorId(id));
        if (el && el.getBoundingClientRect().top - offset <= 1) next = id;
      }
      setCurrent(next);
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    }

    function onSectionScroll(e: Event) {
      const id = (e as CustomEvent<{ id?: unknown }>).detail?.id;
      if (!isVillaSectionId(id)) return;
      setCurrent(id);
      lockRef.current = true;
      /* Hedef zaten görünürse hiç scroll olayı gelmeyebilir. */
      scheduleUnlock(1200);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener(VILLA_SECTION_SCROLL_EVENT, onSectionScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener(VILLA_SECTION_SCROLL_EVENT, onSectionScroll);
    };
  }, []);

  /* Dar ekranda aktif öğe şeridin görünür alanında kalsın (yalnız
     şeridin yatay kaydırması; sayfa dikey kaymaz). */
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const btn = list.querySelector<HTMLElement>(
      `[data-section-id="${current}"]`,
    );
    if (!btn) return;
    const left = btn.offsetLeft;
    const right = left + btn.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = Math.max(0, left - 16);
    }
  }, [current]);

  return (
    <div
      ref={barRef}
      data-villa-section-nav-bar=""
      data-stuck={stuck ? "true" : undefined}
      style={{ top: headerOffset }}
      className={
        /* Sitenin mevcut turuncu marka rengi (`--color-accent`, #C8973A)
           — şeridin tamamı; ayrı beyaz kap yok. */
        "sticky bg-accent shadow-[0_10px_24px_-22px_rgba(36,54,75,0.45)] px-5 md:px-10 lg:px-16 " +
        /* Doğal konumda z-index YOK → DOM'da sonra gelen rezervasyon
           kartı şeridin üstüne taşar (kart kendi stacking context'ini
           kurmaz; içindeki popup'lar Header'ın üstüne çıkabilir).
           Yapışınca şerit içeriğin üstünde kalır (Header z-50 altında). */
        (stuck ? "z-30" : "")
      }
    >
      <div className="max-w-site mx-auto grid grid-cols-1 lg:grid-cols-10 lg:gap-10">
        <div className="min-w-0 lg:col-span-7">
          <nav
            aria-label={dict.villaTabs.sectionNavAriaLabel}
            data-villa-section-nav
          >
            <ul
              ref={listRef}
              className="flex h-14 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {VILLA_SECTION_IDS.map((id) => {
                const isActive = current === id;
                return (
                  <li key={id} className="flex shrink-0">
                    <button
                      type="button"
                      data-section-id={id}
                      onClick={() => scrollToVillaSection(id)}
                      aria-current={isActive ? "true" : undefined}
                      className={
                        /* Turuncu zeminde koyu lacivert metin (≈5:1 kontrast).
                           Aktif öğe zemin DEĞİŞTİRMEZ: yalnız metin genişliği
                           boyunca alttan ince çizgi; hover'da aynı çizgi
                           yarı saydam önizleme olarak belirir. */
                        "relative flex items-center whitespace-nowrap px-4 md:px-5 text-[13.5px] tracking-[0.01em] text-ink " +
                        "after:pointer-events-none after:absolute after:inset-x-4 md:after:inset-x-5 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors after:duration-200 motion-reduce:after:transition-none " +
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60 " +
                        (isActive
                          ? "font-semibold after:bg-ink"
                          : "font-medium after:bg-transparent hover:after:bg-ink/35")
                      }
                    >
                      {labels[id]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
