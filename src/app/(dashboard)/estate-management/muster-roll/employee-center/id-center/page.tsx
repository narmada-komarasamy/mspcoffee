"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
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
  designation: string;
  place: string;
  estateLine1: string;
  estateLine2: string;
  bloodGroup: string;
  mobile: string;
  address: string;
};

const initialForm: CardForm = {
  fullName: "Arjun Menon",
  designation: "Field Supervisor",
  place: "Moganad",
  estateLine1: "Moganad",
  estateLine2: "Estate",
  bloodGroup: "O+",
  mobile: "+91 98765 43210",
  address: "123 Coffee Lane, Brewsville, Grounds 12345",
};

const logoPath = "/msp-logo.png";

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

const cardFormFromEmployee = (employee: EmployeeIdRecord): CardForm => {
  const [estateLine1, estateLine2] = splitEstateName(employee.estate_name);

  return {
    fullName: employee.full_name || "",
    designation: employee.job_role || employee.section_division || "",
    place: employee.section_division || estateLine1,
    estateLine1,
    estateLine2,
    bloodGroup: employee.blood_group || "",
    mobile: formatMobile(employee.mobile_number),
    address: employee.current_address || employee.permanent_address || "",
  };
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
            setForm(cardFormFromEmployee(selected));
            setPhoto(selected.photo_public_url || "");
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

  const updateField = (key: keyof CardForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
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
  return (
    <article className={`${css.card} ${css.cardFront}`}>
      <CardBackground />
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
            <span>Holder Signature</span>
          </div>
          <img className={css.miniLogo} src={logoPath} alt="" />
        </div>
      </div>
    </article>
  );
}

function IdCardBack({ form, signature }: { form: CardForm; signature: string }) {
  return (
    <article className={`${css.card} ${css.cardBack}`}>
      <CardBackground />
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

function CardBackground() {
  return (
    <svg className={css.bgSvg} viewBox="0 0 225 350" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="idGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe98c" />
          <stop offset="45%" stopColor="#ffdd33" />
          <stop offset="100%" stopColor="#a8730f" />
        </linearGradient>
        <linearGradient id="idGoldGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f0c14e" />
          <stop offset="100%" stopColor="#8a6008" />
        </linearGradient>
      </defs>
      <path
        d="M-15,-10 C55,55 -20,110 45,175 C90,225 15,270 55,340 L15,340 C-25,270 50,225 5,175 C-60,110 15,55 -55,-10 Z"
        fill="url(#idGoldGrad)"
      />
      <path
        d="M20,-10 C90,60 25,125 90,190 C130,235 65,275 100,340 L75,340 C40,275 105,235 65,190 C0,125 65,60 -5,-10 Z"
        fill="url(#idGoldGrad2)"
        opacity=".85"
      />
      <g fill="none" stroke="#e3c777" strokeWidth="1.4" opacity=".42" transform="translate(116 205)">
        <path d="M10,110 C10,70 25,40 55,15" />
        <path d="M25,95 C25,75 40,60 60,50 C48,60 40,72 35,90 Z" />
        <path d="M40,75 C45,55 60,42 82,35 C68,42 58,55 55,72 Z" />
        <path d="M60,55 C68,38 85,28 105,25 C90,32 78,42 73,58 Z" />
        <circle cx="30" cy="98" r="4" fill="#e3c777" stroke="none" />
        <circle cx="38" cy="90" r="4" fill="#e3c777" stroke="none" />
        <circle cx="95" cy="30" r="4" fill="#e3c777" stroke="none" />
      </g>
    </svg>
  );
}
