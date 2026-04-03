"use client";

import { use } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Fuel,
  FileText,
  Users,
  Wheat,
  DollarSign,
  Sprout,
  SprayCan,
  Truck,
  Package,
  ShoppingCart,
  CloudSun,
  Brain,
  Construction,
} from "lucide-react";

const pageInfo: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  "fuel-expenses": {
    label: "Fuel Expenses",
    icon: Fuel,
    description: "Track diesel and petrol expenses across estates and vehicles.",
  },
  "daily-report": {
    label: "Daily Report",
    icon: FileText,
    description: "View and submit daily estate activity reports.",
  },
  "muster-roll": {
    label: "Muster Roll",
    icon: Users,
    description: "Manage daily worker attendance and labour allocation.",
  },
  "harvest-yield": {
    label: "Harvest Yield",
    icon: Wheat,
    description: "Record and analyze coffee cherry harvest data by estate.",
  },
  "labour-costs": {
    label: "Labour Costs",
    icon: DollarSign,
    description: "Monitor wage calculations, overtime, and cost breakdowns.",
  },
  nursery: {
    label: "Nursery",
    icon: Sprout,
    description: "Track seedling growth, grafting, and nursery inventory.",
  },
  "spraying-log": {
    label: "Spraying Log",
    icon: SprayCan,
    description: "Log pesticide and fertilizer application schedules.",
  },
  "vehicle-log": {
    label: "Vehicle Log",
    icon: Truck,
    description: "Maintain vehicle usage, maintenance, and trip records.",
  },
  "store-inventory": {
    label: "Store Inventory",
    icon: Package,
    description: "Manage estate store stock levels and procurement.",
  },
  "shopify-orders": {
    label: "Shopify Orders",
    icon: ShoppingCart,
    description: "View and manage online coffee orders from Shopify.",
  },
  weather: {
    label: "Weather",
    icon: CloudSun,
    description: "Check current weather and forecasts for your estates.",
  },
  "ai-insights": {
    label: "AI Insights",
    icon: Brain,
    description: "Get AI-powered analysis and recommendations for your plantation.",
  },
};

export default function PlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const info = pageInfo[slug];

  const Icon = info?.icon ?? Construction;
  const label = info?.label ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const description = info?.description ?? "This module is not yet available.";

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#86efac]/10 mb-6">
        <Icon className="h-10 w-10 text-[#86efac]" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{label}</h2>
      <p className="text-white/50 max-w-md mb-4">{description}</p>
      <Badge variant="secondary" className="bg-white/10 text-white/60 border-0">
        Coming soon
      </Badge>
    </div>
  );
}
