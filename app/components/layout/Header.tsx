"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import TopBar from "./TopBar";
/* 🛡️ FAZ 36 — Favorites shortcut (localStorage badge counter) */
import HeaderFavoritesLink from "@/app/components/favorites/HeaderFavoritesLink";
/* 🛡️ Canlı arama paylaşılan component (header + hero) — duplikasyon yok.
   Arama state/debounce/dropdown mantığı VillaSearchBox'a taşındı. */
import VillaSearchBox from "@/app/components/layout/VillaSearchBox";
/* 🛡️ PHASE 2 — UI Translation Dictionary Core.
   🛡️ PHASE 9A GÜNCELLEMESİ — artık modül seviyesinde SABİT
   DEFAULT_LOCALE değil; component gövdesinde, zaten mevcut olan
   `usePathname()` sonucundan `localeFromPathname()` (lib/i18n/config.ts,
   Phase 9A) ile locale tespit edilip `getDictionary(locale)` HER
   RENDER'DA çağrılır (saf/ucuz fonksiyon — DB sorgusu YOK, yeni bir
   cache mekanizması gerektirmiyor). TR route'larında (pathname `/en`
   veya `/de` ile başlamıyorsa) `localeFromPathname` DEFAULT_LOCALE
   ("tr") döner — dictionary.header.offer/menuOpen/menuClose değerleri
   ÖNCEKİ sabit TR metinlerle ("Teklif Al" / "Menüyü aç" / "Menüyü
   kapat") BİREBİR aynı, TR render çıktısı DEĞİŞMEDİ. Middleware/
   headers() KULLANILMADI (bkz. Phase 9A audit — bu, Footer'ın aksine
   Header zaten "use client" olduğu ve `usePathname()`'e sahip olduğu
   için mümkün; site-wide dynamic-rendering riski YOK). */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  localeFromPathname,
} from "@/lib/i18n/config";
/* 🛡️ NAVIGATION LOCALE PERSISTENCE — iç linkler aktif locale'i taşır.
   Yeni bir routing sistemi DEĞİL; `buildLocaleAlternates` (Phase 7B)
   üzerine ince, saf sarmalayıcı (bkz. lib/i18n/locale-href.ts). */
import { localeHref } from "@/lib/i18n/locale-href";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
/* 🛡️ PHASE 10H — `source_type: "category"` menü öğelerinin adı (villa
   tipi) locale'e göre çözülür; çeviri yoksa canonical TR adı kalır.
   Saf helper — DB/server bağımlılığı YOK. */
import {
  resolveTaxonomyName,
  type TaxonomyNameByLocale,
} from "@/lib/i18n/taxonomy-name.helper";

/* ===============================================================
   🛡️ FAZ 39C — HEADER CSS CLEANUP
   ===============================================================
   ÖNCE (FAZ 38 ardından):
     - `transparent` boolean dead constant'tı (always false)
     - Tüm `transparent ? "white..." : "stone..."` ternary'leri
       her zaman ikinci branch'a düşüyordu → dead code + okuma yükü
     - `useMemo` import edilmişti ama kullanılmıyordu
     - Logo span'ı `text-[var(--color-champagne-500)]` (cyan) →
       yeni coral brand identity ile çelişiyordu
     - Mobile favorites pill `hover:border-champagne-500` (cyan) →
       coral brand ile çelişiyordu
     - Desktop & mobile CTAs `bg-stone-900` + `text-white` ham black
       pill → coral luxury button system ile çelişiyordu
     - Search spinner `border-champagne-500` (cyan) → coral aksenti
       eksikti

   SONRA (FAZ 39C):
     - `transparent` kaldırıldı; tüm ternary'ler kaldırıldı
     - useMemo import kaldırıldı
     - Logo accent → coral
     - Mobile favorites hover → coral
     - Desktop CTA → `.btn-primary` (luxury coral system)
     - Mobile CTA → `.btn-primary` (zaten kullanılıyordu; ✔)
     - Search spinner → coral

   KORUNAN BEHAVIOR (zero touch):
     - State hooks: open, search, results, loading, openSearch, scrolled
     - useEffect: pathname reset, scroll watch, live search debounce
       + memory-leak guard, outside-click
     - getImage helper
     - Live search query (visibility filter ile)
     - Logo (settings.site_logo) + wordmark fallback
     - Mobile menu open/close
     - HeaderFavoritesLink (artık `variant="default"` sabiti)
   =============================================================== */

/* ===============================================================
   🛡️ HEADER REDESIGN (premium / referans tasarım)
   ===============================================================
   - Ana sayfada (/, /tr, /en, /de) header hero görselinin ÜZERİNDE
     şeffaf durur; scroll / mobil menü açıkken ve iç sayfalarda koyu
     lacivert zemine geçer. Spacer yalnız iç sayfalarda basılır.
   - Sağ alan: mevcut arama + favoriler. Dil seçici ve telefon YALNIZ
     TopBar'da; "Teklif Al" CTA'sı sol kenardaki sabit FloatingQuoteCta
     bileşeninde (public layout) → header'da tekrar yok.
   - Menü verisi, locale href'leri, arama, favoriler, mobil menü
     state/accordion mantığı DEĞİŞMEDİ; yalnız görsel katman.
   =============================================================== */

/** Ana sayfa yolları — header'ın hero üzerinde şeffaf durduğu yerler. */
const HOME_PATHS = new Set<string>([
  "/",
  ...SUPPORTED_LOCALES.map((l) => `/${l}`),
]);

type MenuItem = {
  id?: string;
  name: string;
  href: string;
  children?: MenuItem[];
  /** 🛡️ PHASE 10H — OPSİYONEL. Yalnız villa tipi (`category`) kaynaklı
   *  öğelerde `HeaderWrapper` tarafından doldurulur; diğer öğelerde
   *  undefined → canonical `name` gösterilir (eski davranış). */
  nameByLocale?: TaxonomyNameByLocale;
};

export default function Header({
  menu = [],
  siteLogo = null,
  trHomeHref = "/",
  footerLogo = null,
}: {
  menu?: MenuItem[];
  /* settings.site_logo — boşsa text wordmark fallback */
  siteLogo?: string | null;
  /* settings.footer_logo — koyu zemin için açık/negatif logo. Koyu
     (dolu) header durumunda varsa kullanılır, yoksa site_logo. */
  footerLogo?: string | null;
  /* 🔄 TR ana sayfanın yolu. Varsayılan dil EN/DE iken "/" bir
     YÖNLENDİRİCİ olduğu için HeaderWrapper "/tr" geçer; aksi halde
     (ve prop hiç verilmezse) "/" → davranış BYTE-IDENTICAL. */
  trHomeHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /* 🛡️ PHASE 9A — locale, ZATEN var olan `pathname`'den saf/senkron
     şekilde türetilir; middleware/headers() gerektirmez. `getDictionary`
     saf bir modül-import lookup'ı (DB sorgusu YOK) — her render'da
     çağrılmasının performans maliyeti yoktur. TR path'lerinde
     (pathname `/en`/`/de` ile başlamıyorsa) `dictionary` ÖNCEKİ modül-
     seviyesi sabitle (`getDictionary(DEFAULT_LOCALE)`) BİREBİR AYNI
     referans/değerleri döner. */
  const locale = localeFromPathname(pathname);
  const dictionary = getDictionary(locale);

  /* TR'de ana sayfa hedefi `trHomeHref`; EN/DE'de mevcut
     `localeHref` davranışı AYNEN korunur. */
  const homeHref =
    locale === DEFAULT_LOCALE ? trHomeHref : localeHref("/", locale);

  /* 🛡️ Header search (desktop + mobile) TÜM sayfalarda gösterilir —
     anasayfa dahil (eski `!isHome` gizleme kaldırıldı). İç sayfa
     davranışı birebir aynı; paylaşılan VillaSearchBox mantığı değişmedi.
     Hero / HeroSearchPanel / HeroStickySearch AYNEN korunur. */

  const [scrolled, setScrolled] = useState(false);

  /* 🛡️ MOBILE SUBMENU ACCORDION — hangi ana menü öğelerinin alt
     menüsü açık, id/name bazlı Set ile tutuluyor. Birden fazla
     submenu bağımsız açık kalabilir (biri diğerini otomatik
     kapatmaz). Başlangıç: boş Set → tüm alt menüler kapalı.
     Yalnızca mobile hamburger drawer'ı için; desktop `group-hover`
     dropdown sistemine dokunulmadı. */
  const [openSubmenus, setOpenSubmenus] = useState<Set<string>>(
    new Set()
  );

  function toggleSubmenu(key: string) {
    setOpenSubmenus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  /* Hamburger tamamen kapanınca submenu state'i de temizlenir —
     kullanıcı menüyü tekrar açtığında bütün alt menüler yine
     kapalı gelir. */
  function closeMobileMenu() {
    setOpen(false);
    setOpenSubmenus(new Set());
  }

  useEffect(() => {
    setOpen(false);
    setOpenSubmenus(new Set());
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* 🛡️ HEADER REDESIGN — ana sayfada, en üstteyken ve mobil menü
     kapalıyken hero üzerinde şeffaf; aksi halde koyu lacivert. */
  const normalizedPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const isHome = HOME_PATHS.has(normalizedPath);
  const overHero = isHome && !scrolled && !open;
  const headerShellClass =
    "border-b transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none " +
    (overHero
      ? "bg-[#244c45]/10 !border-transparent shadow-none"
      : "bg-[var(--color-stone-900)]/95 backdrop-blur-xl backdrop-saturate-150 !border-white/10 " +
        (scrolled
          ? "shadow-[0_10px_30px_-14px_rgba(0,0,0,0.45)]"
          : "shadow-none"));
  /* Koyu (dolu) durumda açık logo varyantı tercih edilir. */
  const logoSrc = overHero ? siteLogo : footerLogo || siteLogo;
  return (
    <>
      <header className="w-full fixed top-0 z-50">
        <TopBar />

        <div className={headerShellClass}>
          <div className="max-w-[1480px] mx-auto px-4 sm:px-5 md:px-8 lg:px-10 xl:px-16 h-[72px] md:h-[80px] flex items-center justify-between gap-3 lg:gap-6">
            {/* LOGO */}
            <Link
              href={homeHref}
              className="
                font-display text-2xl tracking-tight
                flex items-center shrink-0
                text-white hover:text-white/85
                transition-colors motion-reduce:transition-none
              "
            >
              {logoSrc ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoSrc}
                  alt={dictionary.header.logoAlt}
                  className="h-9 md:h-12 w-auto max-w-[32vw] sm:max-w-[170px] md:max-w-[210px] object-contain"
                />
              ) : (
                <>
                  Villa
                  {/* Wordmark fallback — altın vurgu (header redesign). */}
                  <span className="text-[#C9A55A]">Kiralama</span>
                </>
              )}
            </Link>

            {/* MENU — ultra clean, premium spacing */}
            <nav
              className="
                hidden md:flex flex-1 justify-center gap-6 lg:gap-9 xl:gap-11
                text-[15px] font-medium tracking-[0.01em]
                text-white/85
                [text-shadow:0_1px_12px_rgba(0,0,0,0.25)]
              "
            >
              {menu.map((item) => {
                const isActive = pathname === item.href;
                const hasChildren = item.children && item.children.length > 0;
                /* 🛡️ PHASE 10H — villa tipi (category) öğelerinde
                   locale karşılığı; diğer öğelerde canonical `name`. */
                const itemName = resolveTaxonomyName(
                  item.name,
                  item.nameByLocale,
                  locale
                );

                return (
                  <div
                    key={item.id || item.name}
                    className="relative group py-5"
                  >
                    <Link
                      href={localeHref(item.href, locale)}
                      className={
                        "flex items-center gap-1 transition-colors motion-reduce:transition-none " +
                        (isActive ? "text-white" : "hover:text-white")
                      }
                    >
                      {itemName}
                      {hasChildren && (
                        <ChevronDown size={14} className="opacity-70" />
                      )}
                    </Link>

                    {/* Coral underline accent (FAZ 38) */}
                    <span
                      aria-hidden="true"
                      className={
                        "absolute left-0 right-0 -bottom-px mx-auto h-[2px] w-6 rounded-full transition-opacity duration-300 motion-reduce:transition-none " +
                        "bg-[#C9A55A] " +
                        (isActive
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100")
                      }
                    />

                    {hasChildren && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[999]">
                        <div className="w-56 bg-white rounded-2xl [text-shadow:none] shadow-[0_24px_48px_-16px_rgb(27_26_23/0.18)] border border-[var(--color-stone-100)] overflow-hidden">
                          {item.children!.map((child) => (
                            <Link
                              key={child.id}
                              href={localeHref(child.href, locale)}
                              className="block px-5 py-3 text-[16px] text-[var(--color-stone-700)] hover:bg-[var(--color-sand-50)] hover:text-[var(--color-stone-900)] transition"
                            >
                              {resolveTaxonomyName(
                                child.name,
                                child.nameByLocale,
                                locale
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* RIGHT — arama + favoriler. Dil seçici TopBar'da; "Teklif
               Al" sol kenardaki sabit CTA'da (FloatingQuoteCta). */}
            <div
              className="
                hidden md:flex items-center gap-2 lg:gap-3 shrink-0
                [&_a[href$='/favoriler']]:text-white/85
                [&_a[href$='/favoriler']:hover]:bg-white/10 [&_a[href$='/favoriler']:hover]:text-white
              "
            >
              {/* SEARCH — paylaşılan VillaSearchBox (mantık AYNEN). Koyu/
                 şeffaf zemin için yalnız görsel override (descendant). */}
              <div
                className="
                  [&>div]:!bg-white/10 [&>div]:!border-white/20
                  [&>div:focus-within]:!bg-white/15 [&>div:focus-within]:!border-white/40
                  [&>div>svg]:!text-white/70
                  [&>div>input]:!text-white [&>div>input]:placeholder:!text-white/60
                "
              >
                <VillaSearchBox variant="desktop" locale={locale} />
              </div>

              {/* Favorites shortcut (FAZ 36) — renk override'ı üst
                 sarmalayıcıda (açık metin). */}
              <HeaderFavoritesLink locale={locale} />
            </div>

            {/* 🛡️ MOBILE ACTIONS — search input + hamburger toggle.
               Yerleşim: [ Villa ara... ] [ ☰ ]
               Eski mobil arama drawer içindeydi (kullanıcı hamburger
               açmadan göremiyordu); kullanılabilirlik için header
               strip'e taşındı. State (search/openSearch/results/loading)
               + debounce + outside-click handler değişmedi — input
               sadece DOM konumu değiştirdi. Desktop branch'e dokunulmadı
               (`md:hidden` mobil-only). */}
            <div
              className="
                md:hidden flex items-center gap-1.5 sm:gap-2 shrink-0
                [&_a[href$='/favoriler']]:text-white/85
                [&_a[href$='/favoriler']:hover]:bg-white/10 [&_a[href$='/favoriler']:hover]:text-white
              "
            >
              {/* 🛡️ MOBILE SEARCH kaldırıldı — mobilde tek villa-adı arama
                 girişi Bottom Navigation → Arama → SearchBottomSheet.
                 Çift arama olmaması için header mobil arama render EDİLMEZ.
                 Desktop arama (hidden md:flex bloğu) AYNEN korunur. */}

              {/* 🛡️ MOBILE FAVORITES — hamburger'ın solunda ikon-only
                 favori girişi. Desktop ile AYNI HeaderFavoritesLink
                 component'i (ikon + köşe badge); yalnız `md:hidden` bu
                 blokta → desktop cluster'daki kopya etkilenmez. Eski
                 drawer içi "Favorilerim" satırı kaldırıldı. */}
              <HeaderFavoritesLink locale={locale} />

              {/* HAMBURGER — aç/kapa davranışı birebir korundu. Görünür
                 "Menü" metni kaldırıldı;
                 yalnız ikon kalır, simetrik padding ile tap alanı korunur.
                 Kapanış (manuel ya da route değişimiyle) submenu state'ini
                 de temizler (closeMobileMenu → openSubmenus sıfırlanır). */}
              <button
                onClick={() => (open ? closeMobileMenu() : setOpen(true))}
                aria-label={open ? dictionary.header.menuClose : dictionary.header.menuOpen}
                aria-expanded={open}
                className="
                  inline-flex items-center justify-center shrink-0
                  p-2 sm:p-2.5 rounded-full
                  text-white
                  hover:bg-white/10
                  transition-colors motion-reduce:transition-none
                "
              >
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE MENU */}
        <div
          className={
            "md:hidden bg-white border-t border-[var(--color-stone-100)] shadow-lg " +
            "transition-all duration-300 origin-top " +
            (open
              ? /* 🛡️ MOBİL MENÜ SCROLL FIX — bar (h-[72px]) altından
                   viewport sonuna; dvh → iPhone Safari toolbar-safe.
                   overflow-y-auto: uzun menüde alt öğelere erişim;
                   overscroll-contain: iOS body scroll-chaining engeli. */
                "opacity-100 max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain"
              : "opacity-0 max-h-0 overflow-hidden")
          }
        >
          <div className="flex flex-col p-5 gap-4">
            {/* 🛡️ MOBILE SEARCH header strip'e taşındı (kullanıcı
               hamburger açmadan görebilsin). Drawer artık yalnızca
               navigasyon menüsü ve CTA içerir. Aynı state hâlâ
               geçerli — sadece drawer içindeki render kaldırıldı. */}
            {menu.map((item) => {
              const itemKey = item.id || item.name;
              const hasChildren =
                item.children && item.children.length > 0;
              const isSubmenuOpen = openSubmenus.has(itemKey);
              /* 🛡️ PHASE 10H — masaüstüyle AYNI çözüm. `itemKey` bilinçli
                 olarak canonical `item.name`'den türetilmeye devam eder
                 (React key + açık submenu state'i locale değişiminden
                 ETKİLENMEMELİ). */
              const itemName = resolveTaxonomyName(
                item.name,
                item.nameByLocale,
                locale
              );

              return (
                <div
                  key={itemKey}
                  className="border-b border-[var(--color-stone-100)] pb-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={localeHref(item.href, locale)}
                      className="block flex-1 font-medium text-[var(--color-stone-900)]"
                    >
                      {itemName}
                    </Link>

                    {/* 🛡️ SUBMENU TOGGLE — ayrı, bağımsız tıklama alanı.
                       Parent linkin kendi navigasyon davranışına
                       dokunmaz (yukarıdaki <Link> AYNEN çalışır);
                       yalnızca alt menüyü açar/kapatır. Birden fazla
                       submenu bağımsız açık kalabilir (openSubmenus
                       bir Set — bunu açmak diğerini kapatmaz). */}
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => toggleSubmenu(itemKey)}
                        aria-expanded={isSubmenuOpen}
                        aria-label={formatDictionaryString(
                          isSubmenuOpen
                            ? dictionary.header.submenuCloseAriaLabel
                            : dictionary.header.submenuOpenAriaLabel,
                          { label: itemName }
                        )}
                        className="
                          shrink-0 inline-flex items-center justify-center
                          h-7 w-7 rounded-full
                          text-[var(--color-stone-500)]
                          hover:bg-[var(--color-sand-50)] hover:text-[var(--color-stone-900)]
                          transition-colors motion-reduce:transition-none
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244C45]/40
                        "
                      >
                        <ChevronDown
                          size={16}
                          className={
                            "transition-transform duration-300 motion-reduce:transition-none " +
                            (isSubmenuOpen ? "rotate-180" : "rotate-0")
                          }
                        />
                      </button>
                    )}
                  </div>

                  {/* 🛡️ SMOOTH ACCORDION — grid-rows-[0fr]→[1fr] tekniği
                     (projede FaqSection.tsx ile aynı yaklaşım); height
                     ölçme/layout-thrash yok. Başlangıçta (openSubmenus
                     boş Set) HERKES kapalı. */}
                  {hasChildren && (
                    <div
                      className={
                        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none " +
                        (isSubmenuOpen ? "grid-rows-[1fr] mt-2" : "grid-rows-[0fr]")
                      }
                    >
                      <div className="overflow-hidden">
                        <div className="ml-3 space-y-2">
                          {item.children!.map((child) => (
                            <Link
                              key={child.id}
                              href={localeHref(child.href, locale)}
                              className="block text-[16.5px] text-[var(--color-stone-500)] hover:text-[var(--color-stone-900)] transition"
                            >
                              {resolveTaxonomyName(
                                child.name,
                                child.nameByLocale,
                                locale
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 🛡️ Favoriler artık mobil Header strip'te (hamburger'ın
               solunda ikon-only). Drawer içindeki "Favorilerim" satırı
               kaldırıldı. */}

          </div>
        </div>
      </header>

      {/* Spacer — iç sayfalarda header opak; ana sayfada hero header'ın
         ALTINDAN başlar (header hero üzerinde şeffaf) → spacer YOK. */}
      {!isHome && <div className="h-[108px]" />}
    </>
  );
}
