import type { ThemeMode } from "./types";

export function applyThemeMode(mode: ThemeMode): () => void {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const apply = () => {
    const effectiveTheme = mode === "auto" ? (mediaQuery.matches ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  };

  apply();

  if (mode !== "auto") {
    return () => undefined;
  }

  mediaQuery.addEventListener("change", apply);
  return () => mediaQuery.removeEventListener("change", apply);
}
