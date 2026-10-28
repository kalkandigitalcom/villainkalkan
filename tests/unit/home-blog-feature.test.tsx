/* ===============================================================
   🏝️ Ana sayfa "Neden Kalkan?" — blog yazısından görselli bölüm
   + admin "Ana sayfada göster" (migration 099)
   =============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------- ortak mock'lar ---------------- */
const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: (...a: unknown[]) => revalidateTagMock(...a),
  revalidatePath: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  /* eslint-disable-next-line @next/next/no-img-element */
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/* Native DB — çağrıları kaydeden basit builder. */
type Call = { op: string; args: unknown[] };
const dbCalls: Call[] = [];
let dbResult: { data: unknown; error: unknown } = { data: null, error: null };
function builder() {
  const chain: Record<string, unknown> = {};
  for (const op of ["from", "select", "eq", "neq", "order", "limit", "update", "insert"]) {
    chain[op] = (...args: unknown[]) => {
      dbCalls.push({ op, args });
      return chain;
    };
  }
  chain.maybeSingle = () => Promise.resolve(dbResult);
  chain.single = () => Promise.resolve(dbResult);
  chain.then = (res: (v: unknown) => unknown) => Promise.resolve(dbResult).then(res);
  return chain;
}
vi.mock("@/lib/db/native", () => ({
  dbNative: { from: (t: string) => (dbCalls.push({ op: "from", args: [t] }), builder()) },
  dbAdminNative: { from: (t: string) => (dbCalls.push({ op: "from", args: [t] }), builder()) },
}));

/* Çeviri katmanı — EN için çevrilmiş başlık döndür. */
vi.mock("@/lib/i18n/get-blog-translation.server", () => ({
  resolveBlogContent: async (
    post: { title: string; excerpt: string | null; body: string | null },
    locale: string,
  ) => ({
    title: locale === "en" ? "The Mediterranean's Hidden Paradise" : post.title,
    excerpt: post.excerpt,
    body: post.body,
    seoTitle: null,
    seoDescription: null,
  }),
}));
vi.mock("@/lib/storage/site-asset-version.server", () => ({
  getSiteAssetVersions: async () => ({}),
}));

import {
  bodyHighlights,
  bodySummary,
  htmlToText,
  truncateText,
} from "@/lib/blog-homepage";
import {
  buildHomepageBlogFeature,
  type HomepageBlogFeature,
} from "@/lib/blog-homepage.server";
import { blogRepository, type BlogPost } from "@/lib/db/blog.repository";
import { HomeBlogFeatureView } from "@/app/components/home/HomeBlogFeatureSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const BODY =
  "<p>Kalkan, Türkiye&#39;nin güneybatı kıyısında &amp; tarihi dokusuyla büyüleyen bir Akdeniz incisi.</p>" +
  "<ul><li><p>Kristal berraklığında Akdeniz suları</p></li><li>Tarihi liman ve sakin körfez</li>" +
  "<li>Eşsiz Akdeniz mutfağı</li><li>Mahremiyet ve huzur</li><li>Beşinci madde</li></ul>" +
  "<p>İkinci paragraf <script>alert(1)</script>metni.</p>";

const POST: BlogPost = {
  id: "p1",
  title: "Akdeniz'in En Gizli Cenneti",
  slug: "akdenizin-en-gizli-cenneti",
  excerpt: null,
  body: BODY,
  cover_image: "https://cdn.example/blog/akdenizin-en-gizli-cenneti.webp",
  is_active: true,
  published_at: "2026-10-01T00:00:00Z",
  seo_title: null,
  seo_description: null,
  og_image: null,
  noindex: false,
  category: "Neden Kalkan?",
  author: null,
  show_on_homepage: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: null,
};

beforeEach(() => {
  dbCalls.length = 0;
  dbResult = { data: null, error: null };
  revalidateTagMock.mockClear();
});

/* ================================================================ */
describe("Blog içeriğinden metin çıkarma (HTML güvenli)", () => {
  it("etiketleri söker, entity'leri çözer; script metni HTML olarak kalmaz", () => {
    expect(htmlToText("<p>A &amp; B&#39;s <b>x</b></p>")).toBe("A & B's x");
    const s = bodySummary(BODY, 1000);
    expect(s).not.toMatch(/<|>/);
    expect(s).toContain("Türkiye'nin");
    expect(s).toContain("& tarihi");
    /* Liste öğeleri özete karışmaz. */
    expect(s).not.toContain("Kristal");
  });

  it("özet kelime sınırında kısalır", () => {
    expect(truncateText("bir iki üç dört beş", 9)).toBe("bir iki…");
    expect(bodySummary(BODY, 40).endsWith("…")).toBe(true);
    expect(bodySummary(BODY, 40).length).toBeLessThanOrEqual(41);
  });

  it("maddeler: ilk 4 liste öğesi, düz metin", () => {
    expect(bodyHighlights(BODY)).toEqual([
      "Kristal berraklığında Akdeniz suları",
      "Tarihi liman ve sakin körfez",
      "Eşsiz Akdeniz mutfağı",
      "Mahremiyet ve huzur",
    ]);
    expect(bodyHighlights("<p>liste yok</p>")).toEqual([]);
  });
});

describe("Veri: yalnız yayındaki + işaretli yazı", () => {
  it("repository is_active=true ve show_on_homepage=true filtreler, tek satır", async () => {
    await blogRepository.findHomepageFeatured();
    const eqs = dbCalls.filter((c) => c.op === "eq").map((c) => c.args);
    expect(eqs).toEqual(
      expect.arrayContaining([
        ["is_active", true],
        ["show_on_homepage", true],
      ]),
    );
    expect(dbCalls.some((c) => c.op === "limit" && c.args[0] === 1)).toBe(true);
  });

  it("taslak, işaretsiz veya boş yazı → null (bölüm gizlenir)", async () => {
    expect(await buildHomepageBlogFeature(null, "tr")).toBeNull();
    expect(await buildHomepageBlogFeature({ ...POST, is_active: false }, "tr")).toBeNull();
    expect(
      await buildHomepageBlogFeature({ ...POST, show_on_homepage: false }, "tr"),
    ).toBeNull();
  });

  it("TR: başlık, kategori, kapak ve mevcut blog detay rotası", async () => {
    const f = (await buildHomepageBlogFeature(POST, "tr"))!;
    expect(f.title).toBe("Akdeniz'in En Gizli Cenneti");
    expect(f.category).toBe("Neden Kalkan?");
    expect(f.href).toBe("/tr/blog/akdenizin-en-gizli-cenneti");
    expect(f.coverUrl).toContain("blog/akdenizin-en-gizli-cenneti.webp");
    /* excerpt yok → gövde özeti öncü metin; tekrar basılmaz. */
    expect(f.lead).toContain("Kalkan, Türkiye'nin");
    expect(f.summary).toBeNull();
    expect(f.highlights).toHaveLength(4);
  });

  it("excerpt varsa öncü metin odur, gövde özeti ek paragraf", async () => {
    const f = (await buildHomepageBlogFeature({ ...POST, excerpt: "Kısa özet." }, "tr"))!;
    expect(f.lead).toBe("Kısa özet.");
    expect(f.summary).toContain("Kalkan");
  });

  it("EN: çevrilmiş başlık ve /en önekli bağlantı", async () => {
    const f = (await buildHomepageBlogFeature(POST, "en"))!;
    expect(f.title).toBe("The Mediterranean's Hidden Paradise");
    expect(f.href).toBe("/blog/akdenizin-en-gizli-cenneti");
  });
});

describe("Ana sayfa görünümü", () => {
  const feature: HomepageBlogFeature = {
    slug: "s",
    href: "/tr/blog/s",
    title: "Akdeniz'in En Gizli Cenneti",
    category: "Neden Kalkan?",
    lead: "Öncü metin",
    summary: null,
    highlights: ["A", "B"],
    coverUrl: "https://cdn.example/blog/s.webp",
  };
  const cta = getDictionary("tr").home.blogFeature.cta;

  it("tam genişlik beyaz section; iki sütun (lg), mobil tek sütun", () => {
    const { container } = render(<HomeBlogFeatureView feature={feature} ctaLabel={cta} />);
    const section = container.querySelector("section")!;
    expect(section.className.split(/\s+/)).toContain("bg-white");
    expect(section).toHaveAttribute("data-home-section", "blog-feature");
    const grid = section.firstElementChild as HTMLElement;
    expect(grid.className).toContain("max-w-site");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("lg:grid-cols-2");
    expect(grid.className).not.toContain("bg-white");
    expect(section.querySelector("[data-blog-feature-cover] img")).toHaveAttribute(
      "src",
      feature.coverUrl,
    );
  });

  it("kategori etiketi, başlık, metin, maddeler ve 'Daha Fazla Keşfet' bağlantısı", () => {
    render(<HomeBlogFeatureView feature={feature} ctaLabel={cta} />);
    const h2 = screen.getByRole("heading", { level: 2, name: feature.title });
    expect(h2.className).toContain("text-ink");
    expect(screen.getByText("Neden Kalkan?")).toBeInTheDocument();
    expect(screen.getByText("Öncü metin")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    const link = screen.getByRole("link", { name: new RegExp(cta) });
    expect(link).toHaveAttribute("href", "/tr/blog/s");
    expect(cta).toBe("Daha Fazla Keşfet");
    expect(getDictionary("en").home.blogFeature.cta).toBe("Discover More");
  });

  it("kapak yoksa görsel alanı basılmaz; kategori/madde yoksa gizlenir", () => {
    const { container } = render(
      <HomeBlogFeatureView
        feature={{ ...feature, coverUrl: null, category: null, highlights: [] }}
        ctaLabel={cta}
      />,
    );
    expect(container.querySelector("[data-blog-feature-cover]")).toBeNull();
    expect(container.querySelector("[data-blog-feature-category]")).toBeNull();
    expect(container.querySelector("[data-blog-feature-highlights]")).toBeNull();
    expect((container.querySelector("section")!.firstElementChild as HTMLElement).className).not.toContain(
      "lg:grid-cols-2",
    );
  });

  it("sıra: Hizmetlerimiz → Neden Kalkan? → İndirimli Kiralık Villalar", () => {
    const body = readFileSync(join(process.cwd(), "app/components/home/HomePageBody.tsx"), "utf8");
    const at = (t: string) => body.indexOf(t);
    expect(at("<HomeBlogFeatureSection")).toBeGreaterThan(at("<HomeServicesSection"));
    expect(at("<DiscountCollection")).toBeGreaterThan(at("<HomeBlogFeatureSection"));
  });
});

describe("Migration 099", () => {
  it("blog_posts'a show_on_homepage (default false) + tek-satır kısmi unique index", () => {
    const sql = readFileSync(
      join(process.cwd(), "db/migrations/099_blog_posts_show_on_homepage.sql"),
      "utf8",
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.blog_posts\s+ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false/,
    );
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_single_homepage_idx/);
    expect(sql).toMatch(/WHERE show_on_homepage/);
    expect(sql).not.toMatch(/CREATE TABLE/);
  });
});
