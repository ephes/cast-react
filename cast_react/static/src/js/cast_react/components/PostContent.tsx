// Shows the HTML of a post. Gallery links open in the lightbox, and audio
// player slots left by `parsePostHtml` are filled with React players.

import { useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { PLAYER_SLOT_ATTRIBUTE } from "../postHtml";
import { isPlainClick } from "../router";
import type { PlayerPayload } from "../types";
import { Lightbox, imageFromLink, type LightboxImage } from "./Lightbox";

export function PostContent({
  html,
  players = [],
  renderPlayer,
  className = "cr-prose",
}: {
  html: string;
  players?: PlayerPayload[];
  renderPlayer?: (track: PlayerPayload) => ReactNode;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<{ element: Element; track: PlayerPayload }[]>([]);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);
  const opener = useRef<HTMLAnchorElement | null>(null);

  useLayoutEffect(() => {
    const found: { element: Element; track: PlayerPayload }[] = [];
    container.current?.querySelectorAll(`[${PLAYER_SLOT_ATTRIBUTE}]`).forEach((element) => {
      const audioId = Number(element.getAttribute(PLAYER_SLOT_ATTRIBUTE));
      const track = players.find((player) => player.audioId === audioId);
      if (track) {
        found.push({ element, track });
      }
    });
    setSlots(found);
    // `players` is derived from `html`, so `html` alone decides when to look again.
  }, [html]);

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isPlainClick(event)) {
      return;
    }
    const link = (event.target as Element).closest<HTMLAnchorElement>("a.cast-gallery-link");
    if (!link || !container.current?.contains(link)) {
      return;
    }
    const gallery = link.closest(".cast-gallery") ?? container.current;
    const links = Array.from(gallery.querySelectorAll<HTMLAnchorElement>("a.cast-gallery-link"));
    event.preventDefault();
    opener.current = link;
    setLightbox({ images: links.map(imageFromLink), index: Math.max(0, links.indexOf(link)) });
  };

  return (
    <>
      {/* The markup comes from the site's own django-cast API, rendered by the theme templates. */}
      <div ref={container} className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      {renderPlayer && slots.map(({ element, track }) => createPortal(renderPlayer(track), element, track.audioId))}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onChange={(index) => setLightbox({ images: lightbox.images, index })}
          onClose={() => {
            setLightbox(null);
            // Back to the picture the reader came from.
            opener.current?.focus();
          }}
        />
      )}
    </>
  );
}
