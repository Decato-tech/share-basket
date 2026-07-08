import { householdRpcErrorMessage } from "./household-errors.ts";
import type { Lang } from "./i18n";

export type UserErrorContext =
  | "auth"
  | "settings_load"
  | "settings_save"
  | "settings_leave"
  | "item_save"
  | "item_delete"
  | "grocery"
  | "generic";

type LocalizedMessage = Record<Lang, string>;

const messages: Record<string, LocalizedMessage> = {
  auth_invalid_credentials: {
    en: "The email or password is incorrect.",
    nl: "Het e-mailadres of wachtwoord is onjuist.",
  },
  auth_email_not_confirmed: {
    en: "Please confirm your email before signing in.",
    nl: "Bevestig je e-mail voordat je inlogt.",
  },
  auth_rate_limited: {
    en: "Too many attempts. Please wait a moment and try again.",
    nl: "Te veel pogingen. Wacht even en probeer het opnieuw.",
  },
  auth_weak_password: {
    en: "Use a stronger password with at least 6 characters.",
    nl: "Gebruik een sterker wachtwoord van minimaal 6 tekens.",
  },
  auth_signup_unavailable: {
    en: "Creating an account is temporarily unavailable. Please try again later.",
    nl: "Een account aanmaken is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
  },
  permission_denied: {
    en: "You do not have permission to do that for this household.",
    nl: "Je hebt geen toestemming om dit voor dit huishouden te doen.",
  },
  network_unavailable: {
    en: "Could not reach the server. Check your connection and try again.",
    nl: "Kan de server niet bereiken. Controleer je verbinding en probeer het opnieuw.",
  },
  request_timed_out: {
    en: "The request took too long. Please try again.",
    nl: "Het verzoek duurde te lang. Probeer het opnieuw.",
  },
  item_save_failed: {
    en: "Could not save this item. Please try again.",
    nl: "Dit product kon niet worden opgeslagen. Probeer het opnieuw.",
  },
  item_delete_failed: {
    en: "Could not delete this item. Please try again.",
    nl: "Dit product kon niet worden verwijderd. Probeer het opnieuw.",
  },
  settings_load_failed_detail: {
    en: "Settings could not be loaded. Please try again.",
    nl: "Instellingen konden niet worden geladen. Probeer het opnieuw.",
  },
  settings_save_failed: {
    en: "Settings could not be saved. Please try again.",
    nl: "Instellingen konden niet worden opgeslagen. Probeer het opnieuw.",
  },
  settings_leave_failed: {
    en: "Could not leave the household. Please try again.",
    nl: "Het huishouden kon niet worden verlaten. Probeer het opnieuw.",
  },
  generic_failed: {
    en: "Something went wrong.",
    nl: "Er ging iets mis.",
  },
};

function localized(key: keyof typeof messages, lang: Lang) {
  return messages[key][lang];
}

export function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function contextFallback(context: UserErrorContext, lang: Lang) {
  switch (context) {
    case "settings_load":
      return localized("settings_load_failed_detail", lang);
    case "settings_save":
      return localized("settings_save_failed", lang);
    case "settings_leave":
      return localized("settings_leave_failed", lang);
    case "item_save":
      return localized("item_save_failed", lang);
    case "item_delete":
      return localized("item_delete_failed", lang);
    default:
      return localized("generic_failed", lang);
  }
}

export function userErrorMessage(
  error: unknown,
  lang: Lang,
  context: UserErrorContext = "generic",
) {
  const raw = errorMessageFromUnknown(error).trim();
  if (!raw) return contextFallback(context, lang);

  const householdMessage = householdRpcErrorMessage(raw, lang);
  if (householdMessage !== raw) return householdMessage;

  const normalized = raw.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return localized("auth_invalid_credentials", lang);
  }

  if (normalized.includes("email not confirmed") || normalized.includes("email_not_confirmed")) {
    return localized("auth_email_not_confirmed", lang);
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("too many attempts")
  ) {
    return localized("auth_rate_limited", lang);
  }

  if (
    normalized.includes("weak password") ||
    normalized.includes("password should be at least") ||
    normalized.includes("password must be at least")
  ) {
    return localized("auth_weak_password", lang);
  }

  if (normalized.includes("signups not allowed") || normalized.includes("signup disabled")) {
    return localized("auth_signup_unavailable", lang);
  }

  if (
    normalized.includes("permission denied") ||
    normalized.includes("row-level security") ||
    normalized.includes("rls") ||
    normalized.includes("not authorized") ||
    normalized.includes("unauthorized")
  ) {
    return localized("permission_denied", lang);
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  ) {
    return localized("network_unavailable", lang);
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return localized("request_timed_out", lang);
  }

  const fallback = contextFallback(context, lang);
  return `${fallback} ${lang === "nl" ? "Details" : "Details"}: ${raw}`;
}
