"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudOff, RefreshCw, Sparkles, Trophy, Upload } from "lucide-react";

type SportsRegistration = {
  id: string;
  name: string;
  phoneAsPerAadhaar: string;
  alternatePhone: string;
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
  phoneAsPerAadhaar: "",
  alternatePhone: "",
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
  const [extractMessage, setExtractMessage] = useState("");
  const [extractingAadhaar, setExtractingAadhaar] = useState(false);
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

  const extractAadhaarDetails = async (file: File) => {
    setExtractMessage("");
    if (!navigator.onLine) {
      setExtractMessage("Offline: enter Aadhaar address and phone manually.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setExtractMessage("Aadhaar file must be 5 MB or smaller.");
      return;
    }

    setExtractingAadhaar(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch("/api/parse-aadhaar-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: dataUrl.split(",")[1] ?? "",
          mediaType: file.type || "application/pdf",
        }),
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed.error || "Could not read Aadhaar details.");

      setForm((prev) => ({
        ...prev,
        name: parsed.name || prev.name,
        aadhaarAddress: parsed.aadhaar_address || prev.aadhaarAddress,
        phoneAsPerAadhaar: parsed.phone_as_per_aadhaar || prev.phoneAsPerAadhaar,
      }));
      setExtractMessage(parsed.notes || "Aadhaar details read. Please review before submitting.");
    } catch (error) {
      setExtractMessage(error instanceof Error ? error.message : "Could not read Aadhaar details. Enter them manually.");
    } finally {
      setExtractingAadhaar(false);
    }
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
    <div className="ds-page px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl border shadow-[0_8px_24px_rgba(27,74,27,0.10)]" style={{ background: "var(--t-card)", borderColor: "var(--t-border)" }}>
        <div className="px-6 py-6 text-center text-white" style={{ background: "linear-gradient(135deg, var(--t-heading) 0%, var(--t-green) 100%)" }}>
          <div className="mb-2 flex items-center justify-center gap-2 text-2xl font-semibold">
            <Trophy className="h-6 w-6" style={{ color: "var(--t-gold)" }} />
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
            <label className="ds-filter-label">Full Name *</label>
            <input
              required
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="w-full rounded-lg border px-3.5 py-3 text-base outline-none transition focus:ring-4"
              style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}
              placeholder="Enter full name as on Aadhaar"
            />
          </div>

          <div>
            <label className="ds-filter-label">Phone as per Aadhaar</label>
            <input
              inputMode="numeric"
              pattern="[0-9]{10}"
              value={form.phoneAsPerAadhaar}
              onChange={(event) => setField("phoneAsPerAadhaar", event.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full rounded-lg border px-3.5 py-3 text-base outline-none transition focus:ring-4"
              style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}
              placeholder="Auto-filled if visible on Aadhaar"
            />
            <p className="mt-1 text-xs" style={{ color: "var(--t-muted)" }}>Most Aadhaar cards do not print the linked phone number.</p>
          </div>

          <div>
            <label className="ds-filter-label">Alternate Phone Number *</label>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              value={form.alternatePhone}
              onChange={(event) => setField("alternatePhone", event.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full rounded-lg border px-3.5 py-3 text-base outline-none transition focus:ring-4"
              style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}
              placeholder="10-digit contact number"
            />
          </div>

          <div>
            <label className="ds-filter-label">Gender *</label>
            <div className="grid grid-cols-2 gap-3">
              {["Male", "Female"].map((gender) => (
                <label key={gender} className="flex items-center gap-2 rounded-lg border px-3 py-3" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}>
                  <input
                    required
                    type="radio"
                    name="gender"
                    value={gender}
                    checked={form.gender === gender}
                    onChange={() => setField("gender", gender)}
                    style={{ accentColor: "var(--t-accent)" }}
                  />
                  {gender}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="ds-filter-label">Current Location / Address *</label>
            <textarea
              required
              value={form.currentLocation}
              onChange={(event) => setField("currentLocation", event.target.value)}
              className="min-h-24 w-full resize-y rounded-lg border px-3.5 py-3 text-base outline-none transition focus:ring-4"
              style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}
              placeholder="Enter current residential address"
            />
          </div>

          <div>
            <label className="ds-filter-label">Address as per Aadhaar *</label>
            <textarea
              required
              value={form.aadhaarAddress}
              onChange={(event) => setField("aadhaarAddress", event.target.value)}
              className="min-h-24 w-full resize-y rounded-lg border px-3.5 py-3 text-base outline-none transition focus:ring-4"
              style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}
              placeholder="Enter the full address written on Aadhaar"
            />
          </div>

          <div>
            <label className="ds-filter-label">Registration Year *</label>
            <select
              required
              value={form.year}
              onChange={(event) => setField("year", event.target.value)}
              className="w-full rounded-lg border px-3.5 py-3 text-base outline-none transition focus:ring-4"
              style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}
            >
              {YEARS.map((year) => <option key={year}>{year}</option>)}
            </select>
          </div>

          <div>
            <label className="ds-filter-label">Sports interested in *</label>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {SPORTS.map((sport) => (
                <label key={sport} className="flex items-center gap-2 rounded-lg border px-3 py-3" style={{ background: "var(--t-bg)", borderColor: "var(--t-border)", color: "var(--t-text)" }}>
                  <input
                    type="checkbox"
                    checked={form.sports.includes(sport)}
                    onChange={() => toggleSport(sport)}
                    style={{ accentColor: "var(--t-accent)" }}
                  />
                  {sport}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--t-muted)" }}>{selectedSportsText}</p>
          </div>

          <div>
            <label className="ds-filter-label">Aadhaar Card Photo *</label>
            <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition" style={{ background: "var(--t-subtle)", borderColor: "var(--t-border)", color: "var(--t-text)" }}>
              <Upload className="mb-2 h-7 w-7" style={{ color: "var(--t-accent)" }} />
              <span className="font-medium">{aadhaarFile ? aadhaarFile.name : "Click to upload Aadhaar photo"}</span>
              <span className="mt-1 text-xs" style={{ color: "var(--t-muted)" }}>
                {extractingAadhaar ? "Reading Aadhaar details..." : "JPG, PNG or PDF. Max 5 MB."}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setAadhaarFile(file);
                  if (file) void extractAadhaarDetails(file);
                }}
              />
            </label>
            {extractMessage && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs" style={{ background: "var(--t-subtle)", borderColor: "var(--t-border)", color: "var(--t-text)" }}>
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{extractMessage}</span>
              </div>
            )}
          </div>

          {message && (
            <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: "var(--t-subtle)", borderColor: "var(--t-border)", color: "var(--t-text)" }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg px-4 py-3.5 text-base font-semibold shadow-[0_4px_12px_rgba(27,74,27,0.20)] transition hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: "var(--t-accent)", color: "var(--t-bg)" }}
          >
            {saving ? "Saving..." : "Submit Registration"}
          </button>

          <p className="text-center text-xs" style={{ color: "var(--t-muted)" }}>
            Aadhaar is used only for verification. Entries are saved on this device first, so field entry can continue without internet.
          </p>
        </form>

        <div className="border-t px-6 py-4" style={{ background: "var(--t-subtle)", borderColor: "var(--t-border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--t-heading)" }}>Pending on this device</div>
              <div className="text-xs" style={{ color: "var(--t-muted)" }}>Stored locally until sync is connected</div>
            </div>
            <div className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold" style={{ background: "var(--t-card)", color: "var(--t-heading)" }}>
              <CheckCircle2 className="h-4 w-4" />
              {pending.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
