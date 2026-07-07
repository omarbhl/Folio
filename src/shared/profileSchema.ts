import type { FolioProfile } from "./types";

export type { FolioProfile } from "./types";

export function isProfile(value: unknown): value is FolioProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<FolioProfile>;
  return (
    !!profile.personal &&
    typeof profile.personal === "object" &&
    Array.isArray(profile.education) &&
    Array.isArray(profile.experience) &&
    Array.isArray(profile.skills) &&
    Array.isArray(profile.documents)
  );
}
