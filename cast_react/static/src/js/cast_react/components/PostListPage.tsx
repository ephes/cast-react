// The blog index: description, search and filters, and the paginated posts.

import { useEffect, useMemo } from "react";
import { effectivePageSize, facetCountsUrl, postDetailUrl, postListUrl, useJson } from "../api";
import type { Config } from "../config";
import { Link, go } from "../navigation";
import { PlayIcon, PauseIcon } from "./icons";
import { toggle, usePlayerSelector } from "../player/store";
import { parsePostHtml } from "../postHtml";
import { detailHref, listHref, settleScroll } from "../router";
import { formatDuration } from "../time";
import type { FacetCountsFromApi, Filters, PlayerPayload, Post, PostsFromApi } from "../types";
import { FILTER_KEYS } from "../types";
import { FilterPanel } from "./FilterPanel";
import { FollowLinks } from "./FollowLinks";
import { Pagination } from "./Pagination";
import { PostContent } from "./PostContent";
import { SubscribeLinks } from "./SubscribeLinks";

// Page types seen in list answers, so the detail request can ask for the right type.
export const knownPageTypes = new Map<string, string>();

function PlayEpisodeButton({ track }: { track: PlayerPayload }) {
  const status = usePlayerSelector((state) => (state.track?.audioId === track.audioId ? state.status : "idle"));
  const playing = status === "playing" || status === "loading";
  const duration = track.duration ? formatDuration(track.duration) : "";
  return (
    <button
      type="button"
      className="cr-play-episode"
      data-loading={status === "loading" || undefined}
      onClick={() => toggle(track)}
      aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}
    >
      <span className="cr-play-episode__icon">{playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}</span>
      <span>{playing ? "Pause" : status === "paused" ? "Continue" : "Play"}</span>
      {duration && <span className="cr-play-episode__duration">{duration}</span>}
    </button>
  );
}

function PostRow({ post, config }: { post: Post; config: Config }) {
  const href = detailHref(config.blogUrl, post.meta.slug);
  const parsed = useMemo(
    () => parsePostHtml(post.html_overview ?? "", { playerSlots: "none", permalink: href, excludeDetail: true }),
    [post.html_overview, href],
  );
  const prefetch = [postDetailUrl(config, post.meta.slug, post.meta.type)];
  const track = parsed.players[0];
  const cover = post.cover_image_poster_url || track?.poster || "";
  return (
    <li className="cr-post-row">
      <article>
        {cover && !parsed.hasImage && (
          <Link className="cr-post-row__cover" href={href} prefetch={prefetch} tabIndex={-1} aria-hidden="true">
            <img src={cover} alt="" width={160} height={160} loading="lazy" decoding="async" />
          </Link>
        )}
        <div className="cr-post-row__body">
          <p className="cr-post-row__meta">
            {parsed.meta.date && <time dateTime={parsed.meta.dateTime}>{parsed.meta.date}</time>}
          </p>
          <h2 className="cr-post-row__title">
            <Link href={href} prefetch={prefetch}>
              {post.title}
            </Link>
          </h2>
          {parsed.html && <PostContent html={parsed.html} className="cr-prose cr-prose--teaser" />}
          <p className="cr-post-row__more">
            <Link href={href} prefetch={prefetch} aria-label={`Read more about ${post.title}`}>
              Read more →
            </Link>
          </p>
          {track && <PlayEpisodeButton track={track} />}
        </div>
      </article>
    </li>
  );
}

function describeFilters(filters: Filters): string {
  return FILTER_KEYS.some((key) => filters[key])
    ? "No post matches this search and these filters."
    : "Nothing has been published here yet.";
}

export function PostListPage({ config, filters, page }: { config: Config; filters: Filters; page: number }) {
  const listUrl = postListUrl(config, filters, page);
  const posts = useJson<PostsFromApi>(listUrl);
  const facets = useJson<FacetCountsFromApi>(facetCountsUrl(config, filters));
  const current = posts.dataUrl === listUrl;
  const items = posts.data?.items ?? null;
  const totalPages = posts.data ? Math.max(1, Math.ceil(posts.data.meta.total_count / effectivePageSize(config))) : 1;
  const hasFilters = FILTER_KEYS.some((key) => filters[key]);

  useEffect(() => {
    for (const post of posts.data?.items ?? []) {
      knownPageTypes.set(post.meta.slug, post.meta.type);
    }
  }, [posts.data]);

  useEffect(() => {
    document.title = config.blogTitle;
  }, [config.blogTitle]);

  useEffect(() => {
    if (current) {
      settleScroll();
    }
  }, [current, listUrl]);

  const prefetchFor = (target: Filters, targetPage: number) => [
    postListUrl(config, target, targetPage),
    facetCountsUrl(config, target),
  ];
  const changeFilters = (next: Filters, typing: boolean) => {
    // Typing a search replaces the history entry, so "back" does not step through every pause.
    go(listHref(config.blogUrl, next, 1), prefetchFor(next, 1), { keepScroll: true, replace: typing && hasFilters });
  };

  return (
    <div className="cr-list">
      <div className="cr-list__intro cr-show">
        {config.subscribe?.coverUrl && (
          <img className="cr-show__cover" src={config.subscribe.coverUrl} alt="" width={320} height={320} decoding="async" />
        )}
        <div className="cr-show__heading">
          <h1>{config.blogTitle}</h1>
          {config.blogSubtitle && <p className="cr-list__subtitle">{config.blogSubtitle}</p>}
        </div>
        {config.blogDescriptionHtml && (
          <div className="cr-prose cr-list__description" dangerouslySetInnerHTML={{ __html: config.blogDescriptionHtml }} />
        )}
        <SubscribeLinks config={config} />
        <FollowLinks config={config} />
      </div>
      <FilterPanel filters={filters} facetCounts={facets.data?.facet_counts ?? null} onChange={changeFilters} />
      <section className="cr-list__posts" aria-label="Posts" aria-busy={posts.loading}>
        {hasFilters && posts.data && (
          <p className="cr-list__summary" role="status">
            {posts.data.meta.total_count === 1 ? "1 post found." : `${posts.data.meta.total_count} posts found.`}{" "}
            <Link href={config.blogUrl} prefetch={prefetchFor({}, 1)} keepScroll>
              Clear search and filters
            </Link>
          </p>
        )}
        {posts.error && (
          <div className="cr-notice" role="alert">
            <p>The posts could not be loaded. {posts.error.message}</p>
            <button type="button" className="cr-button" onClick={posts.reload}>
              Load posts again
            </button>
          </div>
        )}
        {items === null && !posts.error && (
          <ul className="cr-post-list" aria-hidden="true">
            {[0, 1, 2].map((placeholder) => (
              <li key={placeholder} className="cr-post-row cr-post-row--placeholder">
                <span />
                <span />
                <span />
              </li>
            ))}
          </ul>
        )}
        {items !== null && items.length === 0 && !posts.loading && <p className="cr-notice">{describeFilters(filters)}</p>}
        {items !== null && items.length > 0 && (
          <ul className="cr-post-list" data-stale={!current || undefined}>
            {items.map((post) => (
              <PostRow key={post.id} post={post} config={config} />
            ))}
          </ul>
        )}
        <Pagination
          current={Math.min(page, totalPages)}
          total={totalPages}
          hrefFor={(target) => listHref(config.blogUrl, filters, target)}
          prefetchFor={(target) => prefetchFor(filters, target)}
        />
      </section>
    </div>
  );
}
