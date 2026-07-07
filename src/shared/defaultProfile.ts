import type { FolioProfile } from "./types";

export const APP_VERSION = "1.0.1";
export const PROFILE_VERSION = 2;
const createdAt = new Date().toISOString();

export const defaultProfile: FolioProfile = {
  metadata: {
    appVersion: APP_VERSION,
    profileVersion: PROFILE_VERSION,
    createdAt,
    updatedAt: createdAt
  },
  personal: {
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    linkedin: "",
    github: "",
    portfolio: ""
  },
  education: [
    {
      school: "",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
      description: ""
    }
  ],
  experience: [
    {
      company: "",
      title: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      description: ""
    }
  ],
  skills: [],
  documents: [
    {
      id: "",
      name: "",
      type: "resume",
      tags: [],
      fileName: "",
      mimeType: "text/plain",
      size: 0,
      content: "",
      contentKind: "text",
      createdAt: "",
      updatedAt: "",
      usageCount: 0,
      lastUsedAt: ""
    }
  ],
  metrics: {
    totalFormsFilled: 0,
    totalFieldsFilled: 0,
    lastAutofillAt: "",
    activityLog: []
  },
  preferences: {
    enabled: true,
    countryAliases: [],
    cityAliases: [],
    defaultResumeId: ""
  }
};
