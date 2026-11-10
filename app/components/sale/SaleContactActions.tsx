import { MessageCircle, Phone } from "lucide-react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

/* ===============================================================
   Satılık ilan iletişim aksiyonları (WhatsApp + telefon).
   `preview` → GERÇEK bağlantı ÜRETİLMEZ: href yok, tıklanamaz
   (aria-disabled), "Önizlemede devre dışı" notu. Böylece admin
   önizlemesinden yanlışlıkla iletişim/işlem başlatılamaz.
=============================================================== */
export default function SaleContactActions({
  whatsappHref,
  phoneHref,
  locale,
  preview,
  tone = "light",
}: {
  whatsappHref: string | null;
  phoneHref: string | null;
  locale: Locale;
  preview: boolean;
  tone?: "light" | "dark";
}) {
  const dict = getDictionary(locale).sale;
  if (!whatsappHref && !phoneHref) return null;

  const primary =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-semibold transition";
  const secondary =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-medium transition border " +
    (tone === "dark"
      ? "border-white/25 text-white"
      : "border-[var(--color-stone-200)] text-[var(--color-stone-800)]");

  if (preview) {
    return (
      <div className="space-y-2.5" data-sale-contact="preview">
        {whatsappHref && (
          <span
            role="link"
            aria-disabled="true"
            title={dict.previewContactDisabled}
            className={`${primary} cursor-not-allowed bg-[#25D366]/60 text-white`}
          >
            <MessageCircle size={17} aria-hidden />
            {dict.contactWhatsapp}
          </span>
        )}
        {phoneHref && (
          <span
            role="link"
            aria-disabled="true"
            title={dict.previewContactDisabled}
            className={`${secondary} cursor-not-allowed opacity-60`}
          >
            <Phone size={15} aria-hidden />
            {dict.contactPhone}
          </span>
        )}
        <p
          className={
            "text-center text-[11.5px] " +
            (tone === "dark" ? "text-white/60" : "text-[var(--color-stone-400)]")
          }
        >
          {dict.previewContactDisabled}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" data-sale-contact="live">
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${primary} bg-[#25D366] text-white hover:bg-[#1ebe5a]`}
        >
          <MessageCircle size={17} aria-hidden />
          {dict.contactWhatsapp}
        </a>
      )}
      {phoneHref && (
        <a
          href={phoneHref}
          className={`${secondary} ${tone === "dark" ? "hover:bg-white/10" : "hover:bg-[var(--color-sand-50)]"}`}
        >
          <Phone size={15} aria-hidden />
          {dict.contactPhone}
        </a>
      )}
    </div>
  );
}
