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
  { category: "Fruit & Vegetables", words: ["apple", "apples", "banana", "bananas", "lettuce", "tomato", "tomatoes", "potato", "potatoes", "onion", "onions", "carrot", "carrots", "cucumber", "pepper", "peppers", "bell pepper", "spinach", "broccoli", "cauliflower", "zucchini", "courgette", "lemon", "lime", "orange", "oranges", "grape", "grapes", "berry", "berries", "strawberry", "strawberries", "blueberry", "blueberries", "avocado", "garlic", "appel", "appels", "banaan", "bananen", "sla", "tomaat", "tomaten", "komkommer", "paprika", "aardappel", "aardappelen", "ui", "uien", "wortel", "wortels", "bloemkool", "spinazie", "sinaasappel", "sinaasappels", "druiven", "aardbei", "aardbeien", "knoflook"] },
  { category: "Dairy", words: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "kwark", "quark", "egg", "eggs", "melk", "halfvolle melk", "volle melk", "magere melk", "kaas", "boter", "vla", "room", "slagroom", "creme fraiche", "crème fraîche", "ei", "eieren"] },
  { category: "Meat & Fish", words: ["chicken", "salmon", "beef", "mince", "minced", "pork", "tuna", "shrimp", "bacon", "ham", "sausage", "turkey", "cod", "kip", "kipfilet", "gehakt", "rundvlees", "varkensvlees", "zalm", "tonijn", "kabeljauw", "worst", "spek"] },
  { category: "Bakery", words: ["bread", "wrap", "wraps", "croissant", "croissants", "bagel", "baguette", "bun", "buns", "tortilla", "tortillas", "brood", "volkoren brood", "bolletje", "bolletjes", "stokbrood", "krentenbol", "krentenbollen", "cracker", "crackers", "beschuit"] },
  { category: "Drinks", words: ["cola", "water", "juice", "coffee", "tea", "beer", "wine", "soda", "lemonade", "sap", "appelsap", "sinaasappelsap", "frisdrank", "bier", "wijn", "koffie", "thee"] },
  { category: "Frozen", words: ["pizza", "frozen", "ice cream", "icecream", "diepvries", "diepvriespizza", "diepvriesgroenten", "ijs", "friet", "patat", "kroket", "kroketten", "frikandel", "frikandellen"] },
  { category: "Pantry", words: ["pasta", "rice", "olive oil", "oil", "flour", "sugar", "salt", "spice", "sauce", "ketchup", "mayonnaise", "mayo", "vinegar", "honey", "cereal", "oats", "beans", "lentils", "rijst", "olijfolie", "olie", "bloem", "suiker", "zout", "peper", "havermout", "ontbijtgranen", "pindakaas", "jam", "saus", "tomatensaus", "soep"] },
  { category: "Snacks", words: ["chips", "chocolate", "cookie", "cookies", "candy", "crisps", "nuts", "popcorn", "biscuits", "chocolade", "koek", "koekje", "koekjes", "snoep", "noot", "nootjes", "borrelnoot", "borrelnoten"] },
  { category: "Household", words: ["toilet paper", "detergent", "cleaning", "dish soap", "sponge", "trash bag", "garbage bag", "paper towel", "tissue", "wc papier", "toiletpapier", "keukenrol", "afwasmiddel", "wasmiddel", "schoonmaakmiddel", "vuilniszak", "vuilniszakken", "vaatwastablet", "vaatwastabletten", "allesreiniger"] },
  { category: "Personal Care", words: ["shampoo", "toothpaste", "deodorant", "soap", "conditioner", "razor", "lotion", "tampon", "tampons", "pads", "tandpasta", "douchegel", "zeep", "wc spray", "scheermesje", "scheermesjes", "maandverband"] },
];

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function suggestCategory(name: string): Category {
  const n = name.toLowerCase().trim();
  if (!n) return "Other";
  for (const { category, words } of RULES) {
    for (const w of words) {
      // Match as whole word; allow trailing plural 's' or 'en' for singular entries.
      const re = new RegExp(`(^|[^\\p{L}])${escapeRegex(w)}(s|en)?($|[^\\p{L}])`, "iu");
      if (re.test(n)) return category;
    }
  }
  return "Other";
}