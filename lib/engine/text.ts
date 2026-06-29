/**
 * Normalize a product title for fuzzy duplicate-grouping across stores.
 * Lowercases, strips ASCII + Arabic punctuation, collapses whitespace. Keeps
 * Arabic/Latin letters and digits intact (avoids \w, which would drop Arabic).
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[!-/:-@[-`{-~،؛؟“”"'…–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
