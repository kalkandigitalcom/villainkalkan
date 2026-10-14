/* ===============================================================
   🎛️ İNDİRİMLİ VİLLALAR — AKTİF KART TASARIMI
   ===============================================================
   Ana sayfada YALNIZ bu sabitle seçilen tasarım render edilir.
     "a" → DiscountVillaCardA (Premium Yatay Kart)
     "b" → DiscountVillaCardB (Editoryal Lüks Kart)
     "c" → VillaCard variant="discount" — public kart tasarım sistemi
           ("petrol fiyat paneli"; tüm public villa kartlarıyla aynı)
   İki tasarımı yan yana karşılaştırmak için geliştirme ortamında:
     /onizleme/indirimli-villalar  (production'da 404)
   =============================================================== */

export type DiscountCardDesign = "a" | "b" | "c";

/* Onaylı tasarım: "a". "c" yalnız önizleme sayfasında karşılaştırma
   için tutulur; ana sayfanın varsayılanı DEĞİLDİR. */
export const DISCOUNT_CARD_DESIGN: DiscountCardDesign = "a";
