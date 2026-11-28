// Reads what the Django template (cast/react/base.html) tells the app about the blog.

const platformIcons = {
  apple_podcasts: "podcast",
  overcast: "headphones",
  pocket_casts: "headphones",
  spotify: "music",
  youtube: "video",
  castro: "headphones",
} as const;

type PlatformId = keyof typeof platformIcons;

export interface Subscribe {
  feedPageUrl: string;
  isPodcast: boolean;
  podcastRssUrl: string;
  blogRssUrl: string;
  // The podcast artwork, shown beside the show title.
  coverUrl: string;
  platformLinks: { id: PlatformId; label: string; icon: (typeof platformIcons)[PlatformId]; url: string }[];
  followLinks: { label: string; url: string; rel: string }[];
}

export interface Config {
  blogUrl: string;
  blogId: number;
  blogTitle: string;
  blogSubtitle: string;
  blogDescriptionHtml: string;
  navigation: { href: string; text: string }[];
  csrfToken: string;
  pageSize: number;
  // Wagtail's WAGTAILAPI_LIMIT_MAX; null when the API has no cap.
  apiLimitMax: number | null;
  pagesApiUrl: string;
  facetCountsApiUrl: string;
  postCommentUrl: string;
  themeListApiUrl: string;
  themeUpdateApiUrl: string;
  feedUrl: string;
  subscribe: Subscribe | null;
  // Set in a Wagtail preview: the draft rendered by the server.
  preview: { title: string; html: string } | null;
  routeName: "PostList" | "PostDetail";
  postSlug: string;
  pageType: string;
}

function safeLink(value: unknown, allowMailto = false): string {
  if (typeof value !== "string" || /[\s\\\x00-\x1f\x7f]/u.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && /^https?:\/\/[^/]/i.test(value) && url.hostname) {
      return value;
    }
    if (allowMailto && url.protocol === "mailto:" && url.pathname) return value;
  } catch {
    // Ignore an invalid URL in a template override.
  }
  return "";
}

function readSubscribe(doc: Document): Subscribe | null {
  const script = doc.getElementById("cast-react-subscribe");
  if (!script?.textContent) return null;
  try {
    const data = JSON.parse(script.textContent);
    if (typeof data?.isPodcast !== "boolean") return null;
    const platformLinks: Subscribe["platformLinks"] = [];
    const followLinks: Subscribe["followLinks"] = [];
    if (data.isPodcast && Array.isArray(data.platformLinks)) {
      for (const link of data.platformLinks) {
        if (typeof link?.id !== "string" || !Object.hasOwn(platformIcons, link.id) ||
            typeof link.label !== "string" || !link.label.trim()) continue;
        const id = link.id as PlatformId;
        const url = safeLink(link.url);
        if (url) platformLinks.push({ id, label: link.label, icon: platformIcons[id], url });
      }
    }
    if (Array.isArray(data.followLinks)) {
      for (const link of data.followLinks) {
        if (typeof link?.label !== "string" || !link.label.trim()) continue;
        const url = safeLink(link.url, true);
        if (url) followLinks.push({ label: link.label, url, rel: link.rel === "me" ? "me" : "" });
      }
    }
    return {
      isPodcast: data.isPodcast,
      feedPageUrl: safeLink(data.feedPageUrl),
      podcastRssUrl: safeLink(data.podcastRssUrl),
      blogRssUrl: safeLink(data.blogRssUrl),
      coverUrl: data.isPodcast ? safeLink(data.coverUrl) : "",
      platformLinks,
      followLinks,
    };
  } catch {
    return null;
  }
}

export function readConfig(doc: Document = document): Config {
  const data = doc.getElementById("cast-react-configuration")?.dataset;
  if (!data) {
    throw new Error("cast-react: the configuration element is missing from the page");
  }
  const blogId = Number.parseInt(data.blogId ?? "", 10);
  if (Number.isNaN(blogId)) {
    throw new Error(`cast-react: invalid blog id "${data.blogId ?? ""}"`);
  }
  const pageSize = Number.parseInt(data.paginationPageSize ?? "", 10);
  const apiLimitMax = Number.parseInt(data.apiLimitMax ?? "", 10);
  // On a multi-site installation Wagtail may hand out an absolute URL; the router works with paths.
  let blogUrl = "/";
  try {
    blogUrl = new URL(data.blogUrl || "/", doc.baseURI || "http://localhost/").pathname;
  } catch {
    blogUrl = "/";
  }
  if (!blogUrl.endsWith("/")) {
    blogUrl += "/";
  }
  const preview = doc.getElementById("cast-react-preview");
  const description = doc.getElementById("cast-react-blog-description");
  const navigation = doc.getElementById("cast-react-navigation");
  const links = navigation instanceof HTMLTemplateElement ? navigation.content.querySelectorAll("a") : [];
  return {
    blogUrl,
    blogId,
    blogTitle: data.blogTitle ?? "",
    blogSubtitle: data.blogSubtitle ?? "",
    blogDescriptionHtml: description instanceof HTMLTemplateElement ? description.innerHTML.trim() : "",
    navigation: Array.from(links, (link) => ({
      href: link.getAttribute("href") ?? "",
      text: link.textContent ?? "",
    })).filter((link) => link.href && link.text),
    csrfToken: data.csrfToken ?? "",
    pageSize: Number.isNaN(pageSize) || pageSize < 1 ? 5 : pageSize,
    // An empty attribute means "no cap"; without the attribute (an older template override) keep Wagtail's default.
    apiLimitMax:
      data.apiLimitMax === undefined ? 20 : Number.isNaN(apiLimitMax) || apiLimitMax < 1 ? null : apiLimitMax,
    pagesApiUrl: data.wagtailApiPagesUrl ?? "/",
    facetCountsApiUrl: data.apiFacetCountsUrl ?? "/",
    postCommentUrl: data.postCommentUrl ?? "/",
    themeListApiUrl: data.apiThemeListUrl ?? "",
    themeUpdateApiUrl: data.apiThemeUpdateUrl ?? "",
    feedUrl: safeLink(data.feedUrl),
    subscribe: readSubscribe(doc),
    preview:
      preview instanceof HTMLTemplateElement
        ? { title: preview.dataset.title ?? "", html: preview.innerHTML }
        : null,
    routeName: data.routeName === "PostDetail" ? "PostDetail" : "PostList",
    postSlug: data.postSlug ?? "",
    pageType: data.pageType ?? "",
  };
}
