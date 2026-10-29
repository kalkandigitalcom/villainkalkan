/* ===============================================================
   📝 Blog — İngilizce içerik alanı Türkçe ile AYNI zengin metin editörü
   =============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const { loadMock, saveMock, upsertMock, findByIdMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  saveMock: vi.fn(),
  upsertMock: vi.fn(),
  findByIdMock: vi.fn(),
}));

vi.mock("@/app/(admin)/maki-admin/blog/blog-translations.action", () => ({
  loadBlogTranslationsAction: (...a: unknown[]) => loadMock(...a),
  saveBlogTranslationAction: (...a: unknown[]) => saveMock(...a),
}));
vi.mock("@/app/components/admin/notifications/NotificationProvider", () => ({
  useNotify: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("@/lib/db/translation.repository.server", () => ({
  translationRepository: { upsertOne: (...a: unknown[]) => upsertMock(...a) },
}));
vi.mock("@/lib/db/blog.repository.server", () => ({
  blogServerRepository: { findById: (...a: unknown[]) => findByIdMock(...a) },
}));

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
vi.mock("next/image", () => ({
  /* eslint-disable-next-line @next/next/no-img-element */
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/app/services/blog.service", () => ({
  getBlogPostBySlug: async () => ({
    id: "p1",
    title: "EN title",
    slug: "x",
    excerpt: null,
    body: "<p>EN</p>",
    cover_image: null,
    is_active: true,
    published_at: "2026-10-01T00:00:00Z",
    seo_title: null,
    seo_description: null,
    og_image: null,
    noindex: false,
    category: null,
    author: null,
    show_on_homepage: false,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: null,
  }),
}));
vi.mock("@/lib/i18n/get-blog-translation.server", () => ({
  resolveBlogContent: async () => ({
    title: "TR başlık",
    excerpt: null,
    body: "<h2>Why Kalkan</h2><h3>Sub</h3><p><strong>Bold</strong> <em>it</em> <u>u</u> <a href=\"https://e.com\">link</a></p><ul><li><p>One</p></li></ul><ol><li><p>Two</p></li></ol><blockquote><p>Quote</p></blockquote>",
    seoTitle: null,
    seoDescription: null,
  }),
}));
vi.mock("@/app/components/ui/PageHero", () => ({ default: () => null }));
vi.mock("@/lib/storage/site-asset-version.server", () => ({ getSiteAssetVersions: async () => ({}) }));

import BlogDetailPageBody from "@/app/components/blog/BlogDetailPageBody";
import BlogTranslationsCard, {
  toEditorHtml,
} from "@/app/(admin)/maki-admin/blog/BlogTranslationsCard";
import RichTextEditor from "@/app/components/admin/villa-form/RichTextEditor";
import { upsertBlogTranslation } from "@/app/services/blog-translation.service";

const TOOLBAR = [
  "Kalın",
  "İtalik",
  "Altı çizili",
  "Başlık 2",
  "Başlık 3",
  "Başlık 4",
  "Madde listesi",
  "Numaralı liste",
  "Alıntı",
  "Bağlantı",
  "Görsel yükle",
  "Tablo ekle",
];

const toolbarTitles = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("button[title]")).map((b) => b.getAttribute("title"));

const trRow = (body: string | null) => ({
  ok: true,
  rows: [
    {
      locale: "tr",
      title: "Gizli Cennet",
      excerpt: null,
      body,
      seo_title: null,
      seo_description: null,
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toEditorHtml — mevcut içerik korunur", () => {
  it("HTML içerik aynen kalır", () => {
    const html = "<h2>Title</h2><p><strong>bold</strong></p><ul><li>a</li></ul>";
    expect(toEditorHtml(html)).toBe(html);
  });
  it("eski düz metin paragraflara çevrilir, özel karakterler kaçırılır", () => {
    expect(toEditorHtml("Line 1\nLine 2\n\nSecond <para> & more")).toBe(
      "<p>Line 1<br>Line 2</p><p>Second &lt;para&gt; &amp; more</p>",
    );
  });
  it("boş → boş", () => {
    expect(toEditorHtml(null)).toBe("");
    expect(toEditorHtml("   ")).toBe("");
  });
});

describe("Admin — Türkçe çeviri içerik alanı", () => {
  it("ana (İngilizce) editörle aynı toolbar görünür (aynı bileşen)", async () => {
    const { container: trBox } = render(<RichTextEditor value="<p>en</p>" onChange={() => {}} />);
    await waitFor(() => expect(toolbarTitles(trBox).length).toBeGreaterThan(0));
    const trTitles = toolbarTitles(trBox);
    for (const t of TOOLBAR) expect(trTitles).toContain(t);

    loadMock.mockResolvedValueOnce(trRow("<p>tr</p>"));
    render(<BlogTranslationsCard postId="p1" postTitle="EN" />);
    const group = await screen.findByRole("group", { name: "Türkçe içerik" });
    await waitFor(() => expect(toolbarTitles(group).length).toBeGreaterThan(0));
    expect(toolbarTitles(group)).toEqual(trTitles);
    /* Eski düz textarea kalmadı. */
    expect(within(group).queryByRole("textbox", { name: "Türkçe içerik" })).toBeNull();
    expect(group.querySelector("textarea")).toBeNull();
    expect(group.querySelector(".villa-rte[contenteditable='true']")).not.toBeNull();
  });

  it("kayıtlı biçimli TR içerik editöre yüklenir ve kaydette biçimiyle TR olarak gönderilir", async () => {
    const html = "<h2>Neden Kalkan</h2><p><strong>Berrak</strong> <em>su</em></p><ul><li><p>Bir</p></li></ul>";
    loadMock.mockResolvedValueOnce(trRow(html));
    saveMock.mockResolvedValueOnce({
      ok: true,
      row: { title: "Gizli Cennet", excerpt: null, body: html, seo_title: null, seo_description: null },
    });
    render(<BlogTranslationsCard postId="p1" postTitle="EN" />);
    const group = await screen.findByRole("group", { name: "Türkçe içerik" });
    await waitFor(() => expect(group.querySelector(".villa-rte h2")?.textContent).toBe("Neden Kalkan"));
    expect(group.querySelector(".villa-rte strong")?.textContent).toBe("Berrak");
    expect(group.querySelector(".villa-rte ul li")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Türkçe sürümünü kaydet" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    const payload = saveMock.mock.calls[0][0];
    expect(payload.locale).toBe("tr");
    expect(payload.postId).toBe("p1");
    expect(payload.body).toBe(html);
  });

  it("eski düz metin TR içerik paragraflarıyla yüklenir", async () => {
    loadMock.mockResolvedValueOnce(trRow("Birinci paragraf\n\nİkinci paragraf"));
    render(<BlogTranslationsCard postId="p1" />);
    const group = await screen.findByRole("group", { name: "Türkçe içerik" });
    await waitFor(() => expect(group.querySelectorAll(".villa-rte p")).toHaveLength(2));
  });
});

describe("Kayıt — TR çeviri gövdesi EN ana içerikle aynı sözleşme", () => {
  beforeEach(() => {
    findByIdMock.mockResolvedValue({ data: { id: "p1" }, error: null });
    upsertMock.mockImplementation(async (_e: string, _id: string, _l: string, v: Record<string, unknown>) => ({
      data: { locale: "tr", ...v },
      error: null,
    }));
  });

  it("biçimler korunur, zararlı içerik temizlenir; yalnız 'tr' satırı yazılır", async () => {
    const r = await upsertBlogTranslation({
      postId: "p1",
      locale: "tr",
      body: '<h2>H</h2><p><strong>b</strong><u>u</u></p><ol><li>x</li></ol><blockquote>q</blockquote><script>alert(1)</script>',
    });
    expect(r.ok).toBe(true);
    const [entity, id, locale, values] = upsertMock.mock.calls[0];
    expect([entity, id, locale]).toEqual(["blog_post", "p1", "tr"]);
    const body = (values as { body: string }).body;
    for (const tag of ["<h2>", "<strong>", "<u>", "<ol>", "<blockquote>"]) expect(body).toContain(tag);
    expect(body).not.toContain("<script");
    /* Ana (EN) alanları (blog_posts) bu kayıtta yazılmaz. */
    expect(Object.keys(values as object)).toEqual(["title", "excerpt", "body", "seo_title", "seo_description"]);
  });

  it("boş editör çıktısı NULL kaydedilir (İngilizce ana içeriğe fallback korunur)", async () => {
    await upsertBlogTranslation({ postId: "p1", locale: "tr", body: "<p></p>" });
    expect((upsertMock.mock.calls[0][3] as { body: unknown }).body).toBeNull();
  });
});

describe("Ön yüz — TR blog detayında (çeviri) biçimlendirme", () => {
  it("başlık, kalın, italik, altı çizili, bağlantı, listeler ve alıntı HTML olarak render edilir", async () => {
    const ui = await BlogDetailPageBody({ params: Promise.resolve({ slug: "x" }), locale: "tr" });
    const { container } = render(ui);
    const content = container.querySelector(".villa-description") as HTMLElement;
    expect(content).not.toBeNull();
    expect(content.querySelector("h2")?.textContent).toBe("Why Kalkan");
    expect(content.querySelector("h3")?.textContent).toBe("Sub");
    expect(content.querySelector("strong")?.textContent).toBe("Bold");
    expect(content.querySelector("em")?.textContent).toBe("it");
    expect(content.querySelector("u")?.textContent).toBe("u");
    expect(content.querySelector("a")?.getAttribute("href")).toBe("https://e.com");
    expect(content.querySelector("ul li")?.textContent).toBe("One");
    expect(content.querySelector("ol li")?.textContent).toBe("Two");
    expect(content.querySelector("blockquote")?.textContent).toBe("Quote");
    /* Etiketler metin olarak kaçırılmadı. */
    expect(content.textContent).not.toContain("<strong>");
  });
});
