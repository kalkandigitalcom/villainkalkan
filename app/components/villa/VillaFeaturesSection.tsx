import { Check } from "lucide-react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ VillaFeaturesSection — PHASE 8D-2
   ===============================================================
   TR villa detay sayfasının (`app/(public)/kiralik-villa/[slug]/
   page.tsx`, "ozellikler" tab slot'u, satır ~608-641) "Ne sunuyor?"
   bloğunun SALT-SUNUM extraction'ı. TR dosyası bu component'i
   KULLANMIYOR — kendi inline JSX'i AYNEN, DOKUNULMADAN duruyor;
   yalnız EN/DE villa detay sayfaları import eder.

   Server component; server-only translation/repository koduna HİÇ
   erişmez — yalnız ZATEN ÇÖZÜLMÜŞ `TranslatedFeature[]` prop'unu
   render eder. Hardcoded TR metinleri ("Ne sunuyor?", "Özellik
   bilgisi bulunmuyor") BİLİNÇLİ OLARAK ÇEVRİLMEDİ (kapsam dışı —
   UI dictionary/localization AYRI bir fazın konusu).
   =============================================================== */

export type TranslatedFeature = {
  id: string;
  /** Gösterilecek metin — çevrilmişse çeviri, yoksa orijinal TR. */
  displayName: string;
};

export default function VillaFeaturesSection({
  features,
  locale,
}: {
  features: TranslatedFeature[];
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış). */
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  return (
    /* 2026-11 — ortak public kart sistemi (beyaz ana kart + ince
       çerçeveli özellik kutuları). */
    <section className="pub-card pub-card-pad">
      <h2 className="font-display text-2xl md:text-3xl text-[var(--color-stone-900)] tracking-[-0.015em]">
        {dict.villa.featuresTitle}
      </h2>

      {features.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-stone-400)] italic">
          {dict.villa.featuresEmpty}
        </p>
      ) : (
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 gap-2.5 mt-5">
          {features.map((f) => (
            <div
              key={f.id}
              className="
                pub-card-sm
                flex min-w-0 items-center gap-2.5
                text-[var(--color-stone-700)]
                px-3.5 py-2.5 text-[13.5px] leading-snug break-words
              "
            >
              <Check
                size={15}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0 text-ink"
              />
              {f.displayName}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
