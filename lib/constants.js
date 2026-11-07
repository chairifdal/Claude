import {
  Wallet, Landmark, Smartphone, CreditCard, TrendingUp,
  Utensils, ShoppingBasket, ShoppingCart, Coffee, GlassWater, Milk, Soup, Pizza, Apple, Carrot, Beef, Fish, Egg, Wheat, Cake, CookingPot, Refrigerator,
  House, Zap, Plug, Droplet, Droplets, Flame, Wifi, Tv, Router, HandHelping, Trash2, Wrench, Hammer, Paintbrush, SprayCan, WashingMachine, Sofa, BedDouble, Bath, ShowerHead, Lamp, Key, Building2, Sprout, Flower2,
  Baby, ToyBrick, School, GraduationCap, BookOpen, Backpack,
  Shirt, Scissors, Sparkles, Gem, Watch, Glasses, Laptop,
  HeartPulse, Stethoscope, Pill, Syringe, Shield, Dumbbell,
  Car, Fuel, Bike, Bus, TrainFront, CircleParking, Plane, Hotel, Ticket, Clapperboard, Gamepad2, Music,
  Receipt, ShoppingBag, Banknote, HandCoins, Coins, PiggyBank, HandHeart, Gift, Users, PawPrint, Dog, Cat, Briefcase, Package, Truck, Umbrella, Phone, Heart, Calendar, Target, CircleEllipsis, Circle,
} from "lucide-react";

export const ACCOUNT_KINDS = {
  cash:       { label: "Tunai",          group: "liquid",     icon: Wallet },
  bank:       { label: "Bank",           group: "liquid",     icon: Landmark },
  ewallet:    { label: "E-Wallet",       group: "liquid",     icon: Smartphone },
  credit:     { label: "Kartu Kredit / Paylater", group: "credit", icon: CreditCard },
  investment: { label: "Investasi",      group: "investment", icon: TrendingUp },
};

// Instrumen untuk akun Investasi. Emas bisa dicatat dalam Rupiah atau gram.
export const INSTRUMENTS = {
  gold:        { label: "Emas",      color: "#D4A017", icon: Gem },
  mutual_fund: { label: "Reksadana", color: "#30B0C7", icon: PiggyBank },
  stock:       { label: "Saham",     color: "#5E5CE6", icon: TrendingUp },
  sbn:         { label: "SBN",       color: "#34C759", icon: Landmark },
  other:       { label: "Lainnya",   color: "#8E8E93", icon: Coins },
};
export const isGram = (a) => a?.kind === "investment" && a?.unit === "gram";

export const ACCOUNT_GROUPS = [
  { key: "liquid",     label: "Aset Lancar" },
  { key: "credit",     label: "Kartu Kredit & Paylater" },
  { key: "investment", label: "Investasi" },
];

export const ACCOUNT_COLORS = [
  "#1d5fd6", "#0B5CAD", "#0E7490", "#0F9F6E", "#15803D", "#2a8798",
  "#C026D3", "#E5484D", "#EA580C", "#B45309", "#334155", "#1b1d1f",
];

/** Warna kategori (warna sistem iOS + beberapa tambahan) untuk tile ikon dan grafik. */
export const CATEGORY_COLORS = [
  "#FF3B30", "#FF2D55", "#FF9500", "#FFCC00", "#A2845E", "#34C759", "#00C7BE", "#30B0C7",
  "#32ADE6", "#06B6D4", "#5856D6", "#AF52DE", "#EC4899", "#F97316", "#10B981", "#8E8E93",
];

/** Ikon kategori, dikelompokkan supaya mudah dicari di pemilih ikon. Kunci disimpan di database. */
export const ICON_GROUPS = [
  { label: "Dapur & makan", icons: {
    utensils: Utensils, "shopping-basket": ShoppingBasket, "shopping-cart": ShoppingCart, coffee: Coffee, "glass-water": GlassWater,
    milk: Milk, soup: Soup, pizza: Pizza, apple: Apple, carrot: Carrot, beef: Beef, fish: Fish, egg: Egg, wheat: Wheat, cake: Cake,
    "cooking-pot": CookingPot, refrigerator: Refrigerator } },
  { label: "Rumah & tagihan", icons: {
    home: House, zap: Zap, plug: Plug, droplet: Droplet, droplets: Droplets, flame: Flame, wifi: Wifi, tv: Tv, router: Router, phone: Phone,
    key: Key, building: Building2, "hand-helping": HandHelping, trash: Trash2, wrench: Wrench, hammer: Hammer, paintbrush: Paintbrush,
    "spray-can": SprayCan, "washing-machine": WashingMachine, sofa: Sofa, bed: BedDouble, bath: Bath, shower: ShowerHead, lamp: Lamp,
    sprout: Sprout, flower: Flower2 } },
  { label: "Anak & sekolah", icons: {
    baby: Baby, "toy-brick": ToyBrick, school: School, "graduation-cap": GraduationCap, book: BookOpen, backpack: Backpack } },
  { label: "Kesehatan", icons: {
    "heart-pulse": HeartPulse, stethoscope: Stethoscope, pill: Pill, syringe: Syringe, shield: Shield, dumbbell: Dumbbell } },
  { label: "Pribadi", icons: {
    "shopping-bag": ShoppingBag, shirt: Shirt, scissors: Scissors, sparkles: Sparkles, gem: Gem, watch: Watch, glasses: Glasses,
    smartphone: Smartphone, laptop: Laptop } },
  { label: "Transportasi & liburan", icons: {
    car: Car, fuel: Fuel, bike: Bike, bus: Bus, train: TrainFront, "circle-parking": CircleParking, plane: Plane, hotel: Hotel,
    ticket: Ticket, clapperboard: Clapperboard, gamepad: Gamepad2, music: Music, umbrella: Umbrella } },
  { label: "Uang & keluarga", icons: {
    receipt: Receipt, banknote: Banknote, "hand-coins": HandCoins, coins: Coins, "piggy-bank": PiggyBank, wallet: Wallet,
    landmark: Landmark, "credit-card": CreditCard, briefcase: Briefcase, "trending-up": TrendingUp, "hand-heart": HandHeart,
    gift: Gift, heart: Heart, users: Users, calendar: Calendar, target: Target, package: Package, truck: Truck,
    "paw-print": PawPrint, dog: Dog, cat: Cat, "circle-ellipsis": CircleEllipsis, circle: Circle } },
];

export const CATEGORY_ICONS = Object.assign({}, ...ICON_GROUPS.map((g) => g.icons));



export const ROLE_LABEL = { owner: "Pemilik", editor: "Lihat, catat & ubah", viewer: "Lihat & transfer" };
export const ROLE_HINT = {
  editor: "Bisa melihat saldo dan riwayat, mencatat pemasukan/pengeluaran, serta mengubah atau menghapus catatan di akun ini.",
  viewer: "Bisa melihat saldo dan riwayat, dan memindahkan uang dari atau ke akun ini. Tidak bisa mencatat pemasukan atau pengeluaran.",
};
