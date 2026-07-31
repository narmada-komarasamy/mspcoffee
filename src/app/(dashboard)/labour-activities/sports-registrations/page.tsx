"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudOff, RefreshCw, Trophy, Upload } from "lucide-react";

type SportsRegistration = {
  id: string;
  name: string;
  phone: string;
  gender: string;
  currentLocation: string;
  aadhaarAddress: string;
  year: string;
  sports: string[];
  aadhaarFileName: string;
  aadhaarFileDataUrl: string;
  createdAt: string;
  status: "pending";
};

const STORAGE_KEY = "msp_sports_registration_pending";
const SPORTS = ["Cricket", "Football", "Volleyball", "Athletics", "Other"];
const YEARS = ["2025", "2026", "2027", "2028"];

const emptyForm = {
  name: "",
  phone: "",
  gender: "",
  currentLocation: "",
  aadhaarAddress: "",
  year: "2026",
  sports: [] as string[],
};

function readPending(): SportsRegistration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePending(records: SportsRegistration[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SportsRegistrationsPage() {
  const [form, setForm] = useState(emptyForm);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [pending, setPending] = useState<SportsRegistration[]>([]);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPending(readPending());
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const selectedSportsText = useMemo(
    () => form.sports.length > 0 ? form.sports.join(", ") : "No sports selected",
    [form.sports]
  );

  const setField = (field: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSport = (sport: string) => {
    setForm((prev) => ({
      ...prev,
      sports: prev.sports.includes(sport)
        ? prev.sports.filter((item) => item !== sport)
        : [...prev.sports, sport],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (form.sports.length === 0) {
      setMessage("Please select at least one sport.");
      return;
    }
    if (!aadhaarFile) {
      setMessage("Please upload the Aadhaar card photo or PDF.");
      return;
    }
    if (aadhaarFile.size > 5 * 1024 * 1024) {
      setMessage("Aadhaar file must be 5 MB or smaller.");
      return;
    }

    setSaving(true);
    try {
      const aadhaarFileDataUrl = await fileToDataUrl(aadhaarFile);
      const record: SportsRegistration = {
        id: crypto.randomUUID(),
        ...form,
        aadhaarFileName: aadhaarFile.name,
        aadhaarFileDataUrl,
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      const next = [record, ...pending];
      savePending(next);
      setPending(next);
      setForm(emptyForm);
      setAadhaarFile(null);
      setMessage("Registration saved on this device. It is ready to sync when database upload is connected.");
    } catch {
      setMessage("Could not save this entry on the device. Try a smaller photo or PDF.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f5f0eb] px-4 py-5 text-[#1f1a17] sm:px-6">
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(44,24,16,0.12)]">
        <div className="bg-gradient-to-br from-[#2c1810] to-[#4a2c1a] px-6 py-6 text-center text-white">
          <div className="mb-2 flex items-center justify-center gap-2 text-2xl font-semibold">
            <Trophy className="h-6 w-6 text-[#e8b86d]" />
            <span>MSP Coffee</span>
          </div>
          <h1 className="text-lg font-medium">Sports League Registration</h1>
          <p className="mt-1 text-sm text-white/70">One form. Multiple sports. Works for field entry.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
            {online ? <RefreshCw className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline mode"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#2c1810]">Full Name *</label>
            <input
              required
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="w-full rounded-xl border border-[#d4c8bc] bg-[#fdfaf7] px-3.5 py-3 text-base outline-none focus:border-[#c67c4e] focus:ring-4 focus:ring-[#c67c4e]/15"
              placeholder="Enter full name as on Aadhaar"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#2c1810]">Phone Number *</label>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full rounded-xl border border-[#d4c8bc] bg-[#fdfaf7] px-3.5 py-3 text-base outline-none focus:border-[#c67c4e] focus:ring-4 focus:ring-[#c67c4e]/15"
              placeholder="10-digit mobile number"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2c1810]">Gender *</label>
            <div className="grid grid-cols-2 gap-3">
              {["Male", "Female"].map((gender) => (
                <label key={gender} className="flex items-center gap-2 rounded-xl border border-[#e8ddd3] bg-[#fdfaf7] px-3 py-3">
                  <input
                    required
                    type="radio"
                    name="gender"
                    value={gender}
                    checked={form.gender === gender}
                    onChange={() => setField("gender", gender)}
                    className="accent-[#c67c4e]"
                  />
                  {gender}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#2c1810]">Current Location / Address *</label>
            <textarea
              required
              value={form.currentLocation}
              onChange={(event) => setField("currentLocation", event.target.value)}
              className="min-h-24 w-full resize-y rounded-xl border border-[#d4c8bc] bg-[#fdfaf7] px-3.5 py-3 text-base outline-none focus:border-[#c67c4e] focus:ring-4 focus:ring-[#c67c4e]/15"
              placeholder="Enter current residential address"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#2c1810]">Address as per Aadhaar *</label>
            <textarea
              required
              value={form.aadhaarAddress}
              onChange={(event) => setField("aadhaarAddress", event.target.value)}
              className="min-h-24 w-full resize-y rounded-xl border border-[#d4c8bc] bg-[#fdfaf7] px-3.5 py-3 text-base outline-none focus:border-[#c67c4e] focus:ring-4 focus:ring-[#c67c4e]/15"
              placeholder="Enter the full address written on Aadhaar"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#2c1810]">Registration Year *</label>
            <select
              required
              value={form.year}
              onChange={(event) => setField("year", event.target.value)}
              className="w-full rounded-xl border border-[#d4c8bc] bg-[#fdfaf7] px-3.5 py-3 text-base outline-none focus:border-[#c67c4e] focus:ring-4 focus:ring-[#c67c4e]/15"
            >
              {YEARS.map((year) => <option key={year}>{year}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2c1810]">Sports interested in *</label>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {SPORTS.map((sport) => (
                <label key={sport} className="flex items-center gap-2 rounded-xl border border-[#e8ddd3] bg-[#fdfaf7] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={form.sports.includes(sport)}
                    onChange={() => toggleSport(sport)}
                    className="accent-[#c67c4e]"
                  />
                  {sport}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#6b5b4f]">{selectedSportsText}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#2c1810]">Aadhaar Card Photo *</label>
            <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-[#d4c8bc] bg-[#fdfaf7] px-4 py-6 text-center transition hover:border-[#c67c4e] hover:bg-[#fff8f0]">
              <Upload className="mb-2 h-7 w-7 text-[#a65d2e]" />
              <span className="font-medium">{aadhaarFile ? aadhaarFile.name : "Click to upload Aadhaar photo"}</span>
              <span className="mt-1 text-xs text-[#6b5b4f]">JPG, PNG or PDF. Max 5 MB.</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(event) => setAadhaarFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {message && (
            <div className="rounded-xl border border-[#e8ddd3] bg-[#fff8f0] px-4 py-3 text-sm text-[#5f3a22]">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-br from-[#c67c4e] to-[#a65d2e] px-4 py-3.5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(166,93,46,0.3)] transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit Registration"}
          </button>

          <p className="text-center text-xs text-[#6b5b4f]">
            Aadhaar is used only for verification. Entries are saved on this device first, so field entry can continue without internet.
          </p>
        </form>

        <div className="border-t border-[#ebe4dc] bg-[#f8f4f0] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#2c1810]">Pending on this device</div>
              <div className="text-xs text-[#8a7a6d]">Stored locally until sync is connected</div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#2d6a4f]">
              <CheckCircle2 className="h-4 w-4" />
              {pending.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
