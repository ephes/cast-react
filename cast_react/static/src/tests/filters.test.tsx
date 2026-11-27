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

function names(group: HTMLElement, list = ".cr-facets__top"): (string | null)[] {
  return Array.from(group.querySelectorAll(`${list} button > span:first-child`), (label) => label.textContent);
}

function indexNames(group: HTMLElement): (string | null)[] {
  return names(group, ".cr-facet-index__items");
}

async function typeIn(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
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

it("ranks the top 10 by count then name and opens a separate alphabetical tag index", async () => {
  const view = await render(
    <FilterPanel
      filters={{}}
      facetCounts={{ tag_facets: tags, category_facets: [facet("Web", 3), facet("Backend", 3), facet("Audio", 9)] }}
      onChange={vi.fn()}
    />,
  );
  const categories = group(view, "Categories");
  expect(names(categories)).toEqual(["Audio", "Backend", "Web"]);
  expect(categories.querySelector(".cr-facets__toggle")).toBeNull();
  const tagGroup = group(view, "Tags");
  const ranked = ["Topic 13", "Topic 12", "Topic 11", "Apple", "Topic 10", "Zebra",
    "Topic 9", "Topic 8", "Topic 7", "Topic 6"];
  expect(names(tagGroup)).toEqual(ranked);
  const toggle = tagGroup.querySelector<HTMLButtonElement>(".cr-facets__toggle")!;
  await act(async () => toggle.focus());
  expect(toggle.textContent).toBe("All 15 tags");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  const index = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(index.hidden).toBe(true);
  await click(toggle);
  expect(names(tagGroup)).toEqual(ranked);
  expect(indexNames(tagGroup)).toEqual([
    "Apple", "Topic 1", "Topic 10", "Topic 11", "Topic 12", "Topic 13", "Topic 2", "Topic 3",
    "Topic 4", "Topic 5", "Topic 6", "Topic 7", "Topic 8", "Topic 9", "Zebra",
  ]);
  expect(toggle.textContent).toBe("Hide list");
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(index.hidden).toBe(false);
  await act(async () => index.querySelector("input")!.focus());
  await click(toggle);
  expect(names(tagGroup)).toEqual(ranked);
  expect(index.hidden).toBe(true);
  expect(document.activeElement).toBe(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

it("sorts categories with the page language and keeps the selected button marked", async () => {
  document.documentElement.lang = "sv";
  const onChange = vi.fn();
  const view = await render(
    <FilterPanel
      filters={{ category_facets: "översättning" }}
      facetCounts={{ category_facets: [...tags, facet("Översättning", 1)] }}
      onChange={onChange}
    />,
  );
  const categories = group(view, "Categories");
  const toggle = categories.querySelector(".cr-facets__toggle")!;
  expect(toggle.textContent).toBe("All 16 categories");
  await click(toggle);
  expect(categories.querySelector(".cr-facet-index label span")?.textContent).toBe("Filter categories");
  expect(indexNames(categories).slice(-2)).toEqual(["Zebra", "Översättning"]);
  const selected = categories.querySelector('.cr-facet-index__item[aria-pressed="true"]')!;
  expect(selected.textContent).toBe("Översättning1");
  await click(selected);
  expect(onChange).toHaveBeenCalledWith({}, false);
});

it("filters the tag index by case, accents and Greek sigma variants and clears it on Escape", async () => {
  const view = await render(
    <FilterPanel
      filters={{}}
      facetCounts={{ tag_facets: [...tags, facet("Überwachung", 2), facet("Κόσμος", 2)] }}
      onChange={vi.fn()}
    />,
  );
  const tagGroup = group(view, "Tags");
  await click(tagGroup.querySelector(".cr-facets__toggle"));
  const field = tagGroup.querySelector<HTMLInputElement>('input[type="search"]')!;
  expect(field.labels?.[0].textContent).toBe("Filter tags");
  await act(async () => field.focus());
  await typeIn(field, "uBERw");
  expect(indexNames(tagGroup)).toEqual(["Überwachung"]);
  expect(names(tagGroup)).toHaveLength(10);
  await typeIn(field, "ΚΟΣ");
  expect(indexNames(tagGroup)).toEqual(["Κόσμος"]);
  await typeIn(field, "missing");
  expect(indexNames(tagGroup)).toEqual([]);
  expect(tagGroup.querySelector('[role="status"]')?.textContent).toBe("No tag matches");
  await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(field.value).toBe("");
  expect(document.activeElement).toBe(field);
  expect(indexNames(tagGroup)).toHaveLength(17);
  expect(tagGroup.querySelector('[role="status"]')).toBeNull();
});

it.each([[10, false], [0, false], [10, true], [0, true]])(
  "moves focus back to post search when counts shrink to %i tags (focus in index: %s)",
  async (remaining, focusInIndex) => {
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
    expect(toggle.textContent).toBe("Hide list");
    if (focusInIndex) await act(async () => tagGroup.querySelector("input")!.focus());

    await act(async () => updateTags(tags.slice(0, remaining)));
    expect(view.querySelector(".cr-facets__toggle")).toBeNull();
    expect(view.querySelectorAll(".cr-facet")).toHaveLength(remaining);
    expect(document.activeElement).toBe(view.querySelector(".cr-filters__search input"));
  },
);

it("moves focus to the tag pill when selecting a rare index choice closes the index", async () => {
  function Panel() {
    const [filters, setFilters] = useState<Filters>({});
    const currentTags = filters.tag_facets ? tags.filter((tag) => tag.slug === filters.tag_facets) : tags;
    return <FilterPanel filters={filters} facetCounts={{ tag_facets: currentTags }} onChange={setFilters} />;
  }

  const view = await render(<Panel />);
  const tagGroup = group(view, "Tags");
  expect(names(tagGroup)).not.toContain("Topic 1");
  await click(tagGroup.querySelector(".cr-facets__toggle"));
  await typeIn(tagGroup.querySelector("input")!, "Topic 1");
  const choice = tagGroup.querySelector<HTMLButtonElement>(".cr-facet-index__item")!;
  expect(choice.firstElementChild?.textContent).toBe("Topic 1");
  await act(async () => choice.focus());
  await click(choice);

  expect(tagGroup.querySelector(".cr-facet-index")).toBeNull();
  const pill = tagGroup.querySelector('.cr-facet[aria-pressed="true"]');
  expect(pill?.firstElementChild?.textContent).toBe("Topic 1");
  expect(document.activeElement).toBe(pill);
});

it("forgets a dropped focused tag when the index unmounts", async () => {
  let updateTags: (next: Facet[]) => void;
  function Panel() {
    const [currentTags, setTags] = useState(tags);
    updateTags = setTags;
    return <FilterPanel filters={{}} facetCounts={{ tag_facets: currentTags }} onChange={vi.fn()} />;
  }

  const view = await render(<Panel />);
  const tagGroup = group(view, "Tags");
  await click(tagGroup.querySelector(".cr-facets__toggle"));
  const choice = Array.from(tagGroup.querySelectorAll<HTMLButtonElement>(".cr-facet-index__item"))
    .find((button) => button.firstElementChild?.textContent === "Topic 1")!;
  await act(async () => choice.focus());

  const withoutChoice = tags.filter((tag) => tag.slug !== "topic 1");
  await act(async () => updateTags(withoutChoice.slice(0, 10)));
  expect(tagGroup.querySelector(".cr-facet-index")).toBeNull();
  expect(document.activeElement).toBe(view.querySelector(".cr-filters__search input"));

  await act(async () => updateTags(withoutChoice));
  expect(indexNames(tagGroup)).toHaveLength(withoutChoice.length);
  expect(indexNames(tagGroup)).not.toContain("Topic 1");
});

it("keeps an out-of-range tag and a category missing from counts visible and removable", async () => {
  const onChange = vi.fn();
  const filters = { tag_facets: "topic 1", category_facets: "outside" };
  const view = await render(<FilterPanel filters={filters} facetCounts={{ tag_facets: tags }} onChange={onChange} />);
  const tagGroup = group(view, "Tags");
  const selectedTag = tagGroup.querySelector('.cr-facet[aria-pressed="true"]');
  expect(names(tagGroup)).toHaveLength(11);
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
  expect(names(tagGroup)).toHaveLength(10);
  expect(names(tagGroup)).not.toContain("Topic 1");
});

it("keeps focus on an index choice that drops out of the counts", async () => {
  function Panel() {
    const [filters, setFilters] = useState<Filters>({ tag_facets: "topic 1" });
    const currentTags = filters.tag_facets ? tags : tags.filter((tag) => tag.slug !== "topic 1");
    return <FilterPanel filters={filters} facetCounts={{ tag_facets: currentTags }} onChange={setFilters} />;
  }

  const view = await render(<Panel />);
  const tagGroup = group(view, "Tags");
  await click(tagGroup.querySelector(".cr-facets__toggle"));
  const choice = tagGroup.querySelector<HTMLButtonElement>('.cr-facet-index__item[aria-pressed="true"]')!;
  await act(async () => choice.focus());
  await click(choice);
  expect(document.activeElement).toBe(choice);
  expect(choice.getAttribute("aria-pressed")).toBe("false");
  await act(async () => choice.blur());
  expect(indexNames(tagGroup)).not.toContain("Topic 1");
});

it.each([{}, { date_after: "2025-01-01" }, { date_before: "2026-01-01" }])(
  "opens the custom date range only when a date is set initially (%j)",
  async (filters) => {
    const view = await render(<FilterPanel filters={filters} facetCounts={null} onChange={vi.fn()} />);
    const details = view.querySelector("details")!;
    expect(details.querySelector("summary")?.textContent).toBe("Custom date range");
    expect(details.open).toBe(Boolean(filters.date_after || filters.date_before));
    expect(details.querySelector("input[type='date']")).not.toBeNull();
    expect(monthSelect(view).closest("label")?.nextElementSibling).toBe(details);
    expect(details.nextElementSibling?.textContent).toContain("Order");
  },
);

it("opens the range when dates arrive from navigation and keeps it open when a date is cleared", async () => {
  function Panel() {
    const [filters, setFilters] = useState<Filters>({});
    return (
      <>
        <button onClick={() => setFilters({ date_after: "2025-01-01" })}>Restore range</button>
        <FilterPanel filters={filters} facetCounts={null} onChange={setFilters} />
      </>
    );
  }
  const view = await render(<Panel />);
  const details = view.querySelector("details")!;
  await click(view.querySelector("button"));
  expect(details.open).toBe(true);
  const from = details.querySelector<HTMLInputElement>("input")!;
  expect(from.value).toBe("2025-01-01");
  await act(async () => from.focus());
  await typeIn(from, "");
  expect(from.value).toBe("");
  expect(details.open).toBe(true);
  expect(document.activeElement).toBe(from);
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
