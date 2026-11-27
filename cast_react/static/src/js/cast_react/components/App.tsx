import { useEffect, useRef } from "react";
import { facetCountsUrl, postListUrl } from "../api";
import type { Config } from "../config";
import { MiniPlayer } from "../player/MiniPlayer";
import { listHref as buildListHref, parseRoute, useHref } from "../router";
import type { Filters } from "../types";
import { Footer, Header } from "./Header";
import { PostDetailPage } from "./PostDetailPage";
import { PostListPage } from "./PostListPage";

export function App({ config }: { config: Config }) {
  const href = useHref();
  const route = parseRoute(href, config.blogUrl);
  // "All posts" on a post page leads back to the list as the reader left it.
  const lastList = useRef<{ filters: Filters; page: number }>({ filters: {}, page: 1 });
  if (route.name === "PostList") {
    lastList.current = { filters: route.filters, page: route.page };
  }
  const { filters, page } = lastList.current;
  const listHref = buildListHref(config.blogUrl, filters, page);
  const listPrefetch = [postListUrl(config, filters, page), facetCountsUrl(config, filters)];

  // After a change of page, keyboard and screen reader users continue at the
  // start of the new content instead of at the link they activated.
  const pageKey = route.name === "PostDetail" ? `post:${route.slug}` : route.name;
  const firstPage = useRef(true);
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    document.getElementById("cr-main")?.focus({ preventScroll: true });
  }, [pageKey]);

  return (
    <>
      <a className="cr-skip-link" href="#cr-main">
        Skip to content
      </a>
      <Header config={config} />
      <main id="cr-main" className="cr-main" tabIndex={-1}>
        {route.name === "PostList" && <PostListPage config={config} filters={route.filters} page={route.page} />}
        {route.name === "PostDetail" && (
          <PostDetailPage
            key={route.slug}
            config={config}
            slug={route.slug}
            listHref={listHref}
            listPrefetch={listPrefetch}
          />
        )}
        {route.name === "Elsewhere" && (
          <div className="cr-notice">
            <h1>Page not found</h1>
            <p>
              There is nothing at this address. <a href={config.blogUrl}>Go to {config.blogTitle}</a>
            </p>
          </div>
        )}
      </main>
      <Footer config={config} />
      <MiniPlayer blogUrl={config.blogUrl} />
    </>
  );
}
