/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterGroceryItems,
  GroceryValidationError,
  prepareCheckedUpdate,
  prepareGroceryInsert,
  prepareGroceryUpdate,
  reconcileServerItem,
  removeMatchingItems,
  restoreRemovedItems,
  type GroceryItem,
} from "./grocery.ts";

function item(overrides: Partial<GroceryItem>): GroceryItem {
  return {
    id: "item-1",
    household_id: "household-1",
    name: "Milk",
    quantity: null,
    category: "dairy",
    store: null,
    notes: null,
    checked: false,
    added_by: "user-1",
    checked_by: null,
    checked_at: null,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("grocery payload helpers", () => {
  it("prepares trimmed insert payloads with nullable optional fields", () => {
    assert.deepEqual(
      prepareGroceryInsert("household-1", "user-1", {
        name: "  Apples  ",
        quantity: "  ",
        category: "fruit",
        store: "__none",
        notes: "  remember organic  ",
      }),
      {
        household_id: "household-1",
        added_by: "user-1",
        name: "Apples",
        quantity: null,
        category: "fruit",
        store: null,
        notes: "remember organic",
      },
    );
  });

  it("normalizes custom stores for inserts and updates", () => {
    assert.equal(
      prepareGroceryInsert("household-1", "user-1", {
        name: "Cola",
        quantity: "2",
        category: "drinks",
        store: "Other",
        custom_store: "  Picnic  ",
      }).store,
      "Picnic",
    );

    assert.deepEqual(
      prepareGroceryUpdate({
        id: "item-1",
        name: "  Pasta  ",
        quantity: "1",
        category: "pantry",
        store: "Jumbo",
        custom_store: "Picnic",
        notes: "  ",
      }),
      {
        name: "Pasta",
        quantity: "1",
        category: "pantry",
        store: "Jumbo",
        notes: null,
      },
    );
  });

  it("rejects missing custom stores before sending a mutation", () => {
    assert.throws(
      () =>
        prepareGroceryInsert("household-1", "user-1", {
          name: "Bread",
          quantity: "",
          category: "bakery",
          store: "Other",
          custom_store: "  ",
        }),
      GroceryValidationError,
    );
  });

  it("prepares check-off updates with no unrelated fields", () => {
    assert.deepEqual(prepareCheckedUpdate(true), { checked: true });
    assert.deepEqual(prepareCheckedUpdate(false), { checked: false });
  });
});

describe("grocery cache helpers", () => {
  it("reconciles server items by replacing duplicates and sorting newest first", () => {
    const older = item({ id: "older", name: "Older", created_at: "2026-01-01T09:00:00.000Z" });
    const existing = item({ id: "same", name: "Old name", created_at: "2026-01-01T10:00:00.000Z" });
    const server = item({
      id: "same",
      name: "Server name",
      created_at: "2026-01-01T11:00:00.000Z",
    });

    assert.deepEqual(
      reconcileServerItem([older, existing], server).map((candidate) => [
        candidate.id,
        candidate.name,
      ]),
      [
        ["same", "Server name"],
        ["older", "Older"],
      ],
    );
  });

  it("removes matching items for delete and clear-completed flows", () => {
    const active = item({ id: "active", checked: false });
    const done = item({ id: "done", checked: true });

    assert.deepEqual(
      removeMatchingItems([active, done], (candidate) => candidate.checked),
      [active],
    );
    assert.deepEqual(
      removeMatchingItems([active, done], (candidate) => candidate.id === "active"),
      [done],
    );
  });

  it("restores removed items without duplicating stale copies", () => {
    const active = item({ id: "active", checked: false, created_at: "2026-01-01T09:00:00.000Z" });
    const newerDone = item({ id: "done", checked: true, created_at: "2026-01-01T11:00:00.000Z" });
    const currentDone = item({ id: "done", name: "stale", checked: true });

    assert.deepEqual(
      restoreRemovedItems([active, currentDone], [newerDone]).map((candidate) => [
        candidate.id,
        candidate.name,
      ]),
      [
        ["done", "Milk"],
        ["active", "Milk"],
      ],
    );
  });

  it("filters by item name, notes and store", () => {
    const milk = item({ id: "milk", name: "Milk", notes: "lactose free", store: "Jumbo" });
    const apples = item({ id: "apples", name: "Apples", notes: null, store: "Albert Heijn" });

    assert.deepEqual(filterGroceryItems([milk, apples], "lactose"), [milk]);
    assert.deepEqual(filterGroceryItems([milk, apples], "albert"), [apples]);
    assert.deepEqual(filterGroceryItems([milk, apples], "milk"), [milk]);
  });
});
