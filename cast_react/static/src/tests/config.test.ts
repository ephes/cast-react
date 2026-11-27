import { readConfig } from "@/config";

function page(attributes: string, extra = ""): Document {
  return new DOMParser().parseFromString(
    `<script id="cast-react-configuration" type="application/json" ${attributes}></script>${extra}`,
    "text/html",
  );
}

describe("readConfig", () => {
  it("reads the values the template provides", () => {
    const doc = page(
      `data-blog-url="/show" data-blog-id="3" data-blog-title="Ground Loop" data-pagination-page-size="7"
       data-wagtail-api-pages-url="/cast/api/wagtail/pages/" data-route-name="PostDetail" data-post-slug="episode-05"
       data-page-type="cast.Episode" data-csrf-token="token"`,
      `<template id="cast-react-blog-description"><p>About <b>us</b></p></template>
       <template id="cast-react-navigation"><a href="/">Home</a><a href="">Empty</a></template>`,
    );
    const config = readConfig(doc);
    expect(config.blogUrl).toBe("/show/");
    expect(config.blogId).toBe(3);
    expect(config.pageSize).toBe(7);
    expect(config.routeName).toBe("PostDetail");
    expect(config.postSlug).toBe("episode-05");
    expect(config.pageType).toBe("cast.Episode");
    expect(config.blogDescriptionHtml).toBe("<p>About <b>us</b></p>");
    expect(config.navigation).toEqual([{ href: "/", text: "Home" }]);
  });

  it("uses safe defaults", () => {
    const config = readConfig(page(`data-blog-id="1"`));
    expect(config.blogUrl).toBe("/");
    expect(config.pageSize).toBe(5);
    expect(config.routeName).toBe("PostList");
    expect(config.navigation).toEqual([]);
  });

  it("fails clearly without a usable configuration", () => {
    expect(() => readConfig(page(`data-blog-id="x"`))).toThrow(/invalid blog id/);
    expect(() => readConfig(new DOMParser().parseFromString("<p></p>", "text/html"))).toThrow(/missing/);
  });
});
