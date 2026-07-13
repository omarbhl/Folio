import { APP_VERSION, PROFILE_VERSION, defaultProfile } from "./defaultProfile";
import { isProfile } from "./profileSchema";
import type { FolioProfile, OnboardingDraft, ProfileActivity, ProfileDocument, ThemeMode } from "./types";

const PROFILE_KEY = "folio.profile";
const THEME_KEY = "folio.theme";
const ONBOARDING_DRAFT_KEY = "folio.onboarding-draft";

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

export async function getOnboardingDraft(): Promise<OnboardingDraft | null> {
  const storage = getLocalStorageArea();
  const value = storage
    ? (await storage.get(ONBOARDING_DRAFT_KEY))[ONBOARDING_DRAFT_KEY]
    : readJson(localStorage.getItem(ONBOARDING_DRAFT_KEY));

  if (!value || typeof value !== "object") {
    return null;
  }

  const draft = value as Partial<OnboardingDraft>;
  if (!isProfile(draft.profile) || typeof draft.step !== "number" || (draft.path !== "resume" && draft.path !== "manual")) {
    return null;
  }

  return {
    profile: normalizeProfile(draft.profile),
    step: Math.max(0, Math.min(6, Math.floor(draft.step))),
    path: draft.path,
    updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : new Date().toISOString()
  };
}

export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void> {
  const normalizedDraft: OnboardingDraft = {
    ...draft,
    profile: normalizeProfile(draft.profile),
    updatedAt: new Date().toISOString()
  };
  const storage = getLocalStorageArea();
  if (storage) {
    await storage.set({ [ONBOARDING_DRAFT_KEY]: normalizedDraft });
    return;
  }

  localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(normalizedDraft));
}

export async function clearOnboardingDraft(): Promise<void> {
  const storage = getLocalStorageArea();
  if (storage) {
    await storage.remove(ONBOARDING_DRAFT_KEY);
    return;
  }

  localStorage.removeItem(ONBOARDING_DRAFT_KEY);
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

function readJson(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeProfile(profile: FolioProfile): FolioProfile {
  const legacyMetrics = profile.metrics as Partial<FolioProfile["metrics"]> & { totalAutofills?: number };
  const totalFormsFilled = legacyMetrics.totalFormsFilled ?? legacyMetrics.totalAutofills ?? defaultProfile.metrics.totalFormsFilled;
  const now = new Date().toISOString();
  const metadata = profile.metadata ?? defaultProfile.metadata;

  return {
    ...profile,
    metadata: {
      ...defaultProfile.metadata,
      ...metadata,
      appVersion: APP_VERSION,
      profileVersion: PROFILE_VERSION,
      createdAt: metadata.createdAt || now,
      updatedAt: now
    },
    metrics: {
      ...defaultProfile.metrics,
      ...(profile.metrics ?? {}),
      totalFormsFilled,
      activityLog: normalizeActivityLog(profile.metrics?.activityLog ?? [])
    },
    documents: (profile.documents ?? []).map(normalizeDocument),
    preferences: {
      ...defaultProfile.preferences,
      ...(profile.preferences ?? {})
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
    updatedAt: document.updatedAt || createdAt,
    usageCount: document.usageCount ?? 0,
    lastUsedAt: document.lastUsedAt ?? ""
  };
}

function normalizeActivityLog(activityLog: ProfileActivity[]): ProfileActivity[] {
  return activityLog
    .filter((entry) => entry && entry.id && entry.kind && entry.label && entry.createdAt)
    .slice(0, 50);
}

function makeDocumentId(value: string): string {
  return `doc-${Date.now()}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file"}`;
}

function readThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}
