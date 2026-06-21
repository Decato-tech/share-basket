export const CATEGORIES = [
  "Fruit & Vegetables",
  "Dairy",
  "Meat & Fish",
  "Bakery",
  "Drinks",
  "Frozen",
  "Pantry",
  "Snacks",
  "Household",
  "Personal Care",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const STORES = [
  "Albert Heijn",
  "Jumbo",
  "Lidl",
  "Aldi",
  "Kruidvat",
  "Action",
  "Local store",
  "Other",
] as const;

const RULES: Array<{ category: Category; words: string[] }> = [
  { category: "Dairy", words: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "kwark", "quark"] },
  { category: "Fruit & Vegetables", words: ["apple", "banana", "lettuce", "tomato", "tomatoes", "potato", "potatoes", "onion", "carrot", "cucumber", "pepper", "spinach", "broccoli", "lemon", "lime", "orange", "grape", "berry", "berries", "avocado", "garlic"] },
  { category: "Meat & Fish", words: ["chicken", "salmon", "beef", "mince", "minced", "pork", "tuna", "shrimp", "bacon", "ham", "sausage", "turkey"] },
  { category: "Bakery", words: ["bread", "wrap", "wraps", "croissant", "bagel", "baguette", "bun", "buns", "tortilla", "tortillas"] },
  { category: "Drinks", words: ["cola", "water", "juice", "coffee", "tea", "beer", "wine", "soda", "lemonade"] },
  { category: "Frozen", words: ["pizza", "frozen", "ice cream", "icecream"] },
  { category: "Pantry", words: ["pasta", "rice", "olive oil", "oil", "flour", "sugar", "salt", "pepper", "spice", "sauce", "ketchup", "mayonnaise", "mayo", "vinegar", "honey", "cereal", "oats", "beans", "lentils"] },
  { category: "Snacks", words: ["chips", "chocolate", "cookies", "cookie", "candy", "crisps", "nuts", "popcorn", "biscuits"] },
  { category: "Household", words: ["toilet paper", "detergent", "cleaning", "spray", "dish soap", "sponge", "trash bag", "garbage bag", "paper towel", "tissue"] },
  { category: "Personal Care", words: ["shampoo", "toothpaste", "deodorant", "soap", "conditioner", "razor", "lotion", "tampon", "pads"] },
];

export function suggestCategory(name: string): Category {
  const n = name.toLowerCase().trim();
  if (!n) return "Other";
  for (const { category, words } of RULES) {
    if (words.some((w) => n.includes(w))) return category;
  }
  return "Other";
}