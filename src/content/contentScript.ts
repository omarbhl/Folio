import { detectFields, getFillableElements, getLabelText, getNearbyText } from "../shared/fieldDetection";
import { isSafeFillMatch, matchFields } from "../shared/fieldMatching";
import { getProfile, saveProfile } from "../shared/storage";
import type { ContentMessage, DetectedField, DetectedUploadField, FillRequestMatch, FillResult, FolioProfile } from "../shared/types";

const FOLIO_FILLED_CLASS = "folio-filled";
const FOLIO_STYLE_ID = "folio-filled-indicator-style";
const AVAILABILITY_DEBOUNCE_MS = 500;
const CUSTOM_ANSWER_LEARN_DEBOUNCE_MS = 900;
const MIN_CUSTOM_ANSWER_LENGTH = 2;
const indicatorListeners = new WeakSet<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
const learningIgnoredElements = new WeakSet<Element>();
const learningTimers = new WeakMap<Element, number>();
let availabilityTimer: number | undefined;

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isContentMessage(message)) {
    return false;
  }

  if (message.action === "SCAN_FIELDS") {
    sendResponse({ fields: detectFields() });
    return false;
  }

  if (message.action === "FILL_FIELDS") {
    sendResponse(fillFields(message.matches, message.overwriteExisting));
    return false;
  }

  if (message.action === "SCAN_RESUME_UPLOADS") {
    sendResponse({ fields: detectResumeUploadFields() });
    return false;
  }

  if (message.action === "FILL_RESUME_UPLOAD") {
    sendResponse(fillResumeUpload(message));
    return false;
  }

  return false;
});

void updateAvailabilityBadge();
window.addEventListener("focus", scheduleAvailabilityBadgeUpdate, true);
window.addEventListener("input", scheduleAvailabilityBadgeUpdate, true);
window.addEventListener("change", scheduleAvailabilityBadgeUpdate, true);
window.addEventListener("input", scheduleCustomAnswerLearning, true);
window.addEventListener("change", scheduleCustomAnswerLearning, true);
new MutationObserver(scheduleAvailabilityBadgeUpdate).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["style", "class", "disabled", "readonly", "hidden", "aria-hidden"]
});

function isContentMessage(message: unknown): message is ContentMessage {
  if (!message || typeof message !== "object" || !("action" in message)) {
    return false;
  }

  const action = (message as { action: unknown }).action;
  return action === "SCAN_FIELDS" || action === "FILL_FIELDS" || action === "SCAN_RESUME_UPLOADS" || action === "FILL_RESUME_UPLOAD";
}

function fillFields(matches: FillRequestMatch[], overwriteExisting: boolean): FillResult {
  const elements = getFillableElements();
  let filledCount = 0;
  let skippedCount = 0;
  const restoreScroll = captureScrollPositions();

  for (const match of matches) {
    const element = elements[match.fieldIndex];
    if (!element) {
      skippedCount += 1;
      continue;
    }

    if (!overwriteExisting && element.value.trim().length > 0) {
      skippedCount += 1;
      continue;
    }

    learningIgnoredElements.add(element);
    const didFill = setElementValue(element, match.value, match.alternatives ?? []);
    window.setTimeout(() => learningIgnoredElements.delete(element), 0);
    if (!didFill) {
      skippedCount += 1;
      continue;
    }
    markElementFilled(element);
    filledCount += 1;
  }

  restoreScroll();
  requestAnimationFrame(restoreScroll);
  setTimeout(restoreScroll, 0);
  scheduleAvailabilityBadgeUpdate();
  return { filledCount, skippedCount };
}

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string, alternatives: string[] = []): boolean {
  const restoreScroll = captureScrollPositions(element);
  element.focus({ preventScroll: true });

  if (element instanceof HTMLSelectElement) {
    const matchedValue = getMatchingSelectValue(element, [value, ...alternatives]);
    if (matchedValue === null) {
      restoreScroll();
      element.blur();
      return false;
    }
    element.value = matchedValue;
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
  restoreScroll();
  return true;
}

function markElementFilled(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  ensureFilledIndicatorStyles();
  ensureManualEditListener(element);

  element.classList.remove(FOLIO_FILLED_CLASS);
  void element.offsetWidth;
  element.classList.add(FOLIO_FILLED_CLASS);
}

function ensureManualEditListener(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  if (indicatorListeners.has(element)) {
    return;
  }

  const clearIndicator = () => element.classList.remove(FOLIO_FILLED_CLASS);
  element.addEventListener("input", clearIndicator);
  element.addEventListener("change", clearIndicator);
  indicatorListeners.add(element);
}

function ensureFilledIndicatorStyles(): void {
  if (document.getElementById(FOLIO_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = FOLIO_STYLE_ID;
  style.textContent = `
    .${FOLIO_FILLED_CLASS} {
      outline: 2px solid #567BFF !important;
      outline-offset: 2px !important;
      transition:
        outline-color 180ms ease,
        outline-offset 180ms ease,
        box-shadow 240ms ease !important;
      animation: folio-filled-pulse 600ms ease-out 1;
    }

    @keyframes folio-filled-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(86, 123, 255, 0);
      }
      38% {
        box-shadow: 0 0 0 6px rgba(86, 123, 255, 0.18), 0 0 18px rgba(86, 123, 255, 0.22);
      }
      100% {
        box-shadow: 0 0 0 10px rgba(86, 123, 255, 0);
      }
    }
  `;
  document.documentElement.append(style);
}

function detectResumeUploadFields(): DetectedUploadField[] {
  return getResumeUploadElements().map((element, index) => ({
    index,
    name: element.name ?? "",
    id: element.id ?? "",
    accept: element.accept ?? "",
    ariaLabel: element.getAttribute("aria-label") ?? "",
    labelText: getLabelText(element),
    nearbyText: getNearbyText(element)
  }));
}

function getResumeUploadElements(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll('input[type="file"]')).filter((element): element is HTMLInputElement => {
    if (!(element instanceof HTMLInputElement) || element.disabled) {
      return false;
    }

    const signature = normalizeUploadText(
      [element.name, element.id, element.accept, element.getAttribute("aria-label") ?? "", getLabelText(element), getNearbyText(element)].join(" ")
    );

    return /\b(resume|cv|curriculum vitae|cover letter|candidature)\b/.test(signature);
  });
}

function fillResumeUpload(message: Extract<ContentMessage, { action: "FILL_RESUME_UPLOAD" }>): FillResult {
  const elements = getResumeUploadElements();
  const element = elements[message.fieldIndex];
  if (!element) {
    return { filledCount: 0, skippedCount: 1 };
  }

  const file = makeUploadFile(message.fileName, message.mimeType, message.content, message.contentKind);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  element.files = dataTransfer.files;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  markElementFilled(element);
  scheduleAvailabilityBadgeUpdate();
  return { filledCount: 1, skippedCount: 0 };
}

function makeUploadFile(fileName: string, mimeType: string, content: string, contentKind: "text" | "dataUrl"): File {
  if (contentKind === "dataUrl") {
    const [header = "", payload = ""] = content.split(",");
    const inferredMimeType = header.match(/data:([^;]+)/)?.[1] ?? mimeType;
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], fileName, { type: inferredMimeType || "application/octet-stream" });
  }

  return new File([content], fileName, { type: mimeType || "text/plain" });
}

function scheduleAvailabilityBadgeUpdate(): void {
  window.clearTimeout(availabilityTimer);
  availabilityTimer = window.setTimeout(() => void updateAvailabilityBadge(), AVAILABILITY_DEBOUNCE_MS);
}

function scheduleCustomAnswerLearning(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
    return;
  }

  if (learningIgnoredElements.has(target) || target.disabled || target.readOnly || isIgnoredLearningInput(target)) {
    return;
  }

  window.clearTimeout(learningTimers.get(target));
  const timer = window.setTimeout(() => void learnCustomAnswer(target), CUSTOM_ANSWER_LEARN_DEBOUNCE_MS);
  learningTimers.set(target, timer);
}

async function learnCustomAnswer(element: HTMLInputElement | HTMLTextAreaElement): Promise<void> {
  const answer = element.value.trim();
  if (answer.length < MIN_CUSTOM_ANSWER_LENGTH) {
    return;
  }

  const field = getDetectedFieldForElement(element);
  if (!field) {
    return;
  }

  const question = getReusableQuestionText(field);
  if (!question) {
    return;
  }

  const profile = await getProfile();
  if (!profile || isPersonalProfileAnswer(answer, profile) || isPersonalProfileField(field, profile)) {
    return;
  }

  const nextProfile = upsertCustomAnswer(profile, question, answer);
  if (nextProfile !== profile) {
    await saveProfile(nextProfile);
  }
}

function getDetectedFieldForElement(element: HTMLInputElement | HTMLTextAreaElement): DetectedField | null {
  const elements = getFillableElements();
  const index = elements.indexOf(element);
  if (index < 0) {
    return null;
  }

  return detectFields().find((field) => field.index === index) ?? null;
}

function getReusableQuestionText(field: DetectedField): string {
  const candidates = [field.labelText, field.ariaLabel, field.placeholder, field.nearbyText]
    .map(cleanQuestionText)
    .filter(Boolean);
  const question = candidates.find((candidate) => isLikelyReusableQuestion(candidate)) ?? "";
  return question;
}

function isLikelyReusableQuestion(value: string): boolean {
  const normalized = normalizeQuestion(value);
  if (normalized.length < 8 || normalized.split(" ").length < 2) {
    return false;
  }

  if (isPersonalQuestionText(normalized)) {
    return false;
  }

  return value.includes("?") || normalized.length >= 18;
}

function isPersonalProfileField(field: DetectedField, profile: FolioProfile): boolean {
  return matchFields([field], profile).some((match) => match.profilePath.startsWith("personal."));
}

function isPersonalProfileAnswer(answer: string, profile: FolioProfile): boolean {
  const normalizedAnswer = normalizeQuestion(answer);
  return Object.values(profile.personal).some((value) => value.trim().length > 0 && normalizeQuestion(value) === normalizedAnswer);
}

function upsertCustomAnswer(profile: FolioProfile, question: string, answer: string): FolioProfile {
  const normalizedQuestion = normalizeQuestion(question);
  const existingIndex = profile.customAnswers.findIndex((entry) => normalizeQuestion(entry.question) === normalizedQuestion);

  if (existingIndex >= 0) {
    const existing = profile.customAnswers[existingIndex];
    if (existing.answer.trim() === answer) {
      return profile;
    }

    return {
      ...profile,
      customAnswers: profile.customAnswers.map((entry, index) =>
        index === existingIndex
          ? { ...entry, question, answer, tags: Array.from(new Set([...entry.tags, "learned"])) }
          : entry
      )
    };
  }

  return {
    ...profile,
    customAnswers: [...profile.customAnswers, { question, answer, tags: ["learned"] }]
  };
}

function cleanQuestionText(value: string): string {
  return value
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`´]/g, " ")
    .replace(/[_/-]+/g, " ")
    .replace(/[^a-z0-9? ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPersonalQuestionText(normalized: string): boolean {
  return /\b(first name|last name|full name|name|email|phone|telephone|address|city|country|postal|zip|linkedin|github|portfolio|website|resume|cv|cover letter|password|captcha)\b/.test(
    normalized
  );
}

function isIgnoredLearningInput(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (element instanceof HTMLTextAreaElement) {
    return false;
  }

  const type = element.type.toLowerCase();
  return ["button", "checkbox", "color", "date", "datetime-local", "email", "file", "hidden", "image", "month", "number", "password", "radio", "range", "reset", "search", "submit", "tel", "time", "url", "week"].includes(type);
}

async function updateAvailabilityBadge(): Promise<void> {
  const profile = await getProfile();
  if (!profile) {
    sendAvailabilityCount(0);
    return;
  }

  const fields = detectFields();
  const safeMatches = matchFields(fields, profile).filter(isSafeFillMatch);
  sendAvailabilityCount(safeMatches.length + detectResumeUploadFields().length);
}

function sendAvailabilityCount(count: number): void {
  try {
    chrome.runtime.sendMessage({ action: "FOLIO_AVAILABILITY", count });
  } catch {
    // The badge is a best-effort hint; filling still works if the background page is unavailable.
  }
}

function captureScrollPositions(element?: Element): () => void {
  const positions: Array<{ target: Element | Window; left: number; top: number }> = [
    { target: window, left: window.scrollX, top: window.scrollY }
  ];

  let parent = element?.parentElement;
  while (parent) {
    if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
      positions.push({ target: parent, left: parent.scrollLeft, top: parent.scrollTop });
    }
    parent = parent.parentElement;
  }

  return () => {
    for (const position of positions) {
      if (position.target instanceof Window) {
        window.scrollTo(position.left, position.top);
      } else {
        position.target.scrollLeft = position.left;
        position.target.scrollTop = position.top;
      }
    }
  };
}

function getMatchingSelectValue(select: HTMLSelectElement, values: string[]): string | null {
  const candidates = values.map(normalizeOptionText).filter(Boolean);
  if (candidates.length === 0) {
    return null;
  }

  const options = Array.from(select.options).filter((option) => !option.disabled && option.value.trim().length > 0);

  for (const option of options) {
    const optionCandidates = [option.value, option.label, option.textContent ?? ""].map(normalizeOptionText);
    if (optionCandidates.some((candidate) => candidates.includes(candidate))) {
      return option.value;
    }
  }

  for (const option of options) {
    const optionCandidates = [option.value, option.label, option.textContent ?? ""].map(normalizeOptionText);
    if (optionCandidates.some((optionCandidate) => candidates.some((candidate) => optionCandidate.includes(candidate) || candidate.includes(optionCandidate)))) {
      return option.value;
    }
  }

  return null;
}

function normalizeOptionText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|republic|kingdom|state|states)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUploadText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
