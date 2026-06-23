/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSignupNextStep } from "./auth.ts";

describe("getSignupNextStep", () => {
  it("enters the app when Supabase returns a session", () => {
    assert.equal(getSignupNextStep({ session: { access_token: "token" } }), "enter_app");
  });

  it("asks for email confirmation when signup succeeds without a session", () => {
    assert.equal(getSignupNextStep({ session: null }), "confirm_email");
    assert.equal(getSignupNextStep(null), "confirm_email");
  });
});
