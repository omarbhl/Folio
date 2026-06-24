import type { FolioProfile } from "./types";

export const defaultProfile: FolioProfile = {
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
      updatedAt: ""
    }
  ],
  customAnswers: [
    { question: "Why do you want to work here?", answer: "", tags: ["motivation"] },
    { question: "Tell us about yourself.", answer: "", tags: ["intro"] },
    { question: "What is your notice period?", answer: "", tags: ["availability"] },
    { question: "What are your salary expectations?", answer: "", tags: ["compensation"] }
  ],
  metrics: {
    totalFormsFilled: 0,
    totalFieldsFilled: 0,
    lastAutofillAt: ""
  },
  preferences: {
    enabled: true,
    countryAliases: [],
    cityAliases: [],
    defaultResumeId: "",
    learnedSiteHosts: []
  }
};
