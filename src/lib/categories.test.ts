/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryKeyFromStored,
  categoryOverrideKey,
  categoryStoredValue,
  suggestCategory,
} from "./categories.ts";

describe("category storage compatibility", () => {
  it("stores new categories as stable keys", () => {
    assert.equal(categoryStoredValue("dairy"), "dairy");
    assert.equal(categoryStoredValue("fish_seafood"), "fish_seafood");
  });

  it("maps old English category labels to supported keys", () => {
    assert.equal(categoryKeyFromStored("Fruit & Vegetables"), "vegetables");
    assert.equal(categoryKeyFromStored("Dairy"), "dairy");
    assert.equal(categoryKeyFromStored("Meat & Fish"), "meat");
    assert.equal(categoryKeyFromStored("Personal Care"), "personal_care");
  });

  it("falls back to other for empty or unknown stored values", () => {
    assert.equal(categoryKeyFromStored(null), "other");
    assert.equal(categoryKeyFromStored("Seasonal aisle"), "other");
  });
});

describe("suggestCategory", () => {
  it("recognizes representative English grocery terms", () => {
    assert.equal(suggestCategory("bananas"), "fruit");
    assert.equal(suggestCategory("whole milk"), "dairy");
    assert.equal(suggestCategory("chicken breast"), "meat");
    assert.equal(suggestCategory("salmon"), "fish_seafood");
    assert.equal(suggestCategory("trash bags"), "household");
  });

  it("recognizes representative Dutch grocery terms", () => {
    assert.equal(suggestCategory("bananen"), "fruit");
    assert.equal(suggestCategory("halfvolle melk"), "dairy");
    assert.equal(suggestCategory("kipfilet"), "meat");
    assert.equal(suggestCategory("zalm"), "fish_seafood");
    assert.equal(suggestCategory("tandpasta"), "personal_care");
  });

  it("handles extra words, punctuation, quantities, and packaging", () => {
    assert.equal(suggestCategory("halfvolle melk 1L"), "dairy");
    assert.equal(suggestCategory("2x pak melk"), "dairy");
    assert.equal(suggestCategory("kipfilet 500g"), "meat");
    assert.equal(suggestCategory("volkoren brood, gesneden"), "bakery");
  });

  it("uses the most specific keyword before shorter matches", () => {
    assert.equal(suggestCategory("chocolademelk"), "drinks");
    assert.equal(suggestCategory("chocolate milk"), "drinks");
  });

  it("prefers household category overrides for normalized product names", () => {
    const overrides = { [categoryOverrideKey("halfvolle melk 1L")]: "drinks" as const };

    assert.equal(categoryOverrideKey("2x pak halfvolle melk"), "halfvolle melk");
    assert.equal(suggestCategory("halfvolle melk 1L"), "dairy");
    assert.equal(suggestCategory("halfvolle melk 1L", overrides), "drinks");
  });

  it("covers the required Dutch example terms", () => {
    assert.equal(suggestCategory("melk"), "dairy");
    assert.equal(suggestCategory("wc papier"), "household");
    assert.equal(suggestCategory("afwasmiddel"), "cleaning");
    assert.equal(suggestCategory("shampoo"), "personal_care");
    assert.equal(suggestCategory("kattenvoer"), "pet_supplies");
    assert.equal(suggestCategory("luiers"), "baby_kids");
    assert.equal(suggestCategory("tofu"), "vegetarian_vegan");
  });

  it("avoids matching category words inside unrelated words", () => {
    assert.equal(suggestCategory("milkshake"), "other");
    assert.equal(suggestCategory("soapstone"), "other");
    assert.equal(suggestCategory("carpet"), "other");
  });
});
