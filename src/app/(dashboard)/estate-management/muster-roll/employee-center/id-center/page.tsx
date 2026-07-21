"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, IdCard, Loader2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

type EmployeeIdRecord = {
  id: string;
  full_name: string;
  employee_code: string | null;
  estate_name: string;
  status: string;
  job_role: string | null;
  section_division: string | null;
  mobile_number: string | null;
  photo_public_url: string | null;
};

export default function EmployeeIdCenterPage() {
  const [employee, setEmployee] = useState<EmployeeIdRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const employeeId = new URLSearchParams(window.location.search).get("employee");
    if (!employeeId) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);

      supabase
        .from("estate_employees")
        .select("id, full_name, employee_code, estate_name, status, job_role, section_division, mobile_number, photo_public_url")
        .eq("id", employeeId)
        .single()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            setMessage(`Could not load employee: ${error.message}`);
            setEmployee(null);
          } else {
            setEmployee(data as EmployeeIdRecord);
            setMessage("");
          }
          setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

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

        {(loading || employee || message) && (
          <section className="mb-5 rounded-md border border-[#dbd0b4] bg-[#fffefb] p-5">
            {loading ? (
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#635a48]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading selected employee
              </div>
            ) : employee ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-16 items-center justify-center overflow-hidden rounded-md border border-[#dbd0b4] bg-[#faf6ec] text-xs font-black text-[#7a705d]">
                  {employee.photo_public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={employee.photo_public_url} alt={employee.full_name} className="h-full w-full object-cover" />
                  ) : (
                    "Photo"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a705d]">Selected for ID Center</p>
                  <h2 className="mt-1 text-xl font-black text-[#2f4a3a]">{employee.full_name}</h2>
                  <p className="mt-1 text-sm font-bold text-[#635a48]">
                    {employee.employee_code || "No employee code"} | {employee.estate_name} | {employee.status}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#7a705d]">
                    {[employee.job_role, employee.section_division, employee.mobile_number].filter(Boolean).join(" | ") || "No role details yet"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold text-[#9f2d20]">{message}</p>
            )}
          </section>
        )}

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
