"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
/* 🛡️ Public taksonomi + bölge yüklemesi artık server action üzerinden
   (menu/villa-type repository + @/lib/db client bundle'a girmez);
   aynı SELECT/order shape, aynı UI davranışı. */
import { loadHeroFilters } from "./hero-filters.action";
/* 🛡️ ADDITIVE — "Gelişmiş Arama" villa özellikleri listesi. AYRI action:
   `loadHeroFilters` dosyası ve testleri BİREBİR korunur (bkz. hero-
   features.action.ts başlığı). İki action PARALEL çağrılır. */
import { loadHeroFeatures } from "./hero-features.action";

import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { tr } from "date-fns/locale";
import { enUS } from "date-fns/locale";
/* 🛡️ PHASE 11 — panel metinleri ve takvim locale'i dile göre. Arama
   state'i, `buildHeroSearchParams` ve `router.push` hedefi DEĞİŞMEDİ. */
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
/* 🛡️ NAVIGATION LOCALE PERSISTENCE — iç link aktif locale'i taşır
   (bkz. lib/i18n/locale-href.ts). */
import { localeHref } from "@/lib/i18n/locale-href";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";

import MobileKbSafeInput from "@/app/components/ui/datepicker/MobileKbSafeInput";

import {
  Search,
  Home,
  MapPin,
  CalendarDays,
  Users,
  ChevronDown,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";

import { buildHeroSearchParams } from "../_helpers/build-search-params";
import { buildHeroDateLabel } from "../_helpers/date-label";

import type { FilterOption } from "../_types/hero";

registerLocale("tr", tr);
/* 🛡️ PHASE 11 — EN/DE takvim locale'leri de module-level kaydedilir;
   `registerLocale("tr", tr)` çağrısı DEĞİŞMEDİ. */
registerLocale("en", enUS);

/* ===============================================================
   🛡️ FAZ 4 — HeroSearchPanel (CLIENT — STATEFUL)
   ===============================================================
   Eski Hero.tsx > SEARCH PANEL bloğu (L599-890) BYTE-IDENTICAL
   kopyası + Hero.tsx içinde tutulan state/ref/effect/helper'lar
   self-contained Search Panel'e taşındı.

   ENCAPSULATED STATE:
     - categories, regions, guests, startDate, endDate
     - openCat, openRegion
     - categoryOptions, regionOptions
     - catRef, regRef (outside click DOM refs)

   ENCAPSULATED EFFECTS:
     - villa_types + villa_locations fetch (mount)
     - document.mousedown outside click handler

   ENCAPSULATED HELPERS:
     - toggleItem (pure, inline)
     - handleSearch (delegates to buildHeroSearchParams + router.push)
     - dateLabel (delegates to buildHeroDateLabel)

   🔎 EK — Panelin üst kenarına yarı binen ortalanmış villa-adı arama
   input'u eklendi (VillaSearchBox hero variant, kendi canlı arama +
   navigation logic'i ile). Bu input filtre submit butonundan TAMAMEN
   BAĞIMSIZ; salt görsel/UX ek. Filtre bar (CATEGORY → REGION → DATE →
   GUESTS → "Villa bul" CTA) ve handleSearch/router.push AYNEN korundu.

   ⚠️ KESIN KURAL:
     - useRouter() çağrısı bu component içinde (HEro shell'den prop
       geçmez); encapsulation tam.
     - DatePicker `portalId="hero-datepicker-portal"` AYNEN; portal
       target `<div id="hero-datepicker-portal" />` Hero shell'in
       içinde kalır.
     - Outside click `document.addEventListener("mousedown", handler)`
       + cleanup `removeEventListener` AYNEN.
     - DatePicker callback signature `(dates: any) => { const [start,
       end] = dates; ... }` — `any` tipi BYTE-IDENTICAL korundu
       (DatePicker selectsRange tipi loose). Burada typed yapmak
       potansiyel selectsRange semantic'i etkileyebilir → skip.
     - 4 alan sırası: CATEGORY → REGION → DATE → GUESTS → SEARCH AYNEN.
     - DatePicker / dropdown / outside-click davranışı AYNEN.
     - registerLocale("tr", tr) module-level çağrı korundu.

   🎨 GÖRSEL YENİLEME (marka refresh — bu turda) — SADECE className/
   style/renk değerleri değişti. State/handler/effect/ref/prop/attribute
   mantığı yukarıdaki liste ile BİREBİR aynı kaldı:
     - Turkuaz (--brand-coral*, --color-champagne-*) vurgular →
       SADECE #FF805E (turuncu) / #278BD0 (mavi) marka renkleri.
     - Panel: daha yumuşak radius (28px), turuncu/mavi çok-katmanlı
       glow shadow, ince entrance animasyonu (local `<style>`,
       globals.css'e dokunulmadı, prefers-reduced-motion'da kapanır).
     - Tarih/Kişi alanları → turuncu ikon vurgusu; Tip/Bölge alanları
       → mavi ikon vurgusu (tutarlı ikili renk haritası).
     - "Villa bul" CTA → turuncu→mavi gradient + hafif breathing glow
       (Header/Hero CTA ile aynı teknik, TopBar shimmer'ı DEĞİL).
   =============================================================== */

export default function HeroSearchPanel({
  locale = DEFAULT_LOCALE,
}: {
  locale?: Locale;
} = {}) {
  const dict = getDictionary(locale).home.search;
  const router = useRouter();

  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  /* 🛡️ Hero arama formu — VARSAYILAN kişi sayısı 2.
     Yalnız başlangıç state değeri; dropdown (1–10) ve
     `buildHeroSearchParams` URL yazım kuralı DEĞİŞMEDİ. */
  const [guests, setGuests] = useState(2);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const [openCat, setOpenCat] = useState(false);
  const [openRegion, setOpenRegion] = useState(false);

  /* 🛡️ GELİŞMİŞ ARAMA (ADDITIVE) — ±3 gün esnek EK sonuç. Ana tarih/
     filtre/query davranışını ETKİLEMEZ; yalnız `flexible=3` param'ını
     ekler. Kapalıyken hiç param yazılmaz → mevcut URL birebir. */
  const [advOpen, setAdvOpen] = useState(false);
  const [flexible, setFlexible] = useState(false);

  /* 🛡️ ADDITIVE — villa özellikleri çoklu seçimi (AND). Boş kaldığında
     `ozellikler` parametresi HİÇ yazılmaz → mevcut arama davranışı
     BİREBİR aynı. */
  const [features, setFeatures] = useState<string[]>([]);
  /* Yükleme ile "hiç özellik yok" durumunu ayırmak için (kategori
     dropdown'ındaki `optionsLoading` davranışının aynısı). */
  const [featuresLoaded, setFeaturesLoaded] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>([]);
  const [regionOptions, setRegionOptions] = useState<FilterOption[]>([]);
  const [featureOptions, setFeatureOptions] = useState<FilterOption[]>([]);

  const catRef = useRef<HTMLDivElement>(null);
  const regRef = useRef<HTMLDivElement>(null);
  /* Gelişmiş Arama sarmalayıcısı (buton + floating panel). Dış tıklama
     kontrolü bu kapsayıcıya göre yapılır → panel İÇİ ve aç/kapat
     butonunun kendisi "dış tıklama" sayılmaz (buton kendi toggle'ını
     yapar, çift tetiklenme olmaz). */
  const advRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFilters = async () => {
      /* 🔀 Migration 066 — Tip dropdown'u sort_order ASC (findAllForPublicTaxonomy).
         Dönüş şekli (id, name, slug) findAllVillaTypes ile BİREBİR; UI değişmez.
         Diğer public alanlarla (CategoryCollection/arama/kiralik/kisa-sureli)
         aynı sıra. Bölge (locations) ve navbar menü sistemi ETKİLENMEZ. */
      /* 🛡️ PHASE 11 P0 — locale geçilir: EN/DE'de tip adları
         `villa_type_translations` üzerinden çevrilmiş gelir
         (VillaTypeCarousel ile AYNI helper'lar). TR'de ek sorgu YOK. */
      /* 🛡️ PARALEL: özellik listesi ayrı action'dan gelir → EK RTT YOK.
         `.catch(() => [])` ZORUNLU: özellik sorgusu hata verse bile
         tip/bölge yüklemesi ETKİLENMEZ (mevcut davranış korunur). */
      const [{ types, locations }, featureList] = await Promise.all([
        loadHeroFilters(locale),
        loadHeroFeatures(locale).catch(() => [] as FilterOption[]),
      ]);
      if (types) setCategoryOptions(types);
      setFeatureOptions(featureList);
      setFeaturesLoaded(true);
      /* 🛡️ Migration 050 — Hero bölge dropdown'ı yalnız ANA BÖLGELERİ
         (grup kökü: name === filter_group_name) gösterir. Alt bölgeler
         gizlenir; detay seçimi /arama sidebar'ında. Resolver/URL/SEO
         değişmez — kullanıcı "Kalkan" seçince grup-kökü genişletmesi
         sayesinde tüm alt bölge villaları gelmeye devam eder. */
      if (locations) {
        setRegionOptions(
          locations.filter((l) => {
            const g = (l.filter_group_name ?? "").toString().trim();
            return g.length > 0 && l.name === g;
          })
        );
      }
    };
    fetchFilters();
    /* 🛡️ PHASE 11 P0 — `locale` bağımlılığa eklendi: tip adları locale'e
       göre çözüldüğü için doğru bağımlılık budur. Pratikte her locale
       AYRI bir route/sayfa olduğundan değer bir sayfa ömrü boyunca
       DEĞİŞMEZ → ek fetch OLUŞMAZ (TR davranışı birebir aynı). */
  }, [locale]);

  // Outside click for dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node))
        setOpenCat(false);
      if (regRef.current && !regRef.current.contains(e.target as Node))
        setOpenRegion(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Outside click for Gelişmiş Arama — yalnız panel AÇIKKEN dinlenir.
     `pointerdown` → mouse + touch (mobil/masaüstü) tek yoldan. Hedef
     advRef (buton + panel) içindeyse hiçbir şey yapılmaz. */
  useEffect(() => {
    if (!advOpen) return;
    const handler = (e: PointerEvent) => {
      if (advRef.current && !advRef.current.contains(e.target as Node))
        setAdvOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [advOpen]);

  const toggleItem = (
    value: string,
    list: string[],
    setList: (v: string[]) => void
  ) => {
    if (list.includes(value)) setList(list.filter((i) => i !== value));
    else setList([...list, value]);
  };

  const handleSearch = () => {
    const query = buildHeroSearchParams({
      categories,
      regions,
      startDate,
      endDate,
      guests,
      categoryOptions,
      regionOptions,
      /* Ana start/end DEĞİŞMEZ; yalnız ek-sonuç bayrağı. */
      flexible: flexible ? 3 : 0,
      /* Boş dizi → `ozellikler` parametresi yazılmaz (mevcut URL birebir). */
      features,
    });
    router.push(localeHref(`/arama?${query}`, locale));
  };

  const dateLabel = buildHeroDateLabel(startDate, endDate, locale);

  return (
    /* ═══════════════════════════════════════════════════════
        🛡️ HERO ARAMA PANELİ — "CONCIERGE BAR" (tasarım yenilemesi)
        ═══════════════════════════════════════════════════════
        YALNIZ GÖRSEL KOMPOZİSYON değişti. State, handler, effect, ref,
        DatePicker prop'ları, `buildHeroSearchParams` ve `router.push`
        hedefi BİREBİR korunur.

        Kompozisyon:
          - Masaüstü: tek satırlık, keskin köşeli (6px) fildişi bar;
            alanlar ince dikey çizgilerle ayrılır, sağda bara gömülü
            petrol yeşili "Villa bul" bloğu.
          - Mobil: bilinçli 2+2+1 ızgara → [Tarih | Kişi] · [Bölge | Tip]
            · tam genişlik CTA. DOM sırası = görsel sıra = tab sırası.
          - Alan hiyerarşisi: altın ince ikon + küçük harf aralıklı
            etiket (eyebrow) → Manrope değer satırı (petrol yeşili).
          - Gelişmiş Arama: bar altında sade metin bağlantısı.
          - Tek seferlik giriş animasyonu (reduced-motion'da kapalı).
        ═══════════════════════════════════════════════════════ */
    <div className="relative mt-10 md:mt-14 w-full max-w-site mx-auto hero-panel-in">
      <style>{`
        @keyframes heroPanelIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-panel-in { animation: heroPanelIn 700ms cubic-bezier(0.16,1,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .hero-panel-in { animation: none; }
        }
      `}</style>

      <div
        data-hero-search-panel
        className="
          relative isolate z-30
          grid grid-cols-[1.45fr_1fr] md:flex md:items-stretch
          rounded-[10px] md:rounded-[6px]
          bg-white/[0.97] backdrop-blur-md
          shadow-[0_34px_70px_-34px_rgba(8,22,19,0.75),0_2px_0_0_rgba(255,255,255,0.6)_inset]
          p-1.5
          text-left
        "
      >
        {/* İnce altın imza çizgisi — panelin üst kenarında, sol başta. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-px left-5 md:left-6 h-[2px] w-10 md:w-14 bg-brand"
        />

        {/* ─── TARİH (giriş – çıkış) ─── */}
        <label
          className="
            group relative min-w-0 md:flex-[1.45]
            flex flex-col justify-center
            px-3.5 md:px-6 py-3 md:py-[18px]
            md:rounded-[3px]
            border-b border-r md:border-b-0 !border-ink/10
            cursor-pointer
            hover:bg-white transition-colors duration-200 motion-reduce:transition-none
            focus-within:bg-white
          "
        >
          <span className="flex items-center gap-1.5 text-[10px] md:text-[10.5px] tracking-[0.2em] uppercase font-semibold text-[var(--color-stone-500)]">
            <CalendarDays size={13} strokeWidth={1.75} className="shrink-0 text-brand" aria-hidden />
            {dict.dateLabel}
          </span>
          <span className="mt-1.5 block">
            <DatePicker
              selected={startDate}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(dates: any) => {
                const [start, end] = dates;
                setStartDate(start);
                setEndDate(end);
              }}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              locale={locale}
              dateFormat="dd.MM.yyyy"
              minDate={new Date()}
              placeholderText={dict.datePlaceholder}
              className="!bg-transparent !border-0 !shadow-none !p-0 !rounded-none !outline-none !ring-0 w-full font-display text-[15px] md:text-[16.5px] font-semibold tracking-[-0.01em] !text-ink placeholder:!text-ink placeholder:!opacity-100 cursor-pointer truncate"
              /* 🛡️ PHASE 11 — sentinel string karşılaştırması yerine
                 DOĞRUDAN state kontrolü: `buildHeroDateLabel` sentinel'i
                 TAM OLARAK `!startDate` iken döndürür → davranış birebir
                 aynı, ama locale'e bağımlı değil. */
              value={startDate ? dateLabel : ""}
              popperPlacement="bottom-start"
              popperClassName="!z-[60]"
              portalId="hero-datepicker-portal"
              /* 🛡️ Mobil sanal klavye baskılama — customInput içinde
                 inputMode="none". Takvim popper'ı, value display,
                 selectsRange, onChange, dateFormat, locale, minDate,
                 placeholderText AYNEN korunur. Desktop davranışı
                 değişmez. Detay: MobileKbSafeInput.tsx başlığı. */
              customInput={<MobileKbSafeInput />}
            />
          </span>
        </label>

        {/* ─── KİŞİ ─── */}
        <label
          className="
            group relative min-w-0 md:flex-[0.85]
            flex flex-col justify-center
            px-3.5 md:px-6 py-3 md:py-[18px]
            md:rounded-[3px]
            border-b md:border-b-0 md:border-r !border-ink/10
            cursor-pointer
            hover:bg-white transition-colors duration-200 motion-reduce:transition-none
            focus-within:bg-white
          "
        >
          <span className="flex items-center gap-1.5 text-[10px] md:text-[10.5px] tracking-[0.2em] uppercase font-semibold text-[var(--color-stone-500)]">
            <Users size={13} strokeWidth={1.75} className="shrink-0 text-brand" aria-hidden />
            {dict.guestsLabel}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5">
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="!bg-transparent !border-0 !shadow-none !p-0 !rounded-none !outline-none !ring-0 appearance-none min-w-0 flex-1 font-display text-[15px] md:text-[16.5px] font-semibold tracking-[-0.01em] !text-ink cursor-pointer"
              style={{ backgroundImage: "none", paddingRight: 0 }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => (
                <option key={g} value={g}>
                  {/* 🛡️ PHASE 11 P0 — TR'de "{n} kişi" ile BİREBİR aynı çıktı. */}
                  {formatDictionaryString(dict.guestsOption, { n: g })}
                </option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={1.75} className="shrink-0 text-ink/45 pointer-events-none" aria-hidden />
          </span>
        </label>

        {/* ─── BÖLGE ─── */}
        <div ref={regRef} className="relative min-w-0 md:flex-1 border-r !border-ink/10">
          <button
            type="button"
            aria-expanded={openRegion}
            onClick={() => {
              setOpenRegion(!openRegion);
              setOpenCat(false);
            }}
            className="
              w-full h-full
              flex flex-col justify-center text-left
              px-3.5 md:px-6 py-3 md:py-[18px]
              md:rounded-[3px]
              hover:bg-white transition-colors duration-200 motion-reduce:transition-none
              focus:outline-none focus-visible:bg-white
              focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/35
            "
          >
            <span className="flex items-center gap-1.5 text-[10px] md:text-[10.5px] tracking-[0.2em] uppercase font-semibold text-[var(--color-stone-500)]">
              <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-brand" aria-hidden />
              {dict.regionLabel}
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 w-full">
              <span className="min-w-0 flex-1 truncate font-display text-[15px] md:text-[16.5px] font-semibold tracking-[-0.01em] text-ink">
                {regions.length
                  ? formatDictionaryString(dict.regionsSelected, {
                      n: regions.length,
                    })
                  : dict.allRegions}
              </span>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                aria-hidden
                className={`shrink-0 text-ink/45 transition-transform duration-200 motion-reduce:transition-none ${
                  openRegion ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {openRegion && (
            <div className="absolute top-full mt-2.5 left-0 w-[calc(100vw-3.25rem)] md:w-72 bg-white border border-[var(--color-stone-100)] rounded-[8px] shadow-[0_28px_56px_-24px_rgba(8,22,19,0.45)] p-1.5 z-[60] max-h-72 overflow-auto">
              {regionOptions.length === 0 && (
                <div className="text-sm text-[var(--color-stone-400)] p-3">
                  {dict.optionsLoading}
                </div>
              )}
              {regionOptions.map((item) => {
                const checked = regions.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 text-sm px-3 py-2.5 rounded-[6px] cursor-pointer transition ${
                      checked
                        ? "bg-brand/[0.08] text-brand font-medium"
                        : "hover:bg-brand/[0.04] text-[var(--color-stone-700)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleItem(item.id, regions, setRegions)
                      }
                      className="!w-4 !h-4 !rounded"
                      style={{ accentColor: "var(--color-brand)" }}
                    />
                    {item.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── VİLLA TİPİ ─── */}
        <div ref={catRef} className="relative min-w-0 md:flex-1">
          <button
            type="button"
            aria-expanded={openCat}
            onClick={() => {
              setOpenCat(!openCat);
              setOpenRegion(false);
            }}
            className="
              w-full h-full
              flex flex-col justify-center text-left
              px-3.5 md:px-6 py-3 md:py-[18px]
              md:rounded-[3px]
              hover:bg-white transition-colors duration-200 motion-reduce:transition-none
              focus:outline-none focus-visible:bg-white
              focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/35
            "
          >
            <span className="flex items-center gap-1.5 text-[10px] md:text-[10.5px] tracking-[0.2em] uppercase font-semibold text-[var(--color-stone-500)]">
              <Home size={13} strokeWidth={1.75} className="shrink-0 text-brand" aria-hidden />
              {dict.typeLabel}
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 w-full">
              <span className="min-w-0 flex-1 truncate font-display text-[15px] md:text-[16.5px] font-semibold tracking-[-0.01em] text-ink">
                {categories.length
                  ? formatDictionaryString(dict.typesSelected, {
                      n: categories.length,
                    })
                  : dict.villaType}
              </span>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                aria-hidden
                className={`shrink-0 text-ink/45 transition-transform duration-200 motion-reduce:transition-none ${
                  openCat ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {openCat && (
            <div className="absolute top-full mt-2.5 right-0 md:right-auto md:left-0 w-[calc(100vw-3.25rem)] md:w-72 bg-white border border-[var(--color-stone-100)] rounded-[8px] shadow-[0_28px_56px_-24px_rgba(8,22,19,0.45)] p-1.5 z-[60] max-h-72 overflow-auto">
              {categoryOptions.length === 0 && (
                <div className="text-sm text-[var(--color-stone-400)] p-3">
                  {dict.optionsLoading}
                </div>
              )}
              {categoryOptions.map((item) => {
                const checked = categories.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 text-sm px-3 py-2.5 rounded-[6px] cursor-pointer transition ${
                      checked
                        ? "bg-brand/[0.08] text-brand font-medium"
                        : "hover:bg-brand/[0.04] text-[var(--color-stone-700)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleItem(item.id, categories, setCategories)
                      }
                      className="!w-4 !h-4 !rounded"
                      style={{ accentColor: "var(--color-brand)" }}
                    />
                    {item.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── ANA AKSİYON — "Villa bul" (handleSearch → /arama | /en/arama).
            Masaüstünde bara gömülü petrol yeşili blok; mobilde tam
            genişlik, rahat dokunma alanlı (52px) buton. ─── */}
        <button
          type="button"
          onClick={handleSearch}
          className="
            group col-span-2 md:col-span-1
            inline-flex items-center justify-center gap-2.5
            mt-1.5 md:mt-0 md:ml-1.5
            h-[52px] md:h-auto md:min-w-[176px] px-7 md:px-8
            !rounded-[6px] md:!rounded-[3px]
            bg-brand hover:bg-brand-hover
            text-white font-display text-[15px] md:text-[15.5px] font-semibold tracking-[0.01em]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]
            transition-colors duration-200 motion-reduce:transition-none
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            focus-visible:ring-brand focus-visible:ring-offset-white
          "
        >
          <Search size={16} strokeWidth={2} className="shrink-0 text-white" aria-hidden />
          <span>{dict.submit}</span>
          <ArrowRight
            size={15}
            strokeWidth={2}
            aria-hidden
            className="shrink-0 -ml-0.5 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          🛡️ GELİŞMİŞ ARAMA — bar altında sade metin bağlantısı.
          Floating (absolute) açılır → document flow'a girmez, hero
          yüksekliği DEĞİŞMEZ (z-40; Tip/Bölge dropdown'ları ve
          datepicker portal'ı z-[60] ile her zaman üstte kalır).
          Checkbox yalnız `flexible` state'ini set eder; Villa Bul'a
          basınca `flexible=3` param'ı eklenir (ana tarih değişmez).
          ═══════════════════════════════════════════════════════ */}
      <div ref={advRef} className="relative mt-3.5 flex flex-col items-center md:items-end">
        <button
          type="button"
          onClick={() => setAdvOpen((o) => !o)}
          aria-expanded={advOpen}
          className="
            inline-flex items-center gap-2 rounded-[4px] px-2 py-1.5
            text-[12.5px] md:text-[13px] font-medium tracking-[0.02em] text-white/90
            [text-shadow:0_1px_10px_rgba(8,22,19,0.55)]
            hover:text-white transition-colors motion-reduce:transition-none
            focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60
          "
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
          <span className="underline decoration-accent/70 decoration-1 underline-offset-[5px]">
            {dict.advanced}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={
              "shrink-0 transition-transform duration-200 motion-reduce:transition-none " +
              (advOpen ? "rotate-180" : "")
            }
            aria-hidden
          />
        </button>

        {advOpen && (
          <div className="absolute left-1/2 md:left-auto md:right-0 top-full z-40 -translate-x-1/2 md:translate-x-0 mt-2 w-[min(92vw,420px)] rounded-[8px] bg-white/[0.98] backdrop-blur-md border border-ink/10 shadow-[0_28px_56px_-24px_rgba(8,22,19,0.5)] px-4 py-3.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={flexible}
                onChange={(e) => setFlexible(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded cursor-pointer"
                style={{ accentColor: "var(--color-brand)" }}
              />
              <span className="text-[13px] leading-snug text-[var(--color-stone-700)]">
                {dict.flexibleHint}
              </span>
            </label>

            {/* ═══════════════════════════════════════════════════════
                VİLLA ÖZELLİKLERİ — ÇOKLU SEÇİM (AND)
                ═══════════════════════════════════════════════════════
                Seçim yapılmazsa `ozellikler` parametresi HİÇ yazılmaz →
                mevcut arama davranışı BİREBİR korunur. Seçenekler
                `villa_features` tablosundan DİNAMİK gelir (hard-code YOK);
                adlar EN'de mevcut çeviri zinciriyle çözülür.
            ═══════════════════════════════════════════════════════ */}
            <div className="mt-3.5 border-t !border-ink/10 pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[10.5px] tracking-[0.2em] uppercase font-semibold text-[var(--color-stone-500)]">
                  {dict.featuresLabel}
                </div>
                {features.length > 0 && (
                  <div className="text-[11.5px] font-medium text-ink">
                    {formatDictionaryString(dict.featuresSelected, {
                      n: features.length,
                    })}
                  </div>
                )}
              </div>

              {featureOptions.length === 0 ? (
                <div className="mt-2 text-[13px] text-[var(--color-stone-400)]">
                  {featuresLoaded ? dict.featuresEmpty : dict.optionsLoading}
                </div>
              ) : (
                <div className="mt-2 max-h-[190px] overflow-y-auto -mx-1 px-1">
                  {featureOptions.map((item) => {
                    const checked = features.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 text-[13.5px] px-2.5 py-2 rounded-[6px] cursor-pointer transition ${
                          checked
                            ? "bg-brand/[0.08] text-brand font-medium"
                            : "hover:bg-brand/[0.04] text-[var(--color-stone-700)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleItem(item.id, features, setFeatures)
                          }
                          className="!w-4 !h-4 !rounded"
                          style={{ accentColor: "var(--color-brand)" }}
                        />
                        {item.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
