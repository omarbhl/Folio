import { getFieldSignature } from "./fieldDetection";
import { FIELD_LEXICON, getFieldTerms } from "./fieldLexicon";
import type { DetectedField, FieldMatch, FolioProfile, ProfilePath } from "./types";

const SAFE_FILL_THRESHOLD = 0.72;
const REVIEW_THRESHOLD = 0.45;

const AUTOCOMPLETE_MAP: Record<string, ProfilePath> = {
  "given-name": "personal.firstName",
  "family-name": "personal.lastName",
  name: "personal.fullName",
  email: "personal.email",
  tel: "personal.phone",
  "tel-national": "personal.phone",
  "street-address": "personal.address",
  "address-line1": "personal.address",
  "address-level2": "personal.city",
  country: "personal.country",
  "country-name": "personal.country",
  "postal-code": "personal.postalCode",
  url: "personal.portfolio"
};

export function matchFields(fields: DetectedField[], profile: FolioProfile): FieldMatch[] {
  return fields
    .map((field) => matchField(field, profile))
    .filter((match): match is FieldMatch => match !== null)
    .sort((a, b) => b.confidence - a.confidence);
}

export function isSafeFillMatch(match: FieldMatch): boolean {
  return match.confidence >= SAFE_FILL_THRESHOLD && !match.needsReview;
}

export function getProfileValue(profile: FolioProfile, path: ProfilePath): string {
  if (path.startsWith("customAnswers.")) {
    const index = Number(path.split(".")[1]);
    return Number.isInteger(index) ? profile.customAnswers[index]?.answer ?? "" : "";
  }

  const [, key] = path.split(".") as ["personal", keyof FolioProfile["personal"]];
  return profile.personal[key] ?? "";
}

function matchField(field: DetectedField, profile: FolioProfile): FieldMatch | null {
  if (field.inputType === "password" || field.inputType === "search" || field.inputType === "file") {
    return null;
  }

  const autocomplete = field.autocomplete.toLowerCase().trim();
  const autocompleteMatch = AUTOCOMPLETE_MAP[autocomplete];
  if (autocompleteMatch) {
    return makeMatch(field, autocompleteMatch, profile, 0.96, "autocomplete");
  }

  const highSignal = normalize([field.labelText, field.name, field.id, field.ariaLabel].join(" "));
  const placeholder = normalize(field.placeholder);
  const nearby = normalize(field.nearbyText);
  const signature = normalize(getFieldSignature(field));

  const candidates: FieldMatch[] = [];
  for (const lexiconEntry of FIELD_LEXICON) {
    for (const term of getFieldTerms(lexiconEntry)) {
      const normalizedTerm = normalize(term);
      if (containsTerm(highSignal, normalizedTerm)) {
        candidates.push(makeMatch(field, lexiconEntry.path, profile, confidenceForTerm(0.88, normalizedTerm), "label/name/id"));
      } else if (containsTerm(placeholder, normalizedTerm)) {
        candidates.push(makeMatch(field, lexiconEntry.path, profile, confidenceForTerm(0.64, normalizedTerm), "placeholder"));
      } else if (containsTerm(nearby, normalizedTerm)) {
        candidates.push(makeMatch(field, lexiconEntry.path, profile, confidenceForTerm(0.5, normalizedTerm), "nearby text"));
      } else if (containsTerm(signature, normalizedTerm)) {
        candidates.push(makeMatch(field, lexiconEntry.path, profile, confidenceForTerm(0.46, normalizedTerm), "field signature"));
      }
    }
  }

  profile.customAnswers.forEach((answer, index) => {
    const confidence = getCustomAnswerConfidence(answer.question, {
      highSignal,
      placeholder,
      nearby,
      signature
    });

    if (confidence > 0) {
      candidates.push(makeMatch(field, `customAnswers.${index}` as ProfilePath, profile, confidence, "saved custom answer"));
    }
  });

  const best = candidates
    .filter((candidate) => candidate.value.trim().length > 0)
    .sort((a, b) => b.confidence - a.confidence)[0];

  return best && best.confidence >= REVIEW_THRESHOLD ? best : null;
}

function makeMatch(
  field: DetectedField,
  profilePath: ProfilePath,
  profile: FolioProfile,
  confidence: number,
  source: string
): FieldMatch {
  return {
    field,
    profilePath,
    value: getProfileValue(profile, profilePath),
    confidence,
    source,
    needsReview: confidence < SAFE_FILL_THRESHOLD
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`´]/g, " ")
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCustomAnswerConfidence(
  question: string,
  fieldText: { highSignal: string; placeholder: string; nearby: string; signature: string }
): number {
  const normalizedQuestion = normalize(question);
  if (!normalizedQuestion || normalizedQuestion.length < 8) {
    return 0;
  }

  const highSignalTargets = [fieldText.highSignal, fieldText.placeholder].filter(Boolean);
  for (const target of highSignalTargets) {
    if (target === normalizedQuestion) {
      return 0.97;
    }

    if (containsTerm(target, normalizedQuestion) || containsTerm(normalizedQuestion, target)) {
      return 0.9;
    }
  }

  const contextTargets = [fieldText.nearby, fieldText.signature].filter(Boolean);
  for (const target of contextTargets) {
    if (target === normalizedQuestion) {
      return 0.88;
    }

    if (containsTerm(target, normalizedQuestion)) {
      return 0.82;
    }

    if (getTokenSimilarity(normalizedQuestion, target) >= 0.78) {
      return 0.76;
    }
  }

  return 0;
}

function getTokenSimilarity(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 2));
  const bTokens = new Set(b.split(" ").filter((token) => token.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(aTokens.size, bTokens.size);
}

function containsTerm(value: string, term: string): boolean {
  if (!value || !term) {
    return false;
  }

  return new RegExp(`(^|\\b)${escapeRegExp(term)}(\\b|$)`).test(value);
}

function confidenceForTerm(baseConfidence: number, term: string): number {
  const specificityBonus = Math.min(0.04, term.length / 500);
  return Math.min(0.99, baseConfidence + specificityBonus);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
