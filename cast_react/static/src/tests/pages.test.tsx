import { act } from "react";
import { clearJsonCache } from "@/api";
import { App } from "@/components/App";
import type { Config } from "@/config";
import { resetPlayerForTests } from "@/player/store";
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
  pagesApiUrl: "/cast/api/wagtail/pages/",
  facetCountsApiUrl: "/cast/api/facet_counts/3",
  postCommentUrl: "/show/comments/post/ajax/",
  themeListApiUrl: "",
  themeUpdateApiUrl: "",
  feedUrl: "/feed/",
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
  <section class="block-paragraph"><p>${text}</p></section>${extra}</article>`;

const post = (id: number, slug: string, title: string, type = "cast.Episode") => ({
  id,
  title,
  meta: { type, slug, detail_url: "", html_url: "", first_published_at: "" },
});

let requests: URL[] = [];

function respond(url: URL): Response {
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
          html_detail: body("The whole story", playerMarkup),
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
      { ...post(1, "episode-one", "Episode one"), html_overview: body("Teaser one", playerMarkup) },
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

describe("post list", () => {
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
