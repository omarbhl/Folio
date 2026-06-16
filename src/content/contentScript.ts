import { detectFields, getFillableElements, getLabelText, getNearbyText } from "../shared/fieldDetection";
import { isSafeFillMatch, matchFields } from "../shared/fieldMatching";
import { getProfile } from "../shared/storage";
import type { ContentMessage, DetectedUploadField, FillRequestMatch, FillResult } from "../shared/types";

const FOLIO_FILLED_CLASS = "folio-filled";
const FOLIO_STYLE_ID = "folio-filled-indicator-style";
const AVAILABILITY_DEBOUNCE_MS = 500;
const indicatorListeners = new WeakSet<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
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

    const didFill = setElementValue(element, match.value, match.alternatives ?? []);
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
