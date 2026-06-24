const BLOCKED_HOST_PATTERNS = [
  /(^|\.)instagram\.com$/i
];

export function isBlockedSite(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function isCurrentSiteBlocked(): boolean {
  return isBlockedSite(window.location.hostname);
}
