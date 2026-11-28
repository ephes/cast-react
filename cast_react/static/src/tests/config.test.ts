import { readConfig } from "@/config";

function page(attributes: string, extra = ""): Document {
  return new DOMParser().parseFromString(
    `<script id="cast-react-configuration" type="application/json" ${attributes}></script>${extra}`,
    "text/html",
  );
}

describe("readConfig", () => {
  function withSubscribe(payload: string) {
    return readConfig(page(
      'data-blog-id="1" data-feed-url="/legacy-feed/"',
      `<script id="cast-react-subscribe" type="application/json">${payload}</script>`,
    ));
  }

  it("reads subscription JSON and drops invalid links", () => {
    const config = withSubscribe(JSON.stringify({
      isPodcast: true,
      feedPageUrl: "/show/feed/",
      podcastRssUrl: "https://podcast.example.org/show/feed/podcast/mp3/rss.xml",
      blogRssUrl: "//other.example.org/rss.xml",
      coverUrl: "https://podcast.example.org/media/cover.png",
      platformLinks: [
        { id: "apple_podcasts", label: "Apple Podcasts", url: "https://podcast.example.org/apple" },
        { id: "spotify", label: "Spotify", url: "javascript:alert(1)" },
        { id: "youtube", label: "YouTube", url: "https://[bad" },
        { id: "overcast", label: "Overcast", url: "/\\bad.example.org" },
        { id: "pocket_casts", label: "Pocket Casts", url: "mailto:hello@example.org" },
        { id: "constructor", label: "Invalid", url: "/platform/" },
        null,
      ],
      followLinks: [
        { label: "Mastodon", url: "https://social.example.org/@groundloop", rel: "me" },
        { label: "E-mail", url: "mailto:hello@example.org" },
        { label: "GitHub", url: "data:text/html,test" },
        { label: "Bluesky", url: "/bad path" },
        { label: "Other", url: 100 },
      ],
    }));
    expect(config.feedUrl).toBe("/legacy-feed/");
    expect(config.subscribe).toEqual({
      isPodcast: true,
      feedPageUrl: "/show/feed/",
      podcastRssUrl: "https://podcast.example.org/show/feed/podcast/mp3/rss.xml",
      blogRssUrl: "",
      coverUrl: "https://podcast.example.org/media/cover.png",
      platformLinks: [{ id: "apple_podcasts", label: "Apple Podcasts", icon: "podcast", url: "https://podcast.example.org/apple" }],
      followLinks: [
        { label: "Mastodon", url: "https://social.example.org/@groundloop", rel: "me" },
        { label: "E-mail", url: "mailto:hello@example.org", rel: "" },
      ],
    });
  });

  it("drops an unsafe cover and the cover of a written blog", () => {
    expect(withSubscribe(JSON.stringify({ isPodcast: true, coverUrl: "javascript:alert(1)" })).subscribe?.coverUrl).toBe("");
    expect(withSubscribe(JSON.stringify({ isPodcast: false, coverUrl: "/media/cover.png" })).subscribe?.coverUrl).toBe("");
  });

  it("keeps the legacy feed URL without subscription JSON", () => {
    const config = readConfig(page('data-blog-id="1" data-feed-url="/legacy-feed/"'));
    expect(config.subscribe).toBeNull();
    expect(config.feedUrl).toBe("/legacy-feed/");
  });

  it.each(["{invalid", "null", "[]", '{"isPodcast":"true"}'])("keeps the legacy feed for invalid JSON data (%s)", (payload) => {
    const config = withSubscribe(payload);
    expect(config.subscribe).toBeNull();
    expect(config.feedUrl).toBe("/legacy-feed/");
  });

  it("reads the values the template provides", () => {
    const doc = page(
      `data-blog-url="/show" data-blog-id="3" data-blog-title="Ground Loop" data-pagination-page-size="7" data-api-limit-max="30"
       data-wagtail-api-pages-url="/cast/api/wagtail/pages/" data-route-name="PostDetail" data-post-slug="episode-05"
       data-page-type="cast.Episode" data-csrf-token="token"`,
      `<template id="cast-react-blog-description"><p>About <b>us</b></p></template>
       <template id="cast-react-navigation"><a href="/">Home</a><a href="">Empty</a></template>`,
    );
    const config = readConfig(doc);
    expect(config.blogUrl).toBe("/show/");
    expect(config.blogId).toBe(3);
    expect(config.pageSize).toBe(7);
    expect(config.apiLimitMax).toBe(30);
    expect(config.routeName).toBe("PostDetail");
    expect(config.postSlug).toBe("episode-05");
    expect(config.pageType).toBe("cast.Episode");
    expect(config.blogDescriptionHtml).toBe("<p>About <b>us</b></p>");
    expect(config.navigation).toEqual([{ href: "/", text: "Home" }]);
  });

  it("turns an absolute blog address into a path", () => {
    const config = readConfig(page(`data-blog-id="1" data-blog-url="https://podcast.example.org/show/"`));
    expect(config.blogUrl).toBe("/show/");
  });

  it("picks up the draft of a Wagtail preview", () => {
    const doc = page(
      `data-blog-id="1"`,
      `<template id="cast-react-preview" data-title="Draft"><article><p>Unsaved</p></article></template>`,
    );
    expect(readConfig(doc).preview).toEqual({ title: "Draft", html: "<article><p>Unsaved</p></article>" });
    expect(readConfig(page(`data-blog-id="1"`)).preview).toBeNull();
  });

  it("uses safe defaults", () => {
    const config = readConfig(page(`data-blog-id="1"`));
    expect(config.blogUrl).toBe("/");
    expect(config.pageSize).toBe(5);
    expect(config.apiLimitMax).toBe(20);
    expect(readConfig(page(`data-blog-id="1" data-api-limit-max=""`)).apiLimitMax).toBeNull();
    expect(config.routeName).toBe("PostList");
    expect(config.navigation).toEqual([]);
  });

  it("fails clearly without a usable configuration", () => {
    expect(() => readConfig(page(`data-blog-id="x"`))).toThrow(/invalid blog id/);
    expect(() => readConfig(new DOMParser().parseFromString("<p></p>", "text/html"))).toThrow(/missing/);
  });
});
