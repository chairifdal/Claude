import {
  Wallet, Landmark, Smartphone, CreditCard, TrendingUp,
  Utensils, ShoppingBasket, Coffee, Car, Fuel, Bike, CircleParking, House, Zap, Droplet, Wifi,
  ShoppingBag, Shirt, HeartPulse, Clapperboard, Receipt, Gift, CircleEllipsis, Briefcase,
  Sparkles, Laptop, GraduationCap, Baby, PawPrint, Plane, Dumbbell, Wrench, PiggyBank,
  Banknote, Gamepad2, Music, BookOpen, Pill, Scissors, Sofa, Tv, Bus, HandCoins, Building2, Circle,
} from "lucide-react";

export const ACCOUNT_KINDS = {
  cash:       { label: "Tunai",          group: "liquid",     icon: Wallet },
  bank:       { label: "Bank",           group: "liquid",     icon: Landmark },
  ewallet:    { label: "E-Wallet",       group: "liquid",     icon: Smartphone },
  credit:     { label: "Kartu Kredit / Paylater", group: "credit", icon: CreditCard },
  investment: { label: "Investasi",      group: "investment", icon: TrendingUp },
};

export const ACCOUNT_GROUPS = [
  { key: "liquid",     label: "Aset Lancar" },
  { key: "credit",     label: "Kartu Kredit & Paylater" },
  { key: "investment", label: "Investasi" },
];

export const ACCOUNT_COLORS = [
  "#2440DE", "#0B5CAD", "#0E7490", "#0F9F6E", "#15803D", "#7C3AED",
  "#C026D3", "#E5484D", "#EA580C", "#B45309", "#334155", "#0E1430",
];

export const CATEGORY_COLORS = [
  "#F97316", "#F59E0B", "#EAB308", "#16A34A", "#10B981", "#0D9488", "#0EA5E9",
  "#2563EB", "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#64748B", "#94A3B8",
];

export const CATEGORY_ICONS = {
  utensils: Utensils, "shopping-basket": ShoppingBasket, coffee: Coffee, car: Car, fuel: Fuel,
  bike: Bike, "circle-parking": CircleParking, home: House, zap: Zap, droplet: Droplet, wifi: Wifi,
  "shopping-bag": ShoppingBag, shirt: Shirt, smartphone: Smartphone, "heart-pulse": HeartPulse,
  clapperboard: Clapperboard, receipt: Receipt, gift: Gift, "circle-ellipsis": CircleEllipsis,
  briefcase: Briefcase, sparkles: Sparkles, laptop: Laptop, "trending-up": TrendingUp,
  "graduation-cap": GraduationCap, baby: Baby, "paw-print": PawPrint, plane: Plane,
  dumbbell: Dumbbell, wrench: Wrench, "piggy-bank": PiggyBank, banknote: Banknote,
  gamepad: Gamepad2, music: Music, book: BookOpen, pill: Pill, scissors: Scissors, sofa: Sofa,
  tv: Tv, bus: Bus, "hand-coins": HandCoins, building: Building2, wallet: Wallet, landmark: Landmark,
  "credit-card": CreditCard, circle: Circle,
};

export const ROLE_LABEL = { owner: "Pemilik", editor: "Bisa catat", viewer: "Hanya lihat" };
