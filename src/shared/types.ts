export type DocumentType = "resume" | "coverLetter" | "portfolio" | "other";
export type ThemeMode = "light" | "dark" | "auto";

export type ProfilePath =
  | "personal.firstName"
  | "personal.lastName"
  | "personal.fullName"
  | "personal.email"
  | "personal.phone"
  | "personal.address"
  | "personal.city"
  | "personal.country"
  | "personal.postalCode"
  | "personal.linkedin"
  | "personal.github"
  | "personal.portfolio"
  | `customAnswers.${number}`;

export interface PersonalProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface EducationEntry {
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ExperienceEntry {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface ProfileDocument {
  id: string;
  name: string;
  type: DocumentType;
  tags: string[];
  fileName: string;
  mimeType: string;
  size: number;
  content: string;
  contentKind: "text" | "dataUrl";
  createdAt: string;
  updatedAt: string;
}

export interface CustomAnswer {
  question: string;
  answer: string;
  tags: string[];
}

export interface ProfileMetrics {
  totalFormsFilled: number;
  totalFieldsFilled: number;
  lastAutofillAt: string;
}

export interface AutofillPreferences {
  countryAliases: string[];
  cityAliases: string[];
  defaultResumeId: string;
}

export interface FolioProfile {
  personal: PersonalProfile;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: string[];
  documents: ProfileDocument[];
  customAnswers: CustomAnswer[];
  metrics: ProfileMetrics;
  preferences: AutofillPreferences;
}

export interface DetectedField {
  index: number;
  tagName: "input" | "textarea" | "select";
  inputType: string;
  name: string;
  id: string;
  autocomplete: string;
  placeholder: string;
  ariaLabel: string;
  labelText: string;
  nearbyText: string;
  value: string;
}

export interface DetectedUploadField {
  index: number;
  name: string;
  id: string;
  accept: string;
  ariaLabel: string;
  labelText: string;
  nearbyText: string;
}

export interface FieldMatch {
  field: DetectedField;
  profilePath: ProfilePath;
  value: string;
  confidence: number;
  source: string;
  needsReview: boolean;
}

export interface FillRequestMatch {
  fieldIndex: number;
  value: string;
  alternatives?: string[];
}

export type ContentMessage =
  | { action: "SCAN_FIELDS" }
  | { action: "FILL_FIELDS"; matches: FillRequestMatch[]; overwriteExisting: boolean }
  | { action: "SCAN_RESUME_UPLOADS" }
  | { action: "FILL_RESUME_UPLOAD"; fieldIndex: number; fileName: string; mimeType: string; content: string; contentKind: "text" | "dataUrl" };

export interface FillResult {
  filledCount: number;
  skippedCount: number;
}
