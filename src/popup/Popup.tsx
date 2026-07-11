import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, FileText, LoaderCircle, Power, RefreshCw, Search, Settings, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { PopupLayout } from "@/layouts/popup-layout";
import { addProfileActivity } from "../shared/activity";
import { FolioMark } from "../shared/brand";
import { isSafeFillMatch, matchFields } from "../shared/fieldMatching";
import { getProfile, getThemeMode, saveProfile } from "../shared/storage";
import { applyThemeMode } from "../shared/theme";
import type { DetectedField, DetectedUploadField, FieldMatch, FillResult, FolioProfile, ProfileDocument } from "../shared/types";

type ScanState = "idle" | "scanning" | "ready";
type FillState = "idle" | "filling" | "success" | "error";

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
  const [fillState, setFillState] = useState<FillState>("idle");

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
    setFillState("idle");
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
      setStatus("Folio cannot inspect this browser page. Try a regular website tab.");
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
      setFillState("filling");
      setStatus("Filling confident matches…");
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
        const now = new Date().toISOString();
        let nextProfile: FolioProfile = {
          ...profile,
          documents: profile.documents.map((document) =>
            resumeResult.filledCount > 0 && selectedResume && document.id === selectedResume.id
              ? { ...document, usageCount: document.usageCount + 1, lastUsedAt: now }
              : document
          ),
          metrics: {
            ...profile.metrics,
            totalFormsFilled: profile.metrics.totalFormsFilled + 1,
            totalFieldsFilled: profile.metrics.totalFieldsFilled + totalFilled,
            lastAutofillAt: now
          },
          preferences: {
            ...profile.preferences
          }
        };
        nextProfile = addProfileActivity(nextProfile, "formFilled", `Autofilled ${totalFilled} item${totalFilled === 1 ? "" : "s"}${host ? ` on ${host}` : ""}`, undefined, now);
        if (resumeResult.filledCount > 0 && selectedResume) {
          nextProfile = addProfileActivity(nextProfile, "documentUsed", `Used document: ${selectedResume.fileName || selectedResume.name}`, selectedResume.id, now);
        }
        setProfile(nextProfile);
        await saveProfile(nextProfile);
      }
      const resumeMessage = resumeResult.filledCount > 0 ? ` Attached ${selectedResume?.fileName || selectedResume?.name}.` : "";
      setStatus(`Filled ${totalFilled} item${totalFilled === 1 ? "" : "s"}.${resumeMessage}`);
      setFillState("success");
    } catch (error) {
      setStatus("Folio could not complete this fill. Your saved profile was not changed.");
      setFillState("error");
      toast.error("Fill could not be completed");
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
      <PopupLayout className="popup-shell">
        <section className="popup-panel popup-loading">
          <FolioMark className="popup-mark" />
          <p>Loading Folio...</p>
        </section>
      </PopupLayout>
    );
  }

  if (!profile) {
    return (
      <PopupLayout className="popup-shell">
        <section className="popup-panel welcome-card">
            <FolioMark className="popup-mark hero" />
            <span className="popup-eyebrow">Welcome to Folio</span>
            <h1>Customize once. Apply everywhere.</h1>
            <p>Create a local profile once, then use Folio only when you click it.</p>
            <div className="welcome-steps" aria-label="Setup steps">
              <span>
                <CheckCircle2 size={14} />
                Add contact details
              </span>
              <span>
                <FileText size={14} />
                Upload resume
              </span>
              <span>
                <ShieldCheck size={14} />
                Data stays local
              </span>
            </div>
            <Button onClick={openOptions}>
              <Settings size={16} />
              Start setup
            </Button>
        </section>
      </PopupLayout>
    );
  }

  return (
    <PopupLayout className="popup-shell">
      <section className="popup-panel">
      <div className="popup-space-background" aria-hidden="true" />
      <header className="popup-header">
        <div className="popup-brand">
          <FolioMark className="popup-mark" />
          <h1>Folio</h1>
        </div>
        <div className="popup-header-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="popup-icon-button"
            onClick={() => void refreshPageScan()}
            disabled={!isEnabled || scanState === "scanning"}
            aria-label="Refresh page scan"
            title="Refresh page scan"
          >
            <RefreshCw className={scanState === "scanning" ? "popup-refresh-icon is-spinning" : "popup-refresh-icon"} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="popup-icon-button" onClick={openOptions} aria-label="Open settings" title="Open settings">
            <Settings />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={isEnabled ? "popup-icon-button popup-power-button is-on" : "popup-icon-button popup-power-button is-off"}
            onClick={() => void toggleExtension(!isEnabled)}
            aria-label={isEnabled ? "Turn Folio off" : "Turn Folio on"}
            aria-pressed={isEnabled}
            title={isEnabled ? "Turn Folio off" : "Turn Folio on"}
          >
            <Power />
          </Button>
        </div>
      </header>

      <div key={isEnabled ? "folio-on" : "folio-off"} className={isEnabled ? "popup-state-view is-on" : "popup-state-view is-off"}>
        <section className="popup-hero" aria-labelledby="folio-state-title">
          <div className="popup-mascot-stage" aria-hidden="true">
            <img
              className={isEnabled ? "" : "is-sleeping"}
              src={isEnabled ? "/assets/folio-mascot.png" : "/assets/folio-mascot-sleeping.png"}
              alt=""
            />
          </div>
          <div className="popup-state-copy">
            <div className="popup-active-pill">
              <span className="popup-active-dot" />
              <span>Folio is <strong>{isEnabled ? "ON" : "OFF"}</strong></span>
            </div>
            <h2 id="folio-state-title">Folio is <span>{isEnabled ? "active" : "paused"}</span></h2>
            <p>{isEnabled ? "Folio checks this page and fills only when you choose." : "Turn Folio on when you want to check this page and fill forms."}</p>
          </div>
        </section>

        {isEnabled && <>
        <button
          type="button"
          className="popup-detection-card"
          onClick={() => void refreshPageScan()}
          disabled={!isEnabled || scanState === "scanning"}
          aria-live="polite"
        >
          <span className="popup-card-icon">
            {scanState === "scanning" ? <LoaderCircle className="popup-spin" /> : canFillPage ? <CheckCircle2 /> : <Search />}
          </span>
          <span className="popup-card-copy">
            <strong>{scanState === "scanning" ? "Checking this page" : canFillPage ? `${fillableMatches.length + uploadFields.length} item${fillableMatches.length + uploadFields.length === 1 ? "" : "s"} ready` : "No fillable form found"}</strong>
            <small>{!isEnabled ? "Folio cannot inspect this browser page. Try a regular website tab." : scanState === "scanning" ? "Looking for safe field matches…" : canFillPage ? `${detectedFields.length} fields detected on this page.` : status || "Open a regular website tab and refresh."}</small>
          </span>
          <ChevronRight className="popup-card-chevron" />
        </button>

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
                <Select value={selectedResume?.id ?? ""} onValueChange={setSelectedResumeId} disabled={filteredResumeDocuments.length === 0}>
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

          <div className="popup-overwrite-control">
            <span className="popup-card-icon"><ShieldCheck /></span>
            <label htmlFor="overwrite-existing" className="popup-card-copy">
              <strong>Replace existing answers</strong>
              <small>Leave off to protect fields that already contain text.</small>
            </label>
            <Switch id="overwrite-existing" checked={overwriteExisting} onCheckedChange={setOverwriteExisting} aria-label="Replace existing answers" />
          </div>
        </>}

          <div className="popup-actions">
            <Button
              className={isEnabled ? "ai-fill-button motion-press" : "ai-fill-button is-power-on motion-press"}
              onClick={isEnabled ? fillFields : () => void toggleExtension(true)}
              disabled={isEnabled && (!canFillPage || fillState === "filling")}
            >
              <span className="ai-fill-icon">
                {!isEnabled ? <Power size={20} /> : fillState === "filling" ? <LoaderCircle className="popup-spin" size={20} /> : fillState === "success" ? <CheckCircle2 size={20} /> : <Zap size={20} />}
              </span>
              <span>{!isEnabled ? "Turn Folio on" : fillState === "filling" ? "Filling fields…" : fillState === "success" ? "Filled successfully" : "Fill matched fields"}</span>
            </Button>
          </div>

          {fillState === "error" && (
            <div className="popup-inline-feedback is-error" role="alert">
              <AlertCircle size={15} />
              <span>{status}</span>
            </div>
          )}
        </div>

      <footer className={isEnabled ? "popup-privacy is-on" : "popup-privacy"}>
        <ShieldCheck />
        <span>Your data stays local and private.</span>
      </footer>
      </section>
      <Toaster position="bottom-center" closeButton={false} visibleToasts={1} />
    </PopupLayout>
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
