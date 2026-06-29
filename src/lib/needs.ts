// Frequency ranking of "needs" across entries (AID-015), to seed the admin
// checklist with the most common, already-used items. Pure and testable.

interface HasNeeds {
  needs?: string[];
}

// Trim and collapse internal whitespace so "Agua  potable" and " Agua potable "
// count as the same need.
function normalize(s: string): string {
  return String(s).trim().replace(/\s+/g, " ");
}

const collator = new Intl.Collator("es");

export function topNeeds(entries: HasNeeds[], n: number): string[] {
  // Group case-insensitively so "Alimentos" and "alimentos" count together; the
  // label shown is the most frequent original spelling within the group.
  const groups = new Map<string, { total: number; variants: Map<string, number> }>();
  for (const e of entries || []) {
    for (const raw of e.needs || []) {
      const need = normalize(raw);
      if (!need) continue;
      const key = need.toLowerCase();
      let g = groups.get(key);
      if (!g) { g = { total: 0, variants: new Map() }; groups.set(key, g); }
      g.total++;
      g.variants.set(need, (g.variants.get(need) || 0) + 1);
    }
  }
  const labelOf = (g: { variants: Map<string, number> }) =>
    [...g.variants.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]))[0][0];
  return [...groups.values()]
    .map((g) => ({ label: labelOf(g), total: g.total }))
    .sort((a, b) => b.total - a.total || collator.compare(a.label, b.label))
    .slice(0, n)
    .map((x) => x.label);
}
