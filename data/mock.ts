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
    sku: "ACV-NFL-000421",
    name: "2023 Prizm CJ Stroud Silver Rookie",
    category: "Football",
    status: "Listed",
    location: "Vault A3",
    purchaseCost: 46,
    askingPrice: 129.99,
    marketValue: 118,
    quantity: 1,
    source: "Whatnot",
    ebayId: "256819032184",
    daysListed: 12,
    aiConfidence: 0.94
  },
  {
    sku: "ACV-POK-000382",
    name: "1999 Pokemon Base Charizard Holo",
    category: "Pokemon",
    status: "Needs Pricing",
    location: "Vault B1",
    purchaseCost: 210,
    askingPrice: 0,
    marketValue: 345,
    quantity: 1,
    source: "Local show",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.81
  },
  {
    sku: "ACV-NBA-000511",
    name: "2020 Optic Anthony Edwards Rated Rookie",
    category: "Basketball",
    status: "Ready for Draft",
    location: "Photo Queue",
    purchaseCost: 18,
    askingPrice: 54.99,
    marketValue: 49,
    quantity: 1,
    source: "COMC",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.88
  },
  {
    sku: "ACV-MLB-000301",
    name: "2018 Topps Update Shohei Ohtani RC",
    category: "Baseball",
    status: "Listed",
    location: "Vault C2",
    purchaseCost: 32,
    askingPrice: 74.99,
    marketValue: 69,
    quantity: 2,
    source: "eBay lot",
    ebayId: "256819032998",
    daysListed: 38,
    aiConfidence: 0.91
  },
  {
    sku: "ACV-TCG-000143",
    name: "One Piece OP05 Manga Luffy",
    category: "TCG",
    status: "Needs Review",
    location: "Intake Bin",
    purchaseCost: 98,
    askingPrice: 0,
    marketValue: 142,
    quantity: 1,
    source: "Trade",
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.62
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
