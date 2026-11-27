import { act, useState } from "react";
import { FilterPanel } from "@/components/FilterPanel";
import type { Facet, Filters } from "@/types";
import { cleanup, click, render } from "./helpers";

const facet = (name: string, count: number, slug = name.toLowerCase()): Facet => ({ name, count, slug });

const tags = [
  facet("Zebra", 10),
  ...Array.from({ length: 13 }, (_, index) => facet(`Topic ${index + 1}`, index + 1)),
  facet("Apple", 10),
];

function group(view: HTMLElement, name: string): HTMLElement {
  return Array.from(view.querySelectorAll<HTMLElement>(".cr-facets")).find((group) =>
    group.querySelector("h3")?.textContent === name,
  )!;
}

function names(group: HTMLElement): (string | null)[] {
  return Array.from(group.querySelectorAll(".cr-facet > span:first-child"), (label) => label.textContent);
}

function monthSelect(view: HTMLElement): HTMLSelectElement {
  return Array.from(view.querySelectorAll("label")).find((label) => label.firstElementChild?.textContent === "Month")!
    .querySelector("select")!;
}

afterEach(async () => {
  document.documentElement.lang = "";
  vi.restoreAllMocks();
  await cleanup();
});

it("ranks categories and tags by count then name and expands or collapses each group", async () => {
  const view = await render(
    <FilterPanel
      filters={{}}
      facetCounts={{ tag_facets: tags, category_facets: [facet("Web", 3), facet("Backend", 3), facet("Audio", 9)] }}
      onChange={vi.fn()}
    />,
  );
  expect(names(group(view, "Categories"))).toEqual(["Audio", "Backend", "Web"]);
  const tagGroup = group(view, "Tags");
  const ranked = ["Topic 13", "Topic 12", "Topic 11", "Apple", "Topic 10", "Zebra",
    "Topic 9", "Topic 8", "Topic 7", "Topic 6", "Topic 5", "Topic 4", "Topic 3", "Topic 2", "Topic 1"];
  expect(names(tagGroup)).toEqual(ranked.slice(0, 12));
  const toggle = tagGroup.querySelector<HTMLButtonElement>(".cr-facets__toggle")!;
  await act(async () => toggle.focus());
  expect(toggle?.textContent).toBe("Show all 15 tags");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  await click(toggle);
  expect(names(tagGroup)).toEqual(ranked);
  expect(toggle?.textContent).toBe("Show fewer");
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  await click(toggle);
  expect(names(tagGroup)).toEqual(ranked.slice(0, 12));
  expect(document.activeElement).toBe(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

it.each([12, 0])("hides a focused expansion toggle when filtering leaves %i tags", async (remaining) => {
  let updateTags: (next: Facet[]) => void;
  function Panel() {
    const [currentTags, setTags] = useState(tags);
    updateTags = setTags;
    return <FilterPanel filters={{}} facetCounts={{ tag_facets: currentTags }} onChange={vi.fn()} />;
  }

  const view = await render(<Panel />);
  const tagGroup = group(view, "Tags");
  const toggle = tagGroup.querySelector<HTMLButtonElement>(".cr-facets__toggle")!;
  await act(async () => toggle.focus());
  await click(toggle);
  expect(toggle.textContent).toBe("Show fewer");

  await act(async () => updateTags(tags.slice(0, remaining)));
  expect(view.querySelector(".cr-facets__toggle")).toBeNull();
  expect(view.querySelectorAll(".cr-facet")).toHaveLength(remaining);
  expect(document.activeElement).toBe(view.querySelector('input[type="search"]'));
});

it("keeps an out-of-range tag and a category missing from counts visible and removable", async () => {
  const onChange = vi.fn();
  const filters = { tag_facets: "topic 1", category_facets: "outside" };
  const view = await render(<FilterPanel filters={filters} facetCounts={{ tag_facets: tags }} onChange={onChange} />);
  const tagGroup = group(view, "Tags");
  const selectedTag = tagGroup.querySelector('.cr-facet[aria-pressed="true"]');
  expect(names(tagGroup)).toHaveLength(13);
  expect(selectedTag?.firstElementChild?.textContent).toBe("Topic 1");
  const selectedCategory = group(view, "Categories").querySelector('.cr-facet[aria-pressed="true"]');
  expect(selectedCategory?.firstElementChild?.textContent).toBe("outside");
  expect(selectedCategory?.lastElementChild?.textContent).toBe("0");
  await click(selectedCategory);
  expect(onChange).toHaveBeenCalledWith({ tag_facets: "topic 1" }, false);
});

it.each([true, false])("keeps focus after clearing an out-of-range tag (still in counts: %s)", async (stillInCounts) => {
  function Panel() {
    const [filters, setFilters] = useState<Filters>({ tag_facets: "topic 1" });
    const currentTags = filters.tag_facets || stillInCounts ? tags : tags.filter((tag) => tag.slug !== "topic 1");
    return <FilterPanel filters={filters} facetCounts={{ tag_facets: currentTags }} onChange={setFilters} />;
  }

  const view = await render(<Panel />);
  const tagGroup = group(view, "Tags");
  const button = tagGroup.querySelector<HTMLButtonElement>('.cr-facet[aria-pressed="true"]')!;
  await act(async () => button.focus());
  await click(button);
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(names(tagGroup)).toContain("Topic 1");

  await act(async () => button.blur());
  expect(names(tagGroup)).toHaveLength(12);
  expect(names(tagGroup)).not.toContain("Topic 1");
});

it("groups months newest first, localizes labels and sets and clears date_facets", async () => {
  document.documentElement.lang = "de-DE";
  const onChange = vi.fn<(filters: Filters, typing: boolean) => void>();
  const view = await render(
    <FilterPanel filters={{ tag_facets: "rss", date_facets: "2024-01" }} onChange={onChange} facetCounts={{
      date_facets: [facet("2025-12", 6), facet("2026-10", 2), facet("2025-02", 8), facet("2026-11", 1)],
    }} />,
  );
  const select = monthSelect(view);
  expect(select.options[0].text).toBe("Any month");
  expect(select.value).toBe("2024-01");
  expect(Array.from(select.querySelectorAll("optgroup"), (group) => [
    group.label,
    Array.from(group.querySelectorAll("option"), (option) => option.text),
  ])).toEqual([
    ["2026", ["November 2026 (1)", "Oktober 2026 (2)"]],
    ["2025", ["Dezember 2025 (6)", "Februar 2025 (8)"]],
    ["2024", ["Januar 2024 (0)"]],
  ]);
  await act(async () => {
    select.value = "2026-10";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onChange).toHaveBeenLastCalledWith({ tag_facets: "rss", date_facets: "2026-10" }, false);
  await act(async () => {
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onChange).toHaveBeenLastCalledWith({ tag_facets: "rss" }, false);
});

it.each([
  ["de@formal", "de"],
  ["de_DE@formal", "de-DE"],
  ["sr-latn", "sr-Latn"],
  ["zh-hans", "zh-Hans"],
  ["not a locale", undefined],
  ["en-US-u-ca-islamic", "en-US"],
])("formats Gregorian months for document language %s", async (language, expectedLocale) => {
  document.documentElement.lang = language;
  const slug = "2026-01";
  const view = await render(
    <FilterPanel filters={{}} facetCounts={{ date_facets: [facet(slug, 1)] }} onChange={vi.fn()} />,
  );
  const expectedLabel = new Intl.DateTimeFormat(expectedLocale, {
    month: "long", year: "numeric", calendar: "gregory", timeZone: "UTC",
  }).format(new Date("2026-01-01T00:00:00Z"));
  const select = monthSelect(view);
  expect(select.querySelector("optgroup")?.label).toBe("2026");
  expect(select.options[1].value).toBe(slug);
  expect(select.options[1].text).toBe(`${expectedLabel} (1)`);
});

it("uses the browser language when the document has no language", async () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
  const view = await render(
    <FilterPanel filters={{}} facetCounts={{ date_facets: [facet("2026-10", 1)] }} onChange={vi.fn()} />,
  );
  expect(monthSelect(view).options[1].text).toBe("Oktober 2026 (1)");
});
