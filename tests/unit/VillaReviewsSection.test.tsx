/* ===============================================================
   2026-10 — Misafir Yorumları yeniden tasarım (yalnız sunum)
   ===============================================================
   Veri, sıra (öne çıkan önce, diğerleri gelen sırada), puan/yıldız
   gösterimi ve form akordeonu AYNI. Sahte içerik üretilmez.
=============================================================== */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("@/app/services/villa-review.action", () => ({
  createVillaReviewAction: vi.fn(async () => ({ ok: true })),
}));

import VillaReviewsSection from "@/app/components/villa/VillaReviewsSection";

const REVIEWS = [
  { id: "a", guest_name: "Ayşe Kaya", rating: 5, comment: "Harika bir tatildi.", created_at: "2026-08-10T10:00:00Z", is_featured: false },
  { id: "b", guest_name: "John Smith", rating: 4, comment: "Lovely villa with a view.", created_at: "2026-07-01T10:00:00Z", is_featured: true },
  { id: "c", guest_name: "Mehmet D.", rating: 3, comment: "x".repeat(400), created_at: null, is_featured: false },
];
const STATS = { count: 3, average: 4.0 };

describe("VillaReviewsSection — 2026-10 tasarım", () => {
  it("beyaz kart; başlık + sayı rozeti + büyük ortalama puan (TR)", () => {
    const { container } = render(
      <VillaReviewsSection villaId="v1" reviews={REVIEWS} stats={STATS} locale="tr" />
    );
    const section = container.querySelector("section")!;
    /* 2026-11 — ortak public kart sistemi. */
    expect(section.className).toMatch(/(^|\s)pub-card(\s|$)/);
    expect(screen.getByRole("heading", { level: 2, name: "Misafir Yorumları" })).toBeInTheDocument();
    expect(screen.getByText("3 misafir yorumu")).toBeInTheDocument();
    const score = container.querySelector("[data-review-score]")!;
    expect(score.textContent).toContain("4.0");
    expect(within(score as HTMLElement).getByLabelText("4.0 / 5")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/bg-gradient|sand-100/);
  });

  it("öne çıkan yorum önce, diğerleri gelen sırada; her kartta ad, tarih, yıldız, metin", () => {
    const { container } = render(
      <VillaReviewsSection villaId="v1" reviews={REVIEWS} stats={STATS} locale="tr" />
    );
    const featured = container.querySelector("[data-review-featured]")!;
    expect(featured.textContent).toContain("Lovely villa with a view.");
    expect(featured.textContent).toContain("John Smith");
    const cards = Array.from(container.querySelectorAll("[data-review-card]"));
    expect(cards.map((c) => c.textContent?.includes("Ayşe Kaya") ? "a" : "c")).toEqual(["a", "c"]);
    expect(within(cards[0] as HTMLElement).getByLabelText("5.0 / 5")).toBeInTheDocument();
    expect(cards[0].textContent).toMatch(/10 Ağu 2026/);
    /* Tarihi olmayan yorumda tarih satırı uydurulmaz. */
    expect(cards[1].querySelector(".tabular-nums")).toBeNull();
    /* Uzun metin taşmaz. */
    expect(cards[1].querySelector("p.break-words")).not.toBeNull();
  });

  it("ad boşsa avatar/ad çizilmez (sahte içerik yok)", () => {
    const { container } = render(
      <VillaReviewsSection
        villaId="v1"
        reviews={[{ ...REVIEWS[0], guest_name: "  " }]}
        stats={{ count: 1, average: 5 }}
        locale="tr"
      />
    );
    const card = container.querySelector("[data-review-card]")!;
    expect(card.querySelector(".font-display")).toBeNull();
  });

  it("yorum yoksa boş-durum metni; puan/ayraç/liste yok", () => {
    const { container } = render(
      <VillaReviewsSection villaId="v1" reviews={[]} stats={{ count: 0, average: 0 }} locale="en" />
    );
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(container.querySelector("[data-review-score]")).toBeNull();
    expect(container.querySelector("[data-review-card]")).toBeNull();
  });

  it("form akordeonu aynı çalışır", () => {
    render(<VillaReviewsSection villaId="v1" reviews={REVIEWS} stats={STATS} locale="tr" />);
    const toggle = screen.getByRole("button", { name: /Yorum Yap/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Formu Kapat/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Adınız")).toBeInTheDocument();
  });
});
