import type { ProfilePath } from "./types";

type SupportedFieldLanguage = "en" | "fr";

type FieldLexiconEntry = {
  path: ProfilePath;
  terms: Record<SupportedFieldLanguage, string[]>;
};

export const FIELD_LEXICON: FieldLexiconEntry[] = [
  {
    path: "personal.firstName",
    terms: {
      en: ["first name", "firstname", "given name", "forename"],
      fr: ["prenom", "premier prenom", "votre prenom"]
    }
  },
  {
    path: "personal.lastName",
    terms: {
      en: ["last name", "lastname", "surname", "family name"],
      fr: ["nom", "nom de famille", "votre nom"]
    }
  },
  {
    path: "personal.fullName",
    terms: {
      en: ["full name", "name"],
      fr: ["nom complet", "nom et prenom", "prenom et nom", "identite"]
    }
  },
  {
    path: "personal.email",
    terms: {
      en: ["email", "e-mail", "email address"],
      fr: ["email", "e-mail", "adresse email", "adresse e-mail", "courriel", "adresse courriel"]
    }
  },
  {
    path: "personal.phone",
    terms: {
      en: ["phone", "phone number", "mobile", "mobile number", "telephone"],
      fr: ["telephone", "numero de telephone", "portable", "numero de portable", "mobile", "numero mobile"]
    }
  },
  {
    path: "personal.address",
    terms: {
      en: ["address", "street address"],
      fr: ["adresse", "adresse postale", "adresse personnelle", "rue"]
    }
  },
  {
    path: "personal.city",
    terms: {
      en: ["city", "town"],
      fr: ["ville", "commune", "localite"]
    }
  },
  {
    path: "personal.country",
    terms: {
      en: ["country"],
      fr: ["pays"]
    }
  },
  {
    path: "personal.postalCode",
    terms: {
      en: ["postal code", "postcode", "zip", "zip code"],
      fr: ["code postal", "cp"]
    }
  },
  {
    path: "personal.linkedin",
    terms: {
      en: ["linkedin", "linkedin profile"],
      fr: ["linkedin", "profil linkedin"]
    }
  },
  {
    path: "personal.github",
    terms: {
      en: ["github", "github profile"],
      fr: ["github", "profil github"]
    }
  },
  {
    path: "personal.portfolio",
    terms: {
      en: ["portfolio", "website", "personal website"],
      fr: ["portfolio", "site web", "site personnel", "site internet"]
    }
  }
];

export function getFieldTerms(entry: FieldLexiconEntry): string[] {
  return Object.values(entry.terms).flat();
}
