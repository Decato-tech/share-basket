import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "nl";

const STORAGE_KEY = "hg.lang";

const dict = {
  // Auth
  app_name: { en: "Household Groceries", nl: "Huishoud Boodschappen" },
  app_tagline: { en: "Shared shopping, simply.", nl: "Samen boodschappen, simpel." },
  sign_in: { en: "Sign in", nl: "Inloggen" },
  sign_up: { en: "Sign up", nl: "Registreren" },
  sign_out: { en: "Sign out", nl: "Uitloggen" },
  log_out: { en: "Log out", nl: "Uitloggen" },
  email: { en: "Email", nl: "E-mail" },
  password: { en: "Password", nl: "Wachtwoord" },
  name: { en: "Name", nl: "Naam" },
  your_name: { en: "Your name", nl: "Je naam" },
  create_account: { en: "Create account", nl: "Account aanmaken" },
  please_wait: { en: "Please wait…", nl: "Even geduld…" },
  have_account: { en: "Already have an account?", nl: "Heb je al een account?" },
  no_account: { en: "Don't have an account?", nl: "Nog geen account?" },
  account_created: {
    en: "Account created — you're in!",
    nl: "Account aangemaakt — je bent ingelogd!",
  },
  check_email_to_confirm: {
    en: "If this email can be used to create an account, check your inbox for a confirmation link.",
    nl: "Als dit e-mailadres gebruikt kan worden om een account aan te maken, sturen we een bevestigingslink.",
  },
  check_email_title: { en: "Check your email", nl: "Controleer je e-mail" },
  check_email_desc: {
    en: "If this email is new, we sent a confirmation link to",
    nl: "Als dit e-mailadres nieuw is, hebben we een bevestigingslink gestuurd naar",
  },

  // Onboarding
  welcome: { en: "Welcome", nl: "Welkom" },
  welcome_sub: {
    en: "Create a household or join one to get started.",
    nl: "Maak een huishouden aan of word lid om te starten.",
  },
  create: { en: "Create", nl: "Aanmaken" },
  join: { en: "Join", nl: "Deelnemen" },
  household_name: { en: "Household name", nl: "Naam huishouden" },
  household_name_placeholder: { en: "e.g. The Smith family", nl: "bijv. Familie Jansen" },
  create_household: { en: "Create household", nl: "Huishouden aanmaken" },
  join_household: { en: "Join household", nl: "Word lid van huishouden" },
  invite_code: { en: "Invite code", nl: "Uitnodigingscode" },
  household_created: { en: "Household created", nl: "Huishouden aangemaakt" },
  joined_household: { en: "Joined household", nl: "Lid geworden van huishouden" },
  no_household: { en: "No household yet", nl: "Nog geen huishouden" },

  // App / Grocery list
  loading: { en: "Loading…", nl: "Laden…" },
  to_buy: { en: "to buy", nl: "te kopen" },
  done: { en: "done", nl: "gedaan" },
  add_item_placeholder: { en: "Add an item…", nl: "Voeg een product toe…" },
  qty: { en: "Qty", nl: "Aantal" },
  store: { en: "Store", nl: "Winkel" },
  any_store: { en: "Any store", nl: "Elke winkel" },
  custom_store: { en: "Custom store name", nl: "Eigen winkelnaam" },
  please_enter_custom_store: {
    en: "Please enter a custom store name",
    nl: "Voer een eigen winkelnaam in",
  },
  category: { en: "Category", nl: "Categorie" },
  search_items: { en: "Search items", nl: "Zoek producten" },
  all_items: { en: "All", nl: "Alles" },
  by_category: { en: "By category", nl: "Op categorie" },
  by_store: { en: "By store", nl: "Op winkel" },
  list_empty_title: { en: "Your list is empty", nl: "Je lijst is leeg" },
  list_empty_desc: {
    en: "Add your first item using the quick add bar above.",
    nl: "Voeg je eerste product toe via de balk hierboven.",
  },
  completed: { en: "Completed", nl: "Afgerond" },
  clear_completed: { en: "Clear completed", nl: "Afgeronde wissen" },
  cleared: { en: "Completed items cleared", nl: "Afgeronde items gewist" },
  checked_off: { en: "Checked off", nl: "Afgevinkt" },
  undo: { en: "Undo", nl: "Ongedaan maken" },
  live_sync_unavailable: {
    en: "Live sync is temporarily unavailable. Your changes will still be saved.",
    nl: "Live synchronisatie is tijdelijk niet beschikbaar. Je wijzigingen worden wel opgeslagen.",
  },
  no_items: { en: "No items", nl: "Geen producten" },
  new_item: { en: "New item", nl: "Nieuw product" },
  edit_item: { en: "Edit item", nl: "Product bewerken" },
  product: { en: "Product", nl: "Product" },
  product_placeholder: { en: "e.g. Milk", nl: "bijv. Melk" },
  qty_placeholder: { en: "2, 500g…", nl: "2, 500g…" },
  notes: { en: "Notes", nl: "Notities" },
  optional: { en: "Optional", nl: "Optioneel" },
  save: { en: "Save", nl: "Opslaan" },
  cancel: { en: "Cancel", nl: "Annuleren" },
  delete: { en: "Delete", nl: "Verwijderen" },
  confirm_delete_item_title: { en: "Delete this item?", nl: "Dit product verwijderen?" },
  confirm_delete_item_desc: {
    en: "This removes the item from the shared list for everyone in your household.",
    nl: "Dit verwijdert het product uit de gedeelde lijst voor iedereen in je huishouden.",
  },
  confirm_clear_completed_title: {
    en: "Clear completed items?",
    nl: "Afgeronde producten wissen?",
  },
  confirm_clear_completed_desc: {
    en: "This permanently removes all completed items from the shared list.",
    nl: "Dit verwijdert alle afgeronde producten definitief uit de gedeelde lijst.",
  },
  confirm_leave_household_title: { en: "Leave this household?", nl: "Dit huishouden verlaten?" },
  confirm_leave_household_desc: {
    en: "You will lose access to this shared grocery list unless someone invites you again.",
    nl: "Je verliest toegang tot deze gedeelde boodschappenlijst totdat iemand je opnieuw uitnodigt.",
  },
  saved: { en: "Saved", nl: "Opgeslagen" },

  // Settings
  settings: { en: "Settings", nl: "Instellingen" },
  household: { en: "Household", nl: "Huishouden" },
  invite_code_label: { en: "Invite code", nl: "Uitnodigingscode" },
  invite_share_hint: {
    en: "Share this code so others can join your household.",
    nl: "Deel deze code zodat anderen lid kunnen worden van je huishouden.",
  },
  invite_copied: { en: "Invite code copied", nl: "Uitnodigingscode gekopieerd" },
  members: { en: "Members", nl: "Leden" },
  household_members: { en: "Household members", nl: "Huishoudleden" },
  leave_household: { en: "Leave household", nl: "Huishouden verlaten" },
  left_household: { en: "Left household", nl: "Huishouden verlaten" },
  language: { en: "Language", nl: "Taal" },
  english: { en: "English", nl: "Engels" },
  dutch: { en: "Dutch", nl: "Nederlands" },
  settings_load_failed: {
    en: "Settings could not be loaded",
    nl: "Instellingen konden niet worden geladen",
  },
  retry: { en: "Retry", nl: "Opnieuw proberen" },
  household_access_removed: {
    en: "You no longer have access to this household.",
    nl: "Je hebt geen toegang meer tot dit huishouden.",
  },

  // Categories
  cat_fruit_vegetables: { en: "Fruit & Vegetables", nl: "Groente & Fruit" },
  cat_dairy: { en: "Dairy", nl: "Zuivel" },
  cat_meat_fish: { en: "Meat & Fish", nl: "Vlees & Vis" },
  cat_bakery: { en: "Bakery", nl: "Brood & Bakkerij" },
  cat_drinks: { en: "Drinks", nl: "Dranken" },
  cat_frozen: { en: "Frozen", nl: "Diepvries" },
  cat_pantry: { en: "Pantry", nl: "Voorraadkast" },
  cat_snacks: { en: "Snacks", nl: "Snacks" },
  cat_household: { en: "Household", nl: "Huishouden" },
  cat_personal_care: { en: "Personal Care", nl: "Persoonlijke verzorging" },
  cat_other: { en: "Other", nl: "Overig" },

  // Stores
  store_local: { en: "Local store", nl: "Lokale winkel" },
  store_other: { en: "Other", nl: "Anders" },
} as const;

export type TKey = keyof typeof dict;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string };
const LangContext = createContext<Ctx | null>(null);

function readInitial(): Lang {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "en" || v === "nl") return v;
  const nav = window.navigator.language?.toLowerCase() ?? "";
  return nav.startsWith("nl") ? "nl" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(readInitial());
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        try {
          window.localStorage.setItem(STORAGE_KEY, l);
        } catch {
          // Ignore storage errors, for example in private browsing.
        }
      },
      t: (k) => dict[k]?.[lang] ?? dict[k]?.en ?? k,
    }),
    [lang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used inside LanguageProvider");
  return ctx;
}

// ===== Category key mapping (stable DB value = English label) =====
export const CATEGORY_KEYS = [
  "fruit_vegetables",
  "dairy",
  "meat_fish",
  "bakery",
  "drinks",
  "frozen",
  "pantry",
  "snacks",
  "household",
  "personal_care",
  "other",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

const KEY_TO_EN: Record<CategoryKey, string> = {
  fruit_vegetables: "Fruit & Vegetables",
  dairy: "Dairy",
  meat_fish: "Meat & Fish",
  bakery: "Bakery",
  drinks: "Drinks",
  frozen: "Frozen",
  pantry: "Pantry",
  snacks: "Snacks",
  household: "Household",
  personal_care: "Personal Care",
  other: "Other",
};

const EN_TO_KEY: Record<string, CategoryKey> = Object.fromEntries(
  Object.entries(KEY_TO_EN).map(([k, v]) => [v, k as CategoryKey]),
) as Record<string, CategoryKey>;

/** Canonical English label stored in DB. */
export function categoryStoredValue(key: CategoryKey): string {
  return KEY_TO_EN[key];
}

/** DB value (English) -> stable key. Unknown values fall back to "other". */
export function categoryKeyFromStored(stored: string | null | undefined): CategoryKey {
  if (!stored) return "other";
  return EN_TO_KEY[stored] ?? "other";
}

/** Translate a DB-stored category value into the active language label. */
export function useCategoryLabel() {
  const { t } = useT();
  return (stored: string | null | undefined) => {
    const key = categoryKeyFromStored(stored);
    return t(`cat_${key}` as TKey);
  };
}

/** Translate a DB-stored store value (only built-ins; custom names pass through). */
export function useStoreLabel() {
  const { t } = useT();
  return (stored: string | null | undefined) => {
    if (!stored) return "";
    if (stored === "Local store") return t("store_local");
    if (stored === "Other") return t("store_other");
    return stored;
  };
}
