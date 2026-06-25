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

  it("returns unknown messages unchanged", () => {
    assert.equal(
      householdRpcErrorMessage("Database temporarily unavailable", "en"),
      "Database temporarily unavailable",
    );
  });
});
