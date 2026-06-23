/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCustomStore, normalizeStoreDraft } from "./stores.ts";

describe("normalizeStoreDraft", () => {
  it("keeps built-in stores", () => {
    assert.deepEqual(normalizeStoreDraft({ store: "Jumbo" }), { store: "Jumbo" });
  });

  it("stores no-store selections as null", () => {
    assert.deepEqual(normalizeStoreDraft({ store: "" }), { store: null });
    assert.deepEqual(normalizeStoreDraft({ store: "__none" }), { store: null });
  });

  it("requires and trims custom stores", () => {
    assert.deepEqual(normalizeStoreDraft({ store: "Other", custom_store: "" }), {
      error: "custom_store_required",
    });
    assert.deepEqual(normalizeStoreDraft({ store: "Other", custom_store: "  Picnic  " }), {
      store: "Picnic",
    });
  });

  it("ignores stale custom-store text when another store is selected", () => {
    assert.deepEqual(normalizeStoreDraft({ store: "Lidl", custom_store: "Picnic" }), {
      store: "Lidl",
    });
    assert.deepEqual(normalizeStoreDraft({ store: "", custom_store: "Picnic" }), {
      store: null,
    });
  });
});

describe("isCustomStore", () => {
  it("distinguishes custom stores from built-ins and empty values", () => {
    assert.equal(isCustomStore("Picnic"), true);
    assert.equal(isCustomStore("Jumbo"), false);
    assert.equal(isCustomStore(null), false);
  });
});
