import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Keyboard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { FeedbackState } from "@/components/shared/feedback-state";
import { FormField, getFieldA11yProps } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import type { EducationEntry, ExperienceEntry, FolioProfile, OnboardingPath, PersonalProfile } from "@/shared/types";

const STEP_LABELS = ["Welcome", "Setup path", "Resume", "Personal", "Background", "Preferences", "Ready"];
const ACCEPTED_FILE_TYPES = ".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf";

type OnboardingFlowProps = {
  profile: FolioProfile;
  step: number;
  path: OnboardingPath;
  resumeName?: string;
  isUploading: boolean;
  uploadError?: string;
  onStepChange: (step: number) => void;
  onPathChange: (path: OnboardingPath) => void;
  onPersonalChange: (key: keyof PersonalProfile, value: string) => void;
  onExperienceChange: (index: number, key: keyof ExperienceEntry, value: string | boolean) => void;
  onEducationChange: (index: number, key: keyof EducationEntry, value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onFilesSelected: (files: File[]) => Promise<void>;
  onComplete: () => Promise<void>;
};

type PersonalErrors = Partial<Record<"firstName" | "lastName" | "email", string>>;

export function OnboardingFlow({
  profile,
  step,
  path,
  resumeName,
  isUploading,
  uploadError,
  onStepChange,
  onPathChange,
  onPersonalChange,
  onExperienceChange,
  onEducationChange,
  onEnabledChange,
  onFilesSelected,
  onComplete
}: OnboardingFlowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [personalErrors, setPersonalErrors] = useState<PersonalErrors>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const progress = Math.round((step / (STEP_LABELS.length - 1)) * 100);
  const experience = profile.experience[0];
  const education = profile.education[0];
  const resumeReady = Boolean(resumeName);
  const requiredDetailsReady = useMemo(
    () => Boolean(profile.personal.firstName.trim() && profile.personal.lastName.trim() && isValidEmail(profile.personal.email)),
    [profile.personal.email, profile.personal.firstName, profile.personal.lastName]
  );

  function goToStep(nextStep: number) {
    onStepChange(Math.max(0, Math.min(STEP_LABELS.length - 1, nextStep)));
  }

  function validatePersonalDetails() {
    const errors: PersonalErrors = {};
    if (!profile.personal.firstName.trim()) errors.firstName = "Enter your first name.";
    if (!profile.personal.lastName.trim()) errors.lastName = "Enter your last name.";
    if (!profile.personal.email.trim()) errors.email = "Enter the email you use for applications.";
    else if (!isValidEmail(profile.personal.email)) errors.email = "Enter a valid email address.";
    setPersonalErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function continueFromPersonal() {
    if (validatePersonalDetails()) goToStep(4);
  }

  async function completeOnboarding() {
    setIsCompleting(true);
    setCompletionError("");
    try {
      await onComplete();
    } catch {
      setCompletionError("Folio could not finish setup. Your information is still here—please try again.");
      setIsCompleting(false);
    }
  }

  async function acceptFiles(files: File[]) {
    if (files.length === 0) return;
    setIsDragging(false);
    await onFilesSelected(files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void acceptFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <main className="motion-enter mx-auto grid w-full max-w-5xl gap-6 pb-10" aria-labelledby="onboarding-title">
      <PageHeader
        eyebrow="Private setup"
        title="Get Folio ready for your first application."
        description="A focused setup that keeps your information on this device and gets you to your first successful fill quickly."
      />

      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-md">
        <CardHeader className="border-b border-border/70 bg-surface-soft/70 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle id="onboarding-title" className="text-base">{STEP_LABELS[step]}</CardTitle>
              <CardDescription>Step {step + 1} of {STEP_LABELS.length}</CardDescription>
            </div>
            <Badge variant="secondary">{progress}% complete</Badge>
          </div>
          <Progress value={progress} className="mt-3 h-1.5" aria-label="Onboarding progress" />
          <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Setup steps">
            {STEP_LABELS.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    index === step && "bg-primary/10 font-semibold text-primary",
                    index < step && "text-success"
                  )}
                  onClick={() => index < step && goToStep(index)}
                  disabled={index >= step}
                  aria-current={index === step ? "step" : undefined}
                >
                  <span className={cn("grid size-6 place-items-center rounded-full border border-border", index <= step && "border-primary/40 bg-background") }>
                    {index < step ? <Check size={13} /> : index + 1}
                  </span>
                  <span className="hidden sm:block">{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </CardHeader>

        <CardContent className="min-h-[420px] p-5 sm:p-7">
          <div key={step} className="motion-enter">
            {step === 0 && (
              <div className="mx-auto grid max-w-2xl place-items-center gap-6 py-6 text-center">
                <div className="grid size-16 place-items-center rounded-2xl bg-primary/12 text-primary shadow-sm">
                  <Sparkles size={30} />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Your profile, ready when you are.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Folio matches the repetitive fields on job applications and fills only when you choose. It never submits a form for you.
                  </p>
                </div>
                <div className="grid w-full gap-3 text-left sm:grid-cols-3">
                  <ValueCard icon={LockKeyhole} title="Stored locally" description="Profile and documents remain in browser storage." />
                  <ValueCard icon={ShieldCheck} title="You stay in control" description="Review every result before submitting." />
                  <ValueCard icon={Sparkles} title="Confident matches" description="Folio fills only fields it can safely identify." />
                </div>
                <Button type="button" size="lg" className="motion-press" onClick={() => goToStep(1)}>
                  Start private setup <ArrowRight />
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="mx-auto max-w-2xl">
                <StepHeading title="How would you like to begin?" description="Both paths lead to the same editable profile. You can add or replace a resume later." />
                <RadioGroup value={path} onValueChange={(value) => onPathChange(value as OnboardingPath)} className="mt-6 grid gap-3 sm:grid-cols-2">
                  <ChoiceCard value="resume" icon={FileText} title="Start with a resume" description="Store a PDF, TXT, or Markdown resume locally, then review your details." />
                  <ChoiceCard value="manual" icon={Keyboard} title="Enter details manually" description="Start with essential contact information and add the rest at your pace." />
                </RadioGroup>
                <OnboardingActions onBack={() => goToStep(0)} onNext={() => goToStep(2)} nextLabel={path === "resume" ? "Upload resume" : "Enter my details"} />
              </div>
            )}

            {step === 2 && (
              <div className="mx-auto max-w-2xl">
                <StepHeading
                  title={path === "resume" ? "Add your resume" : "Resume is optional"}
                  description="Folio supports PDF, plain text, and Markdown. Files are read locally and are not uploaded to a server."
                />
                {path === "resume" || resumeReady ? (
                  <div className="mt-6 grid gap-4">
                    <div
                      className={cn(
                        "interactive-lift grid min-h-48 place-items-center rounded-xl border-2 border-dashed border-border bg-surface-soft/50 p-6 text-center",
                        isDragging && "border-primary bg-primary/8"
                      )}
                      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={(event) => void acceptFiles(Array.from(event.target.files ?? []))}
                      />
                      {isUploading ? (
                        <div className="grid w-full max-w-xs gap-3" role="status">
                          <LoaderCircle className="mx-auto size-7 animate-spin text-primary" />
                          <p className="text-sm font-medium">Reading your resume locally…</p>
                          <Skeleton className="h-2 w-full" />
                        </div>
                      ) : resumeReady ? (
                        <div className="motion-success grid gap-2">
                          <CheckCircle2 className="mx-auto size-8 text-success" />
                          <p className="font-semibold">{resumeName}</p>
                          <p className="text-sm text-muted-foreground">Stored in this Folio profile and ready for upload fields.</p>
                          <Button type="button" variant="outline" size="sm" className="mx-auto mt-2" onClick={() => fileInputRef.current?.click()}>
                            Replace file
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <Upload className="mx-auto size-8 text-primary" />
                          <p className="font-semibold">Drop your resume here</p>
                          <p className="text-sm text-muted-foreground">PDF, TXT, MD · stored locally</p>
                          <Button type="button" variant="outline" className="mx-auto mt-2" onClick={() => fileInputRef.current?.click()}>
                            Choose a file
                          </Button>
                        </div>
                      )}
                    </div>
                    {uploadError && <FeedbackState variant="error" compact title="Resume could not be read" description={uploadError} />}
                    <Alert>
                      <FileText />
                      <AlertTitle>Review remains important</AlertTitle>
                      <AlertDescription>Folio stores this document for form uploads. Automatic resume extraction is not available yet, so you will review and enter profile details next.</AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <FeedbackState title="Continue without a resume" description="You can add one later from Documents. Your contact details are enough to start using Folio." />
                )}
                <OnboardingActions
                  onBack={() => goToStep(1)}
                  onNext={() => goToStep(3)}
                  nextLabel="Review personal details"
                  secondaryLabel={!resumeReady ? "Skip resume" : undefined}
                  onSecondary={!resumeReady ? () => goToStep(3) : undefined}
                  nextDisabled={path === "resume" && !resumeReady}
                />
              </div>
            )}

            {step === 3 && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title="Review your essential details" description="Required fields are used for common application inputs. Everything remains editable later." />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <PersonalInput id="onboarding-first-name" label="First name" value={profile.personal.firstName} error={personalErrors.firstName} onChange={(value) => onPersonalChange("firstName", value)} />
                  <PersonalInput id="onboarding-last-name" label="Last name" value={profile.personal.lastName} error={personalErrors.lastName} onChange={(value) => onPersonalChange("lastName", value)} />
                  <PersonalInput id="onboarding-email" label="Application email" type="email" value={profile.personal.email} error={personalErrors.email} description="Use the address employers should contact." onChange={(value) => onPersonalChange("email", value)} />
                  <PersonalInput id="onboarding-phone" label="Phone" type="tel" value={profile.personal.phone} optional description="Include your country code where applicable." onChange={(value) => onPersonalChange("phone", value)} />
                  <PersonalInput id="onboarding-city" label="City" value={profile.personal.city} optional onChange={(value) => onPersonalChange("city", value)} />
                  <PersonalInput id="onboarding-country" label="Country" value={profile.personal.country} optional onChange={(value) => onPersonalChange("country", value)} />
                </div>
                {!requiredDetailsReady && <p className="mt-4 text-sm text-muted-foreground">First name, last name, and a valid email are required to finish setup.</p>}
                <OnboardingActions onBack={() => goToStep(2)} onNext={continueFromPersonal} nextLabel="Review background" />
              </div>
            )}

            {step === 4 && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title="Add a quick background" description="Experience and education are optional for setup. Add the most relevant entry now or complete them later." />
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Card className="border-border/80 shadow-xs">
                    <CardHeader>
                      <CardTitle className="text-base">Recent experience</CardTitle>
                      <CardDescription>Start with your current or most recent role.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <FormField id="onboarding-role" label="Role" optional><Input id="onboarding-role" value={experience?.title ?? ""} onChange={(event) => onExperienceChange(0, "title", event.target.value)} placeholder="Frontend Engineer" /></FormField>
                      <FormField id="onboarding-company" label="Company" optional><Input id="onboarding-company" value={experience?.company ?? ""} onChange={(event) => onExperienceChange(0, "company", event.target.value)} placeholder="Company name" /></FormField>
                    </CardContent>
                  </Card>
                  <Card className="border-border/80 shadow-xs">
                    <CardHeader>
                      <CardTitle className="text-base">Education</CardTitle>
                      <CardDescription>Add the qualification most relevant to your search.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <FormField id="onboarding-school" label="School" optional><Input id="onboarding-school" value={education?.school ?? ""} onChange={(event) => onEducationChange(0, "school", event.target.value)} placeholder="University or school" /></FormField>
                      <FormField id="onboarding-degree" label="Degree" optional><Input id="onboarding-degree" value={education?.degree ?? ""} onChange={(event) => onEducationChange(0, "degree", event.target.value)} placeholder="Degree or certificate" /></FormField>
                    </CardContent>
                  </Card>
                </div>
                <OnboardingActions onBack={() => goToStep(3)} onNext={() => goToStep(5)} nextLabel="Set preferences" secondaryLabel="Skip for now" onSecondary={() => goToStep(5)} />
              </div>
            )}

            {step === 5 && (
              <div className="mx-auto max-w-2xl">
                <StepHeading title="Choose how Folio starts" description="You can change this from the popup at any time." />
                <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-soft/60 p-4">
                  <div>
                    <p className="font-medium">Keep Folio enabled</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Folio checks the active page only after you open the popup. Filling still requires your click.</p>
                  </div>
                  <Switch checked={profile.preferences.enabled} onCheckedChange={onEnabledChange} aria-label="Keep Folio enabled" />
                </div>
                <Separator className="my-6" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <PrivacyPoint title="No automatic submission" description="Folio never presses a form's submit button." />
                  <PrivacyPoint title="No profile telemetry" description="Your application profile is not sent to Folio servers." />
                </div>
                <OnboardingActions onBack={() => goToStep(4)} onNext={() => goToStep(6)} nextLabel="Review completion" />
              </div>
            )}

            {step === 6 && (
              <div className="mx-auto grid max-w-2xl place-items-center gap-5 py-6 text-center">
                <div className="motion-success grid size-16 place-items-center rounded-full bg-success/12 text-success"><CheckCircle2 size={32} /></div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Folio is ready.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Save your profile, open a job application, then use the Folio popup to review detected fields and fill confident matches.</p>
                </div>
                <div className="grid w-full gap-2 rounded-xl border border-border bg-surface-soft/50 p-4 text-left text-sm">
                  <CompletionRow complete={requiredDetailsReady} label="Essential contact details" />
                  <CompletionRow complete={resumeReady} label={resumeReady ? `Resume: ${resumeName}` : "Resume can be added later"} />
                  <CompletionRow complete label="Private local storage" />
                </div>
                {completionError && <FeedbackState variant="error" compact title="Setup was not saved" description={completionError} />}
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" onClick={() => goToStep(5)} disabled={isCompleting}><ArrowLeft /> Back</Button>
                  <Button type="button" size="lg" className="motion-press" onClick={() => void completeOnboarding()} disabled={isCompleting || !requiredDetailsReady}>
                    {isCompleting ? <><LoaderCircle className="animate-spin" /> Saving profile…</> : <>Save profile and open Folio <ArrowRight /></>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>;
}

function ValueCard({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
  return <div className="interactive-lift rounded-xl border border-border bg-surface-soft/55 p-4"><Icon className="size-5 text-primary" /><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>;
}

function ChoiceCard({ value, icon: Icon, title, description }: { value: OnboardingPath; icon: typeof FileText; title: string; description: string }) {
  return (
    <label className="interactive-lift flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 has-data-checked:border-primary has-data-checked:bg-primary/6">
      <RadioGroupItem value={value} aria-label={title} />
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span></span>
    </label>
  );
}

function PersonalInput({ id, label, value, onChange, type = "text", description, error, optional = false }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; description?: string; error?: string; optional?: boolean }) {
  return <FormField id={id} label={label} description={description} error={error} optional={optional}><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} {...getFieldA11yProps(id, description, error)} /></FormField>;
}

function OnboardingActions({ onBack, onNext, nextLabel, nextDisabled = false, secondaryLabel, onSecondary }: { onBack: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean; secondaryLabel?: string; onSecondary?: () => void }) {
  return <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><Button type="button" variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button><div className="flex flex-wrap gap-2">{secondaryLabel && onSecondary && <Button type="button" variant="outline" onClick={onSecondary}>{secondaryLabel}</Button>}<Button type="button" className="motion-press" onClick={onNext} disabled={nextDisabled}>{nextLabel} <ArrowRight /></Button></div></div>;
}

function PrivacyPoint({ title, description }: { title: string; description: string }) {
  return <div className="rounded-lg border border-border bg-card p-3 text-left"><ShieldCheck className="size-4 text-success" /><p className="mt-2 text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>;
}

function CompletionRow({ complete, label }: { complete: boolean; label: string }) {
  return <div className="flex items-center gap-2"><span className={cn("grid size-5 place-items-center rounded-full", complete ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>{complete ? <Check size={13} /> : "–"}</span><span>{label}</span></div>;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
