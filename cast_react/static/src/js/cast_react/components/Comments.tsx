// Threaded comments of a post, with a form to write one or to reply.

import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Config } from "../config";
import type { Comment, CommentSecurityData } from "../types";

interface CommentResponse {
  success?: boolean;
  errors?: Record<string, string> | string;
  is_moderated?: boolean;
}

// Django accepts a comment signature for two hours; renew it well before that.
const SECURITY_MAX_AGE_SECONDS = 60 * 60;

type Outcome = { kind: "idle" } | { kind: "sending" } | { kind: "held" } | { kind: "failed"; message: string };

function errorText(errors: CommentResponse["errors"]): string {
  if (!errors) {
    return "";
  }
  if (typeof errors === "string") {
    return errors;
  }
  // The server sends field errors as small HTML snippets; show their text only.
  return Object.values(errors)
    .map((value) => new DOMParser().parseFromString(String(value), "text/html").body.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

function formatCommentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function CommentForm({
  config,
  security,
  parent,
  onPosted,
  onCancel,
  refreshSecurity,
}: {
  config: Config;
  security: CommentSecurityData;
  parent: number | null;
  onPosted: () => void;
  onCancel?: () => void;
  refreshSecurity?: () => Promise<CommentSecurityData | undefined>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const id = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (outcome.kind === "sending") {
      return;
    }
    setOutcome({ kind: "sending" });
    let signature = security;
    const age = Date.now() / 1000 - Number(security.timestamp);
    if (refreshSecurity && (!Number.isFinite(age) || age > SECURITY_MAX_AGE_SECONDS)) {
      try {
        signature = (await refreshSecurity()) ?? security;
      } catch {
        // Send with the signature at hand; the server decides.
      }
    }
    const body = new URLSearchParams({
      content_type: signature.content_type,
      object_pk: String(signature.object_pk),
      timestamp: String(signature.timestamp),
      security_hash: signature.security_hash,
      name,
      email,
      title: "",
      comment: text,
      parent: parent === null ? "" : String(parent),
    });
    try {
      const response = await fetch(config.postCommentUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": config.csrfToken,
          "X-Requested-With": "XMLHttpRequest",
        },
        body,
      });
      const result = (await response.json().catch(() => ({}))) as CommentResponse;
      if (response.ok && result.success) {
        setText("");
        if (result.is_moderated) {
          setOutcome({ kind: "held" });
        } else {
          setOutcome({ kind: "idle" });
        }
        onPosted();
        return;
      }
      const detail = errorText(result.errors);
      setOutcome({
        kind: "failed",
        message: detail
          ? `The comment was not saved: ${detail}`
          : "The comment was not saved. Send it again; if that fails, copy your text and reload the page.",
      });
    } catch {
      setOutcome({ kind: "failed", message: "The comment could not be sent. Check your connection and send it again." });
    }
  };

  return (
    <form className="cr-comment-form" onSubmit={(event) => void submit(event)}>
      <div className="cr-comment-form__row">
        <label className="cr-field" htmlFor={`${id}-name`}>
          <span>Name</span>
          <input
            id={`${id}-name`}
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="cr-field" htmlFor={`${id}-email`}>
          <span>Email (not shown)</span>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      </div>
      <label className="cr-field" htmlFor={`${id}-text`}>
        <span>{parent === null ? "Comment" : "Reply"}</span>
        <textarea id={`${id}-text`} rows={4} required value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="cr-comment-form__actions">
        <button type="submit" className="cr-button cr-button--primary" disabled={outcome.kind === "sending"}>
          {outcome.kind === "sending" ? "Sending…" : parent === null ? "Post comment" : "Post reply"}
        </button>
        {onCancel && (
          <button type="button" className="cr-button cr-button--quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <p className="cr-comment-form__message" role="status">
        {outcome.kind === "held" && "Thank you. Your comment appears once it has been approved."}
        {outcome.kind === "failed" && outcome.message}
      </p>
    </form>
  );
}

function CommentItem({
  comment,
  comments,
  replyTo,
  onReply,
  form,
}: {
  comment: Comment;
  comments: Comment[];
  replyTo: number | null;
  onReply: ((id: number | null) => void) | null;
  form: (parent: number) => ReactNode;
}) {
  const children = comments.filter((candidate) => candidate.parent === comment.id);
  return (
    <li className="cr-comment">
      <p className="cr-comment__meta">
        <span className="cr-comment__author">{comment.user || "Anonymous"}</span>
        <time dateTime={comment.date}>{formatCommentDate(comment.date)}</time>
      </p>
      <p className="cr-comment__text">{comment.comment}</p>
      {onReply && replyTo !== comment.id && (
        <button type="button" className="cr-button cr-button--quiet" onClick={() => onReply(comment.id)}>
          Reply
        </button>
      )}
      {replyTo === comment.id && form(comment.id)}
      {children.length > 0 && (
        <ol className="cr-comment__replies">
          {children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              comments={comments}
              replyTo={replyTo}
              onReply={onReply}
              form={form}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

export function Comments({
  config,
  comments,
  enabled,
  security,
  onPosted,
  refreshSecurity,
}: {
  config: Config;
  comments: Comment[];
  enabled: boolean;
  security: CommentSecurityData | undefined;
  onPosted: () => void;
  refreshSecurity?: () => Promise<CommentSecurityData | undefined>;
}) {
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const canWrite = enabled && security !== undefined && Boolean(security.security_hash);
  if (!canWrite && comments.length === 0) {
    return null;
  }
  const known = new Set(comments.map((comment) => comment.id));
  // A reply whose parent is hidden is shown at the top level instead of disappearing.
  const roots = comments.filter((comment) => comment.parent === null || !known.has(comment.parent));

  return (
    <section className="cr-comments" aria-labelledby="cr-comments-heading">
      <h2 id="cr-comments-heading">{comments.length === 1 ? "1 comment" : `${comments.length} comments`}</h2>
      {comments.length > 0 && (
        <ol className="cr-comments__list">
          {roots.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              comments={comments}
              replyTo={replyTo}
              onReply={canWrite ? setReplyTo : null}
              form={(parent) =>
                security && (
                  <CommentForm
                    config={config}
                    security={security}
                    parent={parent}
                    refreshSecurity={refreshSecurity}
                    onPosted={() => {
                      setReplyTo(null);
                      onPosted();
                    }}
                    onCancel={() => setReplyTo(null)}
                  />
                )
              }
            />
          ))}
        </ol>
      )}
      {canWrite && security && (
        <>
          <h3>Write a comment</h3>
          <CommentForm
            config={config}
            security={security}
            parent={null}
            onPosted={onPosted}
            refreshSecurity={refreshSecurity}
          />
        </>
      )}
    </section>
  );
}
