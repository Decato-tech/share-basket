export type HouseholdRpcErrorKey =
  | "already_in_household"
  | "invalid_invite_code"
  | "not_authenticated"
  | "household_lookup_unavailable";

type HouseholdErrorLanguage = "en" | "nl";

const householdRpcErrorMessages: Record<
  HouseholdRpcErrorKey,
  Record<HouseholdErrorLanguage, string>
> = {
  already_in_household: {
    en: "This account already belongs to a household. If it loads, leave that household from Settings before creating or joining another one.",
    nl: "Dit account hoort al bij een huishouden. Als het opent, verlaat dat huishouden via Instellingen voordat je een nieuw huishouden aanmaakt of lid wordt.",
  },
  invalid_invite_code: {
    en: "That invite code is not valid.",
    nl: "Die uitnodigingscode is niet geldig.",
  },
  not_authenticated: {
    en: "Please sign in again and retry.",
    nl: "Log opnieuw in en probeer het nog eens.",
  },
  household_lookup_unavailable: {
    en: "Household loading is temporarily unavailable while the database update finishes. Please refresh in a moment.",
    nl: "Huishouden laden is tijdelijk niet beschikbaar terwijl de database-update wordt afgerond. Vernieuw de pagina zo meteen.",
  },
};

export function householdRpcErrorKey(message: string): HouseholdRpcErrorKey | null {
  const normalized = message.toLowerCase();

  if (normalized.includes("already belongs to a household")) {
    return "already_in_household";
  }

  if (normalized.includes("invalid invite code")) {
    return "invalid_invite_code";
  }

  if (normalized.includes("not authenticated")) {
    return "not_authenticated";
  }

  if (
    normalized.includes("get_my_household") &&
    (normalized.includes("schema cache") || normalized.includes("could not find the function"))
  ) {
    return "household_lookup_unavailable";
  }

  return null;
}

export function householdRpcErrorMessage(message: string, lang: HouseholdErrorLanguage) {
  const key = householdRpcErrorKey(message);
  return key ? householdRpcErrorMessages[key][lang] : message;
}
