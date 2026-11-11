/* ===============================================================
   🛡️ SATILIK İLANLAR — BAĞIMSIZ GAYRİMENKUL ADMIN UI (108)
   Yeni ilan seçimi (iki yöntem), bağımsız form (alanlar + istek
   gövdesi + slug üretimi), galeri, liste kaynak sütunu, villa
   başlangıç verisi, bağımsız ilan detay render'ı + JSON-LD.
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

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
  usePathname: () => "/maki-admin/sale-listings",
}));
vi.mock("@/app/components/admin/notifications/NotificationProvider", () => ({
  useNotify: () => notify,
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

import SaleListingForm, {
  buildSaleListingRequestBody,
  initialSaleFormState,
} from "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingForm";
import SaleListingList from "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingList";
import { moveImage } from "@/app/(admin)/maki-admin/sale-listings/_components/SaleListingGallery";
import { resolveCreateKind } from "@/app/(admin)/maki-admin/sale-listings/_components/create-kind";
import CreatePage from "@/app/(admin)/maki-admin/sale-listings/ekle/page";
import SaleVillaDetail from "@/app/components/sale/SaleVillaDetail";
import { buildSaleListingJsonLd } from "@/app/components/sale/sale-structured-data";
import type { SaleVillaDetailData } from "@/app/components/sale/sale-villa-detail.types";

const LS = "abcdef12-3456-4789-8abc-def012345678";
const LOC = "55555555-5555-5555-5555-555555555555";
const F1 = "66666666-6666-6666-6666-666666666666";
const V = "22222222-2222-2222-2222-222222222222";
const options = {
  locations: [{ id: LOC, name: "Kalkan" }],
  features: [{ id: F1, name: "Infinity pool" }, { id: "77777777-7777-7777-7777-777777777777", name: "Sauna" }],
};

const ok = (body: Record<string, unknown>) => ({ ok: true, status: 200, json: async () => ({ ok: true, ...body }) });

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  adminFetch.mockResolvedValue(ok({}));
});

describe("Yeni İlan Ekle — iki yöntem", () => {
  it("parametresiz: iki seçenek kartı (mevcut villa / bağımsız)", () => {
    render(<CreatePage />);
    const villa = screen.getByRole("link", { name: /Mevcut Villadan Oluştur/ });
    const standalone = screen.getByRole("link", { name: /Bağımsız Gayrimenkul Oluştur/ });
    expect(villa.getAttribute("href")).toBe("/maki-admin/sale-listings/ekle?kaynak=villa");
    expect(standalone.getAttribute("href")).toBe("/maki-admin/sale-listings/ekle?kaynak=bagimsiz");
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("resolveCreateKind: ?kaynak / eski ?villa bağlantısı", () => {
    expect(resolveCreateKind({})).toBe("choose");
    expect(resolveCreateKind({ kaynak: "villa" })).toBe("villa");
    expect(resolveCreateKind({ kaynak: "bagimsiz" })).toBe("standalone");
    expect(resolveCreateKind({ villa: V })).toBe("villa");
    expect(resolveCreateKind({ kaynak: "xyz" })).toBe("choose");
  });

  it("?kaynak=bagimsiz → form seçenekleri yüklenir, bağımsız form açılır", async () => {
    search = "kaynak=bagimsiz";
    adminFetch.mockResolvedValue(ok(options));
    render(<CreatePage />);
    await waitFor(() => expect(screen.getByText("Gayrimenkul bilgileri")).toBeTruthy());
    expect(adminFetch).toHaveBeenCalledWith("/api/admin/sale-listings/form-options");
    expect(screen.queryByText("Bağlı villa")).toBeNull();
  });
});

describe("bağımsız gayrimenkul formu", () => {
  it("alanlar + slug başlıktan üretilir + POST gövdesi (source, property, TR başlık); kayıt sonrası düzenleme sayfası", async () => {
    adminFetch.mockResolvedValue(ok({ listing: { id: LS } }));
    render(<SaleListingForm mode="create" source="standalone" formOptions={options} />);
    for (const label of ["Bölge", "Yatak odası", "Banyo sayısı", "Özellikler", "Fotoğraf galerisi"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    /* Enlem / boylam alanları, açıklamaları ve örnekleri formda YOK. */
    for (const gone of ["Enlem", "Boylam"]) expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByPlaceholderText("36.2654")).toBeNull();
    expect(screen.queryByPlaceholderText("29.4126")).toBeNull();
    expect(screen.queryByText(/Harita için/)).toBeNull();
    expect(screen.getByText(/Fotoğraflar ilan oluşturulduktan sonra/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Sea view villa in Kalkan"), { target: { value: "Çamlık Evi Kalkan" } });
    expect((screen.getByPlaceholderText("sea-view-villa-in-kalkan") as HTMLInputElement).value).toBe("camlik-evi-kalkan");
    fireEvent.change(screen.getByPlaceholderText("Kalkan'da deniz manzaralı villa"), { target: { value: "Kalkan Çamlık Evi" } });
    fireEvent.change(screen.getByDisplayValue("Bölge seçin…"), { target: { value: LOC } });
    fireEvent.click(screen.getByLabelText("Infinity pool"));
    fireEvent.change(screen.getByPlaceholderText("450000"), { target: { value: "650000" } });
    fireEvent.click(screen.getByRole("button", { name: /İlanı oluştur/ }));
    await waitFor(() => expect(adminFetch).toHaveBeenCalled());
    const [url, init] = adminFetch.mock.calls[0];
    expect(url).toBe("/api/admin/sale-listings");
    const body = JSON.parse(init.body);
    expect(body.source).toBe("standalone");
    expect(body).not.toHaveProperty("villa_id");
    expect(body.property).toMatchObject({ title: "Çamlık Evi Kalkan", slug: "camlik-evi-kalkan", location_id: LOC, feature_ids: [F1] });
    expect(body.translation_tr.title).toBe("Kalkan Çamlık Evi");
    expect(body.listing.sale_price).toBe("650000");
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/maki-admin/sale-listings/${LS}`));
  });

  it("başlıksız kayıt istemcide durdurulur", async () => {
    render(<SaleListingForm mode="create" source="standalone" formOptions={options} />);
    fireEvent.click(screen.getByRole("button", { name: /İlanı oluştur/ }));
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith("Başlık zorunludur", expect.anything()));
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("elle girilen slug başlık değişince ezilmez", () => {
    render(<SaleListingForm mode="create" source="standalone" formOptions={options} />);
    const slug = screen.getByPlaceholderText("sea-view-villa-in-kalkan") as HTMLInputElement;
    fireEvent.change(slug, { target: { value: "ozel-adres" } });
    fireEvent.change(screen.getByPlaceholderText("Sea view villa in Kalkan"), { target: { value: "Başka" } });
    expect(slug.value).toBe("ozel-adres");
  });

  it("düzenleme: galeri yüklenir; PUT gövdesi property içerir, source içermez", async () => {
    adminFetch.mockImplementation(async (url: string) =>
      url.endsWith("/images")
        ? ok({ images: [{ id: "i1", image_url: "k", url: "https://cdn.test/k", sort_order: 0, is_cover: true }] })
        : ok({ listing: { id: LS, slug: "sea-view-plot" } })
    );
    const detail = {
      listing: {
        id: LS, villa_id: null, source: "standalone", title: "Sea View Plot", slug: "sea-view-plot",
        location_id: LOC, latitude: "36.2654", longitude: "29.4126", sale_price: 1, sale_currency: "EUR",
        price_on_request: false, sale_status: "available", property_type: "villa", publication_status: "draft",
        is_published: false, created_at: "x", bedrooms: 3,
      },
      translation_tr: { title: "Deniz Manzaralı Arsa", sale_description: null, seo_title: null, seo_description: null },
      feature_ids: [F1],
    };
    render(<SaleListingForm mode="edit" detail={detail as never} formOptions={options} />);
    expect(screen.getByDisplayValue("Sea View Plot")).toBeTruthy();
    expect(screen.getByDisplayValue("Deniz Manzaralı Arsa")).toBeTruthy();
    expect((screen.getByLabelText("Infinity pool") as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(screen.getByText("Kapak")).toBeTruthy());
    expect(adminFetch).toHaveBeenCalledWith(`/api/admin/sale-listings/${LS}/images`);
    fireEvent.click(screen.getByRole("button", { name: /Kaydet/ }));
    await waitFor(() => expect(adminFetch.mock.calls.some(([u, i]) => u === `/api/admin/sale-listings/${LS}` && i?.method === "PUT")).toBe(true));
    const put = adminFetch.mock.calls.find(([u, i]) => u === `/api/admin/sale-listings/${LS}` && i?.method === "PUT")!;
    const body = JSON.parse(put[1].body);
    expect(body).not.toHaveProperty("source");
    expect(body.property).toMatchObject({ title: "Sea View Plot", slug: "sea-view-plot", feature_ids: [F1] });
  });

  it("saf gövde: villa formu `property` göndermez; TR başlık villa ilanında boş", () => {
    const st = { ...initialSaleFormState(null), title: "X", tr_title: "Y" };
    const v = buildSaleListingRequestBody(st, V) as Record<string, unknown>;
    expect(v).not.toHaveProperty("property");
    expect((v.translation_tr as Record<string, unknown>).title).toBe("");
    const s = buildSaleListingRequestBody(st, undefined, "standalone", "create") as Record<string, unknown>;
    expect(s.source).toBe("standalone");
    expect((s.translation_tr as Record<string, unknown>).title).toBe("Y");
  });

  it("galeri sıralama yardımcısı", () => {
    expect(moveImage(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveImage(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("mevcut villadan ilan — başlangıç verisi", () => {
  it("villa seçilince yatak odası / banyo villadan dolar", async () => {
    /* jsdom'da yok — VillaCombobox vurguyu görünür kaydırır. */
    Element.prototype.scrollIntoView = vi.fn();
    adminFetch.mockResolvedValue(ok({ listing: { id: "l1" } }));
    render(
      <SaleListingForm
        mode="create"
        source="villa"
        villaOptions={[{ id: V, title: "Villa Azure", slug: "villa-azure", is_active: true, listed_for_rent: true, bedrooms: 5, bathrooms: 4 }]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Villa seçin…/ }));
    fireEvent.click(await screen.findByRole("option", { name: /Villa Azure/ }));
    await waitFor(() => expect(screen.getByDisplayValue("5")).toBeTruthy());
    expect(screen.getByDisplayValue("4")).toBeTruthy();
  });
});

describe("liste — kaynak sütunu", () => {
  it("bağımsız ilan kendi başlığıyla, 'Bağımsız Gayrimenkul' rozetiyle; villa uyarısı yok", () => {
    const rows = [
      { id: LS, villa_id: null, source: "standalone", title: "Sea View Plot", slug: "sea-view-plot", sale_price: 1, sale_currency: "EUR", price_on_request: false, publication_status: "published", is_published: true, is_featured: false, created_at: "2026-11-01T00:00:00Z", villa: null },
      { id: "l2", villa_id: V, source: "villa", title: null, sale_price: 2, sale_currency: "EUR", price_on_request: false, publication_status: "draft", is_published: false, is_featured: false, created_at: "2026-11-01T00:00:00Z", villa: { id: V, title: "Villa Azure", slug: "v", is_active: true, deleted_at: null, listed_for_rent: true, listed_for_sale: true } },
    ];
    render(<SaleListingList initialData={rows as never} />);
    expect(screen.getByText("Sea View Plot")).toBeTruthy();
    expect(screen.getByText("Bağımsız Gayrimenkul")).toBeTruthy();
    expect(screen.getByText("Mevcut Villa")).toBeTruthy();
    expect(screen.queryByText("Villa bulunamadı")).toBeNull();
    expect(screen.getAllByRole("link", { name: /Düzenle/ })[0].getAttribute("href")).toBe(`/maki-admin/sale-listings/${LS}`);
    fireEvent.change(screen.getByPlaceholderText(/İlan veya villa adı ara/), { target: { value: "sea view" } });
    expect(screen.queryByText("Villa Azure")).toBeNull();
  });
});

describe("bağımsız ilan detay render + JSON-LD", () => {
  const data: SaleVillaDetailData = {
    listingId: LS,
    source: "standalone",
    title: "Sea View Plot",
    slug: "sea-view-plot",
    locationName: "Kalkan",
    imageUrls: ["https://cdn.test/a.webp"],
    watermark: { logo: null, enabled: false, opacity: 0.15, position: "center", size: 25 },
    listing: {
      salePrice: 300000, saleCurrency: "GBP", priceOnRequest: false, saleStatus: "available", propertyType: "detached_house",
      roomLayout: null, bedrooms: 3, bathrooms: 2, builtAreaM2: 180, plotAreaM2: 500, floors: 2, yearBuilt: 2019,
      titleDeedType: null, hasGarden: false, gardenAreaM2: null, description: "House.", publicationStatus: "published",
    },
    features: [{ id: F1, displayName: "Infinity pool" }],
    siteWhatsappLink: "https://wa.me/905550000000",
    sitePhone: "+90 242 000 00 00",
    seo: { title: null, description: null },
  };
  it("aynı detay tasarımı (Konum/harita yok); Genel Ayarlar iletişimi; JSON-LD bağımsız slug ile", () => {
    const html = renderToStaticMarkup(<SaleVillaDetail data={data} locale="en" />);
    expect(html).not.toContain("sale-location");
    expect(html).not.toMatch(/>Location</);
    expect(html).toContain("Kalkan");
    expect(html).toContain("Sea View Plot");
    expect(html).toContain("Infinity pool");
    expect(html).toMatch(/href="https:\/\/wa\.me\/905550000000\?text=Hello/);
    expect(html).toContain('href="tel:+902420000000"');
    const ld = buildSaleListingJsonLd(data, "tr", "House.") as Record<string, unknown>;
    expect(ld["@type"]).toBe("RealEstateListing");
    expect(String(ld.url)).toContain("/tr/satilik-villa/sea-view-plot");
    expect(JSON.stringify(ld)).not.toContain("identifier");
    expect(JSON.stringify(ld)).not.toContain("GeoCoordinates");
    expect(JSON.stringify(ld)).toContain('"addressLocality":"Kalkan"');
  });
});
