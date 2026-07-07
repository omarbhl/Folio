import type { FolioProfile, ProfileActivity, ProfileActivityKind } from "./types";

const MAX_ACTIVITY_ITEMS = 50;

export function addProfileActivity(
  profile: FolioProfile,
  kind: ProfileActivityKind,
  label: string,
  targetId?: string,
  createdAt = new Date().toISOString()
): FolioProfile {
  const activity: ProfileActivity = {
    id: makeActivityId(kind, targetId, createdAt),
    kind,
    label,
    createdAt,
    targetId
  };

  return {
    ...profile,
    metrics: {
      ...profile.metrics,
      activityLog: [activity, ...profile.metrics.activityLog].slice(0, MAX_ACTIVITY_ITEMS)
    }
  };
}

function makeActivityId(kind: ProfileActivityKind, targetId: string | undefined, createdAt: string): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `activity-${kind}-${targetId ?? "profile"}-${Date.parse(createdAt) || Date.now()}-${suffix}`;
}
