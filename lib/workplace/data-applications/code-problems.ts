import type { Rng } from "../rng";
import { problem } from "../application-developer/code-problems";

/**
 * Database and Data Applications Engineer tickets for the shared code workstation: the data-layer helpers an application needs around its database
 * (pagination and merging rows). The student's function runs in their browser; the server compares what it returned with the answers below.
 */
const CAST = {
  lead: { name: "Aditya Rao", title: "Tech Lead" },
  product: { name: "Neha Kulkarni", title: "Product Manager" },
};

const paginate = (items: unknown[], page: number, pageSize: number) => {
  const size = Math.max(1, Math.floor(pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.max(1, Math.floor(page));
  const start = (current - 1) * size;
  return { items: items.slice(start, start + size), page: current, page_size: size, total, total_pages: totalPages, has_next: current < totalPages };
};

type Row = Record<string, unknown>;
const upsertRows = (existing: Row[], incoming: Row[], key: string) => {
  const merged = existing.map((r) => ({ ...r }));
  const at = new Map<unknown, number>(merged.map((r, i) => [r[key], i]));
  for (const row of incoming) {
    const i = at.get(row[key]);
    if (i === undefined) {
      at.set(row[key], merged.length);
      merged.push({ ...row });
    } else {
      merged[i] = { ...merged[i], ...row };
    }
  }
  return merged;
};

const NAMES = ["Asha", "Bharat", "Chitra", "Deepak", "Esha", "Gopal", "Hema", "Imran"];
const rows = (rng: Rng, ids: number[]): Row[] => ids.map((id) => (rng.chance(0.5) ? { id, name: rng.pick(NAMES) } : { id, name: rng.pick(NAMES), city: rng.pick(["Pune", "Kochi", "Indore"]) }));

export const DATA_APPS_CODE_PROBLEMS = [
  problem({
    id: "dda-paginate", area: "dda-data-layer-logic", difficulty: "easy", minLevel: "fresher", fn: "paginate", params: ["items", "page", "page_size"], requester: CAST.product,
    title: "Pagination for the customer list",
    scenario: "Hi, the customer list loads all 40,000 rows at once. The screen should show one page at a time with a 'next' button that is disabled on the last page. Pages are numbered from 1.",
    deliverable: "Write paginate(items, page, page_size) returning {items, page, page_size, total, total_pages, has_next}. items is the slice for that page, total is the number of items, total_pages is at least 1 (an empty list still has 1 page) and has_next is true when a later page exists. A page below 1 is treated as page 1, and a page beyond the last returns an empty items list with that page number. page_size is at least 1.",
    tags: ["Pagination", "Edge cases", "Lists"],
    cases: (rng) => [[[], 1, 10], [[1, 2, 3, 4, 5], 2, 2], [[1, 2, 3, 4, 5], 3, 2], [[1, 2, 3], 0, 2], [[1, 2, 3], 9, 2], ...Array.from({ length: 5 }, () => [Array.from({ length: rng.int(0, 12) }, (_, i) => i + 1), rng.int(0, 5), rng.int(1, 5)])],
    solve: paginate as never,
  }),
  problem({
    id: "dda-upsert-rows", area: "dda-data-layer-logic", difficulty: "medium", minLevel: "fresher", fn: "upsert_rows", params: ["existing", "incoming", "key"], requester: CAST.lead,
    title: "Merge an imported file into the existing rows",
    scenario: "Hello, customers upload a spreadsheet of contacts and we must update the contacts we already have and add the new ones, instead of creating a second copy of each person. The sheet may leave out columns we already have, and those must not be wiped.",
    deliverable: "Write upsert_rows(existing, incoming, key). Rows are objects and key names the field that identifies a row. Return a new list: the existing rows in their original order, where a row whose key also appears in incoming is updated with the fields of the incoming row (fields missing from incoming are kept), followed by the incoming rows with new keys in the order they first appear. If incoming contains the same new key twice, the later row updates the earlier one. Do not modify the input lists.",
    tags: ["Upsert", "Merging data", "Immutability"],
    cases: (rng) => [[[], [], "id"], [[{ id: 1, name: "Asha", city: "Pune" }], [{ id: 1, name: "Esha" }], "id"], [[{ id: 1, name: "Asha" }], [{ id: 2, name: "Bharat" }, { id: 2, name: "Chitra", city: "Kochi" }], "id"], ...Array.from({ length: 7 }, () => [rows(rng, [1, 2, 3].slice(0, rng.int(0, 3))), rows(rng, [2, 3, 4, 5].slice(0, rng.int(1, 4))), "id"])],
    solve: upsertRows as never,
  }),
];
