import { defaultProfile } from "./defaultProfile";
import { isProfile } from "./profileSchema";
import type { FolioProfile, ProfileDocument, ThemeMode } from "./types";

const PROFILE_KEY = "folio.profile";
const THEME_KEY = "folio.theme";

type ChromeLikeStorage = {
  storage?: {
    local?: {
      get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
  };
};

function getLocalStorageArea() {
  const browserApi = typeof chrome === "undefined" ? undefined : (chrome as ChromeLikeStorage);
  return browserApi?.storage?.local;
}

export async function getProfile(): Promise<FolioProfile | null> {
  const storage = getLocalStorageArea();
  if (!storage) {
    return loadProfileFromWebStorage();
  }

  const result = await storage.get(PROFILE_KEY);
  const profile = result[PROFILE_KEY];
  return isProfile(profile) ? normalizeProfile(profile) : null;
}

export async function saveProfile(profile: FolioProfile): Promise<void> {
  const normalizedProfile = normalizeProfile(profile);
  const storage = getLocalStorageArea();
  if (!storage) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizedProfile));
    return;
  }

  await storage.set({ [PROFILE_KEY]: normalizedProfile });
}

export async function hasProfile(): Promise<boolean> {
  return (await getProfile()) !== null;
}

export async function exportProfile(): Promise<string> {
  const profile = (await getProfile()) ?? defaultProfile;
  return JSON.stringify(profile, null, 2);
}

export async function importProfile(json: string): Promise<FolioProfile> {
  const parsed = JSON.parse(json) as unknown;
  if (!isProfile(parsed)) {
    throw new Error("The imported JSON does not look like a Folio profile.");
  }

  const profile = normalizeProfile(parsed);
  await saveProfile(profile);
  return profile;
}

export async function getThemeMode(): Promise<ThemeMode> {
  const storage = getLocalStorageArea();
  if (!storage) {
    return readThemeMode(localStorage.getItem(THEME_KEY));
  }

  const result = await storage.get(THEME_KEY);
  return readThemeMode(result[THEME_KEY]);
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  const storage = getLocalStorageArea();
  if (!storage) {
    localStorage.setItem(THEME_KEY, mode);
    return;
  }

  await storage.set({ [THEME_KEY]: mode });
}

function loadProfileFromWebStorage(): FolioProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isProfile(parsed) ? normalizeProfile(parsed) : null;
  } catch {
    return null;
  }
}

function normalizeProfile(profile: FolioProfile): FolioProfile {
  const legacyMetrics = profile.metrics as Partial<FolioProfile["metrics"]> & { totalAutofills?: number };
  const totalFormsFilled = legacyMetrics.totalFormsFilled ?? legacyMetrics.totalAutofills ?? defaultProfile.metrics.totalFormsFilled;

  return {
    ...profile,
    metrics: {
      ...defaultProfile.metrics,
      ...(profile.metrics ?? {}),
      totalFormsFilled
    },
    documents: (profile.documents ?? []).map(normalizeDocument),
    preferences: {
      ...defaultProfile.preferences,
      ...(profile.preferences ?? {}),
      learnedSiteHosts: Array.from(new Set(profile.preferences?.learnedSiteHosts ?? []))
    }
  };
}

function normalizeDocument(document: ProfileDocument): ProfileDocument {
  const createdAt = document.createdAt || new Date().toISOString();

  return {
    ...document,
    id: document.id || makeDocumentId(document.fileName || document.name || "document"),
    mimeType: document.mimeType || "text/plain",
    size: document.size ?? document.content?.length ?? 0,
    content: document.content ?? "",
    contentKind: document.contentKind ?? "text",
    createdAt,
    updatedAt: document.updatedAt || createdAt
  };
}

function makeDocumentId(value: string): string {
  return `doc-${Date.now()}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file"}`;
}

function readThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}
