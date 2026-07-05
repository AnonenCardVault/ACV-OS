import {
  BadgeDollarSign,
  Boxes,
  BrainCircuit,
  Camera,
  ChartNoAxesCombined,
  CircleDollarSign,
  Layers3,
  ReceiptText,
  Settings,
  ShoppingBag,
  Truck
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: ChartNoAxesCombined },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Photo Intake", href: "/photo-intake", icon: Camera },
  { label: "Pricing", href: "/pricing", icon: BadgeDollarSign },
  { label: "Listings", href: "/listings", icon: ShoppingBag },
  { label: "Sales", href: "/sales", icon: CircleDollarSign },
  { label: "Shipping", href: "/shipping", icon: Truck },
  { label: "Expenses", href: "/expenses", icon: ReceiptText },
  { label: "Reports", href: "/reports", icon: Layers3 },
  { label: "AI Staff", href: "/ai-staff", icon: BrainCircuit },
  { label: "Settings", href: "/settings", icon: Settings }
];

export const inventoryItems = [
  {
    id: "inv-000421",
    sku: "ACV-NFL-000421",
    name: "2023 Prizm CJ Stroud Silver Rookie",
    category: "Football",
    year: "2023",
    brandSet: "Panini Prizm",
    parallel: "Silver",
    cardNumber: "339",
    serialNumber: "-",
    status: "Listed",
    location: "Vault A3",
    purchaseCost: 46,
    askingPrice: 129.99,
    marketValue: 118,
    quantity: 1,
    source: "Whatnot",
    ebayId: "256819032184",
    daysListed: 12,
    aiConfidence: 0.94,
    lastUpdated: "Jul 05, 12:10 PM",
    notes: "Strong watch activity. Keep SKU locked unless eBay custom label drifts."
  },
  {
    id: "inv-000382",
    sku: "ACV-POK-000382",
    name: "1999 Pokemon Base Charizard Holo",
    category: "Pokemon",
    year: "1999",
    brandSet: "Pokemon Base Set",
    parallel: "Holo",
    cardNumber: "4/102",
    serialNumber: "-",
    status: "Needs Pricing",
    location: "Vault B1",
    purchaseCost: 210,
    askingPrice: 0,
    marketValue: 345,
    quantity: 1,
    source: "Local show",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.81,
    lastUpdated: "Jul 05, 11:42 AM",
    notes: "Needs manual condition notes before price approval."
  },
  {
    id: "inv-000511",
    sku: "ACV-NBA-000511",
    name: "2020 Optic Anthony Edwards Rated Rookie",
    category: "Basketball",
    year: "2020",
    brandSet: "Donruss Optic Rated Rookie",
    parallel: "Base",
    cardNumber: "151",
    serialNumber: "-",
    status: "Ready for Draft",
    location: "Photo Queue",
    purchaseCost: 18,
    askingPrice: 54.99,
    marketValue: 49,
    quantity: 1,
    source: "COMC",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.88,
    lastUpdated: "Jul 05, 10:18 AM",
    notes: "Photos reviewed. Ready for draft title and item specifics QA."
  },
  {
    id: "inv-000301",
    sku: "ACV-MLB-000301",
    name: "2018 Topps Update Shohei Ohtani RC",
    category: "Baseball",
    year: "2018",
    brandSet: "Topps Update",
    parallel: "Base",
    cardNumber: "US1",
    serialNumber: "-",
    status: "Listed",
    location: "Vault C2",
    purchaseCost: 32,
    askingPrice: 74.99,
    marketValue: 69,
    quantity: 2,
    source: "eBay lot",
    ebayId: "256819032998",
    daysListed: 38,
    aiConfidence: 0.91,
    lastUpdated: "Jul 04, 6:04 PM",
    notes: "Listed quantity is 2. Recheck price drift after stale listing review."
  },
  {
    id: "inv-000143",
    sku: "ACV-TCG-000143",
    name: "One Piece OP05 Manga Luffy",
    category: "TCG",
    year: "2023",
    brandSet: "One Piece OP05",
    parallel: "Manga Rare",
    cardNumber: "OP05-119",
    serialNumber: "-",
    status: "Needs Review",
    location: "Intake Bin",
    purchaseCost: 98,
    askingPrice: 0,
    marketValue: 142,
    quantity: 1,
    source: "Trade",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.62,
    lastUpdated: "Jul 04, 4:21 PM",
    notes: "Low AI confidence. Confirm card number, rarity, and condition."
  },
  {
    id: "inv-000612",
    sku: "ACV-NFL-000612",
    name: "2024 Bowman Chrome Caleb Williams Refractor",
    category: "Football",
    year: "2024",
    brandSet: "Bowman Chrome",
    parallel: "Refractor",
    cardNumber: "BC-12",
    serialNumber: "-",
    status: "Ready for Draft",
    location: "Vault A1",
    purchaseCost: 26,
    askingPrice: 69.99,
    marketValue: 64,
    quantity: 1,
    source: "Card show",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.9,
    lastUpdated: "Jul 05, 9:38 AM",
    notes: "High confidence draft candidate. Confirm Bears team keyword."
  },
  {
    id: "inv-000208",
    sku: "ACV-POK-000208",
    name: "Pokemon Umbreon VMAX TG23",
    category: "Pokemon",
    year: "2022",
    brandSet: "Brilliant Stars Trainer Gallery",
    parallel: "Full Art",
    cardNumber: "TG23/TG30",
    serialNumber: "-",
    status: "Sold",
    location: "Ship Queue",
    purchaseCost: 12,
    askingPrice: 32.5,
    marketValue: 31,
    quantity: 1,
    source: "eBay lot",
    ebayId: "256819031208",
    daysListed: 7,
    aiConfidence: 0.95,
    lastUpdated: "Jul 05, 8:22 AM",
    notes: "Sold item waiting for shipping reconciliation."
  },
  {
    id: "inv-000098",
    sku: "ACV-TCG-000098",
    name: "Lorcana Elsa Spirit of Winter Enchanted",
    category: "TCG",
    year: "2023",
    brandSet: "Disney Lorcana First Chapter",
    parallel: "Enchanted",
    cardNumber: "207/204",
    serialNumber: "-",
    status: "Listed",
    location: "",
    purchaseCost: 122,
    askingPrice: 189.99,
    marketValue: 174,
    quantity: 1,
    source: "Trade",
    ebayId: "256819033001",
    daysListed: 21,
    aiConfidence: 0.74,
    lastUpdated: "Jul 03, 2:15 PM",
    notes: "Missing physical location. Confirm before next pick list."
  },
  {
    id: "inv-000777",
    sku: "ACV-NBA-000777",
    name: "2023 Prizm Victor Wembanyama Green",
    category: "Basketball",
    year: "2023",
    brandSet: "Panini Prizm",
    parallel: "Green",
    cardNumber: "136",
    serialNumber: "-",
    status: "Needs Review",
    location: "Intake Bin",
    purchaseCost: 0,
    askingPrice: 0,
    marketValue: 58,
    quantity: 1,
    source: "Break",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.68,
    lastUpdated: "Jul 02, 7:44 PM",
    notes: "Purchase cost missing. AI match needs review."
  },
  {
    id: "inv-000888",
    sku: "ACV-MLB-000888",
    name: "2023 Bowman Chrome Elly De La Cruz Mojo",
    category: "Baseball",
    year: "2023",
    brandSet: "Bowman Chrome Mega Box",
    parallel: "Mojo Refractor",
    cardNumber: "BCP-65",
    serialNumber: "-",
    status: "Needs Pricing",
    location: "Vault C1",
    purchaseCost: 14,
    askingPrice: 0,
    marketValue: 36,
    quantity: 1,
    source: "Local show",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.86,
    lastUpdated: "Jul 01, 3:19 PM",
    notes: "Needs comps before draft."
  }
];

export const dashboardMetrics = [
  { label: "Inventory Value", value: "$18,420", detail: "1,246 active items", tone: "gold" },
  { label: "Projected Profit", value: "$6,884", detail: "37.4% blended margin", tone: "green" },
  { label: "Needs Review", value: "42", detail: "12 low confidence", tone: "pink" },
  { label: "Ready to List", value: "86", detail: "24 priced today", tone: "teal" }
];

export const workflowQueues = [
  { label: "Photo intake", count: 128, status: "Batching" },
  { label: "Needs pricing", count: 57, status: "Comps pending" },
  { label: "Draft QA", count: 31, status: "Ready" },
  { label: "Shipping", count: 9, status: "Pick today" }
];

export const salesRows = [
  {
    id: "S-1048",
    sku: "ACV-NFL-000388",
    title: "2022 Prizm Brock Purdy Silver",
    platform: "eBay",
    buyer: "j***2",
    salePrice: 149.99,
    shippingCharged: 5.35,
    fees: 20.42,
    shippingCost: 4.88,
    suppliesCost: 0.62,
    purchaseCost: 44,
    netProfit: 85.42,
    roi: 1.94,
    dateSold: "Jul 05"
  },
  {
    id: "S-1047",
    sku: "ACV-POK-000208",
    title: "Pokemon Umbreon VMAX TG23",
    platform: "eBay",
    buyer: "m***9",
    salePrice: 32.5,
    shippingCharged: 1.35,
    fees: 4.72,
    shippingCost: 0.97,
    suppliesCost: 0.28,
    purchaseCost: 12,
    netProfit: 15.88,
    roi: 1.32,
    dateSold: "Jul 04"
  },
  {
    id: "S-1046",
    sku: "ACV-NBA-000440",
    title: "2019 Mosaic Ja Morant Rookie",
    platform: "eBay",
    buyer: "c***4",
    salePrice: 21,
    shippingCharged: 1.35,
    fees: 3.18,
    shippingCost: 0.97,
    suppliesCost: 0.28,
    purchaseCost: 24,
    netProfit: -6.08,
    roi: -0.25,
    dateSold: "Jul 04"
  }
];

export const recentComps = [
  { source: "eBay sold", title: "CJ Stroud Silver Prizm RC PSA 9", price: 132.5, date: "Jul 03", confidence: 0.88 },
  { source: "eBay sold", title: "CJ Stroud Prizm Silver Rookie raw", price: 118.25, date: "Jul 01", confidence: 0.82 },
  { source: "Active listing", title: "2023 Prizm CJ Stroud Silver", price: 139.99, date: "Live", confidence: 0.77 },
  { source: "Manual comp", title: "Card show confirmed sale", price: 125, date: "Jun 28", confidence: 0.72 }
];

export const listingRows = [
  {
    sku: "ACV-NFL-000421",
    title: "2023 Panini Prizm CJ Stroud Silver Rookie RC Texans",
    status: "Active",
    price: 129.99,
    quantity: 1,
    drift: "In sync",
    watchers: 18,
    views: 214,
    lastSync: "10 min ago"
  },
  {
    sku: "ACV-MLB-000301",
    title: "2018 Topps Update Shohei Ohtani Rookie Card US1",
    status: "Active",
    price: 74.99,
    quantity: 2,
    drift: "Price drift",
    watchers: 9,
    views: 88,
    lastSync: "Mock only"
  },
  {
    sku: "ACV-NBA-000511",
    title: "2020 Donruss Optic Anthony Edwards Rated Rookie",
    status: "Draft",
    price: 54.99,
    quantity: 1,
    drift: "Draft QA",
    watchers: 0,
    views: 0,
    lastSync: "-"
  }
];

export const listingDraftQueue = [
  {
    sku: "ACV-NBA-000511",
    name: "2020 Optic Anthony Edwards Rated Rookie",
    category: "Basketball",
    location: "Photo Queue",
    cost: 18,
    marketValue: 49,
    suggestedPrice: 54.99,
    titleStatus: "Generated",
    descriptionStatus: "Generated",
    photoStatus: "Reviewed",
    draftStatus: "Ready",
    aiConfidence: 0.88,
    details: {
      year: "2020",
      brand: "Donruss Optic",
      set: "Rated Rookie",
      player: "Anthony Edwards",
      team: "Minnesota Timberwolves",
      cardNumber: "151",
      parallel: "Base"
    },
    suggestedTitle: "2020 Donruss Optic Anthony Edwards Rated Rookie RC #151 Timberwolves",
    suggestedDescription:
      "Sharp 2020 Donruss Optic Anthony Edwards Rated Rookie card. Card ships sleeved, top loaded, and protected for transit. Please review photos for condition.",
    specifics: [
      { label: "Sport", value: "Basketball", complete: true },
      { label: "Player", value: "Anthony Edwards", complete: true },
      { label: "Card Number", value: "151", complete: true },
      { label: "Parallel", value: "Base", complete: true },
      { label: "Condition", value: "Ungraded", complete: true }
    ],
    warnings: ["Confirm corners in photo review before staging."]
  },
  {
    sku: "ACV-POK-000382",
    name: "1999 Pokemon Base Charizard Holo",
    category: "Pokemon",
    location: "Vault B1",
    cost: 210,
    marketValue: 345,
    suggestedPrice: 379.99,
    titleStatus: "Needs Review",
    descriptionStatus: "Generated",
    photoStatus: "Missing Back",
    draftStatus: "Review",
    aiConfidence: 0.81,
    details: {
      year: "1999",
      brand: "Pokemon",
      set: "Base Set",
      player: "Charizard",
      team: "Pokemon",
      cardNumber: "4/102",
      parallel: "Holo"
    },
    suggestedTitle: "1999 Pokemon Base Set Charizard Holo #4/102 Vintage WOTC",
    suggestedDescription:
      "Vintage Pokemon Base Set Charizard holo card. AI draft is staged for manual condition review before listing. Ships protected with tracking.",
    specifics: [
      { label: "Game", value: "Pokemon TCG", complete: true },
      { label: "Character", value: "Charizard", complete: true },
      { label: "Card Number", value: "4/102", complete: true },
      { label: "Finish", value: "Holo", complete: true },
      { label: "Condition", value: "Needs manual review", complete: false }
    ],
    warnings: ["Back image missing.", "Condition must be manually reviewed before approval."]
  },
  {
    sku: "ACV-TCG-000143",
    name: "One Piece OP05 Manga Luffy",
    category: "TCG",
    location: "Intake Bin",
    cost: 98,
    marketValue: 142,
    suggestedPrice: 154.99,
    titleStatus: "Generated",
    descriptionStatus: "Needs AI",
    photoStatus: "Needs Review",
    draftStatus: "Blocked",
    aiConfidence: 0.62,
    details: {
      year: "2023",
      brand: "Bandai",
      set: "OP05",
      player: "Monkey D. Luffy",
      team: "Straw Hat Crew",
      cardNumber: "OP05-119",
      parallel: "Manga"
    },
    suggestedTitle: "One Piece Card Game OP05 Monkey D. Luffy Manga Rare OP05-119",
    suggestedDescription:
      "One Piece Card Game OP05 Monkey D. Luffy Manga Rare. Draft requires manual verification because confidence is below listing threshold.",
    specifics: [
      { label: "Game", value: "One Piece Card Game", complete: true },
      { label: "Character", value: "Monkey D. Luffy", complete: true },
      { label: "Card Number", value: "OP05-119", complete: true },
      { label: "Rarity", value: "Manga Rare", complete: true },
      { label: "Condition", value: "Unconfirmed", complete: false }
    ],
    warnings: ["AI confidence below 70%.", "Confirm card number and condition before staging."]
  },
  {
    sku: "ACV-NFL-000612",
    name: "2024 Bowman Chrome Caleb Williams Refractor",
    category: "Football",
    location: "Vault A1",
    cost: 26,
    marketValue: 64,
    suggestedPrice: 69.99,
    titleStatus: "Generated",
    descriptionStatus: "Generated",
    photoStatus: "Reviewed",
    draftStatus: "Ready",
    aiConfidence: 0.9,
    details: {
      year: "2024",
      brand: "Bowman Chrome",
      set: "Prospect",
      player: "Caleb Williams",
      team: "Chicago Bears",
      cardNumber: "BC-12",
      parallel: "Refractor"
    },
    suggestedTitle: "2024 Bowman Chrome Caleb Williams Refractor Rookie Bears RC",
    suggestedDescription:
      "Clean 2024 Bowman Chrome Caleb Williams Refractor. Card ships sleeved and top loaded with reinforced protection.",
    specifics: [
      { label: "Sport", value: "Football", complete: true },
      { label: "Player", value: "Caleb Williams", complete: true },
      { label: "Team", value: "Chicago Bears", complete: true },
      { label: "Parallel", value: "Refractor", complete: true },
      { label: "Condition", value: "Ungraded", complete: true }
    ],
    warnings: []
  }
];

export const activeListingRows = [
  {
    sku: "ACV-NFL-000421",
    title: "2023 Panini Prizm CJ Stroud Silver Rookie RC Texans",
    category: "Football",
    status: "Active",
    listedPrice: 129.99,
    marketPrice: 118,
    soldMedian: 122.5,
    activeLow: 109.99,
    views: 214,
    watchers: 18,
    quantity: 1,
    daysListed: 12,
    location: "Vault A3",
    driftStatus: "In sync"
  },
  {
    sku: "ACV-MLB-000301",
    title: "2018 Topps Update Shohei Ohtani Rookie Card US1",
    category: "Baseball",
    status: "Active",
    listedPrice: 74.99,
    marketPrice: 69,
    soldMedian: 67.25,
    activeLow: 59.99,
    views: 88,
    watchers: 9,
    quantity: 2,
    daysListed: 38,
    location: "Vault C2",
    driftStatus: "Price drift"
  },
  {
    sku: "ACV-POK-000208",
    title: "Pokemon Umbreon VMAX TG23 Brilliant Stars Trainer Gallery",
    category: "Pokemon",
    status: "Active",
    listedPrice: 34.99,
    marketPrice: 31,
    soldMedian: 32.5,
    activeLow: 28.99,
    views: 141,
    watchers: 15,
    quantity: 1,
    daysListed: 7,
    location: "Vault B2",
    driftStatus: "SKU drift"
  },
  {
    sku: "ACV-NBA-000440",
    title: "2019 Panini Mosaic Ja Morant Rookie RC Grizzlies",
    category: "Basketball",
    status: "Active",
    listedPrice: 24.99,
    marketPrice: 21,
    soldMedian: 22,
    activeLow: 19.5,
    views: 62,
    watchers: 3,
    quantity: 1,
    daysListed: 44,
    location: "Vault A4",
    driftStatus: "Review comps"
  },
  {
    sku: "ACV-TCG-000098",
    title: "Lorcana Elsa Spirit of Winter Enchanted Rare",
    category: "TCG",
    status: "Paused",
    listedPrice: 189.99,
    marketPrice: 174,
    soldMedian: 179.5,
    activeLow: 169,
    views: 301,
    watchers: 27,
    quantity: 1,
    daysListed: 21,
    location: "Vault D1",
    driftStatus: "Quantity drift"
  }
];

export const stagedListingUpdates = [
  {
    id: "STG-001",
    item: "ACV-POK-000208 Umbreon VMAX TG23",
    changeType: "SKU update staged",
    currentEbayValue: "POK-208",
    acvValue: "ACV-POK-000208",
    riskLevel: "High"
  },
  {
    id: "STG-002",
    item: "ACV-MLB-000301 Shohei Ohtani RC",
    changeType: "price update staged",
    currentEbayValue: "$74.99",
    acvValue: "$69.99",
    riskLevel: "Medium"
  },
  {
    id: "STG-003",
    item: "ACV-TCG-000098 Elsa Enchanted",
    changeType: "quantity update staged",
    currentEbayValue: "2",
    acvValue: "1",
    riskLevel: "High"
  },
  {
    id: "STG-004",
    item: "ACV-NFL-000421 CJ Stroud Silver",
    changeType: "title revision staged",
    currentEbayValue: "CJ Stroud Prizm Silver RC",
    acvValue: "2023 Panini Prizm CJ Stroud Silver Rookie RC Texans",
    riskLevel: "Low"
  }
];

export const shippingQueue = [
  { order: "1048", sku: "ACV-NFL-000388", method: "Ground Advantage", package: "Rigid mailer", status: "Pick" },
  { order: "1047", sku: "ACV-POK-000208", method: "PWE", package: "Toploader + sleeve", status: "Pack" },
  { order: "1045", sku: "ACV-MLB-000299", method: "Ground Advantage", package: "Bubble mailer", status: "Label" }
];

export const expenses = [
  { vendor: "USPS", category: "Shipping", amount: 86.42, cadence: "Variable", status: "Logged" },
  { vendor: "Card Shellz", category: "Supplies", amount: 42.0, cadence: "Reorder", status: "Low stock" },
  { vendor: "eBay Store", category: "Platform", amount: 21.95, cadence: "Monthly", status: "Recurring" },
  { vendor: "Toploaders", category: "Supplies", amount: 18.5, cadence: "Reorder", status: "Healthy" }
];

export const aiStaff = [
  { role: "COO", queue: 7, confidence: 0.91, output: "Daily priority stack", status: "Active" },
  { role: "Card Identification Specialist", queue: 31, confidence: 0.78, output: "Staged item matches", status: "Review" },
  { role: "Pricing Analyst", queue: 14, confidence: 0.84, output: "Price recommendations", status: "Active" },
  { role: "Publish QA Specialist", queue: 9, confidence: 0.87, output: "Listing checks", status: "Active" },
  { role: "Profit Analyst", queue: 3, confidence: 0.93, output: "Margin alerts", status: "Active" }
];
