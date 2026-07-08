import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorMessageFromUnknown, userErrorMessage } from "./user-errors.ts";

describe("userErrorMessage", () => {
  it("maps auth errors to localized messages", () => {
    assert.equal(
      userErrorMessage(new Error("Invalid login credentials"), "en", "auth"),
      "The email or password is incorrect.",
    );
    assert.equal(
      userErrorMessage(new Error("Email not confirmed"), "nl", "auth"),
      "Bevestig je e-mail voordat je inlogt.",
    );
  });

  it("reuses household RPC error mappings", () => {
    assert.equal(
      userErrorMessage(new Error("invalid invite code"), "nl", "generic"),
      "Die uitnodigingscode is niet geldig.",
    );
  });

  it("maps permission and network failures", () => {
    assert.equal(
      userErrorMessage(new Error("permission denied for table grocery_items"), "en", "item_save"),
      "You do not have permission to do that for this household.",
    );
    assert.equal(
      userErrorMessage(new Error("Failed to fetch"), "nl", "settings_load"),
      "Kan de server niet bereiken. Controleer je verbinding en probeer het opnieuw.",
    );
  });

  it("adds a localized fallback while keeping unknown details", () => {
    assert.equal(
      userErrorMessage(new Error("unexpected provider message"), "en", "item_delete"),
      "Could not delete this item. Please try again. Details: unexpected provider message",
    );
  });
});

describe("errorMessageFromUnknown", () => {
  it("extracts string, Error, and object message values", () => {
    assert.equal(errorMessageFromUnknown("plain"), "plain");
    assert.equal(errorMessageFromUnknown(new Error("boom")), "boom");
    assert.equal(errorMessageFromUnknown({ message: "object message" }), "object message");
    assert.equal(errorMessageFromUnknown({ message: 123 }), "");
  });
});
