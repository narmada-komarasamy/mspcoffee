import Link from "next/link";
import { Activity, HeartPulse, Trophy, Wrench } from "lucide-react";

const items = [
  {
    label: "Sports Registrations",
    href: "/labour-activities/sports-registrations",
    icon: Trophy,
  },
  {
    label: "Health Camps",
    href: "/labour-activities/health-camps",
    icon: HeartPulse,
  },
  {
    label: "New Facilities",
    href: "/labour-activities/new-facilities",
    icon: Wrench,
  },
];

export default function LabourActivitiesPage() {
  return (
    <div className="min-h-full bg-[#f7f2e7] p-6 text-[#1b2f1b]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1b4a1b] text-white">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">Labour Activities</h1>
            <p className="text-sm text-[#6f776f]">Coffee estate worker welfare and activity records</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-[#e1d8c3] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#edf6ed] text-[#2d6e2d]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-base font-semibold">{item.label}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
