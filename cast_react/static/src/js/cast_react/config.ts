// Reads what the Django template (cast/react/base.html) tells the app about the blog.

export interface Config {
  blogUrl: string;
  blogId: number;
  blogTitle: string;
  blogSubtitle: string;
  blogDescriptionHtml: string;
  navigation: { href: string; text: string }[];
  csrfToken: string;
  pageSize: number;
  pagesApiUrl: string;
  facetCountsApiUrl: string;
  postCommentUrl: string;
  themeListApiUrl: string;
  themeUpdateApiUrl: string;
  feedUrl: string;
  routeName: "PostList" | "PostDetail";
  postSlug: string;
  pageType: string;
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
  let blogUrl = data.blogUrl || "/";
  if (!blogUrl.endsWith("/")) {
    blogUrl += "/";
  }
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
    pagesApiUrl: data.wagtailApiPagesUrl ?? "/",
    facetCountsApiUrl: data.apiFacetCountsUrl ?? "/",
    postCommentUrl: data.postCommentUrl ?? "/",
    themeListApiUrl: data.apiThemeListUrl ?? "",
    themeUpdateApiUrl: data.apiThemeUpdateUrl ?? "",
    feedUrl: data.feedUrl ?? "",
    routeName: data.routeName === "PostDetail" ? "PostDetail" : "PostList",
    postSlug: data.postSlug ?? "",
    pageType: data.pageType ?? "",
  };
}
