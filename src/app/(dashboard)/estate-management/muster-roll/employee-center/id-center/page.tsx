"use client";

import { CSSProperties, ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, IdCard, Loader2, Printer, RotateCcw, Upload, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import css from "./id-center.module.css";

type EmployeeIdRecord = {
  id: string;
  full_name: string;
  employee_code: string | null;
  estate_name: string;
  status: string;
  job_role: string | null;
  section_division: string | null;
  mobile_number: string | null;
  blood_group: string | null;
  current_address: string | null;
  permanent_address: string | null;
  photo_public_url: string | null;
};

type CardForm = {
  fullName: string;
  category: CardCategory;
  designation: string;
  place: string;
  estateLine1: string;
  estateLine2: string;
  bloodGroup: string;
  mobile: string;
  address: string;
};

type IdCenterPrefill = {
  employeeId: string;
  photo: string;
  form: CardForm;
};

type CardCategory = "estate-field" | "pf-worker" | "line-worker" | "village-worker" | "migrant-worker";

type CardTheme = {
  accent: string;
  accentSoft: string;
  accentDark: string;
  ribbon: string;
  ribbonDark: string;
  glow: string;
  leaf: string;
};

const categoryOptions: { value: CardCategory; label: string; shortLabel: string; theme: CardTheme }[] = [
  {
    value: "estate-field",
    label: "Staff & Field",
    shortLabel: "Staff & Field",
    theme: {
      accent: "#ffd400",
      accentSoft: "#fff2a6",
      accentDark: "#b8860b",
      ribbon: "#ffd400",
      ribbonDark: "#8a6008",
      glow: "rgba(184, 134, 11, 0.44)",
      leaf: "#87ad77",
    },
  },
  {
    value: "pf-worker",
    label: "PF Workers",
    shortLabel: "PF Worker",
    theme: {
      accent: "#2f7bff",
      accentSoft: "#c9dcff",
      accentDark: "#063c9e",
      ribbon: "#2f7bff",
      ribbonDark: "#06285f",
      glow: "rgba(29, 82, 168, 0.66)",
      leaf: "#78a9ff",
    },
  },
  {
    value: "line-worker",
    label: "Line Workers",
    shortLabel: "Line Worker",
    theme: {
      accent: "#ff7a00",
      accentSoft: "#ffd7b0",
      accentDark: "#9f3a00",
      ribbon: "#ff7a00",
      ribbonDark: "#7a2b00",
      glow: "rgba(188, 86, 0, 0.58)",
      leaf: "#ffae75",
    },
  },
  {
    value: "village-worker",
    label: "Village Workers",
    shortLabel: "Village Worker",
    theme: {
      accent: "#b83a32",
      accentSoft: "#ffd1ce",
      accentDark: "#6f1712",
      ribbon: "#b83a32",
      ribbonDark: "#54100d",
      glow: "rgba(145, 36, 30, 0.56)",
      leaf: "#e98282",
    },
  },
  {
    value: "migrant-worker",
    label: "Migrant Workers",
    shortLabel: "Migrant Worker",
    theme: {
      accent: "#b994ff",
      accentSoft: "#eadfff",
      accentDark: "#5c2fb1",
      ribbon: "#b994ff",
      ribbonDark: "#3b1e78",
      glow: "rgba(111, 68, 174, 0.6)",
      leaf: "#c9b2ff",
    },
  },
];

const initialForm: CardForm = {
  fullName: "Arjun Menon",
  category: "estate-field",
  designation: "Field Supervisor",
  place: "Moganad",
  estateLine1: "Moganad",
  estateLine2: "Estate",
  bloodGroup: "O+",
  mobile: "+91 98765 43210",
  address: "123 Coffee Lane, Brewsville, Grounds 12345",
};

const logoPath = "/msp-id-logo.png";
const idCenterPrefillStorageKey = "msp-id-center-prefill";

const splitEstateName = (estateName: string) => {
  const clean = estateName.trim() || "Moganad Estate";
  return clean.toLowerCase().endsWith(" estate")
    ? [clean.slice(0, -7), "Estate"]
    : [clean, "Estate"];
};

const formatMobile = (mobile: string | null) => {
  const clean = mobile?.trim();
  if (!clean) return "";
  return clean.startsWith("+") ? clean : `+91 ${clean}`;
};

const categoryFromText = (...values: (string | null | undefined)[]): CardCategory => {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (text.includes("migrant")) return "migrant-worker";
  if (text.includes("village")) return "village-worker";
  if (text.includes("line")) return "line-worker";
  if (text.includes("pf") || text.includes("p.f")) return "pf-worker";
  return "estate-field";
};

const normalizeCategory = (value: unknown): CardCategory =>
  categoryOptions.some((option) => option.value === value) ? (value as CardCategory) : "estate-field";

const getCategory = (category: CardCategory) =>
  categoryOptions.find((option) => option.value === category) ?? categoryOptions[0];

const cardStyleForTheme = (theme: CardTheme) =>
  ({
    "--id-accent": theme.accent,
    "--id-accent-soft": theme.accentSoft,
    "--id-accent-dark": theme.accentDark,
    "--id-ribbon": theme.ribbon,
    "--id-ribbon-dark": theme.ribbonDark,
    "--id-glow": theme.glow,
    "--id-leaf": theme.leaf,
  }) as CSSProperties;

const cardFormFromEmployee = (employee: EmployeeIdRecord): CardForm => {
  const [estateLine1, estateLine2] = splitEstateName(employee.estate_name);

  return {
    fullName: employee.full_name || "",
    category: categoryFromText(employee.job_role, employee.section_division),
    designation: employee.job_role || employee.section_division || "",
    place: employee.section_division || estateLine1,
    estateLine1,
    estateLine2,
    bloodGroup: employee.blood_group || "",
    mobile: formatMobile(employee.mobile_number),
    address: employee.current_address || employee.permanent_address || "",
  };
};

const readIdCenterPrefill = (employeeId: string): IdCenterPrefill | null => {
  const raw = window.sessionStorage.getItem(idCenterPrefillStorageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as IdCenterPrefill;
    if (parsed.employeeId !== employeeId) return null;
    return {
      ...parsed,
      form: {
        ...parsed.form,
        category: normalizeCategory(parsed.form.category),
      },
    };
  } catch {
    window.sessionStorage.removeItem(idCenterPrefillStorageKey);
    return null;
  }
};

export default function EmployeeIdCenterPage() {
  const [form, setForm] = useState<CardForm>(initialForm);
  const [employee, setEmployee] = useState<EmployeeIdRecord | null>(null);
  const [photo, setPhoto] = useState("");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedSummary = useMemo(() => {
    if (!employee) return "";
    return [employee.employee_code || "No employee code", employee.estate_name, employee.status]
      .filter(Boolean)
      .join(" | ");
  }, [employee]);

  useEffect(() => {
    const employeeId = new URLSearchParams(window.location.search).get("employee");
    if (!employeeId) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const prefill = readIdCenterPrefill(employeeId);
      const hasPrefill = Boolean(prefill);
      if (prefill) {
        setForm(prefill.form);
        setPhoto(prefill.photo);
      }

      setLoading(true);

      supabase
        .from("estate_employees")
        .select(
          "id, full_name, employee_code, estate_name, status, job_role, section_division, mobile_number, blood_group, current_address, permanent_address, photo_public_url"
        )
        .eq("id", employeeId)
        .single()
        .then(({ data, error }) => {
          if (cancelled) return;

          if (error) {
            setMessage(`Could not load employee: ${error.message}`);
            setEmployee(null);
          } else {
            const selected = data as EmployeeIdRecord;
            setEmployee(selected);
            if (!hasPrefill) setForm(cardFormFromEmployee(selected));
            setPhoto((currentPhoto) => selected.photo_public_url || currentPhoto || "");
            setMessage("");
            window.sessionStorage.removeItem(idCenterPrefillStorageKey);
          }

          setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const updateField = (key: keyof CardForm, value: string) => {
    setForm((current) => ({ ...current, [key]: key === "category" ? normalizeCategory(value) : value }));
  };

  const readImage = (event: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    if (!window.confirm("Clear all fields and start a fresh card?")) return;
    setForm(initialForm);
    setPhoto("");
    setSignature("");
    setEmployee(null);
    setMessage("");
  };

  return (
    <main className={css.page}>
      <header className={css.header}>
        <div>
          <p className={css.eyebrow}>Muster Roll / Employee Center</p>
          <h1 className={css.title}>ID Center</h1>
        </div>
        <div className={css.headerActions}>
          <Link href="/estate-management/muster-roll/employee-center" className={css.linkBtn}>
            <ArrowLeft size={16} />
            Registry
          </Link>
          <button type="button" className={css.primaryBtn} onClick={() => window.print()}>
            <Printer size={16} />
            Print ID card
          </button>
        </div>
      </header>

      {(loading || employee || message) && (
        <section className={css.selectedPanel}>
          {loading ? (
            <div className={css.loading}>
              <Loader2 className={css.spin} size={16} />
              Loading selected employee
            </div>
          ) : employee ? (
            <>
              <div className={css.selectedIcon}>
                <Users size={18} />
              </div>
              <div>
                <p className={css.selectedLabel}>Selected for ID Center</p>
                <h2>{employee.full_name}</h2>
                <p>{selectedSummary}</p>
              </div>
            </>
          ) : (
            <p className={css.errorText}>{message}</p>
          )}
        </section>
      )}

      <div className={css.app}>
        <aside className={css.editor}>
          <div className={css.editorHead}>
            <div className={css.editorIcon}>
              <IdCard size={20} />
            </div>
            <div>
              <h2>MSP Coffee ID Card Maker</h2>
              <p>Edit fields here. The front and back cards update live.</p>
            </div>
          </div>

          <label className={css.fieldGroup}>
            <span>Full Name</span>
            <input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
          </label>

          <label className={css.fieldGroup}>
            <span>Category</span>
            <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className={css.categorySwatches}>
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${css.categorySwatch} ${form.category === option.value ? css.categorySwatchActive : ""}`}
                style={{ "--swatch-color": option.theme.accent } as CSSProperties}
                onClick={() => updateField("category", option.value)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>

          <div className={css.row2}>
            <label className={css.fieldGroup}>
              <span>Designation</span>
              <input value={form.designation} onChange={(event) => updateField("designation", event.target.value)} />
            </label>
            <label className={css.fieldGroup}>
              <span>Place</span>
              <input value={form.place} onChange={(event) => updateField("place", event.target.value)} />
            </label>
          </div>

          <div className={css.row2}>
            <label className={css.fieldGroup}>
              <span>Estate Name, line 1</span>
              <input value={form.estateLine1} onChange={(event) => updateField("estateLine1", event.target.value)} />
            </label>
            <label className={css.fieldGroup}>
              <span>Estate Name, line 2</span>
              <input value={form.estateLine2} onChange={(event) => updateField("estateLine2", event.target.value)} />
            </label>
          </div>

          <div className={css.fieldGroup}>
            <span>Photo</span>
            <div className={css.uploadRow}>
              <div className={css.thumb}>{photo ? <img src={photo} alt="" /> : "Photo"}</div>
              <label className={css.ghostBtn}>
                <Upload size={15} />
                Upload photo
                <input type="file" accept="image/*" onChange={(event) => readImage(event, setPhoto)} />
              </label>
            </div>
          </div>

          <div className={css.divider} />

          <div className={css.row2}>
            <label className={css.fieldGroup}>
              <span>Blood Group</span>
              <input value={form.bloodGroup} onChange={(event) => updateField("bloodGroup", event.target.value)} />
            </label>
            <label className={css.fieldGroup}>
              <span>Mobile No.</span>
              <input value={form.mobile} onChange={(event) => updateField("mobile", event.target.value)} />
            </label>
          </div>

          <label className={css.fieldGroup}>
            <span>Address</span>
            <textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} />
          </label>

          <div className={css.fieldGroup}>
            <span>Signature image, optional</span>
            <div className={css.uploadRow}>
              <div className={`${css.thumb} ${css.sigThumb}`}>{signature ? <img src={signature} alt="" /> : "Sign"}</div>
              <label className={css.ghostBtn}>
                <Upload size={15} />
                Upload signature
                <input type="file" accept="image/*" onChange={(event) => readImage(event, setSignature)} />
              </label>
            </div>
          </div>

          <div className={css.divider} />

          <div className={css.printActions}>
            <button type="button" className={css.goldBtn} onClick={() => window.print()}>
              <Printer size={16} />
              Print this ID card
            </button>
            <button type="button" className={css.ghostBtn} onClick={resetForm}>
              <RotateCcw size={15} />
              Clear all fields
            </button>
          </div>
        </aside>

        <section className={css.stage}>
          <div className={css.stageLabel}>Live Preview - Front & Back</div>
          <div className={css.cardsWrap}>
            <IdCardFront form={form} photo={photo} signature={signature} />
            <IdCardBack form={form} signature={signature} />
          </div>
        </section>
      </div>
    </main>
  );
}

function IdCardFront({
  form,
  photo,
  signature,
}: {
  form: CardForm;
  photo: string;
  signature: string;
}) {
  const category = getCategory(form.category);
  const theme = category.theme;

  return (
    <article className={`${css.card} ${css.cardFront}`} style={cardStyleForTheme(theme)}>
      <FrontBackground theme={theme} />
      <div className={css.frontContent}>
        <img className={css.frontLogo} src={logoPath} alt="MSP Coffee logo" />

        <div className={css.photoFrame}>
          <div className={css.connector} />
          <div className={css.ring}>
            <div className={css.inner}>{photo ? <img src={photo} alt={form.fullName} /> : <span>PHOTO</span>}</div>
          </div>
        </div>

        <div className={css.nameText}>{form.fullName || "Full Name"}</div>
        <div className={css.desigText}>{form.designation || "Designation"}</div>
        <div className={css.placeText}>{form.place || "Place"}</div>

        <div className={css.estateText}>
          <span>{form.estateLine1 || "Estate"}</span>
          <span>{form.estateLine2 || "Estate"}</span>
        </div>

        <div className={css.sigRow}>
          <div>
            {signature ? <img className={css.signatureImage} src={signature} alt="" /> : null}
            <span>Authority Signature</span>
          </div>
          <img className={css.miniLogo} src={logoPath} alt="" />
        </div>
      </div>
    </article>
  );
}

function IdCardBack({ form, signature }: { form: CardForm; signature: string }) {
  const category = getCategory(form.category);
  const theme = category.theme;

  return (
    <article className={`${css.card} ${css.cardBack}`} style={cardStyleForTheme(theme)}>
      <BackBackground theme={theme} />
      <div className={css.backContent}>
        <img className={css.backLogo} src={logoPath} alt="MSP Coffee logo" />
        <div className={`${css.goldText} ${css.backTitle}`}>MSP COFFEE</div>
        <div className={css.backSubtitle}>I D&nbsp; C A R D</div>

        <div className={css.backGrid}>
          <div>
            <div className={css.cellLabel}>Blood Group</div>
            <div className={css.cellValue}>{form.bloodGroup || "-"}</div>
          </div>
          <div>
            <div className={css.cellLabel}>Mobile No.</div>
            <div className={css.cellValue}>{form.mobile || "-"}</div>
          </div>
        </div>

        <div className={css.addrBlock}>
          <div className={css.cellLabel}>Address</div>
          <div className={css.cellValue}>{form.address || "-"}</div>
        </div>

        <div className={css.backSig}>
          {signature ? <img className={css.signatureImage} src={signature} alt="" /> : null}
          <span>Holder Signature</span>
        </div>
      </div>
    </article>
  );
}

function FrontBackground({ theme }: { theme: CardTheme }) {
  return (
    <svg className={css.bgSvg} viewBox="0 0 225 350" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="idGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe98c" />
          <stop offset="45%" stopColor={theme.ribbon} />
          <stop offset="100%" stopColor={theme.accentDark} />
        </linearGradient>
        <linearGradient id="idGoldGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={theme.accentSoft} />
          <stop offset="100%" stopColor={theme.ribbonDark} />
        </linearGradient>
      </defs>
      <path
        d="M-34,-16 C48,62 18,114 50,168 C80,218 12,263 35,366 L10,366 C-22,270 44,220 9,172 C-44,100 5,50 -62,-16 Z"
        fill="url(#idGoldGrad)"
      />
      <path
        d="M15,-16 C78,58 36,125 91,184 C132,228 76,275 109,366 L84,366 C47,281 101,234 63,190 C4,122 50,56 -12,-16 Z"
        fill="url(#idGoldGrad2)"
        opacity=".85"
      />
      <path
        d="M51,158 C97,174 145,167 234,71 L234,104 C156,187 91,205 42,182 Z"
        fill="url(#idGoldGrad)"
        opacity=".9"
      />
      <path
        d="M230,-12 C218,46 209,89 177,129 C145,170 116,181 76,181 L66,165 C111,157 143,139 165,102 C189,62 199,21 206,-12 Z"
        fill="#031c14"
        opacity=".62"
      />
      <path
        d="M-8,270 C4,311 21,336 48,365 L20,365 C-5,330 -17,296 -20,257 Z"
        fill="#05291f"
        opacity=".55"
      />
    </svg>
  );
}

function BackBackground({ theme }: { theme: CardTheme }) {
  return (
    <svg className={css.bgSvg} viewBox="0 0 225 350" preserveAspectRatio="none" aria-hidden="true">
      <rect width="225" height="350" fill="#05291f" />
      <radialGradient id="backGlow" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stopColor="#0b3a2b" />
        <stop offset="100%" stopColor="#031c14" />
      </radialGradient>
      <rect width="225" height="350" fill="url(#backGlow)" opacity=".85" />
      <g fill="none" stroke={theme.leaf} strokeWidth="1.1" opacity=".22">
        <path d="M-6,26 C22,2 48,-2 78,18" />
        <path d="M12,14 C21,37 39,53 72,66" />
        <path d="M17,18 C34,20 48,31 61,52" />
        <path d="M31,8 C41,24 52,34 76,42" />
        <path d="M178,-2 C200,18 210,48 207,78" />
        <path d="M204,16 C185,27 169,45 156,72" />
        <path d="M198,34 C181,43 170,57 164,82" />
        <path d="M3,235 C28,243 48,260 60,296" />
        <path d="M14,327 C38,303 58,287 91,284" />
        <path d="M176,260 C196,278 211,304 227,341" />
        <path d="M221,255 C197,267 181,286 171,318" />
      </g>
      <g fill="none" stroke={theme.leaf} strokeWidth=".9" opacity=".18">
        <circle cx="7" cy="68" r="14" />
        <circle cx="218" cy="36" r="13" />
        <circle cx="17" cy="311" r="15" />
      </g>
    </svg>
  );
}
