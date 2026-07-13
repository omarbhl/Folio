import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
  Star,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";
import { OptionsLayout } from "@/layouts/options-layout";
import { cn } from "@/lib/utils";
import { addProfileActivity } from "../shared/activity";
import { FolioMark } from "../shared/brand";
import { defaultProfile } from "../shared/defaultProfile";
import {
  exportProfile,
  clearOnboardingDraft,
  getOnboardingDraft,
  getProfile,
  getThemeMode,
  hasProfile,
  importProfile,
  saveOnboardingDraft,
  saveProfile,
  saveThemeMode
} from "../shared/storage";
import { applyThemeMode } from "../shared/theme";
import type {
  EducationEntry,
  ExperienceEntry,
  FolioProfile,
  OnboardingPath,
  PersonalProfile,
  ProfileDocument,
  ThemeMode
} from "../shared/types";

/* ------------------------------------------------------------------ */
// Constants
/* ------------------------------------------------------------------ */

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
  { id: "ai", label: "AI Assistant", description: "A smarter application assistant is coming in a future update.", icon: Sparkles },
  { id: "data", label: "Settings", description: "Import, export, and inspect the Folio profile stored in this browser.", icon: ShieldCheck }
];

const SECONDS_SAVED_PER_FIELD = 8;
const SECONDS_SAVED_PER_FORM_REVIEW = 20;
const GITHUB_REPO_URL = "https://github.com/omarbhl/Folio";
const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/cihiibkhfaieiegbhmneibchdmhhdgap?utm_source=item-share-cb";

/* ------------------------------------------------------------------ */
// Types
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
// Component
/* ------------------------------------------------------------------ */

export function OptionsPage() {
  // Profile & UI State
  const [profile, setProfile] = useState<FolioProfile>(defaultProfile);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(defaultProfile));
  const [status, setStatus] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [pendingSection, setPendingSection] = useState<SectionId | null>(null);

  // Form State
  const [skillInput, setSkillInput] = useState("");
  const [selectedEducationIndex, setSelectedEducationIndex] = useState(0);
  const [selectedExperienceIndex, setSelectedExperienceIndex] = useState(0);

  // Location State
  const [locationData, setLocationData] = useState<LocationDataApi | null>(null);
  const [countries, setCountries] = useState<LocationOption[]>([]);

  // Document State
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [fileTagFilter, setFileTagFilter] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [documentToDelete, setDocumentToDelete] = useState<ProfileDocument | null>(null);

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPath>("resume");
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState("");

  // Dialog State
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  const isDirty = JSON.stringify(profile) !== savedSnapshot;
  const isFirstRun = hasLoadedProfile && !hasSavedProfile;

  /* ------------------------------------------------------------------ */
  // Derived values
  /* ------------------------------------------------------------------ */

  const pendingSectionLabel = navItems.find((item) => item.id === pendingSection)?.label ?? "this section";

  const estimatedSecondsSaved =
    profile.metrics.totalFieldsFilled * SECONDS_SAVED_PER_FIELD +
    profile.metrics.totalFormsFilled * SECONDS_SAVED_PER_FORM_REVIEW;

  const resumeDocuments = useMemo(
    () => profile.documents.filter((document) => document.type === "resume" && (document.fileName || document.name)),
    [profile.documents]
  );

  const resumeTags = useMemo(() => getDocumentTags(resumeDocuments), [resumeDocuments]);
  const filteredResumeDocuments = useMemo(
    () => (fileTagFilter ? resumeDocuments.filter((document) => document.tags.includes(fileTagFilter)) : resumeDocuments),
    [fileTagFilter, resumeDocuments]
  );

  const selectedDocument = useMemo(
    () => filteredResumeDocuments.find((document) => document.id === selectedDocumentId) ?? filteredResumeDocuments[0] ?? null,
    [filteredResumeDocuments, selectedDocumentId]
  );

  const selectedCountry = useMemo(
    () => countries.find((country) => country.value === profile.personal.country),
    [countries, profile.personal.country]
  );

  const cityOptions = useMemo(() => {
    if (!selectedCountry?.isoCode || !locationData) return [];
    const seen = new Set<string>();
    return (locationData.City.getCitiesOfCountry(selectedCountry.isoCode) ?? [])
      .filter((city) => {
        const key = city.name.toLowerCase();
        if (seen.has(key)) return false;
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
    [
      estimatedSecondsSaved,
      isProfileComplete,
      missingPersonalFields,
      profile.metrics.totalFieldsFilled,
      profile.metrics.totalFormsFilled,
      profileCompleteness,
      reusableDocuments.length
    ]
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

  const selectedEducation = profile.education[selectedEducationIndex] ?? profile.education[0] ?? emptyEducation;
  const savedSelectedEducation = useMemo(() => getSavedEducation(savedSnapshot, selectedEducationIndex), [savedSnapshot, selectedEducationIndex]);
  const isSelectedEducationDirty = JSON.stringify(selectedEducation) !== JSON.stringify(savedSelectedEducation ?? null);

  const selectedExperience = profile.experience[selectedExperienceIndex] ?? profile.experience[0] ?? emptyExperience;
  const savedSelectedExperience = useMemo(() => getSavedExperience(savedSnapshot, selectedExperienceIndex), [savedSnapshot, selectedExperienceIndex]);
  const isSelectedExperienceDirty = JSON.stringify(selectedExperience) !== JSON.stringify(savedSelectedExperience ?? null);

  const activeItem = navItems.find((item) => item.id === activeSection) ?? navItems[0];

  /* ------------------------------------------------------------------ */
  // Effects
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;
    Promise.all([hasProfile(), getProfile(), getOnboardingDraft()]).then(([profileExists, storedProfile, onboardingDraft]) => {
      if (cancelled) return;
      setHasSavedProfile(profileExists);
      if (storedProfile) {
        setProfile(storedProfile);
        setSavedSnapshot(JSON.stringify(storedProfile));
      } else if (onboardingDraft) {
        setProfile(onboardingDraft.profile);
        setOnboardingStep(onboardingDraft.step);
        setOnboardingPath(onboardingDraft.path);
        setSavedSnapshot(JSON.stringify(defaultProfile));
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
    if (!isFirstRun) return;
    const timeout = window.setTimeout(() => {
      void saveOnboardingDraft({
        profile,
        step: onboardingStep,
        path: onboardingPath,
        updatedAt: new Date().toISOString()
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [isFirstRun, onboardingPath, onboardingStep, profile]);

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
    let cancelled = false;
    import("country-state-city").then((module) => {
      if (cancelled) return;
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
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (selectedDocumentId && filteredResumeDocuments.some((document) => document.id === selectedDocumentId)) return;
    setSelectedDocumentId(
      filteredResumeDocuments.find((document) => document.id === profile.preferences.defaultResumeId)?.id ?? filteredResumeDocuments[0]?.id ?? ""
    );
  }, [filteredResumeDocuments, profile.preferences.defaultResumeId, selectedDocumentId]);

  useEffect(() => {
    setPreviewZoom(1);
  }, [selectedDocumentId]);

  /* ------------------------------------------------------------------ */
  // Handlers
  /* ------------------------------------------------------------------ */

  function updatePersonal(key: keyof PersonalProfile, value: string) {
    setProfile((current) => {
      const personal = { ...current.personal, [key]: value };
      if (key === "firstName" || key === "lastName") {
        const previousGeneratedName = [current.personal.firstName, current.personal.lastName].filter(Boolean).join(" ").trim();
        if (!current.personal.fullName.trim() || current.personal.fullName.trim() === previousGeneratedName) {
          personal.fullName = [personal.firstName, personal.lastName].filter(Boolean).join(" ").trim();
        }
      }
      return { ...current, personal };
    });
  }

  function updateCountry(value: string) {
    setProfile((current) => ({
      ...current,
      personal: { ...current.personal, country: value, city: "" }
    }));
  }

  function addSkill() {
    const nextSkill = skillInput.trim();
    if (!nextSkill || profile.skills.includes(nextSkill)) return;
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
    if (profile.education.length <= 1) return;
    setProfile((current) => ({ ...current, education: current.education.filter((_, entryIndex) => entryIndex !== selectedEducationIndex) }));
    setSelectedEducationIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function cancelSelectedEducationChanges() {
    const savedEducation = getSavedEducation(savedSnapshot, selectedEducationIndex);
    if (!savedEducation) {
      if (profile.education.length > 1) deleteSelectedEducation();
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
    if (profile.experience.length <= 1) return;
    setProfile((current) => ({ ...current, experience: current.experience.filter((_, entryIndex) => entryIndex !== selectedExperienceIndex) }));
    setSelectedExperienceIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function cancelSelectedExperienceChanges() {
    const savedExperience = getSavedExperience(savedSnapshot, selectedExperienceIndex);
    if (!savedExperience) {
      if (profile.experience.length > 1) deleteSelectedExperience();
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
    toast.success("Profile saved", { description: "Your changes are stored locally on this device." });
  }

  function requestSectionChange(nextSection: SectionId) {
    if (nextSection === activeSection) return;
    if (isDirty) {
      setPendingSection(nextSection);
      return;
    }
    setActiveSection(nextSection);
  }

  async function saveAndSwitchSection() {
    const nextSection = pendingSection;
    if (!nextSection) return;
    await handleSave();
    setActiveSection(nextSection);
    setPendingSection(null);
  }

  async function completeOnboarding() {
    await handleSave();
    await clearOnboardingDraft();
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
    if (!file) return;
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
    if (!mode) return;
    setThemeMode(mode);
    await saveThemeMode(mode);
  }

  async function addResumeFiles(files: File[]) {
    if (files.length === 0) return;
    setIsUploadingResume(true);
    setResumeUploadError("");
    try {
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
      toast.success(documents.length === 1 ? "Resume added" : `${documents.length} resumes added`, {
        description: "Stored locally in your Folio profile."
      });
    } catch {
      setResumeUploadError("Use a PDF, TXT, or Markdown file and try again.");
      toast.error("Resume could not be read");
    } finally {
      setIsUploadingResume(false);
    }
  }

  async function handleFilesUpload(event: ChangeEvent<HTMLInputElement>) {
    await addResumeFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function updateDocument(id: string, updates: Partial<ProfileDocument>) {
    setProfile((current) => {
      const now = new Date().toISOString();
      return {
        ...current,
        documents: current.documents.map((document) => (document.id === id ? { ...document, ...updates, updatedAt: now } : document))
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
      return { ...current, documents, preferences: { ...current.preferences, defaultResumeId: nextDefaultResumeId } };
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
    if (fileDocument.contentKind !== "dataUrl") URL.revokeObjectURL(href);
  }

  async function handleDeleteAllData() {
    try {
      await chrome.storage.local.remove(["folio_profile", "folio_onboarding_draft", "folio_theme"]);
    } catch {
      // Fallback: state will still reset below
    }
    setProfile(defaultProfile);
    setHasSavedProfile(false);
    setSavedSnapshot(JSON.stringify(defaultProfile));
    setSelectedDocumentId("");
    setDeleteAllDialogOpen(false);
    setStatus("All Folio data has been deleted.");
    toast.success("All data deleted", { description: "Your local profile has been cleared." });
  }

  /* ------------------------------------------------------------------ */
  // Render
  /* ------------------------------------------------------------------ */

  // if (loadingProfile) {
  //   // Note: loadingProfile isn't defined in state above, but keeping for compatibility
  //   // Actually, the original code uses hasLoadedProfile. I'll render based on that.
  // }

  return (
    <OptionsLayout
      className={cn(
        "relative mx-auto grid min-h-[100svh] max-w-[96rem] content-start gap-6 px-6 pt-8 pb-[4.5rem]",
        "max-lg:gap-5 max-[1180px]:px-[clamp(1.5rem,4vw,3rem)] max-[1180px]:pb-12 max-[860px]:px-5 max-[860px]:pb-10",
        "has-[main[aria-labelledby='onboarding-title']]:pt-28 has-[main[aria-labelledby='onboarding-title']]:pb-12"
      )}
    >
      {/* Header */}
      <header className="flex min-h-12 items-center justify-between gap-4 max-[860px]:items-start">
        <div className="flex min-w-0 items-center gap-3.5 max-[860px]:gap-2.5">
          <FolioMark className="h-11 w-11 rounded-[0.8rem] max-[860px]:h-9 max-[860px]:w-9" />
          <div>
            <strong className="block text-xl font-[720] tracking-[-0.045em] text-foreground max-[860px]:text-[1.05rem]">
              Folio
            </strong>
            <span className="block text-xs text-muted-foreground">Private autofill profile</span>
          </div>
        </div>

        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap max-[860px]:gap-[0.35rem]">
          <Button
            asChild
            variant="outline"
            className="min-h-12 flex-none rounded-full border border-border bg-card/80 px-5 text-brand-violet"
          >
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" aria-label="Star Folio on GitHub">
              <Github size={16} />
              <span className="max-[860px]:hidden">Star Folio</span>
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-12 flex-none rounded-full border border-border bg-card/80 px-5 text-brand-violet"
          >
            <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer" aria-label="Rate Folio in the Chrome Web Store">
              <Star size={16} />
              <span className="max-[860px]:hidden">Rate us</span>
            </a>
          </Button>

          <ToggleGroup
            type="single"
            value={themeMode}
            onValueChange={(value) => void handleThemeChange(value as ThemeMode)}
            className="flex items-center gap-[0.15rem] rounded-full bg-card/75 p-1"
          >
            <ToggleGroupItem value="light" aria-label="Light theme" className="h-[2.6rem] w-[2.6rem] rounded-full">
              <Sun size={14} />
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Dark theme" className="h-[2.6rem] w-[2.6rem] rounded-full">
              <Moon size={14} />
            </ToggleGroupItem>
            <ToggleGroupItem value="auto" aria-label="Auto theme" className="h-[2.6rem] w-[2.6rem] rounded-full">
              <Laptop size={14} />
            </ToggleGroupItem>
          </ToggleGroup>

          {!isFirstRun && (
            <Button onClick={handleSave} disabled={!isDirty}>
              <Save size={16} />
              {isDirty ? "Save changes" : "Saved"}
            </Button>
          )}
        </div>
      </header>

      {/* Onboarding or Main Content */}
      {isFirstRun ? (
        <OnboardingFlow
          profile={profile}
          step={onboardingStep}
          path={onboardingPath}
          resumeName={resumeDocuments[0]?.name || resumeDocuments[0]?.fileName}
          isUploading={isUploadingResume}
          uploadError={resumeUploadError}
          onStepChange={setOnboardingStep}
          onPathChange={setOnboardingPath}
          onPersonalChange={updatePersonal}
          onExperienceChange={updateExperience}
          onEducationChange={updateEducation}
          onEnabledChange={(enabled) => setProfile((current) => ({ ...current, preferences: { ...current.preferences, enabled } }))}
          onFilesSelected={addResumeFiles}
          onComplete={completeOnboarding}
        />
      ) : (
        <>
          {/* Hero */}
        <div className="flex items-center gap-6 px-0 pt-0 pb-2">
          <img
            className="h-44 w-auto flex-none object-contain pointer-events-none max-[860px]:hidden"
            src="/assets/mascot-waving.png"
            alt="Folio mascot holding a completed form"
          />
          <div className="min-w-0">
            <p className="mb-1.5 text-[0.95rem] font-bold text-brand-violet">
              Helloo! <span aria-hidden="true">👋</span>
            </p>
            <h1 className="mt-2 text-[clamp(2rem,3.5vw,3rem)] font-[720] leading-[1.05] tracking-[-0.05em] text-foreground max-[720px]:text-[1.75rem]">
              Customize once. Apply everywhere.
            </h1>
            <p className="mt-3 max-w-[36rem] text-base leading-[1.55] text-muted-foreground">
              {activeItem.description}
            </p>
          </div>
        </div>

          {/* Onboarding Progress */}
          {shouldShowOnboarding && (
            <section
              className="grid gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-brand-violet/5 p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.45fr)] max-[960px]:grid-cols-1"
              aria-labelledby="onboarding-title"
            >
              <div>
                <p className="mb-1.5 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-primary">Quick start</p>
                <h2 id="onboarding-title" className="text-[1.05rem] font-[650]">
                  Get Folio ready for your first application.
                </h2>
                <p className="mt-1.5 text-[0.82rem] leading-[1.5] text-muted-foreground">
                  Finish these once. Folio stays local, scans only when you ask, and fills only confident matches.
                </p>
              </div>
              <div className="self-center">
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {onboardingCompleteCount} of {onboardingSteps.length} done
                  </span>
                  <strong className="text-foreground">{onboardingProgress}%</strong>
                </div>
                <Progress value={onboardingProgress} className="h-1.5" />
              </div>
              <div className="col-span-full grid grid-cols-3 gap-2 max-[720px]:grid-cols-1">
                {onboardingSteps.map((step) => {
                  const Icon = step.complete ? CheckCircle2 : step.icon;
                  return (
                    <button
                      type="button"
                      key={step.label}
                      className={cn(
                        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.55rem] rounded-lg border border-border bg-card/80 p-[0.7rem] text-left text-foreground transition-all duration-150 ease-out hover:-translate-y-px hover:border-primary/40",
                        step.complete && "text-success"
                      )}
                      onClick={() => {
                        if (step.label === "Save your profile") {
                          void handleSave();
                          return;
                        }
                        requestSectionChange(step.section);
                      }}
                    >
                      <Icon size={16} />
                      <span className="min-w-0">
                        <strong className="block text-[0.78rem]">{step.label}</strong>
                        <small className="mt-0.5 block text-[0.68rem] leading-[1.35] text-muted-foreground">
                          {step.description}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Navigation & Content */}
            <Tabs className="grid gap-2" value={activeSection} onValueChange={(value) => requestSectionChange(value as SectionId)}>
            <div className="w-full border-b border-border">
              <TabsList
              variant="line"
              aria-label="Settings categories"
              className="flex w-full items-center justify-center gap-1 overflow-visible bg-transparent p-0 shadow-none flex-wrap mb-5"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="relative min-h-10 flex-none justify-center gap-2 rounded-none px-4 text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-gradient-to-r data-[state=active]:after:from-brand-violet data-[state=active]:after:to-primary data-[state=active]:after:content-[''] [&_svg]:h-4 [&_svg]:w-4"
                  >
                    <Icon size={15} />
                    {item.label}
                  </TabsTrigger>
                );
              })}
              </TabsList>
            </div>

            {status && (
              <div
                role="status"
                className="rounded-md border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success"
              >
                {status}
              </div>
            )}

            <main className="min-w-0">
              <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Overview */}
                {activeSection === "overview" && (
                  <div className="col-span-full grid gap-6">
                    <div className="grid grid-cols-4 gap-5 max-[720px]:grid-cols-1 max-[860px]:grid-cols-2 max-[480px]:grid-cols-1">
                      {overviewStats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                          <article
                            key={stat.label}
                            className="flex min-h-[9.5rem] items-center gap-4 rounded-2xl border border-border bg-card/80 p-5 shadow-md backdrop-blur-md"
                          >
                            <div className="flex h-[3.25rem] w-[3.25rem] flex-none items-center justify-center rounded-[0.85rem] bg-gradient-to-br from-brand-violet to-primary/90 text-foreground">
                              <Icon size={23} />
                            </div>
                            <div>
                              <strong className="block text-[2rem] tracking-[-0.04em]">{stat.value}</strong>
                              <span className="mt-1 block text-sm font-semibold">{stat.label}</span>
                              <small className="mt-[0.45rem] block text-xs text-muted-foreground">{stat.delta}</small>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-5 max-[720px]:grid-cols-1">
                      <Card className="min-h-[19rem]">
                        <CardHeader>
                          <CardTitle>Profile completion</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-0">
                            {overviewCompletionRows.map((row) => {
                              const Icon = row.icon;
                              return (
                                <button
                                  type="button"
                                  key={row.label}
                                  className="grid min-h-[3.8rem] grid-cols-[1.5rem_minmax(6rem,0.55fr)_minmax(6rem,1fr)_2.75rem_1.25rem] items-center gap-[0.8rem] border-b border-border px-4 text-left text-foreground transition-colors first:rounded-t-xl last:rounded-b-xl last:border-b-0 hover:border-primary/35"
                                  onClick={() => requestSectionChange(row.section)}
                                >
                                  <Icon size={16} />
                                  <span>{row.label}</span>
                                  <Progress value={row.value} className="h-[0.35rem] rounded-full bg-muted [&>div]:bg-primary" />
                                  <strong>{row.value}%</strong>
                                  <ChevronRight size={15} />
                                </button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="min-h-[19rem]">
                        <CardHeader className="flex items-center justify-between">
                          <CardTitle>AI assistant</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid min-h-80 content-center justify-items-center text-center">
                            <img
                              src="/assets/folio-mascot-face.png"
                              alt="Folio AI assistant mascot"
                              className="my-[-2.5rem_0_-1rem] h-52 w-40 object-contain"
                            />
                            <strong className="text-[1.1rem] text-brand-violet">Coming soon</strong>
                            <p className="max-w-[21rem] leading-[1.55] text-muted-foreground">
                              Future Folio updates will bring smarter help for application questions.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Personal */}
                {activeSection === "personal" && (
                  <Card className="col-span-full">
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

                {/* Files */}
                {activeSection === "files" && (
                  <Card className="col-span-full">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                      <div>
                        <CardTitle>My files</CardTitle>
                        <CardDescription>Upload resumes, preview them, and keep the ones you reuse for applications.</CardDescription>
                      </div>
                      <Button asChild variant="outline">
                        <label className="cursor-pointer">
                          <FilePlus2 size={16} />
                          Upload
                          <input
                            type="file"
                            accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
                            multiple
                            onChange={handleFilesUpload}
                            hidden
                          />
                        </label>
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {resumeDocuments.length === 0 ? (
                        <div className="grid min-h-48 items-center justify-items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
                          <FileText size={28} />
                          <p>No resumes uploaded yet.</p>
                          <span>Text, Markdown, and PDF files can be stored locally in your Folio profile.</span>
                        </div>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.38fr)_minmax(0,1fr)]">
                          <div className="grid content-start gap-[0.45rem]" aria-label="Uploaded resumes">
                            {resumeTags.length > 0 && (
                              <div className="mb-[0.35rem] flex flex-wrap gap-[0.35rem]" aria-label="Filter resumes by tag">
                                <button
                                  type="button"
                                  className={cn(
                                    "rounded-full border border-border bg-muted px-[0.55rem] py-[0.3rem] text-[0.7rem] text-muted-foreground",
                                    !fileTagFilter && "border-primary bg-primary text-primary-foreground"
                                  )}
                                  onClick={() => setFileTagFilter("")}
                                >
                                  All
                                </button>
                                {resumeTags.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    className={cn(
                                      "rounded-full border border-border bg-muted px-[0.55rem] py-[0.3rem] text-[0.7rem] text-muted-foreground",
                                      fileTagFilter === tag && "border-primary bg-primary text-primary-foreground"
                                    )}
                                    onClick={() => setFileTagFilter(tag)}
                                  >
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
                                className={cn(
                                  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.6rem] rounded-md border border-transparent bg-muted/40 p-[0.65rem] text-left text-foreground hover:border-primary/45",
                                  selectedDocument?.id === document.id && "border-primary/45 bg-primary/5"
                                )}
                              >
                                <FileText size={16} />
                                <span className="min-w-0">
                                  <strong className="block truncate">{document.name || document.fileName || "Resume"}</strong>
                                  <small className="block truncate text-[0.68rem] text-muted-foreground">
                                    {formatFileMeta(document)}
                                  </small>
                                  {profile.preferences.defaultResumeId === document.id && (
                                    <em className="mt-0.5 block truncate text-[0.65rem] not-italic text-primary">Default CV</em>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>

                          {selectedDocument && (
                            <div className="grid min-w-0 gap-4">
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

                              <div className="flex flex-wrap items-center gap-2">
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
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Label htmlFor="selected-file-preview">Preview</Label>
                                  <div className="flex flex-wrap items-center gap-2" aria-label="Preview zoom controls">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPreviewZoom((zoom) => Math.max(0.75, zoom - 0.1))}
                                    >
                                      <ZoomOut size={14} />
                                    </Button>
                                    <span className="min-w-[2.6rem] text-center text-[0.72rem] text-muted-foreground">
                                      {Math.round(previewZoom * 100)}%
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPreviewZoom((zoom) => Math.min(1.75, zoom + 0.1))}
                                    >
                                      <ZoomIn size={14} />
                                    </Button>
                                  </div>
                                </div>
                                {selectedDocument.contentKind === "dataUrl" && selectedDocument.mimeType === "application/pdf" ? (
                                  <div className="h-[32rem] overflow-auto rounded-lg border border-border bg-muted/40">
                                    <iframe
                                      className="w-full origin-top-left border-0"
                                      src={selectedDocument.content}
                                      style={{ height: `${520 / previewZoom}px`, transform: `scale(${previewZoom})` }}
                                      title={selectedDocument.name || selectedDocument.fileName}
                                    />
                                  </div>
                                ) : (
                                  <Textarea
                                    id="selected-file-preview"
                                    className="min-h-96 resize-y font-mono"
                                    style={{ fontSize: `${14 * previewZoom}px` }}
                                    value={selectedDocument.content}
                                    readOnly={selectedDocument.contentKind !== "text"}
                                    onChange={(event) =>
                                      updateDocument(selectedDocument.id, { content: event.target.value, size: event.target.value.length })
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <ConfirmationDialog
                      open={documentToDelete !== null}
                      onOpenChange={(open) => !open && setDocumentToDelete(null)}
                      title="Delete resume?"
                      description={
                        <>This removes {documentToDelete?.name || documentToDelete?.fileName || "this resume"} from Folio. This cannot be undone after you save.</>
                      }
                      confirmLabel="Delete resume"
                      destructive
                      onConfirm={() => documentToDelete && deleteDocument(documentToDelete.id)}
                    />
                  </Card>
                )}

                {/* Skills */}
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

                {/* Education */}
                {activeSection === "education" && (
                  <div className="col-span-full grid items-start gap-4 lg:grid-cols-[minmax(15rem,0.42fr)_minmax(0,1fr)]">
                    <Card>
                      <CardHeader className="flex items-start justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
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
                        <div className="max-h-[36rem] overflow-auto">
                          <EducationTimeline
                            entries={profile.education}
                            selectedIndex={selectedEducationIndex}
                            onSelect={setSelectedEducationIndex}
                          />
                        </div>
                        <div className="mt-4 flex gap-2 rounded-md bg-muted/40 p-3 text-[0.75rem] leading-[1.5] text-muted-foreground">
                          <Sparkles size={15} />
                          <p>Keep your newest or most relevant education easy to find. Folio uses this when matching school and degree fields.</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex items-start justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
                        <div>
                          <CardTitle>{selectedEducation.school || "School not set"}</CardTitle>
                          <CardDescription>
                            {[selectedEducation.degree, selectedEducation.fieldOfStudy, formatTimelineRange(selectedEducation.startDate, selectedEducation.endDate)]
                              .filter(Boolean)
                              .join(" - ")}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
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
                          <div className="col-span-full">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 p-6 pt-0">
                        <Button type="button" variant="ghost" onClick={deleteSelectedEducation} disabled={profile.education.length === 1}>
                          <Trash2 size={15} />
                          Delete
                        </Button>
                        <div className="flex items-center gap-2">
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

                {/* Experience */}
                {activeSection === "experience" && (
                  <div className="col-span-full grid items-start gap-4 lg:grid-cols-[minmax(15rem,0.42fr)_minmax(0,1fr)]">
                    <Card>
                      <CardHeader className="flex items-start justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
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
                        <div className="max-h-[36rem] overflow-auto">
                          <ol className="relative m-0 list-none p-0 before:absolute before:inset-y-0 before:left-[0.45rem] before:w-px before:bg-border before:content-['']">
                            {profile.experience.map((entry, index) => {
                              const isSelected = index === selectedExperienceIndex;
                              return (
                                <li key={`experience-${index}`} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-[0.6rem] pb-[0.65rem]">
                                  <span className="relative z-10 mt-3 h-[0.85rem] w-[0.85rem] rounded-full border-2 border-primary bg-card" />
                                  <button
                                    type="button"
                                    className={cn(
                                      "grid w-full gap-0.5 rounded-md border border-transparent bg-muted/40 p-[0.65rem] text-left text-foreground",
                                      isSelected && "border-primary/45"
                                    )}
                                    onClick={() => setSelectedExperienceIndex(index)}
                                  >
                                    <Badge variant="outline" className="justify-self-start">
                                      {formatExperienceRange(entry)}
                                    </Badge>
                                    <strong>{entry.title || "Untitled role"}</strong>
                                    <span className="text-[0.72rem] text-muted-foreground">{entry.company || "Company not set"}</span>
                                    {entry.location && <small className="text-[0.72rem] text-muted-foreground">{entry.location}</small>}
                                  </button>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                        <div className="mt-4 flex gap-2 rounded-md bg-muted/40 p-3 text-[0.75rem] leading-[1.5] text-muted-foreground">
                          <Sparkles size={15} />
                          <p>List your most relevant experience first. Focus on impact, not just duties.</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex items-start justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
                        <div>
                          <CardTitle>{selectedExperience.title || "Untitled role"}</CardTitle>
                          <CardDescription>
                            {[selectedExperience.company, selectedExperience.location, formatExperienceRange(selectedExperience)]
                              .filter(Boolean)
                              .join(" - ")}
                          </CardDescription>
                        </div>
                        {selectedExperience.current && <Badge className="justify-self-start">Current</Badge>}
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
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
                          <div className="col-span-full flex items-center justify-between rounded-md border border-border bg-muted/40 p-[0.7rem]">
                            <Label htmlFor="experience-selected-current">I currently work here</Label>
                            <Switch
                              id="experience-selected-current"
                              checked={selectedExperience.current}
                              onCheckedChange={(checked) => updateExperience(selectedExperienceIndex, "current", checked)}
                            />
                          </div>
                          <div className="col-span-full">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 p-6 pt-0">
                        <Button type="button" variant="ghost" onClick={deleteSelectedExperience} disabled={profile.experience.length === 1}>
                          <Trash2 size={15} />
                          Delete
                        </Button>
                        <div className="flex items-center gap-2">
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

                {/* AI */}
                {activeSection === "ai" && (
                  <Card className="col-span-full">
                    <CardContent>
                      <div className="mx-auto grid max-w-[34rem] justify-items-center px-4 py-12 text-center">
                        <div className="mb-4 h-60 w-44">
                          <img
                            src="/assets/folio-mascot-face.png"
                            alt="Folio AI assistant mascot"
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <p className="mb-1.5 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-primary">AI</p>
                        <h2 className="text-[1.4rem]">Coming soon in the next updates.</h2>
                        <p className="mt-3 leading-[1.6] text-muted-foreground">
                          We are preparing a smarter assistant for application questions, review, and writing help. For now, Folio stays focused on private profile autofill.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Data / Settings */}
                {activeSection === "data" && (
                  <div className="col-span-full grid gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Local data</CardTitle>
                        <CardDescription>Export a backup or import an existing Folio profile.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex flex-wrap items-center gap-2">
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

                        <div className="border-t border-border pt-6">
                          <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Permanently delete all your Folio data from this browser. This cannot be undone.
                          </p>
                          <Button variant="destructive" className="mt-4" onClick={() => setDeleteAllDialogOpen(true)}>
                            <Trash2 size={16} />
                            Delete all my data
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </main>
          </Tabs>

          {/* Unsaved Changes Dialog */}
          <AlertDialog open={pendingSection !== null} onOpenChange={(open) => !open && setPendingSection(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save changes before switching?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have unsaved profile updates. Save them locally before opening {pendingSectionLabel}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction onClick={() => void saveAndSwitchSection()}>Save and switch</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete All Data Dialog */}
          <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all Folio data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove your profile, resumes, settings, and all stored data from this browser. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDeleteAllData()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <Toaster position="bottom-right" closeButton />
    </OptionsLayout>
  );
}

/* ------------------------------------------------------------------ */
// Helpers
/* ------------------------------------------------------------------ */

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getStarterContactProgress(profile: FolioProfile): number {
  const fields: Array<keyof PersonalProfile> = ["firstName", "lastName", "email"];
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
  if (hours === 0) return "0";
  if (hours < 10) return hours.toFixed(1).replace(/\.0$/, "");
  return Math.round(hours).toLocaleString();
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getEntriesCompleteness<T extends object>(entries: T[], keys: Array<keyof T>): number {
  if (entries.length === 0) return 0;
  const completed = entries.reduce((total, entry) => {
    const filled = keys.filter((key) => String(entry[key] ?? "").trim().length > 0).length;
    return total + filled / keys.length;
  }, 0);
  return clampPercent((completed / entries.length) * 100);
}

function formatActivityDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
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
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(/\.0$/, "")} KB`;
  return `${(kb / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
}

function getDocumentTags(documents: ProfileDocument[]): string[] {
  return Array.from(new Set(documents.flatMap((document) => document.tags)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/* ------------------------------------------------------------------ */
// Sub-components
/* ------------------------------------------------------------------ */

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
      onSelect ||
      [entry.school, entry.degree, entry.fieldOfStudy, entry.startDate, entry.endDate, entry.description].some((value) => value.trim().length > 0)
    );

  if (visibleEntries.length === 0) {
    return (
      <div className="grid min-h-48 items-center justify-items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
        <GraduationCap size={22} />
        <p>Add your first school to start building the timeline.</p>
      </div>
    );
  }

  return (
    <ol className="relative m-0 list-none p-0 before:absolute before:inset-y-0 before:left-[0.45rem] before:w-px before:bg-border before:content-['']">
      {visibleEntries.map(({ entry, index }) => {
        const isSelected = index === selectedIndex;
        const content = (
          <>
            <Badge variant="outline" className="justify-self-start">
              {formatTimelineRange(entry.startDate, entry.endDate)}
            </Badge>
            <strong>{entry.degree || entry.fieldOfStudy || "Education"}</strong>
            <span className="text-[0.72rem] text-muted-foreground">{entry.school || "School not added yet"}</span>
            {entry.fieldOfStudy && entry.degree && <small className="text-[0.72rem] text-muted-foreground">{entry.fieldOfStudy}</small>}
            {entry.description && <p className="text-[0.72rem] text-muted-foreground">{entry.description}</p>}
          </>
        );

        const contentClassName = cn(
          "grid w-full gap-0.5 rounded-md border border-transparent bg-muted/40 p-[0.65rem] text-left text-foreground",
          isSelected ? "border-primary/45" : "hover:border-primary/45"
        );

        return (
          <li key={`education-${index}`} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-[0.6rem] pb-[0.65rem]">
            <span className="relative z-10 mt-3 h-[0.85rem] w-[0.85rem] rounded-full border-2 border-primary bg-card" />
            {onSelect ? (
              <button type="button" className={contentClassName} onClick={() => onSelect(index)}>
                {content}
              </button>
            ) : (
              <div className={contentClassName}>{content}</div>
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
  if (start && end) return `${start} - ${end}`;
  return start || end || "Dates pending";
}

function formatTimelineDate(value: string): string {
  if (!value.trim()) return "";
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
      <Select value={selectedOption?.value ?? ""} onValueChange={onChange} disabled={disabled || options.length === 0}>
        <SelectTrigger id={id} className="w-full" aria-label={label}>
          <SelectValue placeholder={value || placeholder} />
        </SelectTrigger>
        <SelectContent position="popper">
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
  if (!value) return "";
  const fullIsoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullIsoDate) return `${fullIsoDate[3]}/${fullIsoDate[2]}/${fullIsoDate[1]}`;
  const monthDate = value.match(/^(\d{4})-(\d{2})$/);
  if (monthDate) return `01/${monthDate[2]}/${monthDate[1]}`;
  return value;
}

function formatYearInputValue(value: string): string {
  if (!value) return "";
  const isoYear = value.match(/^(\d{4})/);
  return isoYear?.[1] ?? value.replace(/\D/g, "").slice(0, 4);
}