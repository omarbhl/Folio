import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, FileText, LoaderCircle, Power, RefreshCw, Search, Settings, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
  const hasResumeUpload = isEnabled && uploadFields.length > 0;

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
      <PopupLayout className="bg-background text-foreground">
        <section className="relative grid h-[590px] place-content-center justify-items-center gap-3.5 overflow-hidden p-[18px_18px_16px] text-center [background-image:linear-gradient(to_bottom,color-mix(in_srgb,var(--background)_22%,transparent),color-mix(in_srgb,var(--background)_58%,transparent)),url('/assets/folio-space-background.png')] bg-[length:100%_100%]">
          <FolioMark className="size-8.5 rounded-[10px]" />
          <p className="m-0 max-w-[260px] text-xs leading-6 text-muted-foreground">Loading Folio...</p>
        </section>
      </PopupLayout>
    );
  }

  if (!profile) {
    return (
      <PopupLayout className="bg-background text-foreground">
        <section className="relative grid h-[590px] place-content-center justify-items-center gap-3.5 overflow-hidden p-[18px_18px_16px] text-center [background-image:linear-gradient(to_bottom,color-mix(in_srgb,var(--background)_22%,transparent),color-mix(in_srgb,var(--background)_58%,transparent)),url('/assets/folio-space-background.png')] bg-[length:100%_100%]">
          <FolioMark className="size-[60px] rounded-[10px]" />
          <span className="text-[11px] font-bold tracking-[0.12em] text-brand-violet uppercase">Welcome to Folio</span>
          <h1 className="m-0 text-2xl tracking-[-0.04em]">Customize once. Apply everywhere.</h1>
          <p className="m-0 max-w-[260px] text-xs leading-6 text-muted-foreground">Create a local profile once, then use Folio only when you click it.</p>
          <div className="grid gap-[7px] text-left">
            <span className="flex items-center gap-[7px] text-[11px] text-muted-foreground">
              <CheckCircle2 size={14} className="text-success" />
              Add contact details
            </span>
            <span className="flex items-center gap-[7px] text-[11px] text-muted-foreground">
              <FileText size={14} className="text-success" />
              Upload resume
            </span>
            <span className="flex items-center gap-[7px] text-[11px] text-muted-foreground">
              <ShieldCheck size={14} className="text-success" />
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
    <PopupLayout className="bg-background text-foreground">
      <section className="relative isolate flex h-[590px] flex-col overflow-hidden p-[18px_18px_16px]">
        {/* Space Background */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[length:100%_100%] [background-image:linear-gradient(to_bottom,color-mix(in_srgb,var(--background)_16%,transparent),color-mix(in_srgb,var(--background)_56%,transparent)),url('/assets/folio-space-background.png')]"
          aria-hidden="true"
        />

        {/* Header */}
        <header className="relative z-10 flex h-[42px] shrink-0 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolioMark className="size-8.5 rounded-[10px]" />
            <h1 className="m-0 text-[22px] font-[720] tracking-[-0.04em]">Folio</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <HeaderIconButton
              onClick={() => void refreshPageScan()}
              disabled={!isEnabled || scanState === "scanning"}
              label="Refresh page scan"
            >
              <RefreshCw className={scanState === "scanning" ? "animate-[popup-spin_700ms_linear_infinite]" : ""} size={17} />
            </HeaderIconButton>
            <HeaderIconButton onClick={openOptions} label="Open settings">
              <Settings size={17} />
            </HeaderIconButton>
            <HeaderIconButton
              onClick={() => void toggleExtension(!isEnabled)}
              label={isEnabled ? "Turn Folio off" : "Turn Folio on"}
              className={cn(
                isEnabled
                  ? "!border-success !text-success !shadow-[inset_0_0_16px_color-mix(in_srgb,var(--success)_8%,transparent),0_0_14px_color-mix(in_srgb,var(--success)_12%,transparent)]"
                  : "!border-[color-mix(in_srgb,var(--destructive)_55%,var(--border))] !text-destructive"
              )}
            >
              <Power size={17} />
            </HeaderIconButton>
          </div>
        </header>

        {/* Main Content */}
        <div
          key={isEnabled ? "folio-on" : "folio-off"}
          className="relative flex flex-1 flex-col gap-[9px] min-h-0 animate-[popup-state-enter_var(--motion-slow)_var(--ease-emphasized)_both]"
        >
          {isEnabled ? (
            <>
              {/* ON Hero */}
            {/* ON Hero */}
<section
  className={cn(
    "relative shrink-0 flex items-center overflow-visible gap-4",
    hasResumeUpload ? "h-[130px]" : "h-[140px]"
  )}
  aria-labelledby="folio-state-title"
>
  {/* Mascot */}
  <div className={cn(
    "relative flex items-center justify-center flex-none",
    hasResumeUpload ? "w-[42%]" : "w-auto pl-2"
  )}>
    <div
      className={cn(
        "absolute -z-10 bg-[radial-gradient(circle,color-mix(in_srgb,var(--brand-violet)_34%,transparent),transparent_68%)] blur-[12px]",
        hasResumeUpload ? "inset-[10%_0_10%_-10%]" : "h-[120px] w-[120px]"
      )}
    />
    <img
      className={cn(
        "relative max-w-none object-contain -rotate-2",
        hasResumeUpload ? "h-[120px] w-auto" : "h-[130px] w-auto"
      )}
      src="/assets/folio-mascot.png"
      alt=""
    />
  </div>

  {/* Text */}
  <div className="flex flex-col justify-center min-w-0">
    <div className="flex min-h-8.5 w-fit items-center gap-2 rounded-full border border-success bg-[color-mix(in_srgb,var(--card)_72%,transparent)] px-3.5 text-xs whitespace-nowrap">
      <span className="size-[7px] rounded-full bg-success shadow-[0_0_10px_color-mix(in_srgb,var(--success)_70%,transparent)]" />
      <span>
        Folio is <strong className="text-success">ON</strong>
      </span>
    </div>
    <h2 id="folio-state-title" className="m-0 mt-3 text-[25px] leading-[1.05] font-[720] tracking-[-0.045em] whitespace-nowrap">
      Folio is <span className="text-success">active</span>
    </h2>
    <p className="m-0 mt-1 text-xs leading-4.5 text-muted-foreground">
      Folio checks this page and fills only when you choose.
    </p>
  </div>
</section>

              {/* Controls */}
              <div className="flex flex-1 flex-col gap-[9px] min-h-0 overflow-hidden">
                {/* Scan Card */}
                <button
                  type="button"
                  className="flex min-h-[72px] w-full shrink-0 items-center gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--border)_76%,transparent)] bg-[color-mix(in_srgb,var(--card)_78%,transparent)] px-3.5 py-2.5 text-left text-inherit shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent),0_10px_24px_color-mix(in_srgb,var(--background)_52%,transparent)] [transition:border-color_var(--motion-base)_var(--ease-standard),background-color_var(--motion-base)_var(--ease-standard),transform_var(--motion-fast)_var(--ease-standard)] hover:not-disabled:bg-[color-mix(in_srgb,var(--accent)_70%,transparent)] hover:not-disabled:border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] active:not-disabled:scale-[0.99] disabled:cursor-default disabled:opacity-100"
                  onClick={() => void refreshPageScan()}
                  disabled={!isEnabled || scanState === "scanning"}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--brand-violet)_30%,var(--border))] bg-[color-mix(in_srgb,var(--brand-violet)_10%,var(--card))] text-brand-violet [&_svg]:size-[21px]">
                    {scanState === "scanning" ? (
                      <LoaderCircle className="animate-[popup-spin_700ms_linear_infinite]" />
                    ) : canFillPage ? (
                      <CheckCircle2 />
                    ) : (
                      <Search />
                    )}
                  </span>
                  <span className="block min-w-0 flex-1">
                    <strong className="block text-[13px] font-bold text-foreground">
                      {scanState === "scanning"
                        ? "Checking this page"
                        : canFillPage
                          ? `${fillableMatches.length + uploadFields.length} item${fillableMatches.length + uploadFields.length === 1 ? "" : "s"} ready`
                          : "No fillable form found"}
                    </strong>
                    <small className="mt-1 line-clamp-2 block text-[11px] leading-[1.45] text-muted-foreground">
                      {!isEnabled
                        ? "Folio cannot inspect this browser page. Try a regular website tab."
                        : scanState === "scanning"
                          ? "Looking for safe field matches…"
                          : canFillPage
                            ? `${detectedFields.length} fields detected on this page.`
                            : status || "Open a regular website tab and refresh."}
                    </small>
                  </span>
                  <ChevronRight className="size-[19px] shrink-0 text-brand-violet" />
                </button>

                {/* Resume Upload */}
                {uploadFields.length > 0 && (
                  <div className="flex w-full flex-col gap-2 rounded-[14px] border border-[color-mix(in_srgb,var(--border)_76%,transparent)] bg-[color-mix(in_srgb,var(--card)_78%,transparent)] px-3.5 py-3 text-left shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent),0_10px_24px_color-mix(in_srgb,var(--background)_52%,transparent)]">
                    <div>
                      <Label htmlFor="resume-upload-select" className="text-xs">
                        Resume upload
                      </Label>
                      <p className="mt-[3px] text-[10px] leading-[1.4] text-muted-foreground">
                        {resumeDocuments.length > 0 ? "Choose which saved CV Folio should attach." : "Add resumes in My files to use this upload path."}
                      </p>
                    </div>
                    {resumeTags.length > 0 && (
                      <div className="flex flex-wrap gap-[5px]" aria-label="Filter resumes by tag">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className={cn("rounded-full text-[10px]", !resumeTagFilter && "border-primary text-primary")}
                          onClick={() => setResumeTagFilter("")}
                        >
                          All
                        </Button>
                        {resumeTags.map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            variant="outline"
                            size="xs"
                            className={cn("rounded-full text-[10px]", resumeTagFilter === tag && "border-primary text-primary")}
                            onClick={() => setResumeTagFilter(tag)}
                          >
                            {tag}
                          </Button>
                        ))}
                      </div>
                    )}
                    <Select value={selectedResume?.id ?? ""} onValueChange={setSelectedResumeId} disabled={filteredResumeDocuments.length === 0}>
                      <SelectTrigger id="resume-upload-select" size="sm" className="w-full bg-background">
                        <SelectValue placeholder="No saved resumes" />
                      </SelectTrigger>
                      {filteredResumeDocuments.length > 0 && (
                        <SelectContent className="max-w-[320px]">
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
                )}

                {/* Overwrite Switch */}
                <div className="flex min-h-[72px] w-full shrink-0 items-center gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--border)_76%,transparent)] bg-[color-mix(in_srgb,var(--card)_78%,transparent)] px-3.5 py-2.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent),0_10px_24px_color-mix(in_srgb,var(--background)_52%,transparent)] [&_[data-slot=switch]]:size-auto [&_[data-slot=switch]]:h-6 [&_[data-slot=switch]]:w-[42px] [&_[data-slot=switch]]:shrink-0 [&_[data-slot=switch]]:border-border [&_[data-slot=switch]]:bg-input [&_[data-slot=switch][data-state=checked]]:bg-success [&_[data-slot=switch-thumb]]:size-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--brand-violet)_30%,var(--border))] bg-[color-mix(in_srgb,var(--brand-violet)_10%,var(--card))] text-brand-violet [&_svg]:size-[21px]">
                    <ShieldCheck />
                  </span>
                  <label htmlFor="overwrite-existing" className="block min-w-0 flex-1">
                    <strong className="block text-[13px] font-bold text-foreground">Replace existing answers</strong>
                    <small className="mt-1 line-clamp-2 block text-[11px] leading-[1.45] text-muted-foreground">
                      Leave off to protect fields that already contain text.
                    </small>
                  </label>
                  <Switch id="overwrite-existing" checked={overwriteExisting} onCheckedChange={setOverwriteExisting} aria-label="Replace existing answers" />
                </div>

                {/* Spacer */}
                <div className="flex-1 min-h-0" />
              </div>
            </>
          ) : (
            /* OFF Hero — fills available space and centers */
            <div className="flex flex-1 flex-col items-center justify-center gap-5">
              <div className="relative flex h-[240px] w-full items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-[180px] w-[180px] bg-[radial-gradient(circle,color-mix(in_srgb,var(--brand-violet)_34%,transparent),transparent_68%)] blur-[16px]" />
                </div>
                <img
                  className="relative h-full w-auto object-contain"
                  src="/assets/folio-mascot-sleeping.png"
                  alt=""
                />
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex min-h-8.5 items-center gap-2 rounded-full border border-destructive bg-[color-mix(in_srgb,var(--card)_72%,transparent)] px-3.5 text-xs whitespace-nowrap">
                  <span className="size-[7px] rounded-full bg-destructive shadow-[0_0_10px_color-mix(in_srgb,var(--destructive)_70%,transparent)]" />
                  <span>
                    Folio is <strong className="text-destructive">OFF</strong>
                  </span>
                </div>
                <h2 className="m-0 text-[25px] leading-[1.05] font-[720] tracking-[-0.045em]">
                  Folio is <span className="text-destructive">paused</span>
                </h2>
                <p className="m-0 max-w-[240px] text-xs leading-4.5 text-muted-foreground">
                  Turn Folio on when you want to check this page and fill forms.
                </p>
              </div>
            </div>
          )}

          {/* Fill / Toggle Button (always at bottom) */}
          <div className="shrink-0">
            <Button
              className={cn(
                "motion-press !h-[54px] !w-full !rounded-xl !border !text-base !font-bold !text-foreground [transition:filter_var(--motion-base)_var(--ease-standard)] hover:not-disabled:!filter-[brightness(1.08)_saturate(1.08)] disabled:!opacity-[0.72] disabled:!filter-[saturate(0.72)]",
                isEnabled
                  ? "!border-[color-mix(in_srgb,var(--primary)_62%,var(--border))] !bg-[linear-gradient(135deg,var(--brand-violet),color-mix(in_srgb,var(--primary)_72%,var(--brand-violet)))] !shadow-[0_10px_24px_color-mix(in_srgb,var(--brand-violet)_28%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--foreground)_22%,transparent)]"
                  : "!border-[color-mix(in_srgb,var(--destructive)_72%,var(--border))] !bg-[linear-gradient(135deg,var(--destructive),color-mix(in_srgb,var(--destructive)_62%,var(--brand-violet)))] !shadow-[0_10px_24px_color-mix(in_srgb,var(--destructive)_24%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--foreground)_22%,transparent)]"
              )}
              onClick={isEnabled ? fillFields : () => void toggleExtension(true)}
              disabled={isEnabled && (!canFillPage || fillState === "filling")}
            >
              <span className="inline-flex items-center gap-2">
                {!isEnabled ? (
                  <Power size={20} />
                ) : fillState === "filling" ? (
                  <LoaderCircle className="animate-[popup-spin_700ms_linear_infinite]" size={20} />
                ) : fillState === "success" ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <Zap size={20} />
                )}
                <span>
                  {!isEnabled
                    ? "Turn Folio on"
                    : fillState === "filling"
                      ? "Filling fields…"
                      : fillState === "success"
                        ? "Filled successfully"
                        : "Fill matched fields"}
                </span>
              </span>
            </Button>
          </div>

          {/* Error Message */}
          {fillState === "error" && (
            <div
              className="flex w-full shrink-0 items-center gap-2 rounded-[10px] border border-[color-mix(in_srgb,var(--destructive)_30%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-2.5 py-2 text-left text-[11px] leading-[1.4] text-destructive"
              role="alert"
            >
              <AlertCircle size={15} />
              <span>{status}</span>
            </div>
          )}
        </div>
      </section>
    </PopupLayout>
  );
}

/* ------------------------------------------------------------------ */
// Helper component for header icon buttons
function HeaderIconButton({
  children,
  onClick,
  disabled,
  label,
  className
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "!size-8.5 !rounded-full !border-border !bg-[color-mix(in_srgb,var(--card)_42%,transparent)] !p-0 !text-muted-foreground [transition:color_var(--motion-base)_var(--ease-standard),background-color_var(--motion-base)_var(--ease-standard),border-color_var(--motion-base)_var(--ease-standard),transform_var(--motion-fast)_var(--ease-standard)] hover:!bg-accent hover:!text-foreground active:not-disabled:scale-[0.94] [&_svg]:!size-[17px]",
        className
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
// Utilities

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
  return Array.from(new Set(documents.flatMap((document) => document.tags)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}