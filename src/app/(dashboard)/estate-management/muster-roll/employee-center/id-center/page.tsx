"use client";

import { CSSProperties, ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, IdCard, Loader2, Mail, Printer, RotateCcw, Send, Upload, Users, X } from "lucide-react";
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
  employeeNumber: string;
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

const standardCardTheme: CardTheme = {
  accent: "#e8b13f",
  accentSoft: "#ffe39a",
  accentDark: "#b77a18",
  ribbon: "#e8b13f",
  ribbonDark: "#8d5e13",
  glow: "rgba(10, 70, 43, 0.44)",
  leaf: "#d6bd71",
};

const categoryOptions: { value: CardCategory; label: string; shortLabel: string; theme: CardTheme }[] = [
  {
    value: "estate-field",
    label: "Staff & Field",
    shortLabel: "Staff & Field",
    theme: standardCardTheme,
  },
  {
    value: "pf-worker",
    label: "PF Workers",
    shortLabel: "PF Worker",
    theme: standardCardTheme,
  },
  {
    value: "line-worker",
    label: "Line Workers",
    shortLabel: "Line Worker",
    theme: standardCardTheme,
  },
  {
    value: "village-worker",
    label: "Village Workers",
    shortLabel: "Village Worker",
    theme: standardCardTheme,
  },
  {
    value: "migrant-worker",
    label: "Migrant Workers",
    shortLabel: "Migrant Worker",
    theme: standardCardTheme,
  },
];

const initialForm: CardForm = {
  fullName: "Arjun Menon",
  category: "estate-field",
  designation: "Field Supervisor",
  place: "Moganad",
  estateLine1: "Moganad",
  estateLine2: "Estate",
  employeeNumber: "EMP-001",
  bloodGroup: "O+",
  mobile: "+91 98765 43210",
  address: "123 Coffee Lane, Brewsville, Grounds 12345",
};

const logoPath = "/msp-id-upload-logo-transparent.png";
const idCenterPrefillStorageKey = "msp-id-center-prefill";
const defaultPrinterEmail = "printer@mspcoffee.com";
const defaultPrinterNote = "Please print the attached MSP Coffee ID card.";

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

const getDisplayName = (name: string) => (name.trim() || "Full Name").toUpperCase();

const getNameFontSize = (name: string) => {
  const length = getDisplayName(name).length;
  if (length <= 12) return 24;
  return Math.min(24, Math.max(9, Math.floor(188 / (length * 0.62))));
};

const getRoleLine = (form: CardForm) =>
  `${form.designation || "Designation"} - ${form.place || "Place"} ${form.estateLine2 || "Estate"}`.toUpperCase();

const getRoleLineFontSize = (form: CardForm) => {
  const length = getRoleLine(form).length;
  if (length <= 32) return 11.5;
  return Math.min(11.5, Math.max(7.4, Math.floor(285 / (length * 0.7)) / 10));
};

const fitCanvasTextSize = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  fontWeight = 900
) => {
  for (let size = startSize; size >= minSize; size -= 1) {
    ctx.font = `${fontWeight} ${size}px Segoe UI, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return minSize;
};

const loadCanvasImage = (source: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    if (!source) {
      resolve(null);
      return;
    }

    const image = new Image();
    if (!source.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });

const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const drawLeftText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  fontWeight = 900
) => {
  ctx.font = `${fontWeight} ${fontSize}px Segoe UI, Arial, sans-serif`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);

  ctx.textAlign = "left";
  lines.slice(0, 4).forEach((item, index) => {
    ctx.fillText(item, x, y + index * lineHeight, maxWidth);
  });
};

const drawCenteredSingleLineText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  minSize: number,
  fontWeight = 900
) => {
  const fontSize = fitCanvasTextSize(ctx, text, maxWidth, startSize, minSize, fontWeight);
  ctx.font = `${fontWeight} ${fontSize}px Segoe UI, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y, maxWidth);
};

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};

const renderIdCardImage = async (form: CardForm, photo: string) => {
  const theme = getCategory(form.category).theme;
  const cardWidth = 675;
  const cardHeight = 1050;
  const gap = 75;
  const canvas = document.createElement("canvas");
  canvas.width = cardWidth * 2 + gap;
  canvas.height = cardHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the ID card image.");

  const [logoImage, photoImage] = await Promise.all([
    loadCanvasImage(logoPath),
    loadCanvasImage(photo),
  ]);

  ctx.fillStyle = "#e9e4d8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawCardBase = (x: number) => {
    ctx.save();
    drawRoundRect(ctx, x, 0, cardWidth, cardHeight, 48);
    ctx.clip();
    const background = ctx.createLinearGradient(x, 0, x + cardWidth, cardHeight);
    background.addColorStop(0, "#06442b");
    background.addColorStop(0.55, "#00351f");
    background.addColorStop(1, "#002516");
    ctx.fillStyle = background;
    ctx.fillRect(x, 0, cardWidth, cardHeight);

    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 22; i += 1) {
      ctx.fillStyle = i % 2 ? "#0b4a2c" : "#02130b";
      ctx.fillRect(x + i * 34, 0, 18, cardHeight);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 18;
    drawRoundRect(ctx, x + 13, 13, cardWidth - 26, cardHeight - 26, 38);
    ctx.stroke();

    ctx.strokeStyle = theme.accentSoft;
    ctx.lineWidth = 3;
    drawRoundRect(ctx, x + 31, 31, cardWidth - 62, cardHeight - 62, 27);
    ctx.stroke();

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 42, cardHeight - 106);
    ctx.quadraticCurveTo(x + cardWidth / 2, cardHeight - 28, x + cardWidth - 42, cardHeight - 106);
    ctx.stroke();
  };

  const drawLogo = (x: number, y: number, width: number, height: number) => {
    if (logoImage) {
      ctx.drawImage(logoImage, x, y, width, height);
      return;
    }
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#fff";
    ctx.font = "900 44px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MSP", x + width / 2, y + height / 2);
    ctx.font = "900 24px Segoe UI, Arial, sans-serif";
    ctx.fillText("COFFEE", x + width / 2, y + height / 2 + 44);
  };

  const frontX = 0;
  drawCardBase(frontX);
  drawLogo(frontX + 208, 70, 260, 244);

  const photoCenterX = frontX + cardWidth / 2;
  const photoCenterY = 555;
  const photoRadius = 142;
  const ring = ctx.createLinearGradient(photoCenterX - photoRadius, photoCenterY - photoRadius, photoCenterX + photoRadius, photoCenterY + photoRadius);
  ring.addColorStop(0, theme.accentSoft);
  ring.addColorStop(0.42, theme.accent);
  ring.addColorStop(1, theme.accentDark);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = theme.accentSoft;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(photoCenterX, photoCenterY, photoRadius - 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#efe9db";
  ctx.beginPath();
  ctx.arc(photoCenterX, photoCenterY, 126, 0, Math.PI * 2);
  ctx.fill();
  if (photoImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(photoCenterX, photoCenterY, 126, 0, Math.PI * 2);
    ctx.clip();
    drawCoverImage(ctx, photoImage, photoCenterX - 126, photoCenterY - 126, 252, 252);
    ctx.restore();
  } else {
    ctx.fillStyle = "#fff";
    ctx.font = "900 27px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PHOTO", photoCenterX, photoCenterY + 10);
  }

  ctx.fillStyle = "#fff";
  drawCenteredSingleLineText(ctx, getDisplayName(form.fullName), frontX + cardWidth / 2, 812, 570, 66, 38);

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(frontX + 112, 862);
  ctx.lineTo(frontX + 270, 862);
  ctx.moveTo(frontX + 405, 862);
  ctx.lineTo(frontX + 563, 862);
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.font = "900 34px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦", frontX + cardWidth / 2, 873);

  ctx.fillStyle = theme.accentSoft;
  drawCenteredSingleLineText(
    ctx,
    `${form.designation || "Designation"} - ${form.place || "Place"} ${form.estateLine2 || "Estate"}`.toUpperCase(),
    frontX + cardWidth / 2,
    925,
    520,
    31,
    19,
    750
  );
  ctx.restore();

  const backX = cardWidth + gap;
  drawCardBase(backX);
  ctx.save();
  ctx.translate(backX, 0);
  ctx.strokeStyle = theme.leaf;
  ctx.globalAlpha = 0.24;
  ctx.lineWidth = 4;
  [[-10, 70, 220, 24], [520, 36, 120, 220], [4, 780, 240, 950], [500, 730, 680, 1050]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + 95, y1 - 70, x2 - 90, y2 - 110, x2, y2);
    ctx.stroke();
  });
  ctx.restore();

  drawLogo(backX + 208, 74, 260, 244);
  ctx.fillStyle = "#fff";
  drawCenteredSingleLineText(ctx, "MSP COFFEE ID CARD", backX + cardWidth / 2, 414, 540, 44, 30, 900);

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(backX + 95, 484);
  ctx.lineTo(backX + 275, 484);
  ctx.moveTo(backX + 400, 484);
  ctx.lineTo(backX + 580, 484);
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.font = "900 34px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦", backX + cardWidth / 2, 495);

  ctx.textAlign = "left";
  ctx.fillStyle = theme.accent;
  ctx.font = "900 38px Segoe UI, Arial, sans-serif";
  ctx.fillText("●", backX + 126, 516);
  ctx.fillText("●", backX + 126, 576);
  ctx.fillText("☎", backX + 121, 636);
  ctx.fillText("●", backX + 126, 696);

  ctx.fillStyle = "#fff";
  ctx.font = "700 25px Segoe UI, Arial, sans-serif";
  ctx.fillText(`EMPLOYEE NO : ${form.employeeNumber || "-"}`, backX + 185, 516, 430);
  ctx.fillText(`BLOOD GROUP : ${form.bloodGroup || "-"}`, backX + 185, 576, 430);
  ctx.fillText(`MOBILE : ${form.mobile || "-"}`, backX + 185, 636, 430);
  drawLeftText(ctx, form.address || "-", backX + 185, 696, 430, 23, 28, 600);
  ctx.restore();

  try {
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error("Could not create the image attachment. Try uploading the photo again, then resend.");
  }
};

const cardFormFromEmployee = (employee: EmployeeIdRecord): CardForm => {
  const [estateLine1, estateLine2] = splitEstateName(employee.estate_name);

  return {
    fullName: employee.full_name || "",
    category: categoryFromText(employee.job_role, employee.section_division),
    designation: employee.job_role || employee.section_division || "",
    place: employee.section_division || estateLine1,
    estateLine1,
    estateLine2,
    employeeNumber: employee.employee_code || "",
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
        ...initialForm,
        ...parsed.form,
        category: normalizeCategory(parsed.form?.category),
        employeeNumber: parsed.form?.employeeNumber || "",
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [printerEmail, setPrinterEmail] = useState(defaultPrinterEmail);
  const [emailNote, setEmailNote] = useState(defaultPrinterNote);

  const selectedSummary = useMemo(() => {
    if (!employee) return "";
    return [employee.employee_code || "No employee code", employee.estate_name, employee.status]
      .filter(Boolean)
      .join(" | ");
  }, [employee]);

  const selectedCategory = getCategory(form.category);
  const emailSubject = `ID Card Print - ${form.fullName || "Employee"}`;
  const attachmentName = `${(form.fullName || "employee")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "employee"}-msp-id-card.png`;
  const emailBodyLines = [
    emailNote || defaultPrinterNote,
    "",
    `Name: ${form.fullName || "-"}`,
    `Category: ${selectedCategory.label}`,
    `Designation: ${form.designation || "-"}`,
    `Place: ${form.place || "-"}`,
    `Estate: ${[form.estateLine1, form.estateLine2].filter(Boolean).join(" ") || "-"}`,
    `Employee No.: ${form.employeeNumber || "-"}`,
    `Blood Group: ${form.bloodGroup || "-"}`,
    `Mobile No.: ${form.mobile || "-"}`,
    `Address: ${form.address || "-"}`,
  ];

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
    setEmployee(null);
    setMessage("");
    setEmailMessage("");
    setEmailNote(defaultPrinterNote);
    setEmailPreviewOpen(false);
  };

  const openEmailPreview = () => {
    setEmailMessage("");
    setEmailPreviewOpen(true);
  };

  const emailPrinter = async () => {
    setSendingEmail(true);
    setEmailMessage("");

    try {
      const imageDataUrl = await renderIdCardImage(form, photo);
      const response = await fetch("/api/id-card/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient: printerEmail, note: emailNote, form, imageDataUrl }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        status?: "sent" | "logged";
        attachmentName?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Could not send the ID card email.");
      }

      if (result?.status === "sent") {
        setEmailMessage(`Sent to printer with ${result.attachmentName || "ID card attachment"}.`);
        setEmailPreviewOpen(false);
      } else {
        setEmailMessage("ID card email was prepared, but live email delivery is not configured.");
      }
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : "Could not send the ID card email.");
    } finally {
      setSendingEmail(false);
    }
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

          <label className={css.fieldGroup}>
            <span>Employee No.</span>
            <input value={form.employeeNumber} onChange={(event) => updateField("employeeNumber", event.target.value)} />
          </label>

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

          <div className={css.printActions}>
            <button type="button" className={css.goldBtn} onClick={() => window.print()}>
              <Printer size={16} />
              Print this ID card
            </button>
            <button type="button" className={css.ghostBtn} onClick={resetForm}>
              <RotateCcw size={15} />
              Clear all fields
            </button>
            <button type="button" className={css.emailBtn} onClick={openEmailPreview}>
              <Mail size={16} />
              Email to printer
            </button>
            {emailMessage ? <p className={css.actionMessage}>{emailMessage}</p> : null}
          </div>
        </aside>

        <section className={css.stage}>
          <div className={css.stageLabel}>Live Preview - Front & Back</div>
          <div className={css.cardsWrap}>
            <IdCardFront form={form} photo={photo} />
            <IdCardBack form={form} />
          </div>
        </section>
      </div>

      {emailPreviewOpen ? (
        <div className={css.modalBackdrop} role="presentation">
          <section className={css.emailModal} role="dialog" aria-modal="true" aria-labelledby="id-card-email-title">
            <div className={css.emailModalHead}>
              <div>
                <p className={css.emailEyebrow}>Review before sending</p>
                <h2 id="id-card-email-title">Email ID card to printer</h2>
              </div>
              <button type="button" className={css.iconBtn} onClick={() => setEmailPreviewOpen(false)} aria-label="Close email preview">
                <X size={18} />
              </button>
            </div>

            <div className={css.emailModalGrid}>
              <div className={css.emailComposer}>
                <label className={css.fieldGroup}>
                  <span>Printer email address</span>
                  <input
                    type="email"
                    value={printerEmail}
                    onChange={(event) => setPrinterEmail(event.target.value)}
                    placeholder="printer@mspcoffee.com"
                  />
                </label>

                <div className={css.emailFieldPreview}>
                  <span>Subject</span>
                  <strong>{emailSubject}</strong>
                </div>

                <div className={css.emailBodyPreview}>
                  <span>Email message</span>
                  <textarea
                    value={emailNote}
                    onChange={(event) => setEmailNote(event.target.value)}
                    rows={4}
                    placeholder="Write a note for the printer"
                  />
                  <pre>{emailBodyLines.slice(2).join("\n")}</pre>
                </div>

                <div className={css.attachmentPreview}>
                  <IdCard size={18} />
                  <div>
                    <strong>{attachmentName}</strong>
                    <span>Printable front and back ID card attachment</span>
                  </div>
                </div>

                {emailMessage ? <p className={css.actionMessage}>{emailMessage}</p> : null}

                <div className={css.modalActions}>
                  <button type="button" className={css.ghostBtn} onClick={() => setEmailPreviewOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className={css.emailBtn} onClick={emailPrinter} disabled={sendingEmail}>
                    {sendingEmail ? <Loader2 className={css.spin} size={16} /> : <Send size={16} />}
                    {sendingEmail ? "Sending..." : "Send email"}
                  </button>
                </div>
              </div>

              <div className={css.emailCardPreview}>
                <div className={css.stageLabel}>Attachment Preview</div>
                <div className={css.modalCardsWrap}>
                  <IdCardFront form={form} photo={photo} />
                  <IdCardBack form={form} />
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function IdCardFront({
  form,
  photo,
}: {
  form: CardForm;
  photo: string;
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

        <div className={css.nameText} style={{ fontSize: `${getNameFontSize(form.fullName)}px` }}>
          {form.fullName || "Full Name"}
        </div>
        <div className={css.ornament}><span /></div>
        <div className={css.frontRoleLine} style={{ fontSize: `${getRoleLineFontSize(form)}px` }}>
          {getRoleLine(form)}
        </div>

      </div>
    </article>
  );
}

function IdCardBack({ form }: { form: CardForm }) {
  const category = getCategory(form.category);
  const theme = category.theme;

  return (
    <article className={`${css.card} ${css.cardBack}`} style={cardStyleForTheme(theme)}>
      <BackBackground theme={theme} />
      <div className={css.backContent}>
        <img className={css.backLogo} src={logoPath} alt="MSP Coffee logo" />
        <div className={css.backTitle}>MSP COFFEE ID CARD</div>
        <div className={css.ornament}><span /></div>

        <div className={css.infoList}>
          <div><span className={css.infoIcon}>●</span><span>Employee No : {form.employeeNumber || "-"}</span></div>
          <div><span className={css.infoIcon}>●</span><span>Blood Group : {form.bloodGroup || "-"}</span></div>
          <div><span className={css.infoIcon}>☎</span><span>Mobile : {form.mobile || "-"}</span></div>
          <div><span className={css.infoIcon}>●</span><span>{form.address || "-"}</span></div>
        </div>
      </div>
    </article>
  );
}

function FrontBackground({ theme }: { theme: CardTheme }) {
  return (
    <svg className={css.bgSvg} viewBox="0 0 225 350" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="frontCardBase" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06442b" />
          <stop offset="55%" stopColor="#00351f" />
          <stop offset="100%" stopColor="#002516" />
        </linearGradient>
        <radialGradient id="frontCardGlow" cx="55%" cy="42%" r="58%">
          <stop offset="0%" stopColor={theme.glow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
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
      <rect width="225" height="350" fill="url(#frontCardBase)" />
      <rect width="225" height="350" fill="url(#frontCardGlow)" />
      <path d="M6,316 C68,346 155,346 219,316" fill="none" stroke="url(#idGoldGrad)" strokeWidth="1.5" />
    </svg>
  );
}

function BackBackground({ theme }: { theme: CardTheme }) {
  return (
    <svg className={css.bgSvg} viewBox="0 0 225 350" preserveAspectRatio="none" aria-hidden="true">
      <rect width="225" height="350" fill="#00351f" />
      <radialGradient id="backGlow" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stopColor="#06442b" />
        <stop offset="100%" stopColor="#002516" />
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
