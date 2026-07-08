import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FileDown,
  FilePlus2,
  FileText,
  Github,
  GraduationCap,
  Laptop,
  LayoutDashboard,
  Moon,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  Upload,
  UserRound,
  X,
  Zap,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { addProfileActivity } from "../shared/activity";
import { CraneMark } from "../shared/brand";
import { defaultProfile } from "../shared/defaultProfile";
import {
  exportProfile,
  getProfile,
  getThemeMode,
  hasProfile,
  importProfile,
  saveProfile,
  saveThemeMode
} from "../shared/storage";
import { applyThemeMode } from "../shared/theme";
import type { EducationEntry, ExperienceEntry, FolioProfile, PersonalProfile, ProfileDocument, ThemeMode } from "../shared/types";

const personalFields: Array<{ key: keyof PersonalProfile; label: string; type?: string }> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "fullName", label: "Full name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "address", label: "Address" },
  { key: "postalCode", label: "Postal code" },
  { key: "linkedin", label: "LinkedIn", type: "url" },
  { key: "github", label: "GitHub", type: "url" },
  { key: "portfolio", label: "Portfolio", type: "url" }
];

const starterPersonalFields: Array<{ key: keyof PersonalProfile; label: string; type?: string; placeholder?: string }> = [
  { key: "fullName", label: "Full name", placeholder: "Jane Doe" },
  { key: "email", label: "Email", type: "email", placeholder: "jane@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+1 555 0123" },
  { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/in/..." }
];

const emptyEducation: EducationEntry = {
  school: "",
  degree: "",
  fieldOfStudy: "",
  startDate: "",
  endDate: "",
  description: ""
};

const emptyExperience: ExperienceEntry = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: ""
};

type SectionId = "overview" | "personal" | "files" | "skills" | "education" | "experience" | "ai" | "data";

const navItems: Array<{ id: SectionId; label: string; description: string; icon: typeof Sparkles }> = [
  { id: "overview", label: "Analytics", description: "Your profile at a glance, theme, and autofill activity.", icon: LayoutDashboard },
  { id: "personal", label: "Profile", description: "Core contact details Folio can match to application forms.", icon: UserRound },
  { id: "files", label: "Documents", description: "Upload, preview, edit, and manage your resume library.", icon: FileText },
  { id: "skills", label: "Skills", description: "Keep a reusable skill set ready for application platforms.", icon: Tags },
  { id: "education", label: "Education", description: "Add the schools and programs that shaped you.", icon: GraduationCap },
  { id: "experience", label: "Experience", description: "Add the roles you've held and what you did there.", icon: BriefcaseBusiness },
  { id: "ai", label: "AI", description: "A smarter application assistant is coming in a future update.", icon: Sparkles },
  { id: "data", label: "Settings", description: "Import, export, and inspect the Folio profile stored in this browser.", icon: ShieldCheck }
];

const SECONDS_SAVED_PER_FIELD = 8;
const SECONDS_SAVED_PER_FORM_REVIEW = 20;
const GITHUB_REPO_URL = "https://github.com/omarbhl/Folio";
const GITHUB_REPO_API_URL = "https://api.github.com/repos/omarbhl/Folio";

type LocationOption = {
  value: string;
  label: string;
  search?: string;
  isoCode?: string;
};

type LocationDataApi = {
  Country: {
    getAllCountries(): Array<{ name: string; isoCode: string; phonecode?: string }>;
  };
  City: {
    getCitiesOfCountry(countryCode: string): Array<{ name: string }> | undefined;
  };
};

export function OptionsPage() {
  const [profile, setProfile] = useState<FolioProfile>(defaultProfile);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(defaultProfile));
  const [status, setStatus] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [selectedEducationIndex, setSelectedEducationIndex] = useState(0);
  const [selectedExperienceIndex, setSelectedExperienceIndex] = useState(0);
  const [locationData, setLocationData] = useState<LocationDataApi | null>(null);
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [fileTagFilter, setFileTagFilter] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [documentToDelete, setDocumentToDelete] = useState<ProfileDocument | null>(null);
  const [githubStarCount, setGithubStarCount] = useState<number | null>(null);
  const isDirty = JSON.stringify(profile) !== savedSnapshot;
  const estimatedSecondsSaved = profile.metrics.totalFieldsFilled * SECONDS_SAVED_PER_FIELD + profile.metrics.totalFormsFilled * SECONDS_SAVED_PER_FORM_REVIEW;
  const resumeDocuments = useMemo(() => profile.documents.filter((document) => document.type === "resume" && (document.fileName || document.name)), [profile.documents]);
  const resumeTags = useMemo(() => getDocumentTags(resumeDocuments), [resumeDocuments]);
  const filteredResumeDocuments = useMemo(
    () => (fileTagFilter ? resumeDocuments.filter((document) => document.tags.includes(fileTagFilter)) : resumeDocuments),
    [fileTagFilter, resumeDocuments]
  );
  const selectedDocument = useMemo(
    () => filteredResumeDocuments.find((document) => document.id === selectedDocumentId) ?? filteredResumeDocuments[0] ?? null,
    [filteredResumeDocuments, selectedDocumentId]
  );
  const selectedCountry = useMemo(() => countries.find((country) => country.value === profile.personal.country), [countries, profile.personal.country]);
  const cityOptions = useMemo(() => {
    if (!selectedCountry?.isoCode || !locationData) {
      return [];
    }

    const seen = new Set<string>();
    return (locationData.City.getCitiesOfCountry(selectedCountry.isoCode) ?? [])
      .filter((city) => {
        const key = city.name.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((city) => ({
        value: city.name,
        label: city.name,
        search: [city.name, selectedCountry.label].join(" ")
      }));
  }, [locationData, selectedCountry]);

  const profileCompleteness = useMemo(() => {
    const values = Object.values(profile.personal);
    const filled = values.filter((value) => value.trim().length > 0).length;
    return Math.round((filled / values.length) * 100);
  }, [profile.personal]);
  const missingPersonalFields = useMemo(
    () => Object.values(profile.personal).filter((value) => value.trim().length === 0).length,
    [profile.personal]
  );
  const reusableDocuments = useMemo(
    () => profile.documents.filter((document) => document.name.trim().length > 0 || document.fileName.trim().length > 0),
    [profile.documents]
  );
  const isProfileComplete = profileCompleteness >= 100;
  const hasStarterContact = useMemo(() => getStarterContactProgress(profile) >= 100, [profile]);
  const hasUsableResume = useMemo(() => resumeDocuments.some((document) => document.content.trim().length > 0), [resumeDocuments]);
  const onboardingSteps = useMemo(
    () => [
      {
        label: "Add your basics",
        description: "Name, email, and the contact details forms ask for most.",
        complete: hasStarterContact,
        section: "personal" as SectionId,
        icon: UserRound
      },
      {
        label: "Upload a resume",
        description: "Keep the file local so Folio can attach it when requested.",
        complete: hasUsableResume,
        section: "files" as SectionId,
        icon: FilePlus2
      },
      {
        label: "Save your profile",
        description: "Store everything locally before opening the popup.",
        complete: hasSavedProfile,
        section: activeSection,
        icon: Save
      }
    ],
    [activeSection, hasSavedProfile, hasStarterContact, hasUsableResume]
  );
  const onboardingCompleteCount = onboardingSteps.filter((step) => step.complete).length;
  const onboardingProgress = Math.round((onboardingCompleteCount / onboardingSteps.length) * 100);
  const shouldShowOnboarding = onboardingProgress < 100;
  const isFirstRun = hasLoadedProfile && !hasSavedProfile;
  const overviewStats = useMemo(
    () => [
      {
        label: "Applications autofilled",
        value: profile.metrics.totalFormsFilled.toLocaleString(),
        delta: `${profile.metrics.totalFieldsFilled.toLocaleString()} fields filled`,
        icon: FileText
      },
      {
        label: "Hours saved",
        value: formatHoursSaved(estimatedSecondsSaved),
        delta: `${profile.metrics.totalFormsFilled.toLocaleString()} forms processed`,
        icon: Clock3
      },
      {
        label: "Profile completeness",
        value: `${profileCompleteness}%`,
        delta: isProfileComplete ? "Complete" : `${missingPersonalFields} fields left`,
        icon: Zap
      },
      {
        label: "Documents saved",
        value: reusableDocuments.length.toLocaleString(),
        delta: reusableDocuments.length > 0 ? "Ready for uploads" : "Upload a resume",
        icon: FileText
      }
    ],
    [estimatedSecondsSaved, isProfileComplete, missingPersonalFields, profile.metrics.totalFieldsFilled, profile.metrics.totalFormsFilled, profileCompleteness, reusableDocuments.length]
  );
  const overviewCompletionRows = useMemo(
    () => [
      { label: "Profile", value: profileCompleteness, icon: UserRound, section: "personal" as SectionId },
      { label: "Experience", value: getEntriesCompleteness(profile.experience, ["company", "title", "description"]), icon: BriefcaseBusiness, section: "experience" as SectionId },
      { label: "Education", value: getEntriesCompleteness(profile.education, ["school", "degree", "fieldOfStudy"]), icon: GraduationCap, section: "education" as SectionId },
      { label: "Skills", value: clampPercent(profile.skills.length * 18), icon: Tags, section: "skills" as SectionId },
      { label: "Documents", value: clampPercent(reusableDocuments.length * 45), icon: FileText, section: "files" as SectionId },
      { label: "AI", value: 0, icon: Sparkles, section: "ai" as SectionId },
      { label: "Autofill privacy", value: profile.preferences.enabled ? 100 : 0, icon: ShieldCheck, section: "data" as SectionId }
    ],
    [profile.education, profile.experience, profile.preferences.enabled, profile.skills.length, profileCompleteness, reusableDocuments.length]
  );
  const mostUsedDocuments = useMemo(
    () =>
      reusableDocuments
        .sort((first, second) => second.usageCount - first.usageCount)
        .slice(0, 5),
    [reusableDocuments]
  );
  const recentActivity = useMemo(() => getRecentActivityItems(profile), [profile]);
  const selectedEducation = profile.education[selectedEducationIndex] ?? profile.education[0] ?? emptyEducation;
  const savedSelectedEducation = useMemo(() => getSavedEducation(savedSnapshot, selectedEducationIndex), [savedSnapshot, selectedEducationIndex]);
  const isSelectedEducationDirty = JSON.stringify(selectedEducation) !== JSON.stringify(savedSelectedEducation ?? null);
  const selectedExperience = profile.experience[selectedExperienceIndex] ?? profile.experience[0] ?? emptyExperience;
  const savedSelectedExperience = useMemo(() => getSavedExperience(savedSnapshot, selectedExperienceIndex), [savedSnapshot, selectedExperienceIndex]);
  const isSelectedExperienceDirty = JSON.stringify(selectedExperience) !== JSON.stringify(savedSelectedExperience ?? null);
  const activeItem = navItems.find((item) => item.id === activeSection) ?? navItems[0];
  useEffect(() => {
    let cancelled = false;

    Promise.all([hasProfile(), getProfile()]).then(([profileExists, storedProfile]) => {
      if (cancelled) {
        return;
      }

      setHasSavedProfile(profileExists);
      if (storedProfile) {
        setProfile(storedProfile);
        setSavedSnapshot(JSON.stringify(storedProfile));
      } else {
        setSavedSnapshot(JSON.stringify(defaultProfile));
      }
      setHasLoadedProfile(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getThemeMode().then(setThemeMode);
  }, []);

  useEffect(() => {
    if (profile.education.length === 0) {
      setSelectedEducationIndex(0);
      return;
    }

    if (selectedEducationIndex >= profile.education.length) {
      setSelectedEducationIndex(profile.education.length - 1);
    }
  }, [profile.education.length, selectedEducationIndex]);

  useEffect(() => {
    if (profile.experience.length === 0) {
      setSelectedExperienceIndex(0);
      return;
    }

    if (selectedExperienceIndex >= profile.experience.length) {
      setSelectedExperienceIndex(profile.experience.length - 1);
    }
  }, [profile.experience.length, selectedExperienceIndex]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${GITHUB_REPO_API_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache"
      },
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((repo: unknown) => {
        const stars = getGitHubStarCount(repo);
        if (typeof stars === "number") {
          setGithubStarCount(stars);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;

    import("country-state-city").then((module) => {
      if (cancelled) {
        return;
      }

      const nextCountries = module.Country.getAllCountries().map((country) => ({
        value: country.name,
        label: country.name,
        search: [country.name, country.isoCode, country.phonecode].filter(Boolean).join(" "),
        isoCode: country.isoCode
      }));
      setLocationData({ Country: module.Country, City: module.City });
      setCountries(nextCountries);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => applyThemeMode(themeMode), [themeMode]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timeout = window.setTimeout(() => setStatus(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (selectedDocumentId && filteredResumeDocuments.some((document) => document.id === selectedDocumentId)) {
      return;
    }

    setSelectedDocumentId(
      filteredResumeDocuments.find((document) => document.id === profile.preferences.defaultResumeId)?.id ?? filteredResumeDocuments[0]?.id ?? ""
    );
  }, [filteredResumeDocuments, profile.preferences.defaultResumeId, selectedDocumentId]);

  useEffect(() => {
    setPreviewZoom(1);
  }, [selectedDocumentId]);

  function updatePersonal(key: keyof PersonalProfile, value: string) {
    setProfile((current) => ({ ...current, personal: { ...current.personal, [key]: value } }));
  }

  function updateCountry(value: string) {
    setProfile((current) => ({
      ...current,
      personal: {
        ...current.personal,
        country: value,
        city: ""
      }
    }));
  }

  function addSkill() {
    const nextSkill = skillInput.trim();
    if (!nextSkill || profile.skills.includes(nextSkill)) {
      return;
    }

    setProfile((current) => addProfileActivity({ ...current, skills: [...current.skills, nextSkill] }, "skillAdded", `Added skill: ${nextSkill}`));
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setProfile((current) => ({ ...current, skills: current.skills.filter((item) => item !== skill) }));
  }

  function updateEducation(index: number, key: keyof EducationEntry, value: string) {
    setProfile((current) => ({
      ...current,
      education: current.education.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [key]: value } : entry))
    }));
  }

  function addEducation() {
    const nextIndex = profile.education.length;
    setProfile((current) => ({ ...current, education: [...current.education, { ...emptyEducation }] }));
    setSelectedEducationIndex(nextIndex);
  }

  function deleteSelectedEducation() {
    if (profile.education.length <= 1) {
      return;
    }

    setProfile((current) => ({
      ...current,
      education: current.education.filter((_, entryIndex) => entryIndex !== selectedEducationIndex)
    }));
    setSelectedEducationIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function cancelSelectedEducationChanges() {
    const savedEducation = getSavedEducation(savedSnapshot, selectedEducationIndex);
    if (!savedEducation) {
      if (profile.education.length > 1) {
        deleteSelectedEducation();
      }
      return;
    }

    setProfile((current) => ({
      ...current,
      education: current.education.map((entry, entryIndex) => (entryIndex === selectedEducationIndex ? savedEducation : entry))
    }));
  }

  function updateExperience(index: number, key: keyof ExperienceEntry, value: string | boolean) {
    setProfile((current) => ({
      ...current,
      experience: current.experience.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [key]: value } : entry))
    }));
  }

  function addExperience() {
    const nextIndex = profile.experience.length;
    setProfile((current) => ({ ...current, experience: [...current.experience, { ...emptyExperience }] }));
    setSelectedExperienceIndex(nextIndex);
  }

  function deleteSelectedExperience() {
    if (profile.experience.length <= 1) {
      return;
    }

    setProfile((current) => ({
      ...current,
      experience: current.experience.filter((_, entryIndex) => entryIndex !== selectedExperienceIndex)
    }));
    setSelectedExperienceIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function cancelSelectedExperienceChanges() {
    const savedExperience = getSavedExperience(savedSnapshot, selectedExperienceIndex);
    if (!savedExperience) {
      if (profile.experience.length > 1) {
        deleteSelectedExperience();
      }
      return;
    }

    setProfile((current) => ({
      ...current,
      experience: current.experience.map((entry, entryIndex) => (entryIndex === selectedExperienceIndex ? savedExperience : entry))
    }));
  }

  async function handleSave() {
    const nextProfile = addProfileActivity(profile, "profileUpdated", "Saved profile changes");
    setProfile(nextProfile);
    await saveProfile(nextProfile);
    setHasSavedProfile(true);
    setSavedSnapshot(JSON.stringify(nextProfile));
    setStatus("Profile saved locally.");
  }

  async function handleExport() {
    const json = await exportProfile();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "folio-profile.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Profile exported.");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const imported = await importProfile(await file.text());
      setProfile(imported);
      setHasSavedProfile(true);
      setSavedSnapshot(JSON.stringify(imported));
      setSelectedDocumentId(imported.documents.find((document) => document.type === "resume" && (document.fileName || document.name))?.id ?? "");
      setStatus("Profile imported and saved locally.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import profile.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleThemeChange(mode: ThemeMode) {
    if (!mode) {
      return;
    }

    setThemeMode(mode);
    await saveThemeMode(mode);
  }

  async function handleFilesUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const documents = await Promise.all(files.map(readResumeDocument));
    setProfile((current) => {
      const nextProfile = {
        ...current,
        documents: [...current.documents.filter((document) => document.fileName || document.name), ...documents],
        preferences: { ...current.preferences, defaultResumeId: current.preferences.defaultResumeId || documents[0]?.id || "" }
      };
      return documents.reduce(
        (profileWithActivity, document) =>
          addProfileActivity(profileWithActivity, "documentUploaded", `Uploaded document: ${document.fileName || document.name}`, document.id, document.createdAt),
        nextProfile
      );
    });
    setSelectedDocumentId(documents[0]?.id ?? "");
    setStatus(`${documents.length} resume file${documents.length === 1 ? "" : "s"} added.`);
    event.target.value = "";
  }

  function updateDocument(id: string, updates: Partial<ProfileDocument>) {
    setProfile((current) => {
      const now = new Date().toISOString();
      return {
        ...current,
        documents: current.documents.map((document) =>
          document.id === id ? { ...document, ...updates, updatedAt: now } : document
        )
      };
    });
  }

  function deleteDocument(id: string) {
    setProfile((current) => {
      const documents = current.documents.filter((document) => document.id !== id);
      const nextDefaultResumeId =
        current.preferences.defaultResumeId === id
          ? documents.find((document) => document.type === "resume" && (document.fileName || document.name))?.id ?? ""
          : current.preferences.defaultResumeId;

      return {
        ...current,
        documents,
        preferences: { ...current.preferences, defaultResumeId: nextDefaultResumeId }
      };
    });
    setSelectedDocumentId((currentId) => (currentId === id ? "" : currentId));
    setDocumentToDelete(null);
    setStatus("Resume removed.");
  }

  function setDefaultResume(id: string) {
    setProfile((current) => ({ ...current, preferences: { ...current.preferences, defaultResumeId: id } }));
    setStatus("Default CV updated.");
  }

  function downloadDocument(fileDocument: ProfileDocument) {
    const href =
      fileDocument.contentKind === "dataUrl"
        ? fileDocument.content
        : URL.createObjectURL(new Blob([fileDocument.content], { type: fileDocument.mimeType || "text/plain" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = fileDocument.fileName || fileDocument.name || "folio-resume";
    link.click();

    if (fileDocument.contentKind !== "dataUrl") {
      URL.revokeObjectURL(href);
    }
  }

  return (
    <div className="folio-options-page">
      <div className="settings-shell">
        <header className="settings-topbar">
          <div className="settings-brand">
            <CraneMark className="brand-mark" />
            <div>
              <strong>Folio</strong>
              <span>Private autofill profile</span>
            </div>
          </div>

          <div className="topbar-actions">
            {!isFirstRun && (
              <Button asChild variant="outline" className="github-star-button">
                <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" aria-label="Star omarbhl/Folio on GitHub">
                  <Github size={16} />
                  <span>Star Folio</span>
                  <strong>{githubStarCount === null ? "..." : formatCompactCount(githubStarCount)}</strong>
                </a>
              </Button>
            )}
            <ToggleGroup
              type="single"
              value={themeMode}
              onValueChange={(value) => void handleThemeChange(value as ThemeMode)}
              className="theme-toggle"
            >
              <ToggleGroupItem value="light" aria-label="Light theme">
                <Sun size={14} />
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                <Moon size={14} />
              </ToggleGroupItem>
              <ToggleGroupItem value="auto" aria-label="Auto theme">
                <Laptop size={14} />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={handleSave} disabled={!isDirty}>
              <Save size={16} />
              {isDirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </header>

        {isFirstRun ? (
          <main className="first-run-shell" aria-labelledby="first-run-title">
            <section className="first-run-hero">
              <div>
                <p className="eyebrow">Quick setup</p>
                <h1 id="first-run-title">Start with the essentials.</h1>
                <p>Add the few details Folio needs first. The full dashboard unlocks after you save.</p>
              </div>
              <div className="first-run-progress">
                <div>
                  <span>{onboardingCompleteCount} of {onboardingSteps.length} ready</span>
                  <strong>{onboardingProgress}%</strong>
                </div>
                <Progress value={onboardingProgress} className="h-1.5" />
              </div>
            </section>

            <section className="first-run-grid">
              <Card className="first-run-card">
                <CardHeader>
                  <CardTitle>
                    <UserRound size={18} />
                    Your basics
                  </CardTitle>
                  <CardDescription>Used for the fields applications ask for most.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="first-run-fields">
                    {starterPersonalFields.map((field) => (
                      <div className="space-y-1.5" key={field.key}>
                        <Label htmlFor={`starter-${field.key}`}>{field.label}</Label>
                        <Input
                          id={`starter-${field.key}`}
                          type={field.type ?? "text"}
                          value={profile.personal[field.key]}
                          onChange={(event) => updatePersonal(field.key, event.target.value)}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="first-run-card">
                <CardHeader>
                  <CardTitle>
                    <FilePlus2 size={18} />
                    Resume
                  </CardTitle>
                  <CardDescription>Optional, but useful when forms ask for an upload.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="first-run-upload">
                    <Button asChild variant={hasUsableResume ? "secondary" : "outline"}>
                      <label className="cursor-pointer">
                        <Upload size={16} />
                        {hasUsableResume ? "Replace resume" : "Upload resume"}
                        <input type="file" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" multiple onChange={handleFilesUpload} hidden />
                      </label>
                    </Button>
                    <div>
                      <strong>{resumeDocuments[0]?.name || resumeDocuments[0]?.fileName || "No resume yet"}</strong>
                      <span>{hasUsableResume ? "Stored locally in your profile." : "You can add this later from Documents."}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="first-run-save-row">
                <div>
                  <ShieldCheck size={17} />
                  <span>Folio stores this on your device and scans only when you ask.</span>
                </div>
                <Button type="button" className="first-run-save-button" onClick={() => void handleSave()} disabled={!isDirty}>
                  <Save size={16} />
                  Save and open Folio
                </Button>
              </div>
            </section>

            {status && (
              <div className="status" role="status">
                {status}
              </div>
            )}
          </main>
        ) : (
          <>
        <div className="settings-page-heading">
          <div>
            <p className="eyebrow">{activeItem.label}</p>
            <h1>Customize once. Apply everywhere.</h1>
            <p>{activeItem.description}</p>
          </div>
          <div className="progress-row">
            <div>
              <span>Profile completeness</span>
              <strong>{profileCompleteness}%</strong>
            </div>
            <Progress value={profileCompleteness} className="h-1.5" />
          </div>
        </div>

        {shouldShowOnboarding && (
          <section className="onboarding-panel" aria-labelledby="onboarding-title">
            <div className="onboarding-copy">
              <p className="eyebrow">Quick start</p>
              <h2 id="onboarding-title">Get Folio ready for your first application.</h2>
              <p>Finish these once. Folio stays local, scans only when you ask, and fills only confident matches.</p>
            </div>
            <div className="onboarding-progress">
              <div>
                <span>{onboardingCompleteCount} of {onboardingSteps.length} done</span>
                <strong>{onboardingProgress}%</strong>
              </div>
              <Progress value={onboardingProgress} className="h-1.5" />
            </div>
            <div className="onboarding-steps">
              {onboardingSteps.map((step) => {
                const Icon = step.complete ? CheckCircle2 : step.icon;
                return (
                  <button
                    type="button"
                    key={step.label}
                    className={step.complete ? "is-complete" : ""}
                    onClick={() => {
                      if (step.label === "Save your profile") {
                        void handleSave();
                        return;
                      }
                      setActiveSection(step.section);
                    }}
                  >
                    <Icon size={16} />
                    <span>
                      <strong>{step.label}</strong>
                      <small>{step.description}</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <nav className="settings-tabs" aria-label="Settings categories">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                onClick={() => setActiveSection(item.id)}
                aria-current={isActive ? "page" : undefined}
                data-state={isActive ? "on" : "off"}
              >
                <Icon size={15} />
                {item.label}
              </Button>
            );
          })}
        </nav>

        {status && (
          <div className="status" role="status">
            {status}
          </div>
        )}

        <main className="settings-main">
          <div className="options-content-grid">
            {activeSection === "overview" && (
              <div className="overview-dashboard span-columns">
                <div className="overview-stat-grid">
                  {overviewStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <article className="overview-stat-card" key={stat.label}>
                        <div className="overview-stat-icon">
                          <Icon size={23} />
                        </div>
                        <div>
                          <strong>{stat.value}</strong>
                          <span>{stat.label}</span>
                          <small>{stat.delta}</small>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="overview-dashboard-grid">
                  <Card className="overview-panel overview-profile-card">
                    <CardHeader>
                      <CardTitle>Profile completion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overview-completion-list">
                        {overviewCompletionRows.map((row) => {
                          const Icon = row.icon;
                          return (
                            <button type="button" className="overview-completion-row" key={row.label} onClick={() => setActiveSection(row.section)}>
                              <Icon size={16} />
                              <span>{row.label}</span>
                              <Progress value={row.value} className="overview-completion-progress" />
                              <strong>{row.value}%</strong>
                              <ChevronRight size={15} />
                            </button>
                          );
                        })}
                      </div>
                      <button type="button" className="overview-complete-profile" onClick={() => setActiveSection(isProfileComplete ? "overview" : "personal")}>
                        <span>
                          <strong>{isProfileComplete ? "Profile complete" : "Complete your profile"}</strong>
                          <small>{isProfileComplete ? "Folio is ready for applications" : "Get the most out of Folio"}</small>
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    </CardContent>
                  </Card>

                  <Card className="overview-panel">
                    <CardHeader className="overview-panel-header">
                      <CardTitle>AI assistant</CardTitle>
                      <Button type="button" variant="outline" size="xs" onClick={() => setActiveSection("ai")}>
                        Preview
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="overview-ai-preview">
                        <Sparkles size={18} />
                        <strong>Coming soon</strong>
                        <p>Future Folio updates will bring smarter help for application questions.</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overview-panel">
                    <CardHeader className="overview-panel-header">
                      <CardTitle>Most used documents</CardTitle>
                      <Button type="button" variant="outline" size="xs" onClick={() => setActiveSection("files")}>
                        View all
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <ol className="overview-document-list">
                        {mostUsedDocuments.length > 0 ? (
                          mostUsedDocuments.map((document) => (
                            <li key={document.id}>
                              <FileText size={16} />
                              <strong>{document.fileName || document.name}</strong>
                              <small>{document.usageCount} uses</small>
                            </li>
                          ))
                        ) : (
                          <li className="overview-empty-row">No documents uploaded yet.</li>
                        )}
                      </ol>
                    </CardContent>
                  </Card>

                  <Card className="overview-panel">
                    <CardHeader className="overview-panel-header">
                      <CardTitle>Recent activity</CardTitle>
                      <Button type="button" variant="outline" size="xs" onClick={() => setActiveSection("overview")}>
                        View all
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="overview-activity-list">
                        {recentActivity.length > 0 ? (
                          recentActivity.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={`${item.label}-${item.time}`}>
                                <Icon size={15} />
                                <span>{item.label}</span>
                                <small>{item.time}</small>
                              </div>
                            );
                          })
                        ) : (
                          <p className="overview-empty-row">No activity recorded yet.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overview-panel">
                    <CardHeader>
                      <CardTitle>Quick actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overview-action-grid">
                        <button type="button" onClick={() => setActiveSection("ai")}>
                          <Sparkles size={18} />
                          <span>
                            <strong>AI</strong>
                            <small>Coming soon</small>
                          </span>
                        </button>
                        <button type="button" onClick={() => setActiveSection("files")}>
                          <Upload size={18} />
                          <span>
                            <strong>Upload document</strong>
                            <small>Add your files</small>
                          </span>
                        </button>
                        <button type="button" onClick={() => setActiveSection("personal")}>
                          <UserRound size={18} />
                          <span>
                            <strong>Edit profile</strong>
                            <small>Update your info</small>
                          </span>
                        </button>
                        <button type="button" onClick={() => setActiveSection("data")}>
                          <SlidersHorizontal size={18} />
                          <span>
                            <strong>Settings</strong>
                            <small>Manage controls</small>
                          </span>
                        </button>
                        <button type="button" className="overview-action-wide" onClick={handleExport}>
                          <FileDown size={18} />
                          <span>
                            <strong>Export profile</strong>
                            <small>Backup your data</small>
                          </span>
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeSection === "personal" && (
              <Card className="span-columns">
                <CardHeader>
                  <CardTitle>Personal information</CardTitle>
                  <CardDescription>Core contact details Folio can safely match to job application forms.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {personalFields.map((field) => (
                      <div className="space-y-1.5" key={field.key}>
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          type={field.type ?? "text"}
                          value={profile.personal[field.key]}
                          onChange={(event) => updatePersonal(field.key, event.target.value)}
                        />
                      </div>
                    ))}
                    <LocationSelect
                      id="country"
                      label="Country"
                      placeholder="Select country"
                      searchPlaceholder="Search country..."
                      emptyMessage={countries.length > 0 ? "No country found." : "Loading countries..."}
                      options={countries}
                      value={profile.personal.country}
                      onChange={updateCountry}
                    />
                    <LocationSelect
                      id="city"
                      label="City"
                      placeholder={selectedCountry ? "Select city" : "Select country first"}
                      searchPlaceholder="Search city..."
                      emptyMessage={selectedCountry ? "No city found." : "Choose a country first."}
                      options={cityOptions}
                      value={profile.personal.city}
                      onChange={(value) => updatePersonal("city", value)}
                      disabled={!selectedCountry}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "files" && (
              <Card className="span-columns">
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>My files</CardTitle>
                    <CardDescription>Upload resumes, preview them, and keep the ones you reuse for applications.</CardDescription>
                  </div>
                  <Button asChild variant="outline">
                    <label className="cursor-pointer">
                      <FilePlus2 size={16} />
                      Upload
                      <input type="file" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" multiple onChange={handleFilesUpload} hidden />
                    </label>
                  </Button>
                </CardHeader>
                <CardContent>
                  {resumeDocuments.length === 0 ? (
                    <div className="file-empty-state">
                      <FileText size={28} />
                      <p>No resumes uploaded yet.</p>
                      <span>Text, Markdown, and PDF files can be stored locally in your Folio profile.</span>
                    </div>
                  ) : (
                    <div className="files-layout">
                      <div className="file-list" aria-label="Uploaded resumes">
                        {resumeTags.length > 0 && (
                          <div className="file-tag-filter" aria-label="Filter resumes by tag">
                            <button type="button" className={!fileTagFilter ? "is-active" : ""} onClick={() => setFileTagFilter("")}>
                              All
                            </button>
                            {resumeTags.map((tag) => (
                              <button key={tag} type="button" className={fileTagFilter === tag ? "is-active" : ""} onClick={() => setFileTagFilter(tag)}>
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                        {filteredResumeDocuments.map((document) => (
                          <button
                            key={document.id}
                            type="button"
                            onClick={() => setSelectedDocumentId(document.id)}
                            className={cn("file-list-item", selectedDocument?.id === document.id && "is-active")}
                          >
                            <FileText size={16} />
                            <span>
                              <strong>{document.name || document.fileName || "Resume"}</strong>
                              <small>{formatFileMeta(document)}</small>
                              {profile.preferences.defaultResumeId === document.id && <em>Default CV</em>}
                            </span>
                          </button>
                        ))}
                      </div>

                      {selectedDocument && (
                        <div className="file-detail">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="selected-file-name">Display name</Label>
                              <Input
                                id="selected-file-name"
                                value={selectedDocument.name}
                                onChange={(event) => updateDocument(selectedDocument.id, { name: event.target.value })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="selected-file-tags">Tags</Label>
                              <Input
                                id="selected-file-tags"
                                value={selectedDocument.tags.join(", ")}
                                onChange={(event) => updateDocument(selectedDocument.id, { tags: splitTags(event.target.value) })}
                                placeholder="resume, frontend, 2026"
                              />
                            </div>
                          </div>

                          <div className="file-actions">
                            <Button
                              variant={profile.preferences.defaultResumeId === selectedDocument.id ? "secondary" : "outline"}
                              onClick={() => setDefaultResume(selectedDocument.id)}
                            >
                              <CheckCircle2 size={16} />
                              {profile.preferences.defaultResumeId === selectedDocument.id ? "Default CV" : "Make default"}
                            </Button>
                            <Button variant="outline" onClick={() => downloadDocument(selectedDocument)}>
                              <FileDown size={16} />
                              Download
                            </Button>
                            <Button variant="destructive" onClick={() => setDocumentToDelete(selectedDocument)}>
                              <Trash2 size={16} />
                              Delete
                            </Button>
                          </div>

                          <div className="space-y-1.5">
                            <div className="file-preview-header">
                              <Label htmlFor="selected-file-preview">Preview</Label>
                              <div className="file-zoom-controls" aria-label="Preview zoom controls">
                                <Button type="button" variant="outline" size="icon-sm" onClick={() => setPreviewZoom((zoom) => Math.max(0.75, zoom - 0.1))}>
                                  <ZoomOut size={14} />
                                </Button>
                                <span>{Math.round(previewZoom * 100)}%</span>
                                <Button type="button" variant="outline" size="icon-sm" onClick={() => setPreviewZoom((zoom) => Math.min(1.75, zoom + 0.1))}>
                                  <ZoomIn size={14} />
                                </Button>
                              </div>
                            </div>
                            {selectedDocument.contentKind === "dataUrl" && selectedDocument.mimeType === "application/pdf" ? (
                              <div className="file-preview-viewport">
                                <iframe
                                  className="file-preview-frame"
                                  src={selectedDocument.content}
                                  style={{ height: `${520 / previewZoom}px`, transform: `scale(${previewZoom})` }}
                                  title={selectedDocument.name || selectedDocument.fileName}
                                />
                              </div>
                            ) : (
                              <Textarea
                                id="selected-file-preview"
                                className="file-preview-text font-mono"
                                style={{ fontSize: `${14 * previewZoom}px` }}
                                value={selectedDocument.content}
                                readOnly={selectedDocument.contentKind !== "text"}
                                onChange={(event) => updateDocument(selectedDocument.id, { content: event.target.value, size: event.target.value.length })}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <Dialog open={documentToDelete !== null} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete resume?</DialogTitle>
                      <DialogDescription>
                        This removes {documentToDelete?.name || documentToDelete?.fileName || "this resume"} from Folio. This cannot be undone after you save.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={() => documentToDelete && deleteDocument(documentToDelete.id)}>
                        Delete resume
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Card>
            )}

            {activeSection === "skills" && (
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                  <CardDescription>Keep a reusable skill set ready for application platforms.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Add a skill"
                    />
                    <Button onClick={addSkill}>
                      <Plus size={16} />
                      Add
                    </Button>
                  </div>

                  {profile.skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No skills yet. Add the skills you want Folio to suggest on forms.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="gap-1.5 py-1.5 pl-3 pr-2 text-sm">
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            aria-label={`Remove ${skill}`}
                            className="rounded-full p-0.5 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <X size={12} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "education" && (
              <div className="education-workspace span-columns">
                <Card className="education-timeline-card education-selector-card">
                  <CardHeader className="education-list-header">
                    <div>
                      <CardTitle>
                        Education <Badge variant="secondary">{profile.education.length}</Badge>
                      </CardTitle>
                      <CardDescription>Your academic timeline.</CardDescription>
                    </div>
                    <Button size="sm" onClick={addEducation}>
                      <Plus size={15} />
                      Add education
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="timeline-selector-scroll">
                      <EducationTimeline entries={profile.education} selectedIndex={selectedEducationIndex} onSelect={setSelectedEducationIndex} />
                    </div>
                    <div className="education-tip">
                      <Sparkles size={15} />
                      <p>Keep your newest or most relevant education easy to find. Folio uses this when matching school and degree fields.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="education-editor-card">
                  <CardHeader className="education-editor-header">
                    <div>
                      <CardTitle>{selectedEducation.school || "School not set"}</CardTitle>
                      <CardDescription>
                        {[selectedEducation.degree, selectedEducation.fieldOfStudy, formatTimelineRange(selectedEducation.startDate, selectedEducation.endDate)]
                          .filter(Boolean)
                          .join(" - ")}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="education-editor-content">
                    <div className="education-form-grid">
                      <div className="space-y-1.5">
                        <Label htmlFor="education-selected-school">School</Label>
                        <Input
                          id="education-selected-school"
                          value={selectedEducation.school}
                          onChange={(event) => updateEducation(selectedEducationIndex, "school", event.target.value)}
                          placeholder="University or school"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="education-selected-degree">Degree</Label>
                        <Input
                          id="education-selected-degree"
                          value={selectedEducation.degree}
                          onChange={(event) => updateEducation(selectedEducationIndex, "degree", event.target.value)}
                          placeholder="Bachelor, Master, Certificate"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="education-selected-field">Field of study</Label>
                        <Input
                          id="education-selected-field"
                          value={selectedEducation.fieldOfStudy}
                          onChange={(event) => updateEducation(selectedEducationIndex, "fieldOfStudy", event.target.value)}
                          placeholder="Computer Science"
                        />
                      </div>
                      <DateField
                        id="education-selected-startDate"
                        label="Start date"
                        value={selectedEducation.startDate}
                        onChange={(value) => updateEducation(selectedEducationIndex, "startDate", value)}
                      />
                      <DateField
                        id="education-selected-endDate"
                        label="End date"
                        value={selectedEducation.endDate}
                        onChange={(value) => updateEducation(selectedEducationIndex, "endDate", value)}
                      />
                      <div className="education-description-field">
                        <Label htmlFor="education-selected-description">Description</Label>
                        <Textarea
                          id="education-selected-description"
                          value={selectedEducation.description}
                          onChange={(event) => updateEducation(selectedEducationIndex, "description", event.target.value)}
                          placeholder="Add coursework, honors, or focus areas."
                        />
                      </div>
                    </div>
                  </CardContent>
                  <div className="education-editor-actions">
                    <Button type="button" variant="ghost" onClick={deleteSelectedEducation} disabled={profile.education.length === 1}>
                      <Trash2 size={15} />
                      Delete
                    </Button>
                    <div>
                      <Button type="button" variant="outline" onClick={cancelSelectedEducationChanges} disabled={!isSelectedEducationDirty}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={() => void handleSave()} disabled={!isDirty}>
                        <Save size={15} />
                        Save changes
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeSection === "experience" && (
              <div className="experience-workspace span-columns">
                <Card className="experience-list-card">
                  <CardHeader className="experience-list-header">
                    <div>
                      <CardTitle>
                        Experience <Badge variant="secondary">{profile.experience.length}</Badge>
                      </CardTitle>
                      <CardDescription>Your work history and impact.</CardDescription>
                    </div>
                    <Button size="sm" onClick={addExperience}>
                      <Plus size={15} />
                      Add experience
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="timeline-selector-scroll">
                      <ol className="education-timeline experience-timeline">
                        {profile.experience.map((entry, index) => {
                          const isSelected = index === selectedExperienceIndex;
                          return (
                            <li
                              key={`experience-${index}`}
                              className={isSelected ? "education-timeline-item is-selected" : "education-timeline-item"}
                            >
                              <span className="education-timeline-dot" />
                              <button type="button" className="education-timeline-content" onClick={() => setSelectedExperienceIndex(index)}>
                                <Badge variant="outline" className="education-timeline-date">
                                  {formatExperienceRange(entry)}
                                </Badge>
                                <strong>{entry.title || "Untitled role"}</strong>
                                <span>{entry.company || "Company not set"}</span>
                                {entry.location && <small>{entry.location}</small>}
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                    <div className="experience-tip">
                      <Sparkles size={15} />
                      <p>List your most relevant experience first. Focus on impact, not just duties.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="experience-editor-card">
                  <CardHeader className="experience-editor-header">
                    <div>
                      <CardTitle>{selectedExperience.title || "Untitled role"}</CardTitle>
                      <CardDescription>
                        {[selectedExperience.company, selectedExperience.location, formatExperienceRange(selectedExperience)].filter(Boolean).join(" - ")}
                      </CardDescription>
                    </div>
                    {selectedExperience.current && <Badge className="experience-current-badge">Current</Badge>}
                  </CardHeader>
                  <CardContent className="experience-editor-content">
                    <div className="experience-form-grid">
                      <div className="space-y-1.5">
                        <Label htmlFor="experience-selected-title">Job title</Label>
                        <Input
                          id="experience-selected-title"
                          value={selectedExperience.title}
                          onChange={(event) => updateExperience(selectedExperienceIndex, "title", event.target.value)}
                          placeholder="Software Engineer"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="experience-selected-company">Company</Label>
                        <Input
                          id="experience-selected-company"
                          value={selectedExperience.company}
                          onChange={(event) => updateExperience(selectedExperienceIndex, "company", event.target.value)}
                          placeholder="Company"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="experience-selected-location">Location</Label>
                        <Input
                          id="experience-selected-location"
                          value={selectedExperience.location}
                          onChange={(event) => updateExperience(selectedExperienceIndex, "location", event.target.value)}
                          placeholder="City, Country"
                        />
                      </div>
                      <DateField
                        id="experience-selected-startDate"
                        label="Start date"
                        value={selectedExperience.startDate}
                        onChange={(value) => updateExperience(selectedExperienceIndex, "startDate", value)}
                      />
                      <DateField
                        id="experience-selected-endDate"
                        label="End date"
                        value={selectedExperience.endDate}
                        onChange={(value) => updateExperience(selectedExperienceIndex, "endDate", value)}
                        disabled={selectedExperience.current}
                      />
                      <div className="experience-current-row">
                        <Label htmlFor="experience-selected-current">I currently work here</Label>
                        <Switch
                          id="experience-selected-current"
                          checked={selectedExperience.current}
                          onCheckedChange={(checked) => updateExperience(selectedExperienceIndex, "current", checked)}
                        />
                      </div>
                      <div className="experience-description-field">
                        <Label htmlFor="experience-selected-description">Description</Label>
                        <Textarea
                          id="experience-selected-description"
                          value={selectedExperience.description}
                          onChange={(event) => updateExperience(selectedExperienceIndex, "description", event.target.value)}
                          placeholder="Add responsibilities, tools, and outcomes."
                        />
                      </div>
                    </div>
                  </CardContent>
                  <div className="experience-editor-actions">
                    <Button type="button" variant="ghost" onClick={deleteSelectedExperience} disabled={profile.experience.length === 1}>
                      <Trash2 size={15} />
                      Delete
                    </Button>
                    <div>
                      <Button type="button" variant="outline" onClick={cancelSelectedExperienceChanges} disabled={!isSelectedExperienceDirty}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={() => void handleSave()} disabled={!isDirty}>
                        <Save size={15} />
                        Save changes
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeSection === "ai" && (
              <Card className="span-columns ai-placeholder-card">
                <CardContent>
                  <div className="ai-placeholder">
                    <div className="ai-placeholder-icon">
                      <Sparkles size={30} />
                    </div>
                    <p className="eyebrow">AI</p>
                    <h2>Coming soon in the next updates.</h2>
                    <p>We are preparing a smarter assistant for application questions, review, and writing help. For now, Folio stays focused on private profile autofill.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "data" && (
              <div className="settings-clean-layout span-columns">
                <Card className="local-data-card">
                  <CardHeader>
                    <CardTitle>Local data</CardTitle>
                    <CardDescription>Export a backup or import an existing Folio profile.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="data-actions">
                      <Button variant="outline" onClick={handleExport}>
                        <FileDown size={16} />
                        Export JSON
                      </Button>
                      <Button asChild variant="outline">
                        <label className="cursor-pointer">
                          <Upload size={16} />
                          Import JSON
                          <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
                        </label>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
          </>
        )}
      </div>
    </div>
  );
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getGitHubStarCount(repo: unknown): number | null {
  if (!repo || typeof repo !== "object" || !("stargazers_count" in repo)) {
    return null;
  }

  const stars = (repo as { stargazers_count?: unknown }).stargazers_count;
  return typeof stars === "number" ? stars : null;
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function getStarterContactProgress(profile: FolioProfile): number {
  const fields: Array<keyof PersonalProfile> = ["fullName", "email", "phone"];
  const filled = fields.filter((field) => profile.personal[field].trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

function getSavedExperience(snapshot: string, index: number): ExperienceEntry | null {
  try {
    const profile = JSON.parse(snapshot) as Partial<FolioProfile>;
    return profile.experience?.[index] ?? null;
  } catch {
    return null;
  }
}

function getSavedEducation(snapshot: string, index: number): EducationEntry | null {
  try {
    const profile = JSON.parse(snapshot) as Partial<FolioProfile>;
    return profile.education?.[index] ?? null;
  } catch {
    return null;
  }
}

function formatExperienceRange(entry: ExperienceEntry): string {
  if (entry.current) {
    const start = formatTimelineDate(entry.startDate);
    return start ? `${start} - Present` : "Current";
  }

  return formatTimelineRange(entry.startDate, entry.endDate);
}

function formatHoursSaved(seconds: number): string {
  const hours = seconds / 3600;
  if (hours === 0) {
    return "0";
  }

  if (hours < 10) {
    return hours.toFixed(1).replace(/\.0$/, "");
  }

  return Math.round(hours).toLocaleString();
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getEntriesCompleteness<T extends object>(entries: T[], keys: Array<keyof T>): number {
  if (entries.length === 0) {
    return 0;
  }

  const completed = entries.reduce((total, entry) => {
    const filled = keys.filter((key) => String(entry[key] ?? "").trim().length > 0).length;
    return total + filled / keys.length;
  }, 0);

  return clampPercent((completed / entries.length) * 100);
}

function getRecentActivityItems(profile: FolioProfile): Array<{ label: string; time: string; icon: typeof FileText }> {
  const items = profile.metrics.activityLog.slice(0, 4).map((activity) => ({
    label: activity.label,
    time: formatRelativeActivityTime(activity.createdAt),
    icon: getActivityIcon(activity.kind)
  }));

  return items;
}

function getActivityIcon(kind: FolioProfile["metrics"]["activityLog"][number]["kind"]): typeof FileText {
  if (kind.startsWith("document")) {
    return FileText;
  }

  if (kind === "skillAdded") {
    return Tags;
  }

  if (kind === "experienceAdded") {
    return BriefcaseBusiness;
  }

  if (kind === "formFilled") {
    return Zap;
  }

  return CheckCircle2;
}

function formatRelativeActivityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) {
    return "now";
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatActivityDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function readResumeDocument(file: File): Promise<ProfileDocument> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const content = isPdf ? await readFileAsDataUrl(file) : await file.text();
  const now = new Date().toISOString();

  return {
    id: makeDocumentId(file.name),
    name: file.name.replace(/\.[^.]+$/, "") || "Resume",
    type: "resume",
    tags: ["resume"],
    fileName: file.name,
    mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"),
    size: file.size,
    content,
    contentKind: isPdf ? "dataUrl" : "text",
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
    lastUsedAt: ""
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read file.")));
    reader.readAsDataURL(file);
  });
}

function makeDocumentId(fileName: string): string {
  const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resume";
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `doc-${crypto.randomUUID()}`;
  }

  return `doc-${Date.now()}-${slug}`;
}

function formatFileMeta(document: ProfileDocument): string {
  const size = document.size > 0 ? formatFileSize(document.size) : `${document.content.length.toLocaleString()} chars`;
  return [document.fileName, size].filter(Boolean).join(" · ");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1).replace(/\.0$/, "")} KB`;
  }

  return `${(kb / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
}

function getDocumentTags(documents: ProfileDocument[]): string[] {
  return Array.from(new Set(documents.flatMap((document) => document.tags))).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function EducationTimeline({
  entries,
  selectedIndex,
  onSelect
}: {
  entries: EducationEntry[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}) {
  const visibleEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) =>
      onSelect || [entry.school, entry.degree, entry.fieldOfStudy, entry.startDate, entry.endDate, entry.description].some((value) => value.trim().length > 0)
    );

  if (visibleEntries.length === 0) {
    return (
      <div className="education-timeline-empty">
        <GraduationCap size={22} />
        <p>Add your first school to start building the timeline.</p>
      </div>
    );
  }

  return (
    <ol className="education-timeline">
      {visibleEntries.map(({ entry, index }) => {
        const isSelected = index === selectedIndex;
        const content = (
          <>
            <Badge variant="outline" className="education-timeline-date">
              {formatTimelineRange(entry.startDate, entry.endDate)}
            </Badge>
            <strong>{entry.degree || entry.fieldOfStudy || "Education"}</strong>
            <span>{entry.school || "School not added yet"}</span>
            {entry.fieldOfStudy && entry.degree && <small>{entry.fieldOfStudy}</small>}
            {entry.description && <p>{entry.description}</p>}
          </>
        );

        return (
          <li key={`education-${index}`} className={isSelected ? "education-timeline-item is-selected" : "education-timeline-item"}>
            <span className="education-timeline-dot" />
            {onSelect ? (
              <button type="button" className="education-timeline-content" onClick={() => onSelect(index)}>
                {content}
              </button>
            ) : (
              <div className="education-timeline-content">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function formatTimelineRange(startDate: string, endDate: string): string {
  const start = formatTimelineDate(startDate);
  const end = formatTimelineDate(endDate);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || "Dates pending";
}

function formatTimelineDate(value: string): string {
  if (!value.trim()) {
    return "";
  }

  const year = value.match(/\b\d{4}\b/)?.[0];
  return year ?? value;
}

function LocationSelect({
  id,
  label,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  options,
  value,
  onChange,
  disabled = false
}: {
  id: string;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  options: Array<{ value: string; label: string; search?: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selectedOption?.value}
        onValueChange={onChange}
        disabled={disabled || options.length === 0}
      >
        <SelectTrigger id={id} className="location-select-trigger w-full" aria-label={label}>
          <SelectValue placeholder={value || placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className="location-select-content">
          <SelectGroup>
            {options.length > 0 ? (
              options.map((option) => (
                <SelectItem key={`${id}-${option.value}`} value={option.value}>
                  {option.label}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__empty" disabled>
                {emptyMessage}
              </SelectItem>
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  disabled = false
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="MM/YYYY"
        value={formatDateInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function YearField({
  id,
  label,
  value,
  onChange,
  disabled = false
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        maxLength={4}
        placeholder="MM/YYYY"
        value={formatYearInputValue(value)}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        disabled={disabled}
      />
    </div>
  );
}

function labelFromKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateInputValue(value: string): string {
  if (!value) {
    return "";
  }

  const fullIsoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullIsoDate) {
    return `${fullIsoDate[3]}/${fullIsoDate[2]}/${fullIsoDate[1]}`;
  }

  const monthDate = value.match(/^(\d{4})-(\d{2})$/);
  if (monthDate) {
    return `01/${monthDate[2]}/${monthDate[1]}`;
  }

  return value;
}

function formatYearInputValue(value: string): string {
  if (!value) {
    return "";
  }

  const isoYear = value.match(/^(\d{4})/);
  return isoYear?.[1] ?? value.replace(/\D/g, "").slice(0, 4);
}
