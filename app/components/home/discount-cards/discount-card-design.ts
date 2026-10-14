/* ===============================================================
   🎛️ İNDİRİMLİ VİLLALAR — AKTİF KART TASARIMI
   ===============================================================
   Ana sayfada YALNIZ bu sabitle seçilen tasarım render edilir.
     "a" → DiscountVillaCardA (Premium Yatay Kart)
     "b" → DiscountVillaCardB (Editoryal Lüks Kart)
   İki tasarımı yan yana karşılaştırmak için geliştirme ortamında:
     /onizleme/indirimli-villalar  (production'da 404)
   =============================================================== */

export type DiscountCardDesign = "a" | "b";

export const DISCOUNT_CARD_DESIGN: DiscountCardDesign = "a";
