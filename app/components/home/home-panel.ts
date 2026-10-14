/* ===============================================================
   🤍 Ana sayfa beyaz bölüm paneli — TEK kaynak
   ===============================================================
   "İndirimli Kiralık Villalar", "Sizin için seçtiklerimiz" ve
   "Misafirlerimiz ne diyor?" bölümleri aynı beyaz paneli kullanır:
   sayfa zemininden ayrılan, hafif yuvarlak köşeli, ince kenarlıklı ve
   yumuşak gölgeli kap. Yalnız kapsayıcı görünümü; içerik, kartlar ve
   kaydırma davranışı bileşenlerin kendisinde AYNEN kalır.
   =============================================================== */

/** Bölümün dış kabuğu (yatay sayfa boşluğu + bölümler arası dikey boşluk). */
export const HOME_PANEL_SECTION_CLASS =
  "px-5 md:px-10 lg:px-16 py-10 md:py-14";

/** 1210px ortak çizgide beyaz panel. */
export const HOME_PANEL_CLASS =
  "max-w-site mx-auto rounded-[24px] md:rounded-[28px] bg-white border border-[var(--color-stone-100)] shadow-[0_18px_44px_-30px_rgba(36,54,75,0.28)] px-4 py-8 sm:px-6 md:px-8 md:py-12";
