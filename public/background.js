chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.action !== "FOLIO_AVAILABILITY") {
    return false;
  }

  const tabId = sender.tab?.id;
  if (!tabId) {
    return false;
  }

  const count = Number(message.count ?? 0);
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#567BFF" });
  chrome.action.setBadgeTextColor?.({ tabId, color: "#FFFFFF" });
  chrome.action.setBadgeText({ tabId, text: count > 0 ? String(Math.min(count, 99)) : "" });
  chrome.action.setTitle({
    tabId,
    title: count > 0 ? `Folio can fill ${count} field${count === 1 ? "" : "s"} on this page` : "Folio"
  });
  return false;
});
