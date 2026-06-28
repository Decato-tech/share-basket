/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterGroceryItems,
  getGroceryItemStatus,
  GroceryValidationError,
  isItemBought,
  isItemNeeded,
  isItemNotInStock,
  prepareCheckedUpdate,
  prepareGroceryInsert,
  prepareGroceryUpdate,
  prepareStatusUpdate,
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
    status: "needed",
    status_updated_by: null,
    status_updated_at: null,
    not_in_stock_note: null,
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
        status: "needed",
        checked: false,
        not_in_stock_note: null,
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

  it("prepares check-off updates as bought/needed status changes", () => {
    assert.deepEqual(prepareCheckedUpdate(true), { checked: true, status: "bought" });
    assert.deepEqual(prepareCheckedUpdate(false), { checked: false, status: "needed" });
  });

  it("prepares explicit item status updates", () => {
    assert.deepEqual(prepareStatusUpdate("not_in_stock", "  Try Lidl  "), {
      checked: false,
      status: "not_in_stock",
      not_in_stock_note: "Try Lidl",
    });
    assert.deepEqual(prepareStatusUpdate("bought"), { checked: true, status: "bought" });
    assert.deepEqual(prepareStatusUpdate("needed"), { checked: false, status: "needed" });
  });

  it("includes status edits without deleting an existing not-in-stock note", () => {
    assert.deepEqual(
      prepareGroceryUpdate({
        id: "item-1",
        name: "Milk",
        quantity: "",
        category: "dairy",
        store: "Lidl",
        custom_store: "",
        notes: "",
        status: "needed",
      }),
      {
        name: "Milk",
        quantity: null,
        category: "dairy",
        store: "Lidl",
        notes: null,
        checked: false,
        status: "needed",
      },
    );
  });
});

describe("grocery status helpers", () => {
  it("uses explicit status when present", () => {
    assert.equal(
      getGroceryItemStatus(item({ status: "not_in_stock", checked: false })),
      "not_in_stock",
    );
  });

  it("maps legacy checked values when status is absent or unknown", () => {
    assert.equal(getGroceryItemStatus({ checked: false, status: null }), "needed");
    assert.equal(getGroceryItemStatus({ checked: true, status: null }), "bought");
    assert.equal(getGroceryItemStatus({ checked: true, status: "legacy" }), "bought");
  });

  it("classifies needed, bought, and not-in-stock items", () => {
    assert.equal(isItemNeeded(item({ status: "needed", checked: false })), true);
    assert.equal(isItemBought(item({ status: "bought", checked: true })), true);
    assert.equal(isItemNotInStock(item({ status: "not_in_stock", checked: false })), true);
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
    const active = item({ id: "active", checked: false, status: "needed" });
    const notAvailable = item({ id: "not-available", checked: false, status: "not_in_stock" });
    const done = item({ id: "done", checked: true, status: "bought" });

    assert.deepEqual(removeMatchingItems([active, notAvailable, done], isItemBought), [
      active,
      notAvailable,
    ]);
    assert.deepEqual(
      removeMatchingItems([active, done], (candidate) => candidate.id === "active"),
      [done],
    );
  });

  it("restores removed items without duplicating stale copies", () => {
    const active = item({ id: "active", checked: false, created_at: "2026-01-01T09:00:00.000Z" });
    const newerDone = item({
      id: "done",
      checked: true,
      status: "bought",
      created_at: "2026-01-01T11:00:00.000Z",
    });
    const currentDone = item({ id: "done", name: "stale", checked: true, status: "bought" });

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

  it("filters by item name, notes, not-in-stock note and store", () => {
    const milk = item({ id: "milk", name: "Milk", notes: "lactose free", store: "Jumbo" });
    const apples = item({ id: "apples", name: "Apples", notes: null, store: "Albert Heijn" });
    const tofu = item({
      id: "tofu",
      name: "Tofu",
      status: "not_in_stock",
      not_in_stock_note: "Try Lidl",
    });

    assert.deepEqual(filterGroceryItems([milk, apples, tofu], "lactose"), [milk]);
    assert.deepEqual(filterGroceryItems([milk, apples, tofu], "albert"), [apples]);
    assert.deepEqual(filterGroceryItems([milk, apples, tofu], "milk"), [milk]);
    assert.deepEqual(filterGroceryItems([milk, apples, tofu], "lidl"), [tofu]);
  });
});
