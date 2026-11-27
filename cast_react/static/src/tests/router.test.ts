import { detailHref, isPlainClick, listHref, parseRoute } from "@/router";

describe("parseRoute", () => {
  it("recognises the post list with its filters and page", () => {
    expect(parseRoute("/show/?search=room&tag_facets=rss&page=3&unknown=1", "/show/")).toEqual({
      name: "PostList",
      filters: { search: "room", tag_facets: "rss" },
      page: 3,
    });
  });

  it("falls back to page 1 for a bad page number", () => {
    expect(parseRoute("/show/?page=zero", "/show/")).toEqual({ name: "PostList", filters: {}, page: 1 });
  });

  it("recognises a post", () => {
    expect(parseRoute("/show/episode-05/?t=30", "/show/")).toEqual({ name: "PostDetail", slug: "episode-05" });
  });

  it("leaves other addresses alone", () => {
    expect(parseRoute("/about/", "/show/")).toEqual({ name: "Elsewhere" });
    expect(parseRoute("/show/a/b/", "/show/")).toEqual({ name: "Elsewhere" });
    expect(parseRoute("https://example.org/show/", "/show/")).toEqual({ name: "Elsewhere" });
    expect(parseRoute("/show/%E0%A4%A/", "/show/")).toEqual({ name: "Elsewhere" });
  });
});

describe("hrefs", () => {
  it("builds list addresses without empty values", () => {
    expect(listHref("/show/", {}, 1)).toBe("/show/");
    expect(listHref("/show/", { search: "a b", o: "" }, 2)).toBe("/show/?search=a+b&page=2");
  });

  it("builds post addresses", () => {
    expect(detailHref("/show/", "episode-05")).toBe("/show/episode-05/");
  });
});

describe("isPlainClick", () => {
  const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };

  it("accepts a plain left click only", () => {
    expect(isPlainClick(base)).toBe(true);
    expect(isPlainClick({ ...base, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...base, button: 1 })).toBe(false);
    expect(isPlainClick({ ...base, defaultPrevented: true })).toBe(false);
  });
});
