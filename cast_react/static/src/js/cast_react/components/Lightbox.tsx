// Full-window view of gallery pictures, built on <dialog> so that focus
// handling and the Escape key come from the browser.

import { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";

export interface LightboxImage {
  src: string;
  srcset: string;
  avifSrcset: string;
  sizes: string;
  width: number | undefined;
  height: number | undefined;
  alt: string;
  caption: string;
}

export function imageFromLink(link: HTMLAnchorElement): LightboxImage {
  const data = link.dataset;
  const width = Number.parseInt(data.modalWidth ?? "", 10);
  const height = Number.parseInt(data.modalHeight ?? "", 10);
  return {
    src: link.getAttribute("href") ?? "",
    srcset: data.modalSrcset ?? "",
    avifSrcset: data.modalSrcsetAvif ?? "",
    sizes: data.modalSizes ?? "",
    width: Number.isNaN(width) ? undefined : width,
    height: Number.isNaN(height) ? undefined : height,
    alt: link.querySelector("img")?.getAttribute("alt") ?? "",
    caption: data.caption ?? "",
  };
}

export function Lightbox({
  images,
  index,
  onChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = images[index];

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open && typeof element.showModal === "function") {
      element.showModal();
    }
  }, []);

  if (!image) {
    return null;
  }
  const many = images.length > 1;
  const previous = () => onChange((index - 1 + images.length) % images.length);
  const next = () => onChange((index + 1) % images.length);

  return (
    <dialog
      ref={dialog}
      className="cr-lightbox"
      aria-label={many ? `Picture ${index + 1} of ${images.length}` : "Picture"}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed area around the picture closes the view.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (many && event.key === "ArrowLeft") {
          previous();
        } else if (many && event.key === "ArrowRight") {
          next();
        }
      }}
    >
      <figure className="cr-lightbox__figure">
        <picture>
          {image.avifSrcset && <source srcSet={image.avifSrcset} sizes={image.sizes || undefined} type="image/avif" />}
          <img
            key={image.src}
            className="cr-lightbox__image"
            src={image.src}
            srcSet={image.srcset || undefined}
            sizes={image.sizes || undefined}
            width={image.width}
            height={image.height}
            alt={image.alt}
          />
        </picture>
        <figcaption className="cr-lightbox__caption">
          {many && (
            <span className="cr-lightbox__count">
              {index + 1} of {images.length}
            </span>
          )}
          {image.caption && <span>{image.caption}</span>}
        </figcaption>
      </figure>
      <div className="cr-lightbox__controls">
        {many && (
          <button type="button" className="cr-lightbox__button" onClick={previous} aria-label="Previous picture">
            <ChevronLeftIcon size={24} />
          </button>
        )}
        {many && (
          <button type="button" className="cr-lightbox__button" onClick={next} aria-label="Next picture">
            <ChevronRightIcon size={24} />
          </button>
        )}
        <button
          type="button"
          className="cr-lightbox__button"
          onClick={onClose}
          aria-label="Close the picture view"
          autoFocus
        >
          <CloseIcon size={24} />
        </button>
      </div>
    </dialog>
  );
}
