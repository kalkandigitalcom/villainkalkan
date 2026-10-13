import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Star } from "lucide-react";

import {
  resolveHeroContent,
  type HeroContent,
} from "@/lib/hero.helpers";

import HeroSearchPanel from "./hero/_components/HeroSearchPanel";
/* 🛡️ PHASE 11 — Hero locale-aware. İÇERİK (badge/title/subtitle/CTA
   metinleri) zaten `resolveHeroContent` tarafından locale'e göre
   çözülüp `content` prop'uyla gelir; burada yalnız görsel alt metni
   ve arama panelinin locale'i kalır. CTA HREF'leri ve hero görseli
   DİL BAĞIMSIZDIR — bu dosyada o mantık DEĞİŞMEDİ. */
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

import type { HeroReviewStats } from "./hero/_types/hero";

/* ===============================================================
   🛡️ HERO — CINEMATIC DUOTONE (yeniden tasarım — brand refresh)
   ===============================================================
   Tasarım yönü (klasik "üstte görsel + ortada metin" kalıbından
   bilinçli çıkış):
     - Full-bleed villa görseli ÜZERİNDE koyu, alttan-yukarı sinematik
       gradient (siyah) — okunabilirlik + "gece / golden hour" luxury
       atmosferi. Metin artık BEYAZ (önceki versiyon koyu metin +
       beyaz overlay kullanıyordu — bilinçli tam ters çevirme).
     - Marka renkleri (#ED7926 turuncu / #0973BA mavi) SADECE vurgu
       katmanlarında: köşe glow'ları, başlık ikinci satırı (gradient
       text-clip), CTA gradient + breathing glow, arama panelindeki
       ikon/hover/odak vurguları. Başka hiçbir ana tema rengi YOK.
     - Floating glass badge (eski turkuaz ping-dot yerine turuncu→mavi
       gradient dot).
     - Arama paneli artık koyu görsel üzerinde yüzen premium glass
       kart — turkuaz yerine turuncu/mavi ring + çok-katmanlı shadow.
     - Hafif, yavaş, rahatsız etmeyen animasyonlar: arka plan görselinde
       çok yavaş "Ken Burns" zoom + dekoratif floating glow orb +
       CTA'larda breathing glow (TopBar shimmer'ıyla AYNI DEĞİL — o
       ışık bandı kullanır, bu `animate-pulse` tabanlı nefes alan
       glow kullanır). Tüm custom keyframe'ler bu component içinde
       local `<style>` ile tanımlanır — globals.css'e DOKUNULMADI.
       `prefers-reduced-motion` için tüm custom animasyonlar kapanır.

   DOKUNULMAYAN İŞ MANTIĞI (AYNEN):
     - HeroSearchPanel state/URL push/datepicker portal AYNEN
       (yalnızca kendi içindeki className/style — bkz. o dosyanın
       başlığı — hiçbir state/handler/effect değişmedi)
     - hero.helpers HeroContent shape AYNEN (badge/title/subtitle/
       backgroundImage/overlayOpacity/primaryCta/secondaryCta)
     - resolveHeroContent default fallback chain AYNEN
     - HeroReviewStats type contract caller'a (page.tsx) AYNEN;
       reviewStats önceki versiyonda da render edilmiyordu (void) —
       bu davranış AYNEN korundu, yeni bir görsel blok icat edilmedi
     - HeroCta akıllı href yönlendirme mantığı (#anchor / http / mailto
       / tel / internal route) BYTE-IDENTICAL
     - `hero.overlayOpacity` (0..1, admin ayarı) artık yeni overlay
       katmanlarının opacity çarpanı olarak KULLANILIYOR — önceki
       "full-bleed premium" revizyonunda bu alan hesaplanıp hiç
       uygulanmıyordu (bkz. lib/hero.helpers.ts yorum satırı); bu,
       zaten var olan admin kontrolünü canlandıran ek bir düzeltme,
       hiçbir mevcut davranışı BOZMUYOR (önceden hiçbir görsel etkisi
       yoktu, şimdi belgelenen amacına kavuşuyor).

   PERFORMANS:
     - <Image priority + fill + sizes="100vw"> LCP optimize (AYNEN)
     - min-h-[60svh] lg:min-h-[78svh] → mount anında sabit ölçü →
       CLS=0 (AYNEN prensip, yalnızca lg değeri büyütüldü — "büyük,
       güçlü Hero" hedefi)
     - Tek hero image fetch (AYNEN)
=============================================================== */

/* ===============================================================
   🛡️ HERO REDESIGN (referans tasarım — premium, merkezi kompozisyon)
   ===============================================================
   - Tam ekran (100svh) full-bleed görsel; header (TopBar + şeffaf bar)
     görselin ÜZERİNDE durur (Header ana sayfada spacer basmaz).
   - Dengeli, düz koyu lacivert overlay + hafif üst/alt kenar koyulaşması
     (yalnız okunabilirlik; dekoratif glow/orb YOK).
   - İçerik yatay + dikey ortalı: rozet (yıldız ikonlu, yarı saydam),
     iki satırlı başlık (merkezi başlık fontu Manrope) (1. satır beyaz, 2. satır altın), açıklama,
     iki CTA (altın dolu + ince kenarlıklı şeffaf), altta kaydırma oku.
   - İÇERİK KAYNAKLARI DEĞİŞMEDİ: rozet/başlık/açıklama/CTA metin+link
     admin ayarlarından (`resolveHeroContent`), görsel admin upload'ı.
   - HeroSearchPanel (tarih/misafir/tip araması) AYNEN korunur; yalnız
     CTA'ların altına yerleşir. State/URL/portal mantığına DOKUNULMADI.
   =============================================================== */

/** Re-export caller path stability. */
export type { HeroReviewStats };

/* ===============================================================
   HeroCta — admin-driven CTA link, akıllı href yönlendirme.
   Buton TEXT + LINK admin settings'ten gelir (hero.primaryCta /
   secondaryCta). Link tipi href'ten türetilir:
     - `#...`            → aynı sayfa smooth scroll (globals:
                            html{scroll-behavior:smooth} + section
                            scroll-mt offset). Plain <a>.
     - `http(s)://...`   → harici, yeni sekme (target=_blank).
     - `mailto:` / `tel:`→ harici protocol, plain <a>.
     - `/...` (diğer)    → dahili route, next/link <Link>.
   Stil/içerik caller'dan (className + children) gelir; bu helper
   yalnız doğru elementi seçer. Hero layout/stiline dokunmaz.
   BU FONKSİYON DEĞİŞMEDİ — yalnızca çağıran yerdeki className/children
   (görsel katman) güncellendi. =============================== */
function HeroCta({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  if (href.startsWith("mailto:") || href.startsWith("tel:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function Hero({
  content,
  reviewStats,
  locale = DEFAULT_LOCALE,
}: {
  content?: HeroContent;
  reviewStats?: HeroReviewStats | null;
  locale?: Locale;
}) {
  const dict = getDictionary(locale).home.hero;
  /* Defensive: prop verilmediyse defaults. */
  const hero: HeroContent = content || resolveHeroContent(null, { locale });
  const titleLines = (hero.title || "").split("\n");

  /* reviewStats render edilmiyor (önceki versiyonda da öyleydi —
     HeroReviewCard kaldırılmıştı) — ama prop type contract caller'a
     (page.tsx) BOZULMASIN diye signature aynen tutuluyor. void to
     silence unused warning. */
  void reviewStats;

  return (
    <>
    <section
      className="
        relative z-20
        min-h-[100svh]
        w-full
        bg-[var(--color-stone-900)]
      "
    >
      {/* 🛡️ Local, component-scoped animasyon — globals.css'e DOKUNULMADI.
         Çok yavaş "Ken Burns" görsel zoom; prefers-reduced-motion'da kapanır. */}
      <style>{`
        @keyframes heroKenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.06); }
        }
        .hero-kenburns { animation: heroKenBurns 28s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .hero-kenburns { animation: none; }
        }
      `}</style>

      <div className="absolute inset-0 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════
          FULL-BLEED BACKGROUND IMAGE — admin source-of-truth (AYNEN)
          priority + fill + sizes="100vw" → LCP optimize.
          object-[center_40%]: mobil kırpımda ufuk/deniz çizgisi görünür.
          ═══════════════════════════════════════════════════════════ */}
      {hero.backgroundImage && (
        <div className="absolute inset-0">
          <Image
            src={hero.backgroundImage}
            alt={hero.title || dict.imageAlt}
            fill
            priority
            sizes="100vw"
            className="hero-kenburns object-cover object-[center_40%]"
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          OVERLAY — dengeli, düz koyu lacivert ton (#0b1f3a). Admin
          `hero.overlayOpacity` (0..1) yoğunluğu ayarlar; metin kontrastı
          için taban 0.6'nın altına düşmez. Üst şerit (header) ve alt
          şerit (arama paneli) için çok hafif kenar koyulaşması.
          ═══════════════════════════════════════════════════════════ */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-[#0b1f3a]/45"
        style={{ opacity: 0.6 + 0.4 * hero.overlayOpacity }}
      />
      <div
        aria-hidden="true"
        className="
          absolute inset-0 pointer-events-none
          bg-[linear-gradient(180deg,rgba(11,31,58,0.45)_0%,rgba(11,31,58,0)_26%,rgba(11,31,58,0)_62%,rgba(11,31,58,0.55)_100%)]
        "
        style={{ opacity: 0.6 + 0.4 * hero.overlayOpacity }}
      />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CONTENT — yatay + dikey ortalı. Üst padding fixed header'ı
          (TopBar + bar) temizler; alt kısımda arama paneli + ok.
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="
          relative
          max-w-[1480px] mx-auto
          px-5 md:px-10 lg:px-[clamp(4rem,7vw,7.5rem)]
          min-h-[100svh]
          flex flex-col
          pt-[132px] md:pt-[148px]
          pb-6 md:pb-8
        "
      >
        <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[880px] mx-auto text-center flex flex-col items-center">
          {/* Rozet — yarı saydam, yıldız ikonlu. Admin "Hero Rozet Metni"
             boşsa (`hero.badge === ""`) HİÇ render edilmez (AYNEN). */}
          {hero.badge && (
            <p
              className="
                inline-flex items-center gap-2.5
                rounded-full border !border-white/25 bg-white/10 backdrop-blur-md
                px-4 md:px-5 py-2
                text-[12.5px] md:text-[14px] font-medium tracking-[0.01em]
                text-white/90
              "
            >
              <Star
                size={15}
                aria-hidden
                className="shrink-0 text-[#D4B25F] fill-[#D4B25F]"
              />
              {hero.badge}
            </p>
          )}

          {/* Başlık — merkezi başlık fontu (Manrope, `.public-shell h1`);
             1. satır beyaz, sonraki satır(lar) altın.
             Admin "Hero Başlığı" boşsa H1 HİÇ render edilmez (AYNEN). */}
          {hero.title && (
            <h1
              className="
                text-[40px] sm:text-[52px] md:text-[64px] lg:text-[76px]
                font-semibold
                leading-[1.1] tracking-[-0.025em]
                text-white
                mt-7 md:mt-9
                [text-wrap:balance]
                [text-shadow:0_2px_28px_rgba(11,31,58,0.35)]
              "
            >
              {titleLines.map((line, i) => (
                <span
                  key={i}
                  className={i === 0 ? "block" : "block text-[#D4B25F]"}
                >
                  {line}
                </span>
              ))}
            </h1>
          )}

          {/* Açıklama */}
          {hero.subtitle && (
            <p
              className="
                text-[16px] md:text-[19px] lg:text-[21px] leading-[1.65]
                text-white/90
                mt-5 md:mt-7
                max-w-[620px] lg:max-w-[640px] w-full whitespace-pre-line
                [text-wrap:pretty]
              "
            >
              {hero.subtitle}
            </p>
          )}

          {/* CTA satırı — admin-driven (metin + link AYNEN); HeroCta akıllı
             href yönlendirmesi DEĞİŞMEDİ. Boş CTA render edilmez (AYNEN).
             Primary: altın dolu; Secondary: şeffaf, ince kenarlıklı. */}
          {(hero.primaryCta || hero.secondaryCta) && (
            <div className="mt-8 md:mt-11 flex flex-wrap items-center justify-center gap-3 md:gap-4">
              {hero.primaryCta && (
                <HeroCta
                  href={hero.primaryCta.href}
                  className="
                    inline-flex items-center justify-center
                    h-12 md:h-[60px] px-7 md:px-9 rounded-full
                    bg-[#C9A55A] hover:bg-[#BB9649]
                    text-white text-[15px] md:text-[17px] font-semibold tracking-[0.01em]
                    shadow-[0_16px_34px_-16px_rgba(201,165,90,0.8)]
                    hover:-translate-y-[1px]
                    transition-[transform,background-color] duration-300
                    motion-reduce:transition-none motion-reduce:hover:translate-y-0
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1f3a]
                  "
                >
                  {hero.primaryCta.text}
                </HeroCta>
              )}
              {hero.secondaryCta && (
                <HeroCta
                  href={hero.secondaryCta.href}
                  className="
                    inline-flex items-center justify-center
                    h-12 md:h-[60px] px-7 md:px-9 rounded-full
                    border !border-white/45 bg-white/[0.08] backdrop-blur-sm
                    text-white text-[15px] md:text-[17px] font-semibold tracking-[0.01em]
                    hover:bg-white/[0.16] hover:!border-white/70
                    hover:-translate-y-[1px]
                    transition-[transform,border-color,background-color] duration-300
                    motion-reduce:transition-none motion-reduce:hover:translate-y-0
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60
                  "
                >
                  {hero.secondaryCta.text}
                </HeroCta>
              )}
            </div>
          )}
        </div>
        </div>

        {/* ─── SEARCH PANEL — client island, AYNEN (mantık/state DEĞİŞMEDİ) ── */}
        <HeroSearchPanel locale={locale} />

        {/* ─── KAYDIRMA OKU — hero'nun bitişine (sonraki bölüm) iner. ── */}
        <a
          href="#hero-sonu"
          aria-label={dict.scrollDown}
          className="
            mx-auto mt-6 md:mt-8
            inline-flex items-center justify-center
            h-10 w-10 rounded-full
            text-white/80 hover:text-white hover:bg-white/10
            transition-colors motion-reduce:transition-none
            focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60
          "
        >
          <ChevronDown
            size={26}
            strokeWidth={1.75}
            aria-hidden
            className="motion-safe:animate-bounce [animation-duration:2.2s]"
          />
        </a>
      </div>

      {/* 🛡️ DATEPICKER PORTAL TARGET — HeroSearchPanel'in
         react-datepicker portalId="hero-datepicker-portal" hedefi. */}
      <div id="hero-datepicker-portal" />
      {/* Kaydırma oku hedefi — hero'nun hemen bitişi. */}
      <div id="hero-sonu" aria-hidden="true" className="absolute bottom-0 left-0 h-0 w-0" />
    </section>
    </>
  );
}
