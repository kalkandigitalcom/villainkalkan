import {
  ArrowDownToLine,
  Baby,
  House,
  MoveHorizontal,
  Ruler,
  Umbrella,
  Users,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatPoolDimension } from "@/lib/dimension.helper";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import {
  buildPoolCards,
  type PoolCardSource,
  type PoolTypeKey,
} from "@/lib/pool.helper";
import { getPoolTypeLabel } from "@/lib/pool-label.helper";

/* ===============================================================
   🛡️ VillaPoolSection — PHASE 10E BATCH 5
   ===============================================================
   TR villa detay sayfasının ("Havuz Bilgileri" bloğu,
   app/(public)/kiralik-villa/[slug]/page.tsx) SALT-SUNUM karşılığı.

   ⚠️ TR SAYFASI BU COMPONENT'İ KULLANMIYOR — kendi inline JSX'i AYNEN
   duruyor. Bu, `VillaDistancesSection` / `VillaFeaturesSection` ile
   AYNI, projede zaten onaylanmış desendir (Phase 8D-2: "EN/DE için
   küçük, salt-sunum server component'leri; TR dosyasına dokunulmaz").
   Böylece TR çıktısı sıfır riskle byte-identical kalır.

   Server component (interaktivite yok — "use client" GEREKMİYOR).
   DB'ye/translation tablosuna HİÇ erişmez.

   🛡️ TİP ↔ ETİKET YÖNÜ: kartlar canonical `PoolTypeKey` taşır
   (lib/pool.helper.ts); etiket yalnız render anında dictionary'den
   türetilir. Çevrilmiş metinden tip/ikon çıkarımı YAPILMAZ — ikon
   (Waves) zaten tipten bağımsız, section geneline aittir.

   🎨 2026-10 GÖRSEL DÜZEN (yalnız sunum; veri/koşul DEĞİŞMEDİ):
     - Beyaz ana kart (açıklama / oda / fiyat kartlarıyla aynı kap).
     - Her havuz kendi ince çerçeveli beyaz kutusunda: tip ikonu + adı;
       altında Genişlik / Uzunluk / Derinlik üç sütun (ikonlu etiket +
       lacivert değer). Masaüstü 2 sütun, mobil tek sütun.
     - Renkli zemin, gradient, gölge YOK. İkon tipten (canonical
       PoolTypeKey) seçilir — çevrilmiş metinden çıkarım YOK.
   =============================================================== */

/* Havuz tipine göre minimal ikon (canonical anahtar → ikon). */
const POOL_TYPE_ICON: Record<PoolTypeKey, LucideIcon> = {
  private: Waves,
  private_sheltered: Umbrella,
  shared: Users,
  indoor: House,
  child: Baby,
};

type Props = {
  villa: PoolCardSource;
  locale: Locale;
};

export default function VillaPoolSection({ villa, locale }: Props) {
  const cards = buildPoolCards(villa);
  if (cards.length === 0) return null;

  const dict = getDictionary(locale);

  return (
    <section className="rounded-[20px] bg-white px-5 py-6 md:px-7 md:py-7">
      <h2 className="font-display text-2xl md:text-3xl text-[var(--color-stone-900)] tracking-[-0.015em]">
        {dict.pool.sectionTitle}
      </h2>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {cards.map((c) => {
          const hasDims = !!(c.width || c.length || c.depth);
          const TypeIcon = POOL_TYPE_ICON[c.type] ?? Waves;
          const rows = [
            { k: dict.pool.width, v: formatPoolDimension(c.width), Icon: MoveHorizontal },
            { k: dict.pool.length, v: formatPoolDimension(c.length), Icon: Ruler },
            { k: dict.pool.depth, v: formatPoolDimension(c.depth), Icon: ArrowDownToLine },
          ];
          return (
            <div
              key={c.key}
              data-pool-card={c.key}
              className="min-w-0 rounded-xl border border-[var(--color-stone-200)] bg-white px-4 py-4 md:px-5"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-stone-50)] text-ink"
                >
                  <TypeIcon size={17} strokeWidth={1.8} />
                </span>
                <p className="min-w-0 font-display text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-stone-900)]">
                  {getPoolTypeLabel(c.type, locale)}
                </p>
              </div>

              {hasDims ? (
                <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--color-stone-200)] border-t border-[var(--color-stone-100)] pt-3.5">
                  {rows.map(({ k, v, Icon }) => (
                    <div key={k} className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-3">
                      <dt className="flex items-center gap-1.5 text-[11.5px] text-[var(--color-stone-500)]">
                        <Icon
                          size={13}
                          strokeWidth={1.9}
                          aria-hidden
                          className="shrink-0 text-brand"
                        />
                        <span className="truncate">{k}</span>
                      </dt>
                      <dd className="mt-1 font-display text-[15px] md:text-[16px] font-semibold text-[var(--color-stone-900)] tabular-nums">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-[12.5px] text-[var(--color-stone-400)] italic">
                  {dict.pool.noDimensions}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
