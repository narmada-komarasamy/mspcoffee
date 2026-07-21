import Link from "next/link";
import { BadgeCheck, IdCard, Users } from "lucide-react";

export default function EmployeeIdCenterPage() {
  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-8 text-[#2b2620]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a705d]">
              Muster Roll / Employee Center
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-[#2f4a3a]">
              ID Center
            </h1>
          </div>
          <Link
            href="/estate-management/muster-roll/employee-center"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#2f4a3a] bg-[#fffefb] px-4 text-sm font-extrabold text-[#2f4a3a] transition hover:bg-[#f2ebd9]"
          >
            <Users className="h-4 w-4" />
            Employee Registry
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-[#dbd0b4] bg-[#fffefb] p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[#2f4a3a] text-[#fffefb]">
              <IdCard className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-[#2f4a3a]">Issue Employee IDs</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#635a48]">
              Prepare ID records from saved employee registry details.
            </p>
          </div>

          <div className="rounded-md border border-[#dbd0b4] bg-[#fffefb] p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[#2f4a3a] text-[#fffefb]">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-[#2f4a3a]">Track ID Status</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#635a48]">
              Use this section for ID pending, printed, issued and replacement workflows.
            </p>
          </div>

          <div className="rounded-md border border-dashed border-[#b8863b] bg-[#faf6ec] p-5">
            <h2 className="text-base font-black text-[#2f4a3a]">Next Build Step</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#635a48]">
              The menu is ready. We can connect this to employee photos, Aadhaar/PAN records and printable ID cards next.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
