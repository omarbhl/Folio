import type { DetectedField } from "./types";

const UNSAFE_INPUT_TYPES = new Set(["hidden", "password", "search", "file", "submit", "button", "reset", "image"]);

export function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function getLabelText(element: HTMLElement): string {
  const labels = "labels" in element ? Array.from((element as HTMLInputElement).labels ?? []) : [];
  const explicit = labels.map((label) => label.textContent?.trim() ?? "").filter(Boolean).join(" ");
  if (explicit) {
    return explicit;
  }

  const id = element.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) {
      return label.textContent.trim();
    }
  }

  const wrappingLabel = element.closest("label");
  return wrappingLabel?.textContent?.replace(element.textContent ?? "", "").trim() ?? "";
}

export function getNearbyText(element: HTMLElement): string {
  const container = element.closest("div, p, section, fieldset, li, tr, form");
  if (!container) {
    return "";
  }

  return Array.from(container.childNodes)
    .filter((node) => node !== element)
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

export function getFieldSignature(field: DetectedField): string {
  return [
    field.autocomplete,
    field.labelText,
    field.name,
    field.id,
    field.placeholder,
    field.ariaLabel,
    field.nearbyText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function detectFields(): DetectedField[] {
  const candidates = Array.from(document.querySelectorAll("input, textarea, select"));

  return candidates.reduce<DetectedField[]>((fields, element) => {
    if (!isFillableElement(element)) {
      return fields;
    }

    const htmlElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    fields.push({
      index: fields.length,
      tagName: element.tagName.toLowerCase() as DetectedField["tagName"],
      inputType: element instanceof HTMLInputElement ? element.type.toLowerCase() : "",
      name: htmlElement.name ?? "",
      id: htmlElement.id ?? "",
      autocomplete: htmlElement.autocomplete ?? "",
      placeholder: "placeholder" in htmlElement ? htmlElement.placeholder : "",
      ariaLabel: htmlElement.getAttribute("aria-label") ?? "",
      labelText: getLabelText(htmlElement),
      nearbyText: getNearbyText(htmlElement),
      value: "value" in htmlElement ? htmlElement.value : ""
    });
    return fields;
  }, []);
}

export function getFillableElements(): Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
  return Array.from(document.querySelectorAll("input, textarea, select")).filter(isFillableElement);
}

function isFillableElement(element: Element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement) &&
    !(element instanceof HTMLSelectElement)
  ) {
    return false;
  }

  const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
  const signature = [
    element.name,
    element.id,
    "placeholder" in element ? element.placeholder : "",
    element.getAttribute("aria-label") ?? ""
  ]
    .join(" ")
    .toLowerCase();

  return (
    isVisible(element) &&
    !element.disabled &&
    (element instanceof HTMLSelectElement || !element.readOnly) &&
    !UNSAFE_INPUT_TYPES.has(inputType) &&
    !signature.includes("captcha")
  );
}
