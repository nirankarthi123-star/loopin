/**
 * Smart Need Matcher — LoopIn Backend
 *
 * Deterministic rule-based matching engine for student requests.
 * Uses zero external AI APIs or paid services.
 *
 * Scoring Formula:
 * - Title match: up to 45 pts (exact whole phrase: 45, token overlap: up to 35)
 * - Category match: 25 pts
 * - Tag match: up to 15 pts
 * - Date availability: 15 pts (item is available)
 * - Campus/Location proximity: 10 pts
 *
 * Threshold: >= 50 qualifies as match; >= 75 is exactMatch.
 */

import type { Item, SmartNeedQuery, SmartMatchResult, MatchReason, ItemCategory } from "@loopin/shared";

const STOP_WORDS = new Set([
  "i", "need", "a", "an", "the", "for", "in", "at", "near", "tomorrow", "today",
  "please", "looking", "want", "to", "borrow", "urgently", "some", "my", "by", "on", "block", "hostel"
]);

/**
 * Natural language parser extracting structured parameters deterministically.
 */
export function parseNaturalNeedQuery(text: string): {
  extractedCategory?: ItemCategory;
  tokens: string[];
  locationHint?: string;
  dateHint?: string;
} {
  const lower = text.toLowerCase();
  const rawWords = lower.replace(/[^\w\s-]/g, " ").split(/\s+/).filter(Boolean);

  let extractedCategory: ItemCategory | undefined;
  if (lower.includes("calculator") || lower.includes("charger") || lower.includes("electronics") || lower.includes("camera") || lower.includes("multimeter") || lower.includes("laptop") || lower.includes("arduino") || lower.includes("sensor")) {
    extractedCategory = "electronics";
  } else if (lower.includes("book") || lower.includes("textbook") || lower.includes("novel") || lower.includes("notes") || lower.includes("stationary")) {
    extractedCategory = "books";
  } else if (lower.includes("drill") || lower.includes("hammer") || lower.includes("wrench") || lower.includes("screwdriver") || lower.includes("tool") || lower.includes("dremel") || lower.includes("soldering")) {
    extractedCategory = "tools";
  } else if (lower.includes("racket") || lower.includes("badminton") || lower.includes("ball") || lower.includes("football") || lower.includes("gym") || lower.includes("cricket")) {
    extractedCategory = "sports";
  } else if (lower.includes("pen") || lower.includes("drafter") || lower.includes("scale") || lower.includes("sheet")) {
    extractedCategory = "stationery";
  } else if (lower.includes("kettle") || lower.includes("plate") || lower.includes("cup") || lower.includes("pan") || lower.includes("blender")) {
    extractedCategory = "kitchen";
  } else if (lower.includes("guitar") || lower.includes("keyboard") || lower.includes("violin") || lower.includes("drum") || lower.includes("flute")) {
    extractedCategory = "musical_instruments";
  }

  // Location heuristic
  let locationHint: string | undefined;
  const locationTriggers = ["near", "at", "around", "by", "hostel", "quad", "department"];
  const LOCATION_FILLERS = new Set(["the", "a", "an", "this", "that"]);
  for (let i = 0; i < rawWords.length; i++) {
    const word = rawWords[i];
    if (word && locationTriggers.includes(word)) {
      // Collect up to 3 meaningful words after the trigger, skipping filler particles
      const meaningfulWords: string[] = [];
      for (let j = i + 1; j < rawWords.length && meaningfulWords.length < 3; j++) {
        const w = rawWords[j];
        if (w && !LOCATION_FILLERS.has(w)) {
          meaningfulWords.push(w);
        }
      }
      if (meaningfulWords.length > 0) {
        locationHint = meaningfulWords.join(" ");
        break;
      }
    }
  }

  // Meaningful query tokens
  const tokens = rawWords.filter((w) => !STOP_WORDS.has(w) && w.length > 2);

  return {
    ...(extractedCategory ? { extractedCategory } : {}),
    tokens,
    ...(locationHint ? { locationHint } : {}),
  };
}

/**
 * Deterministically ranks available items against a student's need.
 */
export function matchItemsForNeed(
  items: Item[],
  query: SmartNeedQuery,
): SmartMatchResult[] {
  const queryText = (query.naturalQuery ?? query.itemOrCategory ?? "").toLowerCase().trim();
  const parsed = queryText ? parseNaturalNeedQuery(queryText) : { tokens: [] };

  const targetCategory = (query.itemOrCategory as ItemCategory) || parsed.extractedCategory;
  const targetLocation = (query.pickupLocation ?? parsed.locationHint ?? "").toLowerCase().trim();
  const tokens = parsed.tokens;

  const results: SmartMatchResult[] = [];

  for (const item of items) {
    // Only match available items
    if (item.status !== "available") continue;

    const reasons: MatchReason[] = [];
    let score = 0;

    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();
    const itemLocationLower = (item.pickupLocation ?? "").toLowerCase();

    // 1. Title & Keyword relevance (up to 45 pts)
    if (queryText && titleLower.includes(queryText)) {
      score += 45;
      reasons.push({
        field: "title",
        label: `Direct title match for "${queryText}"`,
        scoreContribution: 45,
      });
    } else if (tokens.length > 0) {
      let matchedTokenCount = 0;
      for (const token of tokens) {
        if (titleLower.includes(token) || descLower.includes(token)) {
          matchedTokenCount++;
        }
      }
      if (matchedTokenCount > 0) {
        const tokenScore = Math.min(35, Math.round((matchedTokenCount / tokens.length) * 35));
        score += tokenScore;
        reasons.push({
          field: "title",
          label: `Keyword match on item details (${matchedTokenCount}/${tokens.length} keywords)`,
          scoreContribution: tokenScore,
        });
      }
    }

    // 2. Category relevance (up to 25 pts)
    if (targetCategory && item.category === targetCategory) {
      score += 25;
      reasons.push({
        field: "category",
        label: `Matches requested category (${item.category})`,
        scoreContribution: 25,
      });
    }

    // 3. Tag relevance (up to 15 pts)
    if (tokens.length > 0 && item.tags.length > 0) {
      const tagMatch = item.tags.some((t) => tokens.some((k) => t.toLowerCase().includes(k)));
      if (tagMatch) {
        score += 15;
        reasons.push({
          field: "tags",
          label: `Tags include matching keywords`,
          scoreContribution: 15,
        });
      }
    }

    // 4. Availability (10 pts)
    score += 10;
    reasons.push({
      field: "availability",
      label: "Item is currently available in your campus quad",
      scoreContribution: 10,
    });

    // 5. Pickup Location Preference (up to 10 pts)
    if (targetLocation && itemLocationLower && (itemLocationLower.includes(targetLocation) || targetLocation.includes(itemLocationLower))) {
      score += 10;
      reasons.push({
        field: "location",
        label: `Convenient pickup near "${item.pickupLocation}"`,
        scoreContribution: 10,
      });
    }

    if (score >= 35) {
      results.push({
        item,
        matchScore: Math.min(100, score),
        isExactMatch: score >= 70,
        matchReasons: reasons,
      });
    }
  }

  // Sort descending by matchScore
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}
