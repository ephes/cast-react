import { Link } from "../navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

// Page numbers to show: always the first and last page and the ones around
// the current page; 0 stands for a gap.
export function pageNumbers(current: number, total: number): number[] {
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: number[] = [];
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) {
      result.push(0);
    }
    result.push(page);
  });
  return result;
}

export function Pagination({
  current,
  total,
  hrefFor,
  prefetchFor,
}: {
  current: number;
  total: number;
  hrefFor: (page: number) => string;
  prefetchFor: (page: number) => string[];
}) {
  if (total <= 1) {
    return null;
  }
  return (
    <nav className="cr-pagination" aria-label="Pages">
      {current > 1 ? (
        <Link className="cr-pagination__step" href={hrefFor(current - 1)} prefetch={prefetchFor(current - 1)} rel="prev">
          <ChevronLeftIcon size={18} /> <span>Previous</span>
        </Link>
      ) : (
        <span className="cr-pagination__step" aria-disabled="true">
          <ChevronLeftIcon size={18} /> <span>Previous</span>
        </span>
      )}
      <ol className="cr-pagination__pages">
        {pageNumbers(current, total).map((page, index) =>
          page === 0 ? (
            <li key={`gap-${index}`} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={page}>
              {page === current ? (
                <span aria-current="page" aria-label={`Page ${page}, this page`}>
                  {page}
                </span>
              ) : (
                <Link href={hrefFor(page)} prefetch={prefetchFor(page)} aria-label={`Page ${page}`}>
                  {page}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
      {current < total ? (
        <Link className="cr-pagination__step" href={hrefFor(current + 1)} prefetch={prefetchFor(current + 1)} rel="next">
          <span>Next</span> <ChevronRightIcon size={18} />
        </Link>
      ) : (
        <span className="cr-pagination__step" aria-disabled="true">
          <span>Next</span> <ChevronRightIcon size={18} />
        </span>
      )}
    </nav>
  );
}
