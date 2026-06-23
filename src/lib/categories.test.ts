/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestCategory } from "./categories.ts";

describe("suggestCategory", () => {
  it("recognizes representative English grocery terms", () => {
    assert.equal(suggestCategory("bananas"), "Fruit & Vegetables");
    assert.equal(suggestCategory("whole milk"), "Dairy");
    assert.equal(suggestCategory("chicken breast"), "Meat & Fish");
    assert.equal(suggestCategory("trash bags"), "Household");
  });

  it("recognizes representative Dutch grocery terms", () => {
    assert.equal(suggestCategory("bananen"), "Fruit & Vegetables");
    assert.equal(suggestCategory("halfvolle melk"), "Dairy");
    assert.equal(suggestCategory("kipfilet"), "Meat & Fish");
    assert.equal(suggestCategory("tandpasta"), "Personal Care");
  });

  it("avoids matching category words inside unrelated words", () => {
    assert.equal(suggestCategory("pineapple"), "Other");
    assert.equal(suggestCategory("milkshake"), "Other");
    assert.equal(suggestCategory("soapstone"), "Other");
  });
});
