/* ===============================================================
   🛡️ SATILIK İLANLAR — ADMIN UI (render + etkileşim)
   Form: alanlar, EN/TR açıklama, kayıt isteği (POST/PUT gövdesi).
   Liste: kolonlar, durum filtresi, arama, silme isteği.
   İlan türü seçici: üç seçenek, satılık-only uyarısı.
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { adminFetch, replace, notify } = vi.hoisted(() => ({
  adminFetch: vi.fn(),
  replace: vi.fn(),
  notify: { success: vi.fn(), error: vi.fn() },
}));
let search = "";
vi.mock("@/lib/admin-fetch", () => ({ adminFetch: (...a: unknown[]) => adminFetch(...a) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/app/components/admin/notifications/NotificationProvider", () => ({
  useNotify: () => notify,
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

import SaleListingForm from "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingForm";
import SaleListingList from "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingList";
import ListingTypeStep from "@/app/components/admin/villa-form/ListingTypeStep";

const V = "22222222-2222-2222-2222-222222222222";
/* 108: ilan kimliği villa kimliğinden FARKLI → URL'lerin ilan id'si
   kullandığı ayrıca doğrulanır. */
const L = "44444444-4444-4444-4444-444444444444";
const row = (over: Record<string, unknown>) => ({
  id: L,
  villa_id: V,
  source: "villa",
  reference_code: "VIK-1", // DB'de duran eski kolon — UI'da gösterilmemeli
  agent_whatsapp: "+90 555 111 22 33",
  sale_price: 450000,
  sale_currency: "EUR",
  price_on_request: false,
  sale_status: "available",
  property_type: "villa",
  publication_status: "published",
  is_published: true,
  is_featured: false,
  created_at: "2026-11-01T10:00:00Z",
  villa: { id: V, title: "Deniz Villası", slug: "d", is_active: true, deleted_at: null, listed_for_rent: false, listed_for_sale: true },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  adminFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
});

describe("SaleListingForm", () => {
  it("oluşturma: villa seçilmeden kaydetmez; seçilince POST gövdesi EN + TR içerir", async () => {
    adminFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, listing: { id: L } }) });
    render(
      <SaleListingForm
        mode="create"
        initialVillaId={V}
        villaOptions={[{ id: V, title: "Deniz Villası", slug: "d", is_active: true, listed_for_rent: false }]}
      />
    );
    expect(screen.queryByText("Referans kodu")).toBeNull();
    expect(screen.queryByPlaceholderText("VIK-S-001")).toBeNull();
    for (const label of ["Satış fiyatı", "Para birimi", "Arsa alanı (m²)", "Kapalı alan (m²)", "Oda sayısı", "Banyo sayısı", "Kat sayısı", "Yapım yılı", "Gayrimenkul tipi", "Yayın durumu", "Sıralama"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    fireEvent.change(screen.getByPlaceholderText("450000"), { target: { value: "500000" } });
    const [en, tr] = screen.getAllByRole("textbox").filter((el) => el.tagName === "TEXTAREA");
    fireEvent.change(en, { target: { value: "Sea view" } });
    fireEvent.change(tr, { target: { value: "Deniz manzaralı" } });
    fireEvent.click(screen.getByRole("button", { name: /İlanı oluştur/ }));
    await waitFor(() => expect(adminFetch).toHaveBeenCalled());
    const [url, init] = adminFetch.mock.calls[0];
    expect(url).toBe("/api/admin/sale-listings");
    const body = JSON.parse(init.body);
    expect(body.villa_id).toBe(V);
    expect(body.listing).toMatchObject({ sale_price: "500000", sale_description: "Sea view", publication_status: "draft" });
    expect(body.translation_tr.sale_description).toBe("Deniz manzaralı");
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/maki-admin/sale-listings/${L}`));
  });

  it("geçersiz girdi istemcide durdurulur (yayın + fiyatsız)", async () => {
    render(<SaleListingForm mode="create" initialVillaId={V} villaOptions={[{ id: V, title: "D", slug: "d", is_active: true, listed_for_rent: false }]} />);
    fireEvent.change(screen.getByDisplayValue("Taslak"), { target: { value: "published" } });
    fireEvent.click(screen.getByRole("button", { name: /İlanı oluştur/ }));
    await waitFor(() => expect(notify.error).toHaveBeenCalled());
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("düzenleme: mevcut değerler + TR çeviri yüklenir, PUT gönderilir", async () => {
    render(
      <SaleListingForm
        mode="edit"
        villaTitle="Deniz Villası"
        detail={{ listing: row({}) as never, translation_tr: { title: null, sale_description: "TR metin", seo_title: null, seo_description: null } }}
      />
    );
    expect(screen.getByDisplayValue("TR metin")).toBeTruthy();
    // Referans kodu ve ilan bazlı WhatsApp/telefon alanları formda YOK.
    expect(screen.queryByDisplayValue("VIK-1")).toBeNull();
    expect(screen.queryByDisplayValue("+90 555 111 22 33")).toBeNull();
    expect(screen.queryByText("Referans kodu")).toBeNull();
    expect(screen.queryByText("WhatsApp")).toBeNull();
    expect(screen.queryByText("Telefon")).toBeNull();
    expect(screen.getByText(/WhatsApp ve telefon Genel Ayarlar'dan alınır/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Kaydet/ }));
    await waitFor(() => expect(adminFetch).toHaveBeenCalled());
    expect(adminFetch.mock.calls[0][0]).toBe(`/api/admin/sale-listings/${L}`);
    expect(adminFetch.mock.calls[0][1].method).toBe("PUT");
    const body = JSON.parse(adminFetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("villa_id");
    for (const k of ["reference_code", "agent_whatsapp", "agent_phone"]) {
      expect(body.listing).not.toHaveProperty(k);
    }
  });
});

describe("SaleListingList", () => {
  const data = [
    row({}),
    row({ id: "b-listing", villa_id: "b", reference_code: "VIK-2", publication_status: "draft", is_published: false, villa: { id: "b", title: "Şelale Evi", listed_for_sale: false } }),
  ] as never[];

  it("kolonlar, fiyat, durum rozeti ve villa uyarısı", () => {
    render(<SaleListingList initialData={data} />);
    for (const h of ["İlan", "Kaynak", "Satış fiyatı", "Para birimi", "Yayın", "Oluşturulma"]) {
      expect(screen.getByRole("columnheader", { name: h })).toBeTruthy();
    }
    expect(screen.queryByRole("columnheader", { name: "Referans" })).toBeNull();
    expect(screen.queryByText("VIK-1")).toBeNull();
    expect(screen.getAllByText("€450.000")).toHaveLength(2);
    expect(screen.getByText("Villa satılık işaretli değil")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Düzenle/ })[0].getAttribute("href")).toBe(`/maki-admin/sale-listings/${L}`);
    expect(screen.getAllByText("Mevcut Villa")).toHaveLength(2);
  });

  it("durum filtresi URL'den okunur; arama yalnız villa adı", () => {
    search = "status=draft";
    const { unmount } = render(<SaleListingList initialData={data} />);
    expect(screen.queryByText("Deniz Villası")).toBeNull();
    expect(screen.getByText("Şelale Evi")).toBeTruthy();
    unmount();
    search = "";
    render(<SaleListingList initialData={data} />);
    fireEvent.change(screen.getByPlaceholderText(/İlan veya villa adı ara/), { target: { value: "deniz" } });
    expect(screen.getByText("Deniz Villası")).toBeTruthy();
    expect(screen.queryByText("Şelale Evi")).toBeNull();
  });

  it("silme: onay sonrası DELETE isteği, satır listeden kalkar", async () => {
    render(<SaleListingList initialData={data} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Sil/ })[0]);
    await waitFor(() => expect(adminFetch).toHaveBeenCalledWith(`/api/admin/sale-listings/${L}`, { method: "DELETE" }));
    await waitFor(() => expect(screen.queryByText("Deniz Villası")).toBeNull());
  });
});

describe("ListingTypeStep", () => {
  it("üç seçenek; kiralıktan satılık-only'ye geçişte uyarı", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ListingTypeStep value="rent" onChange={onChange} villaId={V} initialValue="rent" />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    fireEvent.click(screen.getByLabelText("Sadece satılık"));
    expect(onChange).toHaveBeenCalledWith("sale");
    rerender(<ListingTypeStep value="sale" onChange={onChange} villaId={V} initialValue="rent" />);
    expect(screen.getByText(/kiralık listelerden, arama ve/)).toBeTruthy();
    rerender(<ListingTypeStep value="both" onChange={onChange} villaId={V} initialValue="both" />);
    expect(screen.getByRole("link", { name: "Satılık İlanlar" }).getAttribute("href")).toBe(`/maki-admin/sale-listings/${V}`);
  });
});
