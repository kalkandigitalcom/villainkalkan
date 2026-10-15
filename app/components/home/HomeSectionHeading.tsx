/* ===============================================================
   ✨ Ana sayfa bölüm başlığı — TEK kaynak
   ===============================================================
   "Öne Çıkan Villalar", "İndirimli Kiralık Villalar", "Villa Kiralama
   Bölgeleri" ve "Kısa Süreli Tarihler" aynı ortalanmış başlığı;
   SSS ve "Misafirlerimiz ne diyor?" ise yalnız altın süsü
   (HomeSectionOrnament) kullanır.

   Süs yalnız dekoratiftir (aria-hidden): sabit genişlikli kısa altın
   çizgiler + ortada küçük bir elmas. Metin akışını, hizalamayı veya
   sayfa genişliğini etkilemez. Renk: marka altını (bg-brand = #C8973A).
   =============================================================== */
import type { ReactNode } from "react";

/** Ortalanmış ana sayfa bölüm başlığının tipografisi. */
export const HOME_SECTION_TITLE_CLASS =
  "font-display font-semibold text-[24px] md:text-[30px] text-[var(--color-stone-900)] leading-tight tracking-[-0.02em]";

export function HomeSectionOrnament({
  align = "center",
}: {
  align?: "center" | "start";
}) {
  const centered = align === "center";
  return (
    <div
      aria-hidden="true"
      data-home-heading-ornament={align}
      className={
        "mt-3 md:mt-4 flex items-center gap-2 " +
        (centered ? "justify-center" : "justify-start")
      }
    >
      {centered && (
        <span className="h-px w-8 md:w-12 bg-gradient-to-r from-transparent to-brand" />
      )}
      <span className="size-1.5 shrink-0 rotate-45 rounded-[1px] bg-brand" />
      <span
        className={
          "h-px bg-gradient-to-l from-transparent to-brand " +
          (centered ? "w-8 md:w-12" : "w-12 md:w-16")
        }
      />
    </div>
  );
}

export default function HomeSectionHeading({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div data-home-section-heading className="text-center mb-8 md:mb-12">
      <h2 className={HOME_SECTION_TITLE_CLASS}>{title}</h2>
      <HomeSectionOrnament />
      {subtitle ? (
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-stone-500)] max-w-md mx-auto">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
