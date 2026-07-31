import { Wrench } from "lucide-react";

export default function NewFacilitiesPage() {
  return (
    <div className="min-h-full bg-[#f7f2e7] p-6 text-[#1b2f1b]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1b4a1b] text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">New Facilities</h1>
            <p className="text-sm text-[#6f776f]">Labour Activities</p>
          </div>
        </div>
        <div className="rounded-lg border border-[#e1d8c3] bg-white p-6 shadow-sm">
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a826f]">Workspace</div>
          <div className="mt-2 text-lg font-semibold">New facility records</div>
        </div>
      </div>
    </div>
  );
}
