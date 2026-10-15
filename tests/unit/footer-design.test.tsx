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

  it("iletişim: masaüstünde yatay ve ortalı, mobilde alt alta; ikonlu, bağlantılar aynı", () => {
    const { container } = render(<Footer {...PROPS} />);
    const contact = container.querySelector("[data-footer-contact]") as HTMLElement;
    const row = contact.firstElementChild as HTMLElement;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("md:flex-row");
    expect(row.className).toContain("md:justify-center");
    const tel = within(contact).getByRole("link", { name: /\+90 \(242\) 010-0000/ });
    expect(tel).toHaveAttribute("href", "tel:+90 (242) 010-0000");
    expect(tel.querySelector("svg")).not.toBeNull();
    expect(within(contact).getByRole("link", { name: /info@example\.com/ })).toHaveAttribute(
      "href",
      "mailto:info@example.com",
    );
    expect(within(contact).getByText("Kalkan, Kaş / Antalya")).toBeInTheDocument();
    expect(within(contact).getByRole("link", { name: /Rezervasyon Sorgula/ })).toHaveAttribute(
      "href",
      "/rezervasyon-kontrol",
    );
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
