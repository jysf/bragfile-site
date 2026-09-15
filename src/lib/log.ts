import raw from "../data/log.json";

/** Raw row from `brag export --format json` (DEC-011 shape). */
type Raw = {
  id: number;
  title: string;
  description: string;
  tags: string;        // comma-joined
  project: string;
  type: string;
  impact: string;
  created_at: string;  // RFC3339
  updated_at: string;
};

/** Shape the page actually consumes — fields renamed for readability. */
export type Entry = {
  id: number;
  date: string;        // ISO 8601, from created_at
  type: string;        // shipped | fixed | learned | mentored | decided | ...
  text: string;        // from description
  project?: string;
  tags?: string[];
};

const toEntry = (r: Raw): Entry => ({
  id: r.id,
  date: r.created_at,
  type: r.type,
  text: r.description,
  project: r.project,
  tags: r.tags
    ? r.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [],
});

export const entries: Entry[] = (raw as Raw[])
  .map(toEntry)
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

/** Entries tagged with a page section, newest first. */
export function bySection(tag: string): Entry[] {
  return entries.filter((e) => e.tags?.includes(tag));
}

/** `learn` entries — these render as numbered findings. */
export const findings = entries.filter((e) => e.type === "learned");

export const stats = {
  total: entries.length,
  newest: entries[0]?.date ?? null,
  oldest: entries.at(-1)?.date ?? null,
  byType: entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {}),
};