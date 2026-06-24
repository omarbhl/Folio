import { useCallback, useEffect, useMemo, useState } from "react";
import { Power, RefreshCw, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CraneMark } from "../shared/brand";
import { isSafeFillMatch, matchFields } from "../shared/fieldMatching";
import { getProfile, getThemeMode, saveProfile } from "../shared/storage";
import { applyThemeMode } from "../shared/theme";
import type { DetectedField, DetectedUploadField, FieldMatch, FillResult, FolioProfile, ProfileDocument } from "../shared/types";

type ScanState = "idle" | "scanning" | "ready";

const SCANNING_MESSAGES = [
  "Reading the page geometry...",
  "Mapping fields into a tiny constellation...",
  "Checking labels, placeholders, and intent...",
  "Finding the safest places to write..."
];

const READY_MESSAGES = [
  "I found a clean path through this form.",
  "This page has a few fields Folio can handle.",
  "Matches are lined up and ready when you are.",
  "Folio found autofillable fields on this page."
];

const EMPTY_MESSAGES = [
  "Nothing to fill here. Folio checked the obvious paths.",
  "No safe matches on this page yet. Keeping the pen capped.",
  "Nothing to fill. This page is quiet for now.",
  "No confident fields found here. Folio is standing down."
];

const FILL_BUTTON_MESSAGES = [
  "Fill matched fields",
  "Compose the boring bits",
  "Let Folio do the typing",
  "Thread the form",
  "Send the blue spark"
];

const COUNTRY_ALIASES: Record<string, string[]> = {
  "united states": ["US", "USA", "United States of America", "America"],
  "united states of america": ["US", "USA", "United States", "America"],
  usa: ["US", "United States", "United States of America"],
  us: ["USA", "United States", "United States of America"],
  "united kingdom": ["UK", "GB", "Great Britain", "Britain"],
  uk: ["United Kingdom", "GB", "Great Britain"],
  canada: ["CA"],
  morocco: ["MA", "Maroc"],
  france: ["FR"],
  germany: ["DE"],
  spain: ["ES"],
  italy: ["IT"],
  netherlands: ["NL"],
  australia: ["AU"],
  india: ["IN"],
  brazil: ["BR"]
};

export function Popup() {
  const [profile, setProfile] = useState<FolioProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [uploadFields, setUploadFields] = useState<DetectedUploadField[]>([]);
  const [matches, setMatches] = useState<FieldMatch[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumeTagFilter, setResumeTagFilter] = useState("");
  const [status, setStatus] = useState("");
  const [siteSeed, setSiteSeed] = useState(0);
  const [messageSeed] = useState(() => Date.now());

  const isEnabled = profile?.preferences.enabled ?? true;
  const fillableMatches = useMemo(() => matches.filter(isSafeFillMatch), [matches]);
  const resumeDocuments = useMemo(
    () => (profile?.documents ?? []).filter((document) => document.type === "resume" && document.content && document.fileName),
    [profile?.documents]
  );
  const resumeTags = useMemo(() => getDocumentTags(resumeDocuments), [resumeDocuments]);
  const filteredResumeDocuments = useMemo(
    () => (resumeTagFilter ? resumeDocuments.filter((document) => document.tags.includes(resumeTagFilter)) : resumeDocuments),
    [resumeDocuments, resumeTagFilter]
  );
  const selectedResume = useMemo(
    () =>
      filteredResumeDocuments.find((document) => document.id === selectedResumeId) ??
      filteredResumeDocuments.find((document) => document.id === profile?.preferences.defaultResumeId) ??
      filteredResumeDocuments[0] ??
      null,
    [filteredResumeDocuments, profile?.preferences.defaultResumeId, selectedResumeId]
  );
  const canFillPage = isEnabled && (fillableMatches.length > 0 || (uploadFields.length > 0 && selectedResume !== null));
  const readyTitle = scanState === "scanning" ? "Scanning page" : canFillPage ? "Ready to fill" : "Nothing to fill";
  const scanSummary =
    scanState === "scanning"
      ? pickMessage(SCANNING_MESSAGES, siteSeed + messageSeed)
      : detectedFields.length > 0
        ? `Detected ${detectedFields.length} fields on this page`
        : status || pickMessage(EMPTY_MESSAGES, siteSeed + messageSeed);
  useEffect(() => {
    let removeThemeListener: () => void = () => undefined;
    getThemeMode().then((mode) => {
      removeThemeListener = applyThemeMode(mode);
    });
    return () => removeThemeListener();
  }, []);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    getActiveTab()
      .then((tab) => setSiteSeed(getSiteSeed(tab.url ?? "")))
      .catch(() => setSiteSeed(Date.now()));
  }, []);

  useEffect(() => {
    if (selectedResumeId && filteredResumeDocuments.some((document) => document.id === selectedResumeId)) {
      return;
    }

    setSelectedResumeId(
      filteredResumeDocuments.find((document) => document.id === profile?.preferences.defaultResumeId)?.id ?? filteredResumeDocuments[0]?.id ?? ""
    );
  }, [filteredResumeDocuments, profile?.preferences.defaultResumeId, selectedResumeId]);

  const scanPage = useCallback(async () => {
    if (!profile || !profile.preferences.enabled) {
      setDetectedFields([]);
      setUploadFields([]);
      setMatches([]);
      setScanState("ready");
      setStatus("Folio is off.");
      return;
    }

    setScanState("scanning");
    setStatus("");

    try {
      const [response, uploadResponse] = (await Promise.all([
        sendTabMessage({ action: "SCAN_FIELDS" }, true),
        sendTabMessage({ action: "SCAN_RESUME_UPLOADS" }, true)
      ])) as [{ fields?: DetectedField[] }, { fields?: DetectedUploadField[] }];
      const fields = response.fields ?? [];
      const uploads = uploadResponse.fields ?? [];
      const nextMatches = matchFields(fields, profile);
      const nextFillableMatches = nextMatches.filter(isSafeFillMatch);
      setDetectedFields(fields);
      setUploadFields(uploads);
      setMatches(nextMatches);
      setScanState("ready");
      setStatus(nextFillableMatches.length === 0 && uploads.length === 0 ? pickMessage(EMPTY_MESSAGES, siteSeed) : pickMessage(READY_MESSAGES, siteSeed));
    } catch (error) {
      setDetectedFields([]);
      setUploadFields([]);
      setMatches([]);
      setScanState("ready");
      setStatus(pickMessage(EMPTY_MESSAGES, siteSeed));
    }
  }, [profile, siteSeed]);

  useEffect(() => {
    if (!loadingProfile && profile && profile.preferences.enabled && scanState === "idle") {
      void scanPage();
    }
  }, [loadingProfile, profile, scanPage, scanState]);

  async function fillFields() {
    if (!profile?.preferences.enabled) {
      setStatus("Folio is off.");
      return;
    }

    const safeMatches = fillableMatches.map((match) => ({
      fieldIndex: match.field.index,
      value: match.value,
      alternatives: getDropdownAlternatives(match, profile)
    }));

    if (safeMatches.length === 0 && (uploadFields.length === 0 || !selectedResume)) {
      setStatus(pickMessage(EMPTY_MESSAGES, siteSeed + messageSeed));
      return;
    }

    try {
      const fieldResult =
        safeMatches.length > 0
          ? ((await sendTabMessage({
              action: "FILL_FIELDS",
              matches: safeMatches,
              overwriteExisting
            }, true)) as FillResult)
          : { filledCount: 0, skippedCount: 0 };
      const resumeResult =
        selectedResume && uploadFields.length > 0
          ? await attachResume(selectedResume)
          : { filledCount: 0, skippedCount: 0 };
      const totalFilled = fieldResult.filledCount + resumeResult.filledCount;
      if (totalFilled > 0 && profile) {
        const host = await getActiveTabHostname();
        const nextProfile: FolioProfile = {
          ...profile,
          metrics: {
            ...profile.metrics,
            totalFormsFilled: profile.metrics.totalFormsFilled + 1,
            totalFieldsFilled: profile.metrics.totalFieldsFilled + totalFilled,
            lastAutofillAt: new Date().toISOString()
          },
          preferences: {
            ...profile.preferences,
            learnedSiteHosts: host ? Array.from(new Set([...profile.preferences.learnedSiteHosts, host])) : profile.preferences.learnedSiteHosts
          }
        };
        setProfile(nextProfile);
        await saveProfile(nextProfile);
      }
      const resumeMessage = resumeResult.filledCount > 0 ? ` Attached ${selectedResume?.fileName || selectedResume?.name}.` : "";
      setStatus(`Filled ${totalFilled} item${totalFilled === 1 ? "" : "s"}.${resumeMessage}`);
    } catch (error) {
      setStatus(pickMessage(EMPTY_MESSAGES, siteSeed + messageSeed));
    }
  }

  async function attachResume(resume: ProfileDocument): Promise<FillResult> {
    return (await sendTabMessage({
      action: "FILL_RESUME_UPLOAD",
      fieldIndex: uploadFields[0].index,
      fileName: resume.fileName || resume.name || "resume.txt",
      mimeType: resume.mimeType,
      content: resume.content,
      contentKind: resume.contentKind
    }, true)) as FillResult;
  }

  async function toggleExtension(enabled: boolean) {
    if (!profile) {
      return;
    }

    const nextProfile: FolioProfile = {
      ...profile,
      preferences: {
        ...profile.preferences,
        enabled
      }
    };
    setProfile(nextProfile);
    await saveProfile(nextProfile);

    if (!enabled) {
      setDetectedFields([]);
      setUploadFields([]);
      setMatches([]);
      setScanState("ready");
      setStatus("Folio is off.");
      return;
    }

    setScanState("idle");
    setStatus("");
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  async function refreshPageScan() {
    if (scanState === "scanning") {
      return;
    }

    try {
      const tab = await getActiveTab();
      setSiteSeed(getSiteSeed(tab.url ?? ""));
    } catch {
      setSiteSeed(Date.now());
    }

    await scanPage();
  }

  if (loadingProfile) {
    return (
      <main className="popup-shell">
        <section className="popup-panel popup-loading">
          <CraneMark className="popup-mark" />
          <p>Loading Folio...</p>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="popup-shell">
        <section className="popup-panel welcome-card">
            <CraneMark className="popup-mark hero" />
            <span className="popup-eyebrow">Welcome to Folio</span>
            <h1>Customize once. Apply everywhere.</h1>
            <p>Create your local profile before autofilling applications.</p>
            <Button onClick={openOptions}>
              <Settings size={16} />
              Open profile setup
            </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="popup-shell">
      <section className="popup-panel">
      <header className="popup-header">
        <div className="popup-brand">
          <CraneMark className="popup-mark" />
          <h1>Folio</h1>
        </div>
        <div className="popup-header-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="popup-icon-button"
            onClick={() => void refreshPageScan()}
            disabled={!isEnabled || scanState === "scanning"}
            aria-label="Refresh scan"
            title="Refresh scan"
          >
            <RefreshCw size={14} className={scanState === "scanning" ? "popup-refresh-icon is-spinning" : "popup-refresh-icon"} />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" className="popup-icon-button" onClick={openOptions} aria-label="Open settings" title="Open settings">
            <Settings size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={isEnabled ? "popup-icon-button popup-power-button is-on" : "popup-icon-button popup-power-button is-off"}
            onClick={() => void toggleExtension(!isEnabled)}
            aria-label={isEnabled ? "Turn Folio off" : "Turn Folio on"}
            title={isEnabled ? "Turn Folio off" : "Turn Folio on"}
          >
            <Power size={14} />
          </Button>
        </div>
      </header>

      {!isEnabled ? (
        <div className="popup-off-state">
          <div className="popup-off-icon">
            <Power size={19} />
          </div>
          <div>
            <strong>Folio is off</strong>
            <p>Turn it on when you want Folio to scan this page and fill forms only when you ask.</p>
          </div>
          <Button type="button" size="sm" className="popup-off-button" onClick={() => void toggleExtension(true)}>
            <Power size={14} />
            Turn Folio on
          </Button>
        </div>
      ) : (
        <>

      <div className={canFillPage ? "popup-fill-state" : "popup-fill-state is-empty"}>
      <div className="popup-status">
        <span className={isEnabled && canFillPage ? "status-dot ready" : "status-dot"} />
        <strong>{readyTitle}</strong>
      </div>
      <p className="popup-description">
        {scanSummary.includes(String(detectedFields.length)) && detectedFields.length > 0 ? (
          <>
            Detected <span>{detectedFields.length}</span> fields on this page
          </>
        ) : (
          scanSummary
        )}
      </p>

          {uploadFields.length > 0 && (
            <div className="resume-upload-panel">
              <div>
                <Label htmlFor="resume-upload-select">Resume upload</Label>
                <p>{resumeDocuments.length > 0 ? "Choose which saved CV Folio should attach." : "Add resumes in My files to use this upload path."}</p>
              </div>
              {resumeTags.length > 0 && (
                <div className="resume-tag-filter" aria-label="Filter resumes by tag">
                  <Button type="button" variant="outline" size="xs" className={!resumeTagFilter ? "is-active" : ""} onClick={() => setResumeTagFilter("")}>
                    All
                  </Button>
                  {resumeTags.map((tag) => (
                    <Button key={tag} type="button" variant="outline" size="xs" className={resumeTagFilter === tag ? "is-active" : ""} onClick={() => setResumeTagFilter(tag)}>
                      {tag}
                    </Button>
                  ))}
                </div>
              )}
              <div className="resume-upload-controls">
                <Select value={selectedResume?.id} onValueChange={setSelectedResumeId} disabled={filteredResumeDocuments.length === 0}>
                  <SelectTrigger id="resume-upload-select" size="sm" className="resume-select-trigger">
                    <SelectValue placeholder="No saved resumes" />
                  </SelectTrigger>
                  {filteredResumeDocuments.length > 0 && (
                    <SelectContent className="resume-select-content">
                      <SelectGroup>
                        {filteredResumeDocuments.map((document) => (
                          <SelectItem key={document.id} value={document.id}>
                            {getResumeLabel(document)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  )}
                </Select>
              </div>
            </div>
          )}

          <div className="popup-actions">
            <Button className="ai-fill-button" onClick={fillFields} disabled={!canFillPage}>
              <span className="ai-fill-icon">
                <Zap size={16} />
              </span>
              <span>{pickMessage(FILL_BUTTON_MESSAGES, messageSeed)}</span>
            </Button>
          </div>
      </div>
        </>
      )}
      </section>
    </main>
  );
}

async function sendTabMessage(message: unknown, injectContentScript = false): Promise<unknown> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  if (injectContentScript) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/contentScript.js"]
    });
  }

  return chrome.tabs.sendMessage(tab.id, message);
}

async function getActiveTab(): Promise<ChromeTab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getSiteSeed(url: string): number {
  try {
    return Array.from(new URL(url).hostname).reduce((total, character) => total + character.charCodeAt(0), 0);
  } catch {
    return Date.now();
  }
}

async function getActiveTabHostname(): Promise<string> {
  const tab = await getActiveTab();
  if (!tab.url) {
    return "";
  }

  try {
    return new URL(tab.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pickMessage(messages: string[], seed: number): string {
  return messages[Math.abs(seed) % messages.length];
}

function getDropdownAlternatives(match: FieldMatch, profile: FolioProfile | null): string[] | undefined {
  if (!profile) {
    return undefined;
  }

  if (match.profilePath === "personal.country") {
    return [...profile.preferences.countryAliases, ...getCommonCountryAliases(match.value)];
  }

  if (match.profilePath === "personal.city") {
    return profile.preferences.cityAliases;
  }

  return undefined;
}

function getCommonCountryAliases(value: string): string[] {
  return COUNTRY_ALIASES[value.toLowerCase().trim()] ?? [];
}

function getResumeLabel(document: ProfileDocument): string {
  return document.name || document.fileName || "Resume";
}

function getDocumentTags(documents: ProfileDocument[]): string[] {
  return Array.from(new Set(documents.flatMap((document) => document.tags))).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
