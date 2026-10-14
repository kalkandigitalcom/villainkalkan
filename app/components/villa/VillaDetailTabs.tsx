import type { ReactNode } from "react";

import {
  villaSectionAnchorId,
  type VillaSectionId,
} from "@/app/components/villa/villa-detail-events";

/* ===============================================================
   🛡️ VillaDetailTabs — villa detay içerik bölümleri (ardışık)
   ===============================================================
   Fiyatlar, Müsaitlik, Konum ve Özellikler artık sekme içinde
   GİZLENMEZ: dördü de sayfada aynı anda, bu sırayla açık durur.
   Her bölüm, üst navigasyon şeridinin (VillaSectionNav) kaydırma
   hedefi olan bir id taşır (`villa-fiyatlar`, `villa-musaitlik`, …).

   ⚠️ Section'lar PROP olarak gelir (page'deki mevcut JSX aynen —
   yeniden oluşturulmaz). Bu component yalnız yerleşimi yönetir;
   pricing / calendar / map / distances logic'ine HİÇ dokunmaz.
   =============================================================== */

type Props = {
  fiyatlar: ReactNode;
  musaitlik: ReactNode;
  /** Konum paneli — Mesafeler (Yakındaki Noktalar). */
  konum: ReactNode;
  ozellikler: ReactNode;
};

export default function VillaDetailTabs({
  fiyatlar,
  musaitlik,
  konum,
  ozellikler,
}: Props) {
  const sections: { id: VillaSectionId; content: ReactNode }[] = [
    { id: "fiyatlar", content: fiyatlar },
    { id: "musaitlik", content: musaitlik },
    { id: "konum", content: konum },
    { id: "ozellikler", content: ozellikler },
  ];

  return (
    <div className="space-y-10 md:space-y-12">
      {sections.map((s) => (
        <div
          key={s.id}
          id={villaSectionAnchorId(s.id)}
          data-villa-section={s.id}
          className="scroll-mt-[180px]"
        >
          {s.content}
        </div>
      ))}
    </div>
  );
}
