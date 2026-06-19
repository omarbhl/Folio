import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Coffee,
  FileDown,
  FilePlus2,
  FileText,
  Film,
  GraduationCap,
  Laptop,
  LayoutDashboard,
  Moon,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Tags,
  Trophy,
  Trash2,
  Upload,
  UserRound,
  X,
  Zap,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { CraneMark } from "../shared/brand";
import { defaultProfile } from "../shared/defaultProfile";
import {
  exportProfile,
  getProfile,
  getThemeMode,
  importProfile,
  saveProfile,
  saveThemeMode
} from "../shared/storage";
import { applyThemeMode } from "../shared/theme";
import type { CustomAnswer, EducationEntry, ExperienceEntry, FolioProfile, PersonalProfile, ProfileDocument, ThemeMode } from "../shared/types";

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

const emptyAnswer: CustomAnswer = {
  question: "",
  answer: "",
  tags: []
};

type SectionId = "overview" | "personal" | "files" | "skills" | "education" | "experience" | "answers" | "data";

const navItems: Array<{ id: SectionId; label: string; description: string; icon: typeof Sparkles }> = [
  { id: "overview", label: "Overview", description: "Your profile at a glance, theme, and autofill activity.", icon: LayoutDashboard },
  { id: "personal", label: "Personal info", description: "Core contact details Folio can match to application forms.", icon: UserRound },
  { id: "files", label: "My files", description: "Upload, preview, edit, and manage your resume library.", icon: FileText },
  { id: "skills", label: "Skills", description: "Keep a reusable skill set ready for application platforms.", icon: Tags },
  { id: "education", label: "Education", description: "Add the schools and programs that shaped you.", icon: GraduationCap },
  { id: "experience", label: "Experience", description: "Add the roles you've held and what you did there.", icon: BriefcaseBusiness },
  { id: "answers", label: "Custom answers", description: "Save go-to answers for recurring application questions.", icon: FileText },
  { id: "data", label: "Data & privacy", description: "Import, export, and inspect the Folio profile stored in this browser.", icon: ShieldCheck }
];

const activityChartConfig = {
  value: {
    label: "Value"
  },
  forms: {
    label: "Forms autofilled",
    color: "var(--chart-1)"
  },
  inputs: {
    label: "Inputs filled",
    color: "var(--chart-2)"
  },
  minutes: {
    label: "Minutes saved",
    color: "var(--chart-5)"
  }
} satisfies ChartConfig;

const SECONDS_SAVED_PER_FIELD = 8;
const SECONDS_SAVED_PER_FORM_REVIEW = 20;

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
  const [skillInput, setSkillInput] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(defaultProfile));
  const [status, setStatus] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [locationData, setLocationData] = useState<LocationDataApi | null>(null);
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [fileTagFilter, setFileTagFilter] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [documentToDelete, setDocumentToDelete] = useState<ProfileDocument | null>(null);
  const isDirty = JSON.stringify(profile) !== savedSnapshot;
  const estimatedSecondsSaved = profile.metrics.totalFieldsFilled * SECONDS_SAVED_PER_FIELD + profile.metrics.totalFormsFilled * SECONDS_SAVED_PER_FORM_REVIEW;
  const estimatedMinutesSaved = Math.max(0, Math.round(estimatedSecondsSaved / 60));
  const timeSavedComparison = useMemo(() => getTimeSavedComparison(estimatedSecondsSaved), [estimatedSecondsSaved]);
  const autofillLevel = useMemo(
    () => getAutofillLevel(profile.metrics.totalFieldsFilled, profile.metrics.totalFormsFilled),
    [profile.metrics.totalFieldsFilled, profile.metrics.totalFormsFilled]
  );
  const activityFunFacts = useMemo(
    () => getActivityFunFacts(profile.metrics.totalFieldsFilled, profile.metrics.totalFormsFilled, estimatedSecondsSaved),
    [estimatedSecondsSaved, profile.metrics.totalFieldsFilled, profile.metrics.totalFormsFilled]
  );
  const averageFieldsPerForm =
    profile.metrics.totalFormsFilled > 0 ? (profile.metrics.totalFieldsFilled / profile.metrics.totalFormsFilled).toFixed(1).replace(/\.0$/, "") : "0";
  const estimatedKeystrokesSaved = profile.metrics.totalFieldsFilled * 12;
  const coffeeBreaksSaved = Math.floor(estimatedMinutesSaved / 15);
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
  const activityChartData = useMemo(
    () => [
      { metric: "Forms", value: profile.metrics.totalFormsFilled, fill: "var(--color-forms)" },
      { metric: "Inputs", value: profile.metrics.totalFieldsFilled, fill: "var(--color-inputs)" },
      { metric: "Minutes", value: estimatedMinutesSaved, fill: "var(--color-minutes)" }
    ],
    [estimatedMinutesSaved, profile.metrics.totalFormsFilled, profile.metrics.totalFieldsFilled]
  );
  const isProfileComplete = profileCompleteness >= 100;
  const savedStateLabel = isDirty ? "Unsaved changes" : "Saved locally";
  const activeItem = navItems.find((item) => item.id === activeSection) ?? navItems[0];
  const profileJson = useMemo(() => JSON.stringify(profile, null, 2), [profile]);

  useEffect(() => {
    getProfile().then((storedProfile) => {
      if (storedProfile) {
        setProfile(storedProfile);
        setSavedSnapshot(JSON.stringify(storedProfile));
      } else {
        setSavedSnapshot(JSON.stringify(defaultProfile));
      }
    });
  }, []);

  useEffect(() => {
    getThemeMode().then(setThemeMode);
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

    setProfile((current) => ({ ...current, skills: [...current.skills, nextSkill] }));
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

  function updateExperience(index: number, key: keyof ExperienceEntry, value: string | boolean) {
    setProfile((current) => ({
      ...current,
      experience: current.experience.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [key]: value } : entry))
    }));
  }

  function updateAnswer(index: number, key: keyof CustomAnswer, value: string) {
    setProfile((current) => ({
      ...current,
      customAnswers: current.customAnswers.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: key === "tags" ? splitTags(value) : value } : entry
      )
    }));
  }

  async function handleSave() {
    await saveProfile(profile);
    setSavedSnapshot(JSON.stringify(profile));
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
    setProfile((current) => ({
      ...current,
      documents: [...current.documents.filter((document) => document.fileName || document.name), ...documents],
      preferences: { ...current.preferences, defaultResumeId: current.preferences.defaultResumeId || documents[0]?.id || "" }
    }));
    setSelectedDocumentId(documents[0]?.id ?? "");
    setStatus(`${documents.length} resume file${documents.length === 1 ? "" : "s"} added.`);
    event.target.value = "";
  }

  function updateDocument(id: string, updates: Partial<ProfileDocument>) {
    setProfile((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.id === id ? { ...document, ...updates, updatedAt: new Date().toISOString() } : document
      )
    }));
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
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border/60 bg-muted/30 md:flex lg:w-60">
        <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-4">
          <CraneMark className="h-8 w-8 text-primary" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Folio</p>
            <p className="text-sm font-semibold leading-tight">Settings</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3" aria-label="Settings categories">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          {isProfileComplete ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 size={14} />
              Profile complete
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Profile complete</span>
                <span className="font-medium text-foreground">{profileCompleteness}%</span>
              </div>
              <Progress value={profileCompleteness} className="h-1.5" />
            </div>
          )}

          <ToggleGroup
            type="single"
            value={themeMode}
            onValueChange={(value) => void handleThemeChange(value as ThemeMode)}
            className="grid grid-cols-3 gap-1"
          >
            <ToggleGroupItem value="light" aria-label="Light theme" className="h-8">
              <Sun size={14} />
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Dark theme" className="h-8">
              <Moon size={14} />
            </ToggleGroupItem>
            <ToggleGroupItem value="auto" aria-label="Auto theme" className="h-8">
              <Laptop size={14} />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile category nav */}
        <div className="border-b border-border/60 bg-muted/30 md:hidden">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <CraneMark className="h-6 w-6 text-primary" />
            <p className="text-sm font-semibold">Folio settings</p>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-3" aria-label="Settings categories">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "border-transparent bg-background text-foreground shadow-sm"
                      : "border-border/60 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Header */}
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{activeItem.label}</h1>
            <p className="text-sm text-muted-foreground">{activeItem.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isDirty ? "outline" : "secondary"} className="gap-1.5">
              {isDirty ? <Sparkles size={13} /> : <CheckCircle2 size={13} />}
              {savedStateLabel}
            </Badge>
            <Button onClick={handleSave} disabled={!isDirty}>
              <Save size={16} />
              {isDirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </header>

        {status && (
          <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-sm text-muted-foreground sm:px-6 lg:px-10" role="status">
            {status}
          </div>
        )}

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="options-content-grid">
            {activeSection === "overview" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Your professional identity travels with you.</CardTitle>
                    <CardDescription>
                      Create your profile once, keep it private, and decide exactly when Folio fills forms for you.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {isProfileComplete ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm">
                        <CheckCircle2 size={16} />
                        <span>Your profile is complete.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Profile completeness</span>
                          <span className="font-medium">{profileCompleteness}%</span>
                        </div>
                        <Progress value={profileCompleteness} />
                      </div>
                    )}

                    <div className="overview-items grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                        <GraduationCap size={16} className="text-muted-foreground" />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold">{profile.education.length}</p>
                          <p className="text-xs text-muted-foreground">Education</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                        <BriefcaseBusiness size={16} className="text-muted-foreground" />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold">{profile.experience.length}</p>
                          <p className="text-xs text-muted-foreground">Experience</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                        <Tags size={16} className="text-muted-foreground" />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold">{profile.skills.length}</p>
                          <p className="text-xs text-muted-foreground">Skills</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                        <FileText size={16} className="text-muted-foreground" />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold">{resumeDocuments.length}</p>
                          <p className="text-xs text-muted-foreground">Resume files</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Autofill activity</CardTitle>
                    <CardDescription>Inputs filled, forms handled, and tiny wins that add up.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="activity-rank">
                      <div>
                        <span>{autofillLevel.kicker}</span>
                        <strong>{autofillLevel.title}</strong>
                      </div>
                      <Badge variant="secondary" className="gap-1.5">
                        <Trophy size={13} />
                        {autofillLevel.badge}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                        <p className="text-2xl font-semibold">{profile.metrics.totalFormsFilled}</p>
                        <p className="text-xs text-muted-foreground">Forms filled</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                        <p className="text-2xl font-semibold">{profile.metrics.totalFieldsFilled}</p>
                        <p className="text-xs text-muted-foreground">Inputs filled</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                        <p className="text-2xl font-semibold">{formatTimeSaved(estimatedSecondsSaved)}</p>
                        <p className="text-xs text-muted-foreground">Estimated time saved</p>
                      </div>
                    </div>
                    <div className="activity-mini-grid">
                      <div>
                        <Zap size={15} />
                        <span>{averageFieldsPerForm}</span>
                        <small>inputs per form</small>
                      </div>
                      <div>
                        <Sparkles size={15} />
                        <span>{estimatedKeystrokesSaved.toLocaleString()}</span>
                        <small>keystrokes avoided</small>
                      </div>
                      <div>
                        <CheckCircle2 size={15} />
                        <span>{profile.metrics.lastAutofillAt ? "Active" : "Ready"}</span>
                        <small>{profile.metrics.lastAutofillAt ? `last used ${formatActivityDate(profile.metrics.lastAutofillAt)}` : "waiting for first fill"}</small>
                      </div>
                      <div>
                        <Coffee size={15} />
                        <span>{coffeeBreaksSaved}</span>
                        <small>coffee breaks saved</small>
                      </div>
                    </div>
                    <div className="time-saved-callout">
                      {timeSavedComparison.kind === "books" ? <BookOpen size={18} /> : <Film size={18} />}
                      <span>{timeSavedComparison.label}</span>
                    </div>
                    <div className="activity-fun-facts">
                      {activityFunFacts.map((fact) => (
                        <span key={fact}>{fact}</span>
                      ))}
                    </div>
                    <ChartContainer config={activityChartConfig} className="activity-chart mt-5 h-[220px] w-full">
                      <BarChart accessibilityLayer data={activityChartData} layout="vertical" margin={{ left: 8, right: 18 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <YAxis dataKey="metric" type="category" tickLine={false} axisLine={false} width={76} />
                        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Bar dataKey="value" radius={8}>
                          {activityChartData.map((entry) => (
                            <Cell key={entry.metric} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </>
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Education</CardTitle>
                    <CardDescription>Schools, degrees, and programs.</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setProfile((current) => ({ ...current, education: [...current.education, emptyEducation] }))}
                  >
                    <Plus size={16} />
                    Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.education.map((entry, index) => (
                    <article key={index} className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between">
                        <strong className="text-sm font-medium">Education {index + 1}</strong>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setProfile((current) => ({
                              ...current,
                              education: current.education.filter((_, entryIndex) => entryIndex !== index)
                            }))
                          }
                          disabled={profile.education.length === 1}
                        >
                          <Trash2 size={16} />
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(["school", "degree", "fieldOfStudy"] as Array<keyof EducationEntry>).map((key) => (
                          <div className="space-y-1.5" key={key}>
                            <Label htmlFor={`education-${index}-${key}`}>{key === "fieldOfStudy" ? "Field of study" : labelFromKey(key)}</Label>
                            <Input
                              id={`education-${index}-${key}`}
                              value={String(entry[key])}
                              onChange={(event) => updateEducation(index, key, event.target.value)}
                            />
                          </div>
                        ))}
                        <YearField
                          id={`education-${index}-startDate`}
                          label="Start date"
                          value={entry.startDate}
                          onChange={(value) => updateEducation(index, "startDate", value)}
                        />
                        <DateField
                          id={`education-${index}-endDate`}
                          label="End date"
                          value={entry.endDate}
                          onChange={(value) => updateEducation(index, "endDate", value)}
                        />
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`education-${index}-description`}>Description</Label>
                          <Textarea
                            id={`education-${index}-description`}
                            value={entry.description}
                            onChange={(event) => updateEducation(index, "description", event.target.value)}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </CardContent>
              </Card>
            )}

            {activeSection === "experience" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Experience</CardTitle>
                    <CardDescription>Roles, responsibilities, and impact.</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setProfile((current) => ({ ...current, experience: [...current.experience, emptyExperience] }))}
                  >
                    <Plus size={16} />
                    Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.experience.map((entry, index) => (
                    <article key={index} className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between">
                        <strong className="text-sm font-medium">Experience {index + 1}</strong>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setProfile((current) => ({
                              ...current,
                              experience: current.experience.filter((_, entryIndex) => entryIndex !== index)
                            }))
                          }
                          disabled={profile.experience.length === 1}
                        >
                          <Trash2 size={16} />
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(["company", "title", "location"] as Array<keyof ExperienceEntry>).map((key) => (
                          <div className="space-y-1.5" key={key}>
                            <Label htmlFor={`experience-${index}-${key}`}>{labelFromKey(key)}</Label>
                            <Input
                              id={`experience-${index}-${key}`}
                              value={String(entry[key])}
                              onChange={(event) => updateExperience(index, key, event.target.value)}
                            />
                          </div>
                        ))}
                        <DateField
                          id={`experience-${index}-startDate`}
                          label="Start date"
                          value={entry.startDate}
                          onChange={(value) => updateExperience(index, "startDate", value)}
                        />
                        <DateField
                          id={`experience-${index}-endDate`}
                          label="End date"
                          value={entry.endDate}
                          onChange={(value) => updateExperience(index, "endDate", value)}
                          disabled={entry.current}
                        />
                        <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2.5 sm:col-span-2">
                          <Label htmlFor={`experience-${index}-current`} className="cursor-pointer">
                            I currently work here
                          </Label>
                          <Switch
                            id={`experience-${index}-current`}
                            checked={entry.current}
                            onCheckedChange={(checked) => updateExperience(index, "current", checked)}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`experience-${index}-description`}>Description</Label>
                          <Textarea
                            id={`experience-${index}-description`}
                            value={entry.description}
                            onChange={(event) => updateExperience(index, "description", event.target.value)}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </CardContent>
              </Card>
            )}

            {activeSection === "answers" && (
              <Card className="span-columns custom-answers-card">
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Custom answers</CardTitle>
                    <CardDescription>Reusable answers for recurring application questions.</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setProfile((current) => ({ ...current, customAnswers: [...current.customAnswers, emptyAnswer] }))}
                  >
                    <Plus size={16} />
                    Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CustomAnswersTable
                    answers={profile.customAnswers}
                    onUpdate={updateAnswer}
                    onRemove={(index) =>
                      setProfile((current) => ({
                        ...current,
                        customAnswers: current.customAnswers.filter((_, entryIndex) => entryIndex !== index)
                      }))
                    }
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === "data" && (
              <Card className="span-columns">
                <CardHeader>
                  <CardTitle>Local data</CardTitle>
                  <CardDescription>Export, import, or reset the Folio profile stored in this browser.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-json-viewer">Profile JSON</Label>
                    <Textarea id="profile-json-viewer" className="json-viewer font-mono" value={profileJson} readOnly aria-readonly="true" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
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

function formatTimeSaved(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function getTimeSavedComparison(seconds: number): { kind: "books" | "movies"; label: string } {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const books = minutes / 360;
  const movies = minutes / 110;

  if (books >= 1) {
    return {
      kind: "books",
      label: `About reading ${formatComparisonCount(books)} ${books >= 1.5 ? "books" : "book"}.`
    };
  }

  return {
    kind: "movies",
    label: `About watching ${formatComparisonCount(movies)} ${movies >= 1.5 ? "movies" : "movie"}.`
  };
}

function formatComparisonCount(value: number): string {
  if (value < 0.1) {
    return "0.1";
  }

  if (value < 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }

  return Math.round(value).toLocaleString();
}

function getAutofillLevel(fields: number, forms: number): { kicker: string; title: string; badge: string } {
  const score = fields + forms * 8;
  const ranks = [
    { min: 900, title: "Offer letter orbit", badge: "Legend" },
    { min: 600, title: "Application astronaut", badge: "Cosmic" },
    { min: 360, title: "Form wizard", badge: "Arcane" },
    { min: 220, title: "Keyboard escape artist", badge: "Elite" },
    { min: 120, title: "Application sprinter", badge: "Pro" },
    { min: 55, title: "Typing dodger", badge: "Rising" },
    { min: 15, title: "Blue spark rookie", badge: "Fresh" },
    { min: 0, title: "Ready for launch", badge: "Starter" }
  ];

  return {
    kicker: "Automation rank",
    ...(ranks.find((rank) => score >= rank.min) ?? ranks[ranks.length - 1])
  };
}

function getActivityFunFacts(fields: number, forms: number, seconds: number): string[] {
  if (fields === 0 && forms === 0) {
    return ["First autofill will start the counter", "No typing saved yet", "Ready when the next form appears"];
  }

  const minutes = Math.max(0, Math.round(seconds / 60));
  const keystrokes = fields * 12;
  const tabsSurvived = Math.max(forms * 3, fields);
  return [
    `${keystrokes.toLocaleString()} fewer keystrokes`,
    `${tabsSurvived.toLocaleString()} fewer tiny form decisions`,
    `${Math.max(1, Math.round(minutes / 5)).toLocaleString()} focus blocks protected`
  ];
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
    updatedAt: now
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

type CustomAnswerRow = CustomAnswer & { rowIndex: number };

function CustomAnswersTable({
  answers,
  onUpdate,
  onRemove
}: {
  answers: CustomAnswer[];
  onUpdate: (index: number, key: keyof CustomAnswer, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [filter, setFilter] = useState("");
  const visibleAnswers = useMemo<CustomAnswerRow[]>(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    const rows = answers.map((answer, rowIndex) => ({ ...answer, rowIndex }));

    if (!normalizedFilter) {
      return rows;
    }

    return rows.filter((answer) =>
      [answer.question, answer.answer, answer.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter)
    );
  }, [answers, filter]);

  return (
    <div className="custom-answers-table-shell">
      <div className="custom-answers-table-toolbar">
        <Input
          placeholder="Filter answers..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="custom-answers-filter-input"
        />
      </div>
      <div className="custom-answers-data-table overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="custom-answer-question-column">Question</TableHead>
              <TableHead className="custom-answer-answer-column">Answer</TableHead>
              <TableHead className="custom-answer-tags-column">Tags</TableHead>
              <TableHead className="custom-answer-actions-column">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleAnswers.length > 0 ? (
              visibleAnswers.map((answer) => (
                <TableRow key={answer.rowIndex}>
                  <TableCell>
                    <Input
                      aria-label={`Question ${answer.rowIndex + 1}`}
                      value={answer.question}
                      onChange={(event) => onUpdate(answer.rowIndex, "question", event.target.value)}
                      placeholder="Question Folio should recognize"
                      className="custom-answer-question-input"
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      aria-label={`Answer ${answer.rowIndex + 1}`}
                      value={answer.answer}
                      onChange={(event) => onUpdate(answer.rowIndex, "answer", event.target.value)}
                      placeholder="Reusable answer"
                      className="custom-answer-table-textarea"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Tags ${answer.rowIndex + 1}`}
                      value={answer.tags.join(", ")}
                      onChange={(event) => onUpdate(answer.rowIndex, "tags", event.target.value)}
                      placeholder="learned, motivation"
                      className="custom-answer-tags-input"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(answer.rowIndex)}
                      disabled={answers.length === 1}
                      className="custom-answer-remove-button"
                    >
                      <Trash2 size={16} />
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No custom answers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="custom-answers-table-count">
        Showing {visibleAnswers.length} of {answers.length} saved answers.
      </p>
    </div>
  );
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
        placeholder="DD/MM/YYYY"
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
        placeholder="YYYY"
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
