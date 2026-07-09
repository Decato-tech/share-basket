/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { householdRpcErrorKey, householdRpcErrorMessage } from "./household-errors.ts";

describe("householdRpcErrorKey", () => {
  it("recognizes a user who still belongs to a household", () => {
    assert.equal(
      householdRpcErrorKey("User already belongs to a household"),
      "already_in_household",
    );
  });

  it("recognizes invalid invite codes and authentication failures", () => {
    assert.equal(householdRpcErrorKey("Invalid invite code"), "invalid_invite_code");
    assert.equal(householdRpcErrorKey("Not authenticated"), "not_authenticated");
  });

  it("recognizes invite-code throttling", () => {
    assert.equal(
      householdRpcErrorKey("Too many invalid invite code attempts. Try again later."),
      "invite_rate_limited",
    );
    assert.match(
      householdRpcErrorMessage("Too many invalid invite code attempts. Try again later.", "nl"),
      /15 minuten/i,
    );
  });

  it("recognizes household lookup schema cache misses", () => {
    assert.equal(
      householdRpcErrorKey(
        "Could not find the function public.get_my_household without parameters in the schema cache",
      ),
      "household_lookup_unavailable",
    );
  });

  it("recognizes household policy helper permission errors", () => {
    assert.equal(
      householdRpcErrorKey("permission denied for function user_household_ids"),
      "household_lookup_unavailable",
    );
    assert.equal(
      householdRpcErrorKey("permission denied for function is_household_member"),
      "household_lookup_unavailable",
    );
  });

  it("leaves unknown messages untouched", () => {
    assert.equal(householdRpcErrorKey("Database temporarily unavailable"), null);
  });
});

describe("householdRpcErrorMessage", () => {
  it("returns localized guidance for known household errors", () => {
    assert.match(
      householdRpcErrorMessage("User already belongs to a household", "en"),
      /already belongs to a household/i,
    );
    assert.match(
      householdRpcErrorMessage("User already belongs to a household", "nl"),
      /hoort al bij een huishouden/i,
    );
  });

  it("returns localized guidance for household lookup availability errors", () => {
    assert.match(
      householdRpcErrorMessage(
        "Could not find the function public.get_my_household without parameters in the schema cache",
        "en",
      ),
      /database update finishes/i,
    );
  });

  it("returns unknown messages unchanged", () => {
    assert.equal(
      householdRpcErrorMessage("Database temporarily unavailable", "en"),
      "Database temporarily unavailable",
    );
  });
});
