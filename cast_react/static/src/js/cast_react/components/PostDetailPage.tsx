// One post or episode: title, player with chapters and transcript, the post
// body and its comments.

import { useEffect, useMemo, useRef } from "react";
import { fetchJson, postDetailUrl, useJson } from "../api";
import type { Config } from "../config";
import { Link } from "../navigation";
import { PlayerPanels } from "../player/Panels";
import { Player } from "../player/Player";
import { getPlayerState, loadTrack } from "../player/store";
import { parsePostHtml } from "../postHtml";
import { detailHref, settleScroll } from "../router";
import { parseStartTime } from "../time";
import type { CommentSecurityData, Post, PostsFromApi } from "../types";
import { Comments } from "./Comments";
import { ChevronLeftIcon } from "./icons";
import { PostContent } from "./PostContent";
import { knownPageTypes } from "./PostListPage";

export function PostDetailPage({
  config,
  slug,
  listHref,
  listPrefetch,
}: {
  config: Config;
  slug: string;
  listHref: string;
  listPrefetch: string[];
}) {
  const pageType = knownPageTypes.get(slug) ?? (slug === config.postSlug ? config.pageType : "");
  const url = postDetailUrl(config, slug, pageType);
  // In a Wagtail preview the draft comes with the page; the API only knows what is published.
  const preview = config.preview !== null && slug === config.postSlug ? config.preview : null;
  const resource = useJson<PostsFromApi>(preview ? null : url);
  const loaded = preview !== null || resource.dataUrl === url;
  const previewPost = useMemo<Post | null>(
    () =>
      preview
        ? {
            id: 0,
            title: preview.title,
            html_detail: preview.html,
            meta: { type: pageType, detail_url: "", html_url: "", slug, first_published_at: "" },
          }
        : null,
    [preview, pageType, slug],
  );
  const post = previewPost ?? (loaded ? (resource.data?.items[0] ?? null) : null);
  const parsed = useMemo(
    () =>
      post
        ? parsePostHtml(post.html_detail ?? "", {
            playerSlots: "afterFirst",
            permalink: detailHref(config.blogUrl, slug),
          })
        : null,
    [post, config.blogUrl, slug],
  );
  const track = parsed?.players[0] ?? null;
  const players = parsed?.players;
  const startHandled = useRef(false);

  useEffect(() => {
    document.title = post ? `${post.title} – ${config.blogTitle}` : config.blogTitle;
  }, [post, config.blogTitle]);

  useEffect(() => {
    if (loaded) {
      settleScroll();
    }
  }, [loaded]);

  // A shared link like `?t=754` opens the episode at that moment. Nothing that
  // is already playing gets interrupted for it.
  useEffect(() => {
    if (!players || players.length === 0 || startHandled.current) {
      return;
    }
    startHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const startAt = parseStartTime(params.get("t"));
    // Links copied from a second audio of the same post name it with `audio`.
    const wanted = players.find((player) => String(player.audioId) === params.get("audio")) ?? players[0];
    if (startAt !== null && getPlayerState().track === null) {
      loadTrack(wanted, { startAt });
    }
  }, [players]);

  // The signature that lets a comment through is only valid for a while. Get a
  // new one when the page has been open for long, without touching the form.
  const refreshSecurity = async (): Promise<CommentSecurityData | undefined> => {
    const fresh = await fetchJson<PostsFromApi>(url, { fresh: true });
    return fresh.items[0]?.comments_security_data;
  };

  const back = (
    <Link className="cr-back" href={listHref} prefetch={listPrefetch}>
      <ChevronLeftIcon size={18} /> All posts
    </Link>
  );

  if (resource.error) {
    return (
      <div className="cr-detail">
        {back}
        <div className="cr-notice" role="alert">
          <p>This post could not be loaded. {resource.error.message}</p>
          <button type="button" className="cr-button" onClick={resource.reload}>
            Load the post again
          </button>
        </div>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="cr-detail" aria-busy="true">
        {back}
        <p className="cr-notice" role="status">
          <span className="cr-spinner" aria-hidden="true" /> Loading…
        </p>
      </div>
    );
  }
  if (!post || !parsed) {
    return (
      <div className="cr-detail">
        {back}
        <div className="cr-notice">
          <h1>Post not found</h1>
          <p>There is no post at this address. It may have been moved or unpublished.</p>
        </div>
      </div>
    );
  }

  return (
    <article className="cr-detail" data-has-panels={Boolean(track && (track.chapters.length || track.transcript)) || undefined}>
      <header className="cr-detail__head">
        {back}
        <h1>{post.title}</h1>
        <p className="cr-detail__meta">
          {parsed.meta.date && <time dateTime={parsed.meta.dateTime}>{parsed.meta.date}</time>}
          {parsed.meta.author && <span>by {parsed.meta.author}</span>}
        </p>
        {track && <Player track={track} heading={false} />}
      </header>
      {track && (
        <aside className="cr-detail__panels" aria-label="Chapters and transcript">
          <PlayerPanels track={track} transcriptPageUrl={parsed.meta.transcriptUrl} />
        </aside>
      )}
      <div className="cr-detail__body">
        <PostContent
          html={parsed.html}
          players={parsed.players}
          renderPlayer={(extra) => (
            <>
              <Player track={extra} secondary />
              <PlayerPanels track={extra} />
            </>
          )}
        />
        <Comments
          config={config}
          comments={post.comments ?? []}
          enabled={post.comments_are_enabled ?? false}
          security={post.comments_security_data}
          onPosted={resource.reload}
          refreshSecurity={refreshSecurity}
        />
      </div>
    </article>
  );
}
