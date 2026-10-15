/* ===============================================================
   🎨 Footer — lacivert → mavi geçiş, yatay iletişim satırı,
   korunan bağlantılar (logo, sosyal, yasal, KalkanDigital)
   =============================================================== */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import Footer from "@/app/components/layout/Footer";
import type { Settings } from "@/app/services/settings.types";

const settings = {
  phone: "+90 (242) 010-0000",
  email: "info@example.com",
  address: "Kalkan, Kaş / Antalya",
  instagram: "https://instagram.com/x",
  facebook: "https://facebook.com/x",
  footer_copyright: null,
  translations: null,
} as unknown as Settings;

const PROPS = {
  settings,
  locations: [],
  villaTypes: [],
  corporatePages: [{ id: "k1", slug: "kvkk", title: "KVKK", nameByLocale: null }],
  year: 2026,
  siteName: "Villa In Kalkan",
  phoneDigits: "902420100000",
} as unknown as Parameters<typeof Footer>[0];

describe("Footer tasarımı", () => {
  it("zemin: marka laciverti → mavi yumuşak geçiş; üstte ince geçiş çizgisi", () => {
    const { container } = render(<Footer {...PROPS} />);
    const footer = container.querySelector("footer") as HTMLElement;
    const bg = footer.style.background;
    expect(bg).toContain("linear-gradient");
    expect(bg).toContain("var(--color-ink)");
    expect(bg).toContain("#22468c");
    /* Ayırıcı çizgiler koyu zeminde ince beyaz (global --border yalnız footer'da). */
    expect(footer.style.getPropertyValue("--border")).toBe("rgba(255, 255, 255, 0.12)");
    expect(footer.querySelector("[data-footer-top-line]")).toHaveAttribute("aria-hidden", "true");
  });

  it("üstte ortalı CTA: başlık, alt başlık, ayarlardaki telefon/e-posta ve 'Bize Ulaşın'", () => {
    const { container } = render(<Footer {...PROPS} />);
    const cta = container.querySelector("[data-footer-cta]") as HTMLElement;
    /* Footer'ın ilk içerik bölümü CTA. */
    expect(container.querySelector("footer > div")!.firstElementChild).toBe(cta);
    expect(cta.className).toContain("text-center");
    const title = within(cta).getByRole("heading", { level: 2, name: "Kalkan'da Sizi Bekliyoruz" });
    /* Koyu zeminde beyaz (global lacivert h2 kuralına takılmaz). */
    expect(title.className).toContain("text-white");
    expect(title.className).not.toContain("text-[var(--color-stone-900)]");
    expect(
      within(cta).getByText(
        "Villa kiralama, satış veya yatırım danışmanlığı için hemen iletişime geçin. Uzman ekibimiz size özel çözümler sunmaya hazır.",
      ),
    ).toBeInTheDocument();
    const tel = within(cta).getByRole("link", { name: /\+90 \(242\) 010-0000/ });
    expect(tel).toHaveAttribute("href", "tel:+90 (242) 010-0000");
    expect(within(cta).getByRole("link", { name: /info@example\.com/ })).toHaveAttribute(
      "href",
      "mailto:info@example.com",
    );
    expect(within(cta).getByRole("link", { name: "Bize Ulaşın" })).toHaveAttribute("href", "/iletisim");
    /* Telefon/e-posta footer'da tek yerde (tekrar yok). */
    expect(container.querySelectorAll('a[href^="tel:"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href^="mailto:"]')).toHaveLength(1);
  });

  it("TÜRSAB ve ödeme yöntemi görselleri kaldırıldı", () => {
    const { container } = render(<Footer {...PROPS} />);
    expect(container.querySelector('img[src*="tursab"]')).toBeNull();
    expect(container.querySelector('img[src*="payment-methods"]')).toBeNull();
    expect(screen.queryByAltText("TÜRSAB üyesi")).toBeNull();
  });

  it("adres ve rezervasyon sorgulama marka bloğunda korunur", () => {
    render(<Footer {...PROPS} />);
    expect(screen.getByText("Kalkan, Kaş / Antalya")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Rezervasyon Sorgula/ })).toHaveAttribute(
      "href",
      "/rezervasyon-kontrol",
    );
  });

  it("EN: CTA metinleri ve /en önekli iletişim bağlantısı", async () => {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ usePathname: () => "/en" }));
    const { default: FooterEn } = await import("@/app/components/layout/Footer");
    const { container } = render(<FooterEn {...PROPS} />);
    const cta = container.querySelector("[data-footer-cta]") as HTMLElement;
    expect(within(cta).getByRole("heading", { level: 2 }).textContent).toBe(
      "We Look Forward to Welcoming You in Kalkan",
    );
    expect(within(cta).getByRole("link", { name: "Contact Us" })).toHaveAttribute("href", "/en/iletisim");
    vi.doUnmock("next/navigation");
  });

  it("sosyal medya, yasal bağlantılar, telif ve KalkanDigital korunur", () => {
    render(<Footer {...PROPS} />);
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/x");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/902420100000");
    expect(screen.getByRole("link", { name: "KVKK" })).toHaveAttribute("href", "/p/kvkk");
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    const credit = screen.getByRole("link", { name: /KalkanDigital/ });
    expect(credit).toHaveAttribute("href", "https://kalkandigital.com");
    expect(credit.textContent).toContain("Web");
  });
});
