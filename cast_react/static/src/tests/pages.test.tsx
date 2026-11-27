import { act } from "react";
import { clearJsonCache } from "@/api";
import { App } from "@/components/App";
import type { Config } from "@/config";
import { resetPlayerForTests } from "@/player/store";
import sharedStyles from "../css/cast_react/shared.css?inline";
import { FakeAudio, cleanup, click, jsonResponse, render, settle } from "./helpers";

const config: Config = {
  blogUrl: "/show/",
  blogId: 3,
  blogTitle: "Ground Loop",
  blogSubtitle: "A podcast",
  blogDescriptionHtml: "<p>About the show</p>",
  navigation: [{ href: "/", text: "Home" }],
  csrfToken: "token",
  pageSize: 2,
  apiLimitMax: 20,
  pagesApiUrl: "/cast/api/wagtail/pages/",
  facetCountsApiUrl: "/cast/api/facet_counts/3",
  postCommentUrl: "/show/comments/post/ajax/",
  themeListApiUrl: "",
  themeUpdateApiUrl: "",
  feedUrl: "/feed/",
  preview: null,
  routeName: "PostList",
  postSlug: "",
  pageType: "",
};

const playerMarkup = `
  <script id="cast-player-data-1" type="application/json">${JSON.stringify({
    audioId: 1,
    title: "Episode one",
    subtitle: "",
    duration: 540,
    poster: "",
    sources: [{ type: "audio/mpeg", src: "/media/1.mp3" }],
    chapters: [{ start: 0, title: "Hello" }],
    transcript: null,
  })}</script>
  <cast-audio-player data-payload="cast-player-data-1"></cast-audio-player>`;

const body = (text: string, extra = "") => `<article>
  <div class="cast-react-article-data" hidden data-article-date="Nov. 24, 2026" data-article-author="Mara"></div>
  <section class="block-overview"><p>${text}</p></section>${extra}</article>`;

const episodeOneBody = body(
  "Teaser one",
  playerMarkup + '<section class="block-detail"><p>The whole story</p></section>',
);

const post = (id: number, slug: string, title: string, type = "cast.Episode") => ({
  id,
  title,
  meta: { type, slug, detail_url: "", html_url: "", first_published_at: "" },
});

let requests: URL[] = [];

function respond(url: URL): Response {
  if (url.pathname === "/cast/api/themes/") {
    return jsonResponse({ items: [
      { slug: "bootstrap5", name: "Bootstrap 5", selected: false },
      { slug: "react", name: "React", selected: true },
    ] });
  }
  if (url.pathname.startsWith("/cast/api/facet_counts/")) {
    return jsonResponse({
      facet_counts: {
        category_facets: [{ slug: "audio", name: "Audio", count: 2 }],
        tag_facets: [],
        date_facets: [{ slug: "2026-11", name: "2026-11", count: 3 }],
      },
    });
  }
  const slug = url.searchParams.get("slug");
  if (slug === "episode-one") {
    return jsonResponse({
      meta: { total_count: 1 },
      items: [
        {
          ...post(1, "episode-one", "Episode one"),
          html_detail: episodeOneBody,
          comments: [
            { id: 1, parent: null, user: "Jonas", date: "2026-11-26T04:12:00Z", comment: "Great episode." },
            { id: 2, parent: 1, user: "Priya", date: "2026-11-26T11:12:00Z", comment: "I agree." },
          ],
          comments_are_enabled: true,
          comments_security_data: { content_type: "cast.post", object_pk: "1", timestamp: "1", security_hash: "hash" },
        },
      ],
    });
  }
  if (slug) {
    return jsonResponse({ meta: { total_count: 0 }, items: [] });
  }
  if (url.searchParams.get("category_facets") === "audio") {
    return jsonResponse({
      meta: { total_count: 1 },
      items: [{ ...post(1, "episode-one", "Episode one"), html_overview: body("Teaser one", playerMarkup) }],
    });
  }
  if (url.searchParams.get("offset") === "2") {
    return jsonResponse({
      meta: { total_count: 3 },
      items: [{ ...post(9, "notes", "Studio notes", "cast.Post"), html_overview: body("Teaser three") }],
    });
  }
  return jsonResponse({
    meta: { total_count: 3 },
    items: [
      { ...post(1, "episode-one", "Episode one"), html_overview: episodeOneBody },
      { ...post(2, "episode-two", "Episode two"), html_overview: body("Teaser two") },
    ],
  });
}

async function open(path: string): Promise<HTMLElement> {
  window.history.replaceState(null, "", path);
  const view = await render(<App config={config} />);
  await settle();
  return view;
}

// Links wait briefly for the data of the next page before the page changes.
async function follow(element: Element | null): Promise<void> {
  await click(element);
  await settle();
  await settle();
}

beforeEach(() => {
  requests = [];
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, window.location.origin);
      requests.push(url);
      if (init?.method === "POST") {
        return jsonResponse({ success: true });
      }
      return respond(url);
    }),
  );
  window.localStorage.clear();
  clearJsonCache();
  resetPlayerForTests();
});

afterEach(async () => {
  await cleanup();
  vi.unstubAllGlobals();
});

it("shows nested header links in a scrolling row on phones and hides empty navigation", async () => {
  const view = await render(
    <>
      <style>{sharedStyles}</style>
      <nav className="cr-header__nav" aria-label="Custom site">
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about/">About</a></li>
        </ul>
      </nav>
      <nav className="cr-header__nav" aria-label="Empty site" />
    </>,
  );
  const [customNav, emptyNav] = view.querySelectorAll("nav");
  expect(getComputedStyle(customNav).display).toBe("flex");
  expect(getComputedStyle(emptyNav).display).toBe("none");

  const phone = Array.from(view.querySelector("style")!.sheet!.cssRules).find(
    (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 35rem)",
  ) as CSSMediaRule;
  const rules = Array.from(phone.cssRules) as CSSStyleRule[];
  expect(rules.find((rule) => rule.selectorText === ".cr-header__nav")?.style.overflowX).toBe("auto");
  expect(rules.find((rule) => rule.selectorText === ".cr-header__nav > ul")?.style.display).toBe("flex");
  expect(rules.find((rule) => rule.selectorText === ".cr-header__nav > ul > li")?.style.display).toBe("flex");
});

it("associates the footer's Site theme label with its select", async () => {
  window.history.replaceState(null, "", "/show/");
  const view = await render(<App config={{ ...config, themeListApiUrl: "/cast/api/themes/" }} />);
  await settle();

  const select = view.querySelector<HTMLSelectElement>("footer select")!;
  expect(Array.from(select.labels ?? [], (label) => label.textContent)).toEqual(["Site theme"]);
  expect(select.value).toBe("react");
  expect(Array.from(select.options, (option) => option.textContent)).toEqual(["Bootstrap 5", "React"]);
});

describe("post list", () => {
  it("keeps the nav links separate from the header actions", async () => {
    const view = await render(<App config={{ ...config, navigation: [
      { href: "/show/", text: "Ground Loop" },
      { href: "/hello/", text: "Claas und Nora sagen Hallo" },
      { href: "/ephes/", text: "~ephes" },
    ] }} />);
    await settle();
    const nav = view.querySelector(".cr-header__nav")!;
    expect(Array.from(nav.querySelectorAll("a"), (link) => link.textContent)).toEqual([
      "Claas und Nora sagen Hallo", "~ephes",
    ]);
    const actions = nav.nextElementSibling!;
    expect(actions.className).toBe("cr-header__actions");
    expect(actions.querySelector('a[aria-label="Feeds"]')?.getAttribute("href")).toBe("/feed/");
    expect(actions.querySelector("button")?.getAttribute("aria-label")).toContain("Change");
  });

  it.each([
    ["a teaser image", '<img src="/cover.jpg" alt="Cover">', false],
    ["a teaser picture with an image", '<picture><source srcset="/cover.webp"><img src="/cover.jpg"></picture>', false],
    ["a teaser picture with only a source", '<picture><source srcset="/cover.webp"></picture>', true],
    ["an image removed with the player", '<cast-audio-player><img src="/cover.jpg"></cast-audio-player>', true],
    ["no teaser image", "", true],
  ])("renders the side thumbnail correctly with %s", async (_name, extra, showsThumbnail) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      meta: { total_count: 1 },
      items: [{
        ...post(1, "episode-one", "Episode one"),
        cover_image_poster_url: "/cover.jpg",
        html_overview: body("Teaser one", playerMarkup + extra),
      }],
    })));
    const view = await open("/show/");
    const row = view.querySelector(".cr-post-row")!;
    const thumbnail = row.querySelector(".cr-post-row__cover img");
    expect(thumbnail?.getAttribute("src") ?? null).toBe(showsThumbnail ? "/cover.jpg" : null);
    expect(Boolean(row.querySelector(".cr-prose--teaser img"))).toBe(!showsThumbnail);
    expect(row.querySelector(".cr-play-episode")).not.toBeNull();
  });

  it("shows the blog, its posts and the paging controls", async () => {
    const view = await open("/show/");
    expect(view.querySelector("h1")?.textContent).toBe("Ground Loop");
    expect(view.querySelector(".cr-list__description")?.textContent).toBe("About the show");
    const titles = Array.from(view.querySelectorAll(".cr-post-row__title"), (title) => title.textContent);
    expect(titles).toEqual(["Episode one", "Episode two"]);
    expect(view.querySelector(".cr-post-row time")?.textContent).toBe("Nov. 24, 2026");
    expect(view.querySelectorAll(".cr-play-episode")).toHaveLength(1);
    expect(view.querySelector(".cr-play-episode")?.textContent).toContain("9 min");
    expect(view.querySelector('.cr-pagination [aria-current="page"]')?.textContent).toBe("1");
    const list = requests.find((url) => url.pathname === "/cast/api/wagtail/pages/");
    expect(list?.searchParams.get("child_of")).toBe("3");
    expect(list?.searchParams.get("limit")).toBe("2");
    expect(list?.searchParams.get("render_for_feed")).toBe("false");
    expect(list?.searchParams.get("use_post_filter")).toBe("true");
    expect(list?.searchParams.get("theme")).toBe("react");
  });

  it("shows only the overview on the list and opens the full post from Read more", async () => {
    const view = await open("/show/");
    const row = view.querySelector(".cr-post-row")!;
    expect(row.querySelector(".block-overview")?.textContent).toBe("Teaser one");
    expect(row.querySelector(".block-detail")).toBeNull();
    expect(row.textContent).not.toContain("The whole story");

    const links = view.querySelectorAll(".cr-post-row__more a");
    expect(links).toHaveLength(2);
    const link = links[0];
    expect(link.textContent).toBe("Read more →");
    expect(link.getAttribute("aria-label")).toBe("Read more about Episode one");
    expect(link.getAttribute("href")).toBe("/show/episode-one/");
    const list = requests.find((url) => url.pathname === "/cast/api/wagtail/pages/");
    expect(list?.searchParams.get("fields")).toBe("html_overview,visible_date,cover_image_poster_url");

    await follow(link);
    expect(window.location.pathname).toBe("/show/episode-one/");
    expect(view.querySelector(".cr-detail .block-overview")?.textContent).toBe("Teaser one");
    expect(view.querySelector(".cr-detail .block-detail")?.textContent).toBe("The whole story");
  });

  it("never asks the API for more posts than it hands out at once", async () => {
    window.history.replaceState(null, "", "/show/?page=2");
    await render(<App config={{ ...config, pageSize: 50 }} />);
    await settle();
    const list = requests.find((url) => url.pathname === "/cast/api/wagtail/pages/");
    expect(list?.searchParams.get("limit")).toBe("20");
    expect(list?.searchParams.get("offset")).toBe("20");
  });

  it("follows the API cap the site configured", async () => {
    window.history.replaceState(null, "", "/show/?page=2");
    await render(<App config={{ ...config, pageSize: 10, apiLimitMax: 4 }} />);
    await settle();
    const capped = requests.find((url) => url.pathname === "/cast/api/wagtail/pages/");
    expect(capped?.searchParams.get("limit")).toBe("4");
    expect(capped?.searchParams.get("offset")).toBe("4");
  });

  it("asks for the whole page size when the API has no cap", async () => {
    window.history.replaceState(null, "", "/show/");
    await render(<App config={{ ...config, pageSize: 50, apiLimitMax: null }} />);
    await settle();
    const list = requests.find((url) => url.pathname === "/cast/api/wagtail/pages/");
    expect(list?.searchParams.get("limit")).toBe("50");
  });

  it("combines two filters chosen in quick succession", async () => {
    const view = await open("/show/");
    const facets = Array.from(view.querySelectorAll(".cr-facet"));
    const audio = facets.find((button) => button.textContent?.startsWith("Audio"));
    const month = view.querySelector<HTMLSelectElement>("select:has(optgroup)")!;
    await click(audio ?? null);
    await act(async () => {
      month.value = "2026-11";
      month.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    await settle();
    expect(window.location.search).toBe("?date_facets=2026-11&category_facets=audio");
  });

  it("goes to the next page and keeps it in the address", async () => {
    const view = await open("/show/");
    await follow(view.querySelector('.cr-pagination a[rel="next"]'));
    expect(window.location.search).toBe("?page=2");
    expect(view.querySelector(".cr-post-row__title")?.textContent).toBe("Studio notes");
    expect(view.querySelector('.cr-pagination [aria-current="page"]')?.textContent).toBe("2");
  });

  it("filters by a facet and can clear the filter again", async () => {
    const view = await open("/show/");
    const facet = Array.from(view.querySelectorAll(".cr-facet")).find((button) =>
      button.textContent?.startsWith("Audio"),
    );
    await follow(facet ?? null);
    expect(window.location.search).toBe("?category_facets=audio");
    expect(view.querySelectorAll(".cr-post-row")).toHaveLength(1);
    expect(view.querySelector(".cr-list__summary")?.textContent).toContain("1 post found.");
    const active = view.querySelector('.cr-facet[aria-pressed="true"]');
    expect(active?.textContent).toContain("Audio");
    await follow(view.querySelector(".cr-list__summary a"));
    expect(window.location.search).toBe("");
    expect(view.querySelectorAll(".cr-post-row")).toHaveLength(2);
  });

  it("removes a filter that is chosen twice in quick succession", async () => {
    const view = await open("/show/");
    const audio = Array.from(view.querySelectorAll(".cr-facet")).find((button) =>
      button.textContent?.startsWith("Audio"),
    );
    await click(audio ?? null);
    await click(audio ?? null);
    await settle();
    await settle();
    expect(window.location.search).toBe("");
  });

  it("reads filters from the address", async () => {
    await open("/show/?search=room&date_after=2026-01-01&o=visible_date&page=2");
    const list = requests.find((url) => url.pathname === "/cast/api/wagtail/pages/");
    expect(list?.searchParams.get("search")).toBe("room");
    expect(list?.searchParams.get("date_after")).toBe("2026-01-01");
    expect(list?.searchParams.get("order")).toBe("visible_date");
    expect(list?.searchParams.get("offset")).toBe("2");
    const facets = requests.find((url) => url.pathname.startsWith("/cast/api/facet_counts/"));
    expect(facets?.searchParams.get("search")).toBe("room");
  });

  it("starts an episode from the list and shows the mini player", async () => {
    const view = await open("/show/");
    await click(view.querySelector(".cr-play-episode"));
    expect(FakeAudio.instances[0].src).toBe("/media/1.mp3");
    expect(view.querySelector(".cr-mini__title")?.textContent).toBe("Episode one");
    expect(view.querySelector(".cr-mini__title")?.getAttribute("href")).toBe("/show/episode-one/");
  });

  it("says so when the posts cannot be loaded and retries", async () => {
    let fail = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => (fail ? jsonResponse({}, 500) : respond(new URL(input, window.location.origin)))),
    );
    const view = await open("/show/");
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
    fail = false;
    await follow(view.querySelector('[role="alert"] button'));
    expect(view.querySelectorAll(".cr-post-row")).toHaveLength(2);
  });
});

describe("post page", () => {
  it("opens a post from the list without leaving the page", async () => {
    const view = await open("/show/");
    await follow(view.querySelector(".cr-post-row__title a"));
    expect(window.location.pathname).toBe("/show/episode-one/");
    expect(view.querySelector(".cr-detail h1")?.textContent).toBe("Episode one");
    expect(document.title).toBe("Episode one – Ground Loop");
    const detail = requests.find((url) => url.searchParams.get("slug") === "episode-one");
    expect(detail?.searchParams.get("type")).toBe("cast.Episode");
    expect(detail?.searchParams.get("render_for_feed")).toBe("false");
    expect(view.querySelector(".cr-player")).not.toBeNull();
    expect(view.querySelector(".cr-prose")?.textContent).toContain("The whole story");
    expect(view.querySelector(".cr-prose cast-audio-player")).toBeNull();
  });

  it("shows threaded comments and posts a new one", async () => {
    const view = await open("/show/episode-one/");
    expect(view.querySelector(".cr-comments h2")?.textContent).toBe("2 comments");
    expect(view.querySelector(".cr-comment__replies .cr-comment__author")?.textContent).toBe("Priya");

    const form = view.querySelector<HTMLFormElement>(".cr-comments > .cr-comment-form");
    const setValue = (selector: string, value: string) => {
      const field = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
      if (!field) {
        throw new Error(`${selector} not found`);
      }
      const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => {
      setValue('input[type="text"]', "Henrik");
      setValue("textarea", "Thanks!");
    });
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await settle();
    const call = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(call?.[0]).toBe("/show/comments/post/ajax/");
    const sent = call?.[1]?.body as URLSearchParams;
    expect(sent.get("name")).toBe("Henrik");
    expect(sent.get("comment")).toBe("Thanks!");
    expect(sent.get("security_hash")).toBe("hash");
    expect((call?.[1]?.headers as Record<string, string>)["X-CSRFToken"]).toBe("token");
    // The post is fetched again so the new comment shows up.
    expect(requests.filter((url) => url.searchParams.get("slug") === "episode-one").length).toBeGreaterThan(1);
  });

  it("opens a shared link at the given time", async () => {
    await open("/show/episode-one/?t=1:30");
    expect(FakeAudio.instances[0].src).toBe("/media/1.mp3");
    await act(async () => FakeAudio.instances[0].ready(540));
    expect(FakeAudio.instances[0].currentTime).toBe(90);
    expect(FakeAudio.instances[0].paused).toBe(true);
  });

  it("applies a shared time to the audio the link names", async () => {
    const second = playerMarkup.replaceAll("cast-player-data-1", "cast-player-data-2").replace('"audioId":1', '"audioId":2');
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          meta: { total_count: 1 },
          items: [{ ...post(1, "episode-one", "Episode one"), html_detail: body("Two audios", playerMarkup + second) }],
        }),
      ),
    );
    const view = await open("/show/episode-one/?t=30&audio=2");
    expect(view.querySelectorAll(".cr-player")).toHaveLength(2);
    await act(async () => FakeAudio.instances[0].ready(540));
    expect(FakeAudio.instances[0].currentTime).toBe(30);
    const clocks = Array.from(view.querySelectorAll(".cr-player__clock"), (clock) => clock.textContent);
    expect(clocks).toEqual(["0:00-9:00", "0:30-8:30"]);
  });

  it("shows the draft of a Wagtail preview without asking the API for the post", async () => {
    // Wagtail serves previews at an admin address, not at the post's own.
    window.history.replaceState(null, "", "/cms/pages/42/edit/preview/");
    const preview = { title: "Unpublished draft", html: body("Not saved yet", playerMarkup) };
    const view = await render(
      <App config={{ ...config, routeName: "PostDetail", postSlug: "draft", pageType: "cast.Episode", preview }} />,
    );
    await settle();
    expect(view.querySelector(".cr-detail h1")?.textContent).toBe("Unpublished draft");
    expect(view.querySelector(".cr-prose")?.textContent).toContain("Not saved yet");
    expect(view.querySelector(".cr-player")).not.toBeNull();
    expect(requests.some((url) => url.searchParams.has("slug"))).toBe(false);
  });

  it("explains a post that does not exist", async () => {
    const view = await open("/show/missing/");
    expect(view.querySelector(".cr-detail h1")?.textContent).toBe("Post not found");
  });

  it("goes back to the list as the reader left it", async () => {
    const view = await open("/show/?page=2");
    await follow(view.querySelector(".cr-post-row__title a"));
    expect(view.querySelector(".cr-back")?.getAttribute("href")).toBe("/show/?page=2");
    await follow(view.querySelector(".cr-back"));
    expect(window.location.search).toBe("?page=2");
    expect(view.querySelector(".cr-post-row__title")?.textContent).toBe("Studio notes");
  });
});
