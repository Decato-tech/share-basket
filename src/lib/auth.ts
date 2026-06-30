type SignupSessionData =
  | {
      session?: unknown | null;
    }
  | null
  | undefined;

export type SignupNextStep = "enter_app" | "confirm_email";

export function getSignupNextStep(data: SignupSessionData): SignupNextStep {
  return data?.session ? "enter_app" : "confirm_email";
}
