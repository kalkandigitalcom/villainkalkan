"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Link2, Mail } from "lucide-react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ VillaShareLinks — villa detay "PAYLAŞ" şeridi
   ===============================================================
   Sayfanın KENDİ adresini (window.location.href, tıklama anında)
   WhatsApp / Facebook / X / e-posta ile paylaşır ya da panoya
   kopyalar. Veri çekmez, URL değiştirmez; yalnız yeni sekmede
   standart paylaşım adreslerini açar.
   =============================================================== */

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const WhatsappIcon = () => (
  <svg {...iconProps}>
    <path d="M3 21l1.65-4.8A8.5 8.5 0 1 1 7.9 19.4L3 21z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .75a3.6 3.6 0 0 1-1.75-1.75l.75-1-1-2L9 9.5z" />
  </svg>
);

const FacebookIcon = () => (
  <svg {...iconProps}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const XIcon = () => (
  <svg {...iconProps}>
    <path d="M4 4l16 16" />
    <path d="M20 4L4 20" />
  </svg>
);

type ShareTarget = "whatsapp" | "facebook" | "x" | "email";

function buildShareHref(target: ShareTarget, url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (target) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case "email":
      return `mailto:?subject=${t}&body=${encodeURIComponent(`${title}\n${url}`)}`;
  }
}

export default function VillaShareLinks({
  title,
  locale,
}: {
  title: string;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const [copied, setCopied] = useState(false);

  /* "Kopyalandı" geri bildirimi 2 sn sonra kendiliğinden kapanır. */
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  function share(target: ShareTarget) {
    if (typeof window === "undefined") return;
    const href = buildShareHref(target, window.location.href, title);
    if (target === "email") {
      window.location.href = href;
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* Pano erişimi yoksa sessizce geç. */
    }
  }

  const buttons: {
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
  }[] = [
    {
      key: "whatsapp",
      label: dict.villaShare.whatsapp,
      icon: <WhatsappIcon />,
      onClick: () => share("whatsapp"),
    },
    {
      key: "facebook",
      label: dict.villaShare.facebook,
      icon: <FacebookIcon />,
      onClick: () => share("facebook"),
    },
    {
      key: "x",
      label: dict.villaShare.x,
      icon: <XIcon />,
      onClick: () => share("x"),
    },
    {
      key: "email",
      label: dict.villaShare.email,
      icon: <Mail size={16} strokeWidth={1.8} aria-hidden />,
      onClick: () => share("email"),
    },
    {
      key: "copy",
      label: copied ? dict.villaShare.copied : dict.villaShare.copyLink,
      icon: copied ? (
        <Check size={16} strokeWidth={2} aria-hidden />
      ) : (
        <Link2 size={16} strokeWidth={1.8} aria-hidden />
      ),
      onClick: copyLink,
    },
  ];

  return (
    <div className="flex items-center gap-3 min-w-0" data-villa-share>
      <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
        {dict.villaShare.label}
      </span>
      <ul
        className="flex items-center gap-1.5 sm:gap-2"
        aria-label={dict.villaShare.label}
      >
        {buttons.map((b) => (
          <li key={b.key}>
            <button
              type="button"
              onClick={b.onClick}
              aria-label={b.label}
              title={b.label}
              className={
                "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 " +
                (b.key === "copy" && copied
                  ? "border-brand bg-brand text-ink"
                  : "border-[var(--color-stone-200)] bg-white text-ink hover:border-brand hover:bg-brand hover:text-ink")
              }
            >
              {b.icon}
            </button>
          </li>
        ))}
      </ul>
      <span className="sr-only" aria-live="polite">
        {copied ? dict.villaShare.copied : ""}
      </span>
    </div>
  );
}
