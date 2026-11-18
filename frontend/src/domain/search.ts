import type { CompositionFilters, Video } from "./types";

/** Most suggestions shown at once, recent searches included (as in the mockup). */
export const SUGGESTION_LIMIT = 8;
/** Most recent searches remembered. */
export const RECENT_LIMIT = 8;

/** A phrase people might search for, weighted by the summed views of the videos it names. */
type WeightedPhrase = Readonly<{ phrase: string; weight: number }>;
export type SuggestionCorpus = readonly WeightedPhrase[];

export type Suggestion = Readonly<{ phrase: string; recent: boolean }>;

/** A piece of a suggestion; the parts the visitor hasn't typed are bold, as on Google. */
export type HighlightPart = Readonly<{ text: string; bold: boolean }>;

const collapse = (text: string) => text.toLowerCase().replace(/\s+/g, " ");

/** How searches compare and are remembered: lowercase, single spaces, trimmed. */
export const normalizeQuery = (text: string): string => collapse(text).trim();

/** A topic counts double; a topic plus its channel is a long-tail phrase worth a quarter. */
const TOPIC_WEIGHT = 2;
const TOPIC_CHANNEL_WEIGHT = 0.25;
/** Each word after the first costs a phrase this share of its weight, so short popular phrases come first. */
const EXTRA_WORD_PENALTY = 0.5;

/** Every title, honest title, channel and topic in the catalog, weighted by views. */
export function suggestionCorpus(catalog: readonly Video[]): SuggestionCorpus {
  const weights = new Map<string, number>();
  const add = (text: string, weight: number) => {
    const phrase = normalizeQuery(text);
    if (phrase) weights.set(phrase, (weights.get(phrase) ?? 0) + weight);
  };
  for (const v of catalog) {
    add(v.title, v.views);
    if (v.honestTitle !== v.title) add(v.honestTitle, v.views);
    add(v.channel, v.views);
    add(v.topic, v.views * TOPIC_WEIGHT);
    add(`${v.topic} ${v.channel}`, v.views * TOPIC_CHANNEL_WEIGHT);
  }
  return [...weights].map(([phrase, weight]) => ({ phrase, weight }));
}

const score = ({ phrase, weight }: WeightedPhrase) => weight / (1 + (phrase.split(" ").length - 1) * EXTRA_WORD_PENALTY);
const byScore = (a: WeightedPhrase, b: WeightedPhrase) => score(b) - score(a);

/** Whether a word after the first starts what was typed ("fing" in "green fingers"). */
const laterWordStarts = (phrase: string, typed: string) => {
  const words = phrase.split(" ");
  return words.some((_, i) => i > 0 && words.slice(i).join(" ").startsWith(typed));
};

/**
 * Google-style suggestions: matching recent searches first, then phrases that start with what was
 * typed, then phrases with a later word that does. A trailing space is kept, so a filled-in phrase
 * suggests what follows it.
 */
export function suggestFor(corpus: SuggestionCorpus, recent: readonly string[], typed: string): readonly Suggestion[] {
  const q = collapse(typed).trimStart();
  const recentHits = recent.filter((r) => r.startsWith(q)).map((phrase) => ({ phrase, recent: true }));
  if (!q) return recentHits.slice(0, SUGGESTION_LIMIT);
  const seen = new Set(recentHits.map((r) => r.phrase));
  const fresh = corpus.filter((x) => !seen.has(x.phrase));
  const starts = fresh.filter((x) => x.phrase.startsWith(q)).sort(byScore);
  const later = fresh.filter((x) => !x.phrase.startsWith(q) && laterWordStarts(x.phrase, q)).sort(byScore);
  const others = [...starts, ...later].map(({ phrase }) => ({ phrase, recent: false }));
  return [...recentHits, ...others].slice(0, SUGGESTION_LIMIT);
}

/** Splits a suggestion so the part that matches what was typed is plain and the rest is bold. */
export function highlightUntyped(phrase: string, typed: string): readonly HighlightPart[] {
  const q = normalizeQuery(typed);
  if (!q) return [{ text: phrase, bold: false }];
  const at = phrase.indexOf(q);
  if (at < 0) return [{ text: phrase, bold: true }];
  const parts = [
    { text: phrase.slice(0, at), bold: true },
    { text: phrase.slice(at, at + q.length), bold: false },
    { text: phrase.slice(at + q.length), bold: true },
  ];
  return parts.filter((p) => p.text);
}

/** The texts a search looks in. "Topic channel" is there too, so every suggestion finds something. */
const searchableTexts = (v: Video) => [v.title, v.honestTitle, v.channel, v.topic, `${v.topic} ${v.channel}`];

/** Videos whose title, honest title, channel or topic contains the query, in catalog order, following Hide clickbait. */
export function searchCatalog(catalog: readonly Video[], query: string, filters: Pick<CompositionFilters, "hideClickbait">): readonly Video[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  return catalog.filter((v) => !(filters.hideClickbait && v.clickbait) && searchableTexts(v).some((text) => collapse(text).includes(q)));
}

/** Puts a search first in the recent list, without repeats, keeping the newest few. */
export function rememberSearch(recent: readonly string[], query: string): readonly string[] {
  const q = normalizeQuery(query);
  return [q, ...recent.filter((r) => r !== q)].slice(0, RECENT_LIMIT);
}

export const forgetSearch = (recent: readonly string[], query: string): readonly string[] => recent.filter((r) => r !== query);
