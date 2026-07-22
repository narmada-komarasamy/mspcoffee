"use client";

import { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, IdCard, Loader2, Plus, Printer, RotateCcw, Save, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import css from "./employee-center.module.css";

type AppUser = { id: string; name: string; role: string; estate: string | null };

type FamilyMember = {
  id: number;
  name: string;
  relationship: string;
  age: string;
  aadhaar: string;
};

type ParsedEmployeeForm = Partial<FormState> & {
  family?: Omit<FamilyMember, "id">[];
};

type FormState = {
  estateName: string;
  fullName: string;
  parentSpouseName: string;
  dob: string;
  age: string;
  gender: string;
  maritalStatus: string;
  aadhaar: string;
  pan: string;
  mobile: string;
  altContact: string;
  reference: string;
  permAddress: string;
  currAddress: string;
  empId: string;
  doj: string;
  jobRole: string;
  section: string;
  wage: string;
  payMode: string;
  bankAcc: string;
  ifsc: string;
  experience: string;
  education: string;
  epf: string;
  esi: string;
  emName: string;
  emNumber: string;
  bloodGroup: string;
  medical: string;
  nomineeName: string;
  nomineeRel: string;
  empSigDate: string;
  hrSigDate: string;
  mdSigDate: string;
};

type EmployeeRow = {
  id: string;
  estate_name: string;
  employee_code: string | null;
  status: "applicant" | "active" | "inactive" | "left";
  full_name: string;
  parent_spouse_name: string | null;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  marital_status: string | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  mobile_number: string | null;
  alternate_contact: string | null;
  reference_name: string | null;
  permanent_address: string | null;
  current_address: string | null;
  date_of_joining: string | null;
  job_role: string | null;
  section_division: string | null;
  daily_wage: number | null;
  wage_text: string | null;
  payment_mode: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  previous_experience_years: number | null;
  experience_text: string | null;
  education_level: string | null;
  epf_uan: string | null;
  esi_number: string | null;
  emergency_contact_name_relation: string | null;
  emergency_contact_number: string | null;
  blood_group: string | null;
  medical_conditions: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  employee_signature_date: string | null;
  hr_signature_date: string | null;
  md_signature_date: string | null;
  photo_path: string | null;
  photo_public_url: string | null;
  application_form_path: string | null;
  application_form_public_url: string | null;
  application_form_file_name: string | null;
  application_form_uploaded_at: string | null;
  updated_at: string;
  estate_employee_family_members?: FamilyRow[];
  estate_employee_documents?: EmployeeDocument[];
  estate_employee_document_notes?: EmployeeDocumentNote[];
};

type FamilyRow = {
  id: string;
  employee_id: string;
  sort_order: number;
  name: string | null;
  relationship: string | null;
  age: number | null;
  aadhaar_number: string | null;
};

type EmployeeDocumentType =
  | "aadhaar"
  | "pan"
  | "bank-account-check"
  | "other-document"
  | "short-term-break-letter"
  | "long-term-break-letter"
  | "other-letter-record";

type EmployeeDocument = {
  id: string;
  employee_id: string;
  document_type: EmployeeDocumentType;
  file_name: string;
  file_path: string;
  public_url: string;
  content_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
};

type EmployeeDocumentNote = {
  id: string;
  employee_id: string;
  note_text: string;
  author_id: string | null;
  author_name: string;
  attachment_file_name: string | null;
  attachment_file_path: string | null;
  attachment_public_url: string | null;
  attachment_content_type: string | null;
  attachment_file_size: number | null;
  created_at: string;
};

const employeeDocumentTypes: { type: EmployeeDocumentType; label: string }[] = [
  { type: "aadhaar", label: "Aadhaar Number" },
  { type: "pan", label: "PAN (if any)" },
  { type: "bank-account-check", label: "Check for Bank account" },
  { type: "other-document", label: "Other documents" },
  { type: "short-term-break-letter", label: "Short term break letters" },
  { type: "long-term-break-letter", label: "Long term break letters" },
  { type: "other-letter-record", label: "Other letters and records" },
];

const initialForm: FormState = {
  estateName: "Stanmore Estate",
  fullName: "",
  parentSpouseName: "",
  dob: "",
  age: "",
  gender: "",
  maritalStatus: "",
  aadhaar: "",
  pan: "",
  mobile: "",
  altContact: "",
  reference: "",
  permAddress: "",
  currAddress: "",
  empId: "",
  doj: "",
  jobRole: "",
  section: "",
  wage: "",
  payMode: "",
  bankAcc: "",
  ifsc: "",
  experience: "",
  education: "",
  epf: "",
  esi: "",
  emName: "",
  emNumber: "",
  bloodGroup: "",
  medical: "",
  nomineeName: "",
  nomineeRel: "",
  empSigDate: "",
  hrSigDate: "",
  mdSigDate: "",
};

const blankFamily = (id: number): FamilyMember => ({
  id,
  name: "",
  relationship: "",
  age: "",
  aadhaar: "",
});

const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNullableNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const missingRelation = (message: string, relationName: string) =>
  message.includes(relationName) &&
  (message.includes("relationship") ||
    message.includes("schema cache") ||
    message.includes("does not exist"));

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formFromEmployee = (employee: EmployeeRow): FormState => ({
  estateName: employee.estate_name || "Stanmore Estate",
  fullName: employee.full_name || "",
  parentSpouseName: employee.parent_spouse_name || "",
  dob: employee.date_of_birth || "",
  age: employee.age?.toString() || "",
  gender: employee.gender || "",
  maritalStatus: employee.marital_status || "",
  aadhaar: employee.aadhaar_number || "",
  pan: employee.pan_number || "",
  mobile: employee.mobile_number || "",
  altContact: employee.alternate_contact || "",
  reference: employee.reference_name || "",
  permAddress: employee.permanent_address || "",
  currAddress: employee.current_address || "",
  empId: employee.employee_code || "",
  doj: employee.date_of_joining || "",
  jobRole: employee.job_role || "",
  section: employee.section_division || "",
  wage: employee.wage_text || employee.daily_wage?.toString() || "",
  payMode: employee.payment_mode || "",
  bankAcc: employee.bank_account_number || "",
  ifsc: employee.ifsc_code || "",
  experience: employee.experience_text || employee.previous_experience_years?.toString() || "",
  education: employee.education_level || "",
  epf: employee.epf_uan || "",
  esi: employee.esi_number || "",
  emName: employee.emergency_contact_name_relation || "",
  emNumber: employee.emergency_contact_number || "",
  bloodGroup: employee.blood_group || "",
  medical: employee.medical_conditions || "",
  nomineeName: employee.nominee_name || "",
  nomineeRel: employee.nominee_relation || "",
  empSigDate: employee.employee_signature_date || "",
  hrSigDate: employee.hr_signature_date || "",
  mdSigDate: employee.md_signature_date || "",
});

const payloadFromForm = (form: FormState, photoUrl: string | null, photoPath: string | null) => ({
  estate_name: form.estateName.trim() || "Stanmore Estate",
  employee_code: toNullable(form.empId),
  full_name: form.fullName.trim(),
  parent_spouse_name: toNullable(form.parentSpouseName),
  date_of_birth: toNullable(form.dob),
  age: toNullableNumber(form.age),
  gender: toNullable(form.gender),
  marital_status: toNullable(form.maritalStatus),
  aadhaar_number: toNullable(form.aadhaar),
  pan_number: toNullable(form.pan),
  mobile_number: toNullable(form.mobile),
  alternate_contact: toNullable(form.altContact),
  reference_name: toNullable(form.reference),
  permanent_address: toNullable(form.permAddress),
  current_address: toNullable(form.currAddress),
  date_of_joining: toNullable(form.doj),
  job_role: toNullable(form.jobRole),
  section_division: toNullable(form.section),
  daily_wage: toNullableNumber(form.wage),
  wage_text: toNullable(form.wage),
  payment_mode: toNullable(form.payMode),
  bank_account_number: toNullable(form.bankAcc),
  ifsc_code: toNullable(form.ifsc),
  previous_experience_years: toNullableNumber(form.experience),
  experience_text: toNullable(form.experience),
  education_level: toNullable(form.education),
  epf_uan: toNullable(form.epf),
  esi_number: toNullable(form.esi),
  emergency_contact_name_relation: toNullable(form.emName),
  emergency_contact_number: toNullable(form.emNumber),
  blood_group: toNullable(form.bloodGroup),
  medical_conditions: toNullable(form.medical),
  nominee_name: toNullable(form.nomineeName),
  nominee_relation: toNullable(form.nomineeRel),
  employee_signature_date: toNullable(form.empSigDate),
  hr_signature_date: toNullable(form.hrSigDate),
  md_signature_date: toNullable(form.mdSigDate),
  photo_public_url: photoUrl,
  photo_path: photoPath,
});

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const fieldLabels: Partial<Record<keyof FormState, string[]>> = {
  estateName: ["Estate Name"],
  fullName: ["Full Name", "Full Name (as per Aadhaar)"],
  parentSpouseName: ["Father's / Husband's Name"],
  dob: ["Date of Birth"],
  age: ["Age"],
  gender: ["Gender"],
  maritalStatus: ["Marital Status"],
  aadhaar: ["Aadhaar Number"],
  pan: ["PAN", "PAN (if any)"],
  mobile: ["Mobile", "Mobile Number"],
  altContact: ["Alternate Contact"],
  reference: ["Reference"],
  permAddress: ["Permanent Address"],
  currAddress: ["Current Address"],
  empId: ["Employee ID / Code"],
  doj: ["Date of Joining"],
  jobRole: ["Job Role / Designation"],
  section: ["Section / Division"],
  wage: ["Daily Wage / Salary"],
  payMode: ["Payment Mode"],
  bankAcc: ["Bank Account Number"],
  ifsc: ["IFSC Code"],
  experience: ["Previous Experience", "Previous Experience (Years)"],
  education: ["Education Level"],
  epf: ["EPF/PF UAN / Member ID"],
  esi: ["ESI Number", "ESI Number (if applicable)"],
  emName: ["Emergency Contact Name & Relation"],
  emNumber: ["Emergency Contact Number"],
  bloodGroup: ["Blood Group"],
  medical: ["Medical Conditions / Allergies"],
  nomineeName: ["Nominee Name", "Nominee Name (for benefits)"],
  nomineeRel: ["Relation"],
};

const namedFormFields: Partial<Record<keyof FormState, string>> = {
  estateName: "estateName",
  fullName: "fullName",
  parentSpouseName: "parentSpouseName",
  dob: "dob",
  age: "age",
  gender: "gender",
  maritalStatus: "maritalStatus",
  aadhaar: "aadhaar",
  pan: "pan",
  mobile: "mobile",
  altContact: "altContact",
  reference: "reference",
  permAddress: "permAddress",
  currAddress: "currAddress",
  empId: "empId",
  doj: "doj",
  jobRole: "jobRole",
  section: "section",
  wage: "wage",
  payMode: "payMode",
  bankAcc: "bankAcc",
  ifsc: "ifsc",
  experience: "experience",
  education: "education",
  epf: "epf",
  esi: "esi",
  emName: "emName",
  emNumber: "emNumber",
  bloodGroup: "bloodGroup",
  medical: "medical",
  nomineeName: "nomineeName",
  nomineeRel: "nomineeRel",
  empSigDate: "empSigDate",
  hrSigDate: "hrSigDate",
  mdSigDate: "mdSigDate",
};

const familyNames = {
  name: "famName[]",
  relationship: "famRel[]",
  age: "famAge[]",
  aadhaar: "famAadhaar[]",
};

function textFromElement(element: Element | null) {
  return element?.textContent?.trim() ?? "";
}

function valueFromNamedElement(element: Element) {
  if (element instanceof HTMLInputElement) {
    if ((element.type === "radio" || element.type === "checkbox") && !element.checked) return "";
    return element.value || element.getAttribute("value") || "";
  }
  if (element instanceof HTMLTextAreaElement) {
    return element.value || element.textContent || "";
  }
  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0];
    return selected?.value || selected?.textContent || element.value || "";
  }
  return textFromElement(element);
}

function valueByName(doc: Document, name: string) {
  const elements = Array.from(doc.getElementsByName(name));
  const checked = elements.find(
    (element) => element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox") && element.checked
  );
  const element = checked ?? elements[0];
  return element ? valueFromNamedElement(element).trim() : "";
}

function valueBySummaryLabel(doc: Document, labels: string[]) {
  const fields = Array.from(doc.querySelectorAll(".field"));
  for (const label of labels) {
    const match = fields.find((field) => textFromElement(field.querySelector("strong")) === label);
    const value = textFromElement(match?.querySelector("span") ?? null);
    if (value) return value;
  }
  return "";
}

function parseFamilyRows(doc: Document) {
  const namedRows = Array.from(doc.getElementsByName(familyNames.name));
  if (namedRows.length) {
    const valuesFor = (name: string) => Array.from(doc.getElementsByName(name)).map(valueFromNamedElement);
    const names = valuesFor(familyNames.name);
    const relationships = valuesFor(familyNames.relationship);
    const ages = valuesFor(familyNames.age);
    const aadhaars = valuesFor(familyNames.aadhaar);
    return names
      .map((name, index) => ({
        id: index + 1,
        name: name.trim(),
        relationship: (relationships[index] ?? "").trim(),
        age: (ages[index] ?? "").trim(),
        aadhaar: (aadhaars[index] ?? "").trim(),
      }))
      .filter((row) => row.name || row.relationship || row.age || row.aadhaar);
  }

  const familyHeading = Array.from(doc.querySelectorAll("h3")).find((heading) =>
    textFromElement(heading).toLowerCase().includes("family")
  );
  const table = familyHeading?.nextElementSibling?.tagName === "TABLE"
    ? familyHeading.nextElementSibling
    : familyHeading?.parentElement?.querySelector("table");
  const rows = Array.from(table?.querySelectorAll("tbody tr") ?? []);
  return rows
    .map((row, index) => {
      const cells = Array.from(row.querySelectorAll("td")).map(textFromElement);
      return {
        id: index + 1,
        name: cells[1] ?? "",
        relationship: cells[2] ?? "",
        age: cells[3] ?? "",
        aadhaar: cells[4] ?? "",
      };
    })
    .filter((row) => row.name || row.relationship || row.age || row.aadhaar);
}

function parseFilledHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const parsedForm = { ...initialForm };

  (Object.keys(parsedForm) as (keyof FormState)[]).forEach((key) => {
    const namedField = namedFormFields[key];
    const namedValue = namedField ? valueByName(doc, namedField) : "";
    const summaryValue = fieldLabels[key] ? valueBySummaryLabel(doc, fieldLabels[key]) : "";
    parsedForm[key] = (namedValue || summaryValue || parsedForm[key]).trim();
  });

  const photoSrc = doc.querySelector<HTMLImageElement>("#photoImg, .photo img")?.src || "";
  const parsedFamily = parseFamilyRows(doc);

  return {
    form: parsedForm,
    family: parsedFamily.length ? parsedFamily : [blankFamily(1)],
    photo: photoSrc.startsWith("data:image/") ? photoSrc : "",
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function parseEmployeeFormWithAi(file: File): Promise<ParsedEmployeeForm> {
  const mediaType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  const supported = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (!supported.includes(mediaType)) {
    throw new Error("Upload a PDF, JPG, PNG, GIF, WebP, or saved HTML form.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File too large - maximum 10 MB.");
  }

  const base64 = arrayBufferToBase64(await file.arrayBuffer());
  const response = await fetch("/api/parse-employee-form", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Could not parse employee form");
  }

  return data as ParsedEmployeeForm;
}

function applyParsedEmployeeForm(current: FormState, parsed: ParsedEmployeeForm) {
  const next = { ...current };
  (Object.keys(initialForm) as (keyof FormState)[]).forEach((key) => {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) next[key] = value.trim();
  });

  const familyRows = Array.isArray(parsed.family)
    ? parsed.family
        .map((row, index) => ({
          id: index + 1,
          name: row.name?.trim() ?? "",
          relationship: row.relationship?.trim() ?? "",
          age: row.age?.trim() ?? "",
          aadhaar: row.aadhaar?.trim() ?? "",
        }))
        .filter((row) => row.name || row.relationship || row.age || row.aadhaar)
    : [];

  return {
    form: next,
    family: familyRows.length ? familyRows : undefined,
  };
}

function FieldLabel({ en, ta }: { en: string; ta: string }) {
  return (
    <span className={css.label}>
      {en}
      <span className={`${css.ta} ${css.tamil}`}>{ta}</span>
    </span>
  );
}

type TamilTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function TamilTextInput({ value, onValueChange, ...props }: TamilTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (composingRef.current || !inputRef.current || inputRef.current.value === value) return;
    inputRef.current.value = value;
  }, [value]);

  return (
    <input
      {...props}
      ref={inputRef}
      lang="ta-IN"
      inputMode={props.inputMode ?? "text"}
      autoCorrect={props.autoCorrect ?? "on"}
      spellCheck={props.spellCheck ?? true}
      defaultValue={value}
      onCompositionStart={(event) => {
        composingRef.current = true;
        props.onCompositionStart?.(event);
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const nextValue = event.currentTarget.value;
        onValueChange(nextValue);
        props.onCompositionEnd?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (!composingRef.current) onValueChange(nextValue);
      }}
    />
  );
}

type TamilTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function TamilTextarea({ value, onValueChange, ...props }: TamilTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (composingRef.current || !textareaRef.current || textareaRef.current.value === value) return;
    textareaRef.current.value = value;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      lang="ta-IN"
      inputMode={props.inputMode ?? "text"}
      autoCorrect={props.autoCorrect ?? "on"}
      spellCheck={props.spellCheck ?? true}
      defaultValue={value}
      onCompositionStart={(event) => {
        composingRef.current = true;
        props.onCompositionStart?.(event);
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const nextValue = event.currentTarget.value;
        onValueChange(nextValue);
        props.onCompositionEnd?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (!composingRef.current) onValueChange(nextValue);
      }}
    />
  );
}

export default function EmployeeCenterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [family, setFamily] = useState<FamilyMember[]>(() => [blankFamily(1)]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [currentUser] = useState<AppUser | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("msp_user");
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photo, setPhoto] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [uploadingDocumentType, setUploadingDocumentType] = useState<EmployeeDocumentType | null>(null);
  const [documentNote, setDocumentNote] = useState("");
  const [documentNoteFile, setDocumentNoteFile] = useState<File | null>(null);
  const [savingDocumentNote, setSavingDocumentNote] = useState(false);
  const filledFormInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const selectedDocumentTypeRef = useRef<EmployeeDocumentType | null>(null);

  const flash = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus((current) => (current === message ? "" : current)), 3500);
  }, []);

  const nextFamilyId = useMemo(
    () => Math.max(0, ...family.map((row) => row.id)) + 1,
    [family]
  );

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedId) ?? null,
    [employees, selectedId]
  );

  const selectedEmployeeDocuments = useMemo(
    () => selectedEmployee?.estate_employee_documents ?? [],
    [selectedEmployee]
  );

  const selectedEmployeeDocumentNotes = useMemo(
    () => selectedEmployee?.estate_employee_document_notes ?? [],
    [selectedEmployee]
  );

  const isAdmin = currentUser?.role === "admin";

  const filteredEmployees = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((employee) =>
      [
        employee.full_name,
        employee.employee_code,
        employee.estate_name,
        employee.mobile_number,
        employee.job_role,
        employee.section_division,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [employees, search]);

  const activeCount = employees.filter((employee) => employee.status === "active").length;

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    let result = await supabase
      .from("estate_employees")
      .select(`
        *,
        estate_employee_family_members (*),
        estate_employee_documents (*),
        estate_employee_document_notes (*)
      `)
      .order("updated_at", { ascending: false });

    if (result.error && missingRelation(result.error.message, "estate_employee_document_notes")) {
      result = await supabase
        .from("estate_employees")
        .select(`
          *,
          estate_employee_family_members (*),
          estate_employee_documents (*)
        `)
        .order("updated_at", { ascending: false });
    }

    if (result.error && missingRelation(result.error.message, "estate_employee_documents")) {
      result = await supabase
        .from("estate_employees")
        .select(`
          *,
          estate_employee_family_members (*)
        `)
        .order("updated_at", { ascending: false });
    }

    if (result.error) {
      flash(`Failed to load employees: ${result.error.message}`);
      setLoading(false);
      return;
    }

    const rows = (result.data ?? []).map((employee) => ({
      ...employee,
      estate_employee_family_members: [...(employee.estate_employee_family_members ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order
      ),
      estate_employee_documents: [...(employee.estate_employee_documents ?? [])].sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      ),
      estate_employee_document_notes: [...(employee.estate_employee_document_notes ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    })) as EmployeeRow[];

    setEmployees(rows);
    setLoading(false);
  }, [flash]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEmployees();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadEmployees]);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateFamily = (id: number, key: keyof Omit<FamilyMember, "id">, value: string) => {
    setFamily((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const removeFamily = (id: number) => {
    setFamily((rows) => {
      if (rows.length === 1) return [blankFamily(rows[0].id)];
      return rows.filter((row) => row.id !== id);
    });
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const startNew = () => {
    setForm(initialForm);
    setFamily([blankFamily(1)]);
    setSelectedId(null);
    setPhoto("");
    setPhotoFile(null);
    flash("Ready for a new employee");
  };

  const resetForm = () => {
    if (!window.confirm("Clear all entered data on this form? This cannot be undone.")) return;
    startNew();
    flash("Form cleared");
  };

  const selectEmployee = (employee: EmployeeRow) => {
    setSelectedId(employee.id);
    setForm(formFromEmployee(employee));
    const familyRows = employee.estate_employee_family_members ?? [];
    setFamily(
      familyRows.length
        ? familyRows.map((row, index) => ({
            id: index + 1,
            name: row.name || "",
            relationship: row.relationship || "",
            age: row.age?.toString() || "",
            aadhaar: row.aadhaar_number || "",
          }))
        : [blankFamily(1)]
    );
    setPhoto(employee.photo_public_url || "");
    setPhotoFile(null);
    flash(`Loaded ${employee.full_name}`);
  };

  const saveEmployee = async (
    showMessage = true,
    formToSave = form,
    familyToSave = family,
    photoToSave = photo,
  ): Promise<string | null> => {
    if (!formToSave.fullName.trim()) {
      flash("Full name is required before saving");
      return null;
    }

    setSaving(true);
    let photoPath = selectedEmployee?.photo_path ?? null;
    let photoUrl = selectedEmployee?.photo_public_url ?? null;

    if (photoFile) {
      const safeName = photoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${selectedId ?? crypto.randomUUID()}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-center")
        .upload(path, photoFile, { upsert: true });

      if (uploadError) {
        setSaving(false);
        flash(`Photo upload failed: ${uploadError.message}`);
        return null;
      }

      const { data: urlData } = supabase.storage.from("employee-center").getPublicUrl(path);
      photoPath = path;
      photoUrl = urlData.publicUrl;
    }

    const payload = payloadFromForm(formToSave, photoUrl, photoPath);
    const { data: saved, error } = selectedId
      ? await supabase
          .from("estate_employees")
          .update(payload)
          .eq("id", selectedId)
          .select()
          .single()
      : await supabase
          .from("estate_employees")
          .insert({ ...payload, status: "applicant" })
          .select()
          .single();

    if (error) {
      setSaving(false);
      flash(`Save failed: ${error.message}`);
      return null;
    }

    const employeeId = saved.id as string;
    const { error: deleteFamilyError } = await supabase
      .from("estate_employee_family_members")
      .delete()
      .eq("employee_id", employeeId);

    if (deleteFamilyError) {
      setSaving(false);
      flash(`Saved employee, but family sync failed: ${deleteFamilyError.message}`);
      return null;
    }

    const familyPayload = familyToSave
      .map((row, index) => ({
        employee_id: employeeId,
        sort_order: index + 1,
        name: toNullable(row.name),
        relationship: toNullable(row.relationship),
        age: toNullableNumber(row.age),
        aadhaar_number: toNullable(row.aadhaar),
      }))
      .filter((row) => row.name || row.relationship || row.age !== null || row.aadhaar_number);

    if (familyPayload.length) {
      const { error: familyError } = await supabase
        .from("estate_employee_family_members")
        .insert(familyPayload);

      if (familyError) {
        setSaving(false);
        flash(`Saved employee, but family sync failed: ${familyError.message}`);
        return null;
      }
    }

    setSelectedId(employeeId);
    setPhoto(photoUrl || photoToSave || "");
    setPhotoFile(null);
    await loadEmployees();
    setSaving(false);
    if (showMessage) flash("Employee saved to registry");
    return employeeId;
  };

  const uploadFilledForm = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploadingForm(true);
    let formForSave = form;
    let familyForSave = family;
    let photoForSave = photo;
    let populatedFromFile = false;
    let importMessage = "";

    if (file.type === "text/html" || file.name.toLowerCase().endsWith(".html") || file.name.toLowerCase().endsWith(".htm")) {
      const html = await file.text();
      const parsed = parseFilledHtml(html);
      formForSave = parsed.form;
      familyForSave = parsed.family;
      photoForSave = parsed.photo || photo;
      setForm(parsed.form);
      setFamily(parsed.family);
      if (parsed.photo) {
        setPhoto(parsed.photo);
        setPhotoFile(null);
      }
      populatedFromFile = true;
      importMessage = "Filled form imported and uploaded";
    } else if (file.type === "application/pdf" || file.type.startsWith("image/") || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        flash("Reading employee form with AI...");
        const parsed = await parseEmployeeFormWithAi(file);
        const applied = applyParsedEmployeeForm(form, parsed);
        formForSave = applied.form;
        familyForSave = applied.family ?? family;
        setForm(applied.form);
        if (applied.family) setFamily(applied.family);
        populatedFromFile = true;
        importMessage = "Employee form imported and uploaded";
      } catch (error) {
        setUploadingForm(false);
        flash(error instanceof Error ? error.message : "Could not read employee form");
        return;
      }
    }

    let employeeId = selectedId;
    if (!employeeId || populatedFromFile) {
      const savedId = await saveEmployee(false, formForSave, familyForSave, photoForSave);
      if (!savedId) {
        setUploadingForm(false);
        return;
      }
      employeeId = savedId;
    }

    if (!employeeId) {
      setUploadingForm(false);
      flash("Save or select an employee before uploading the filled form");
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${employeeId}/filled-forms/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("employee-center")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploadingForm(false);
      flash(`Filled form upload failed: ${uploadError.message}`);
      return;
    }

    const { data: urlData } = supabase.storage.from("employee-center").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("estate_employees")
      .update({
        application_form_path: path,
        application_form_public_url: urlData.publicUrl,
        application_form_file_name: file.name,
        application_form_uploaded_at: new Date().toISOString(),
      })
      .eq("id", employeeId);

    if (updateError) {
      setUploadingForm(false);
      flash(`Uploaded file, but registry update failed: ${updateError.message}`);
      return;
    }

    await loadEmployees();
    setUploadingForm(false);
    flash(populatedFromFile ? importMessage : "Filled form uploaded");
  };

  const openDocumentUpload = (documentType: EmployeeDocumentType) => {
    selectedDocumentTypeRef.current = documentType;
    documentInputRef.current?.click();
  };

  const uploadEmployeeDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    const documentType = selectedDocumentTypeRef.current;
    selectedDocumentTypeRef.current = null;

    if (!file || !documentType) return;

    setUploadingDocumentType(documentType);

    let employeeId = selectedId;
    if (!employeeId) {
      const savedId = await saveEmployee(false);
      if (!savedId) {
        setUploadingDocumentType(null);
        return;
      }
      employeeId = savedId;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${employeeId}/documents/${documentType}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("employee-center")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setUploadingDocumentType(null);
      flash(`Document upload failed: ${uploadError.message}`);
      return;
    }

    const { data: urlData } = supabase.storage.from("employee-center").getPublicUrl(path);
    const { error: insertError } = await supabase.from("estate_employee_documents").insert({
      employee_id: employeeId,
      document_type: documentType,
      file_name: file.name,
      file_path: path,
      public_url: urlData.publicUrl,
      content_type: file.type || null,
      file_size: file.size,
      uploaded_by: null,
    });

    if (insertError) {
      setUploadingDocumentType(null);
      flash(`Uploaded file, but document registry update failed: ${insertError.message}`);
      return;
    }

    await loadEmployees();
    setUploadingDocumentType(null);
    const documentLabel = employeeDocumentTypes.find((item) => item.type === documentType)?.label ?? "Document";
    flash(`${documentLabel} uploaded`);
  };

  const saveDocumentNote = async () => {
    const noteText = documentNote.trim();
    if (!noteText && !documentNoteFile) {
      flash("Add a note or attach a document before saving");
      return;
    }

    setSavingDocumentNote(true);

    let employeeId = selectedId;
    if (!employeeId) {
      const savedId = await saveEmployee(false);
      if (!savedId) {
        setSavingDocumentNote(false);
        return;
      }
      employeeId = savedId;
    }

    let attachmentPath: string | null = null;
    let attachmentUrl: string | null = null;

    if (documentNoteFile) {
      const safeName = documentNoteFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${employeeId}/document-notes/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-center")
        .upload(path, documentNoteFile, {
          contentType: documentNoteFile.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        setSavingDocumentNote(false);
        flash(`Note attachment upload failed: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from("employee-center").getPublicUrl(path);
      attachmentPath = path;
      attachmentUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("estate_employee_document_notes").insert({
      employee_id: employeeId,
      note_text: noteText || "Attachment added",
      author_id: currentUser?.id ?? null,
      author_name: currentUser?.name || "Unknown user",
      attachment_file_name: documentNoteFile?.name ?? null,
      attachment_file_path: attachmentPath,
      attachment_public_url: attachmentUrl,
      attachment_content_type: documentNoteFile?.type || null,
      attachment_file_size: documentNoteFile?.size ?? null,
    });

    if (error) {
      setSavingDocumentNote(false);
      flash(`Note save failed: ${error.message}`);
      return;
    }

    setDocumentNote("");
    setDocumentNoteFile(null);
    await loadEmployees();
    setSavingDocumentNote(false);
    flash("Document note saved");
  };

  const updateEmployeeStatus = async (nextStatus: EmployeeRow["status"]) => {
    if (!selectedId) {
      flash("Select or save an employee before changing status");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("estate_employees")
      .update({ status: nextStatus })
      .eq("id", selectedId);

    if (error) {
      setSaving(false);
      flash(`Status update failed: ${error.message}`);
      return;
    }

    await loadEmployees();
    setSaving(false);
    flash(`Employee marked ${nextStatus}`);
  };

  const moveToIdCenter = async () => {
    const employeeId = await saveEmployee(false);
    if (!employeeId) return;

    router.push(`/estate-management/muster-roll/employee-center/id-center?employee=${employeeId}`);
  };

  const deleteEmployeeRecord = async () => {
    if (!isAdmin) {
      flash("Only admins can delete employee records");
      return;
    }

    if (!selectedId || !selectedEmployee) {
      flash("Select an employee before deleting");
      return;
    }

    const ok = window.confirm(
      `Delete ${selectedEmployee.full_name} from the employee registry? This will remove the employee record, family rows and document registry links.`
    );
    if (!ok) return;

    setSaving(true);
    const { error } = await supabase
      .from("estate_employees")
      .delete()
      .eq("id", selectedId);

    if (error) {
      setSaving(false);
      flash(`Delete failed: ${error.message}`);
      return;
    }

    setForm(initialForm);
    setFamily([blankFamily(1)]);
    setSelectedId(null);
    setPhoto("");
    setPhotoFile(null);
    await loadEmployees();
    setSaving(false);
    flash("Employee record deleted");
  };

  const downloadHtml = () => {
    const familyRows = family
      .map(
        (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><input name="${familyNames.name}" lang="ta-IN" value="${escapeHtml(row.name)}"></td>
            <td><input name="${familyNames.relationship}" lang="ta-IN" value="${escapeHtml(row.relationship)}"></td>
            <td><input name="${familyNames.age}" inputmode="numeric" value="${escapeHtml(row.age)}"></td>
            <td><input name="${familyNames.aadhaar}" inputmode="numeric" value="${escapeHtml(row.aadhaar)}"></td>
          </tr>`
      )
      .join("");

    const field = (key: keyof FormState, label: string, value: string, multiline = false) => {
      const name = namedFormFields[key] ?? key;
      const escaped = escapeHtml(value);
      return multiline
        ? `<div class="field"><strong>${label}</strong><textarea name="${name}" lang="ta-IN">${escaped}</textarea></div>`
        : `<div class="field"><strong>${label}</strong><input name="${name}" lang="ta-IN" value="${escaped}"></div>`;
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MSP Application - ${escapeHtml(form.fullName || "Applicant")}</title>
<style>
body{margin:0;background:#f2ebd9;color:#2b2620;font-family:Arial,sans-serif;padding:24px}
.sheet{max-width:900px;margin:0 auto;background:#faf6ec;border:1px solid #dbd0b4}
.head{display:flex;gap:18px;align-items:center;background:#2f4a3a;color:#fffefb;padding:24px 32px;border-bottom:4px solid #b8863b}
.photo{width:110px;height:128px;border:2px dashed #ddbd7e;display:flex;align-items:center;justify-content:center;background:#fffefb;color:#635a48;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover}.content{padding:24px 32px}.section{border-top:1px solid #dbd0b4;padding-top:18px;margin-top:18px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 18px}.field strong{display:block;font-size:12px;color:#635a48}.field input,.field textarea,td input{width:100%;box-sizing:border-box;border:1px solid #dbd0b4;border-radius:4px;background:#fffefb;color:#2b2620;font:14px Arial,'Noto Sans Tamil',sans-serif;padding:7px 8px}.field textarea{min-height:58px;resize:vertical}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #dbd0b4;padding:7px;text-align:left;font-size:13px}th{background:#f2ebd9}
.sig{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.line{height:44px;border-bottom:1px solid #635a48}
@media(max-width:700px){.grid,.sig{grid-template-columns:1fr}.head{flex-direction:column;align-items:flex-start}}
</style>
</head>
<body><div class="sheet">
<div class="head"><div><h1>MSP Coffee (P) Ltd.</h1><p>Application Form - For Farm Labor</p><p>Stanmore Estate, Nagalur, Yercaud, Salem - 636602</p></div><div class="photo">${photo ? `<img src="${photo}" alt="Applicant photo">` : "Photo"}</div></div>
<div class="content">
<div class="section"><h2>Personal Details</h2><div class="grid">
${field("estateName", "Estate Name", form.estateName)}${field("fullName", "Full Name", form.fullName)}${field("parentSpouseName", "Father's / Husband's Name", form.parentSpouseName)}${field("dob", "Date of Birth", form.dob)}${field("age", "Age", form.age)}${field("gender", "Gender", form.gender)}${field("maritalStatus", "Marital Status", form.maritalStatus)}${field("aadhaar", "Aadhaar Number", form.aadhaar)}${field("pan", "PAN", form.pan)}${field("mobile", "Mobile", form.mobile)}${field("altContact", "Alternate Contact", form.altContact)}${field("reference", "Reference", form.reference)}${field("permAddress", "Permanent Address", form.permAddress, true)}${field("currAddress", "Current Address", form.currAddress, true)}
</div><h3>Family Members</h3><table><thead><tr><th>S.No</th><th>Name</th><th>Relationship</th><th>Age</th><th>Aadhaar Number</th></tr></thead><tbody>${familyRows}</tbody></table></div>
<div class="section"><h2>Employment Details</h2><div class="grid">
${field("empId", "Employee ID / Code", form.empId)}${field("doj", "Date of Joining", form.doj)}${field("jobRole", "Job Role / Designation", form.jobRole)}${field("section", "Section / Division", form.section)}${field("wage", "Daily Wage / Salary", form.wage)}${field("payMode", "Payment Mode", form.payMode)}${field("bankAcc", "Bank Account Number", form.bankAcc)}${field("ifsc", "IFSC Code", form.ifsc)}${field("experience", "Previous Experience", form.experience)}${field("education", "Education Level", form.education)}${field("epf", "EPF/PF UAN / Member ID", form.epf)}${field("esi", "ESI Number", form.esi)}
</div></div>
<div class="section"><h2>Other Information</h2><div class="grid">
${field("emName", "Emergency Contact Name & Relation", form.emName)}${field("emNumber", "Emergency Contact Number", form.emNumber)}${field("bloodGroup", "Blood Group", form.bloodGroup)}${field("medical", "Medical Conditions / Allergies", form.medical, true)}${field("nomineeName", "Nominee Name", form.nomineeName)}${field("nomineeRel", "Relation", form.nomineeRel)}
</div></div>
<div class="section"><p>I hereby declare that the above information is true to the best of my knowledge.</p><div class="sig"><div><div class="line"></div><strong>Signature of Employee</strong><p>Date: ${escapeHtml(form.empSigDate)}</p></div><div><div class="line"></div><strong>Signature of HR (Manager)</strong><p>Date: ${escapeHtml(form.hrSigDate)}</p></div><div><div class="line"></div><strong>Managing Director</strong><p>Date: ${escapeHtml(form.mdSigDate)}</p></div></div></div>
</div></div></body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const suggested = form.fullName.trim().replace(/\s+/g, "_") || "Applicant";
    anchor.href = url;
    anchor.download = `MSP_Application_${suggested}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    flash("Saved - check your Downloads folder");
  };

  return (
    <div className={css.page}>
      <div className={css.registryLayout}>
        <aside className={css.registryPanel}>
          <div className={css.registryHead}>
            <div>
              <div className={css.registryEyebrow}>Muster Roll</div>
              <h2 className={css.registryTitle}>Employee Registry</h2>
            </div>
            <button type="button" className={css.iconAction} onClick={startNew} title="New employee">
              <UserPlus size={17} />
            </button>
          </div>

          <div className={css.registryStats}>
            <div>
              <span>Total</span>
              <strong>{employees.length}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{activeCount}</strong>
            </div>
          </div>

          <label className={css.searchBox}>
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, code, mobile"
            />
          </label>

          <div className={css.employeeList}>
            {loading ? (
              <div className={css.emptyState}>
                <Loader2 size={16} className={css.spin} /> Loading employees
              </div>
            ) : filteredEmployees.length ? (
              filteredEmployees.map((employee) => (
                <button
                  type="button"
                  key={employee.id}
                  className={`${css.employeeItem} ${selectedId === employee.id ? css.employeeItemActive : ""}`}
                  onClick={() => selectEmployee(employee)}
                >
                  <span>
                    <strong>{employee.full_name}</strong>
                    <small>{employee.employee_code || "No employee code"} · {employee.estate_name}</small>
                  </span>
                  <em>{employee.status}</em>
                </button>
              ))
            ) : (
              <div className={css.emptyState}>No employees found</div>
            )}
          </div>
        </aside>

        <div className={css.shell}>
        <header className={css.letterhead}>
          <div className={css.seal} aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="12" rx="8" ry="10" stroke="#DDBD7E" strokeWidth="1.4" />
              <path d="M12 2 C 12 7, 12 17, 12 22" stroke="#DDBD7E" strokeWidth="1.4" />
            </svg>
          </div>
          <div>
            <h1 className={css.title}>MSP Coffee (P) Ltd.</h1>
            <p className={css.sub}>Stanmore Estate, Nagalur, Yercaud, Salem - 636602</p>
            <p className={`${css.sub} ${css.tamil}`}>ஸ்டான்மோர் எஸ்டேட், நாகலூர், ஏற்காடு, சேலம் - 636602</p>
            <div className={css.formTitle}>
              Application Form - For Farm Labor{" "}
              <span className={css.tamil}>| விண்ணப்பப் படிவம் - தோட்டத் தொழிலாளர்களுக்கான</span>
            </div>
          </div>
        </header>

        <div className={css.toolbar}>
          <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void saveEmployee()} disabled={saving}>
            {saving ? <Loader2 size={15} className={css.spin} /> : <Save size={15} />}
            {selectedId ? "Update registry" : "Save to registry"}
          </button>
          <button type="button" className={css.btn} onClick={() => void moveToIdCenter()} disabled={saving || !form.fullName.trim()}>
            <IdCard size={15} /> Move to ID Center
          </button>
          <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={downloadHtml}>
            <Download size={15} /> Save filled form (.html)
          </button>
          <input
            ref={filledFormInputRef}
            type="file"
            accept=".pdf,.html,.htm,image/*"
            className={css.hiddenInput}
            onChange={uploadFilledForm}
          />
          <button
            type="button"
            className={css.btn}
            onClick={() => filledFormInputRef.current?.click()}
            disabled={saving || uploadingForm}
          >
            {uploadingForm ? <Loader2 size={15} className={css.spin} /> : <Upload size={15} />}
            Upload filled form
          </button>
          {selectedEmployee?.application_form_public_url && (
            <a
              className={css.uploadedFormLink}
              href={selectedEmployee.application_form_public_url}
              target="_blank"
              rel="noreferrer"
              title={selectedEmployee.application_form_file_name || "Uploaded filled form"}
            >
              <ExternalLink size={14} /> View uploaded form
            </a>
          )}
          <button type="button" className={css.btn} onClick={() => window.print()}>
            <Printer size={15} /> Print / Save as PDF
          </button>
          <button type="button" className={css.btn} onClick={resetForm}>
            <RotateCcw size={15} /> Clear form
          </button>
          {isAdmin && selectedId && (
            <button type="button" className={`${css.btn} ${css.btnDanger}`} onClick={() => void deleteEmployeeRecord()} disabled={saving}>
              <Trash2 size={15} /> Delete record
            </button>
          )}
          <div className={css.statusControls}>
            {(["applicant", "active", "inactive", "left"] as EmployeeRow["status"][]).map((item) => (
              <button
                key={item}
                type="button"
                className={`${css.statusPill} ${selectedEmployee?.status === item ? css.statusPillActive : ""}`}
                onClick={() => updateEmployeeStatus(item)}
                disabled={!selectedId || saving}
              >
                {item}
              </button>
            ))}
          </div>
          <span className={css.status}>{status}</span>
        </div>

        <section className={css.documentPanel}>
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
            className={css.hiddenInput}
            onChange={uploadEmployeeDocument}
          />
          <div className={css.documentHead}>
            <div>
              <h2 className={css.documentTitle}>Employee Documents</h2>
              <p className={css.documentCopy}>Upload identity, bank and employee record files against this registry entry.</p>
            </div>
          </div>
          <div className={css.documentGrid}>
            {employeeDocumentTypes.map((item) => {
              const documents = selectedEmployeeDocuments.filter((document) => document.document_type === item.type);
              const isUploading = uploadingDocumentType === item.type;

              return (
                <div className={css.documentRow} key={item.type}>
                  <div>
                    <strong className={css.documentLabel}>{item.label}</strong>
                    {documents.length ? (
                      <div className={css.documentLinks}>
                        {documents.slice(0, 2).map((document) => (
                          <a
                            key={document.id}
                            className={css.documentLink}
                            href={document.public_url}
                            target="_blank"
                            rel="noreferrer"
                            title={document.file_name}
                          >
                            <ExternalLink size={13} />
                            {document.file_name}
                          </a>
                        ))}
                        {documents.length > 2 && <span className={css.documentMeta}>+{documents.length - 2} more</span>}
                      </div>
                    ) : (
                      <span className={css.documentMeta}>No file uploaded</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className={css.documentUploadBtn}
                    onClick={() => openDocumentUpload(item.type)}
                    disabled={saving || uploadingDocumentType !== null}
                  >
                    {isUploading ? <Loader2 size={14} className={css.spin} /> : <Upload size={14} />}
                    Upload
                  </button>
                </div>
              );
            })}
          </div>

          <div className={css.documentNotesPanel}>
            <div className={css.documentNotesHead}>
              <div>
                <h3 className={css.documentNotesTitle}>Comments and Notes</h3>
                <p className={css.documentCopy}>Notes are saved with timestamp and user name. Attach a document when needed.</p>
              </div>
            </div>
            <textarea
              className={css.documentNoteInput}
              value={documentNote}
              onChange={(event) => setDocumentNote(event.target.value)}
              placeholder="Leave a comment or note for this employee document file..."
              rows={3}
            />
            <div className={css.documentNoteActions}>
              <label className={css.documentNoteFile}>
                <Upload size={14} />
                <span>{documentNoteFile ? documentNoteFile.name : "Attach document if needed"}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
                  onChange={(event) => setDocumentNoteFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {documentNoteFile && (
                <button type="button" className={css.documentNoteClear} onClick={() => setDocumentNoteFile(null)}>
                  Remove attachment
                </button>
              )}
              <button
                type="button"
                className={`${css.btn} ${css.btnPrimary}`}
                onClick={() => void saveDocumentNote()}
                disabled={savingDocumentNote || saving || (!documentNote.trim() && !documentNoteFile)}
              >
                {savingDocumentNote ? <Loader2 size={14} className={css.spin} /> : <Save size={14} />}
                Save note
              </button>
            </div>

            <div className={css.documentNotesList}>
              {selectedEmployeeDocumentNotes.length ? (
                selectedEmployeeDocumentNotes.map((note) => (
                  <article className={css.documentNoteItem} key={note.id}>
                    <div className={css.documentNoteMeta}>
                      <strong>{note.author_name}</strong>
                      <span>{formatDateTime(note.created_at)}</span>
                    </div>
                    <p>{note.note_text}</p>
                    {note.attachment_public_url && (
                      <a className={css.documentLink} href={note.attachment_public_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} />
                        {note.attachment_file_name || "View attachment"}
                      </a>
                    )}
                  </article>
                ))
              ) : (
                <div className={css.documentNoteEmpty}>No comments or notes saved yet</div>
              )}
            </div>
          </div>
        </section>

        <form className={css.content} onSubmit={(event) => event.preventDefault()}>
          <section className={css.block}>
            <div className={css.blockHead}>
              <span className={css.blockNum}>1</span>
              <span className={css.blockTitle}>Personal Details</span>
              <span className={`${css.blockTitleTa} ${css.tamil}`}>தனிப்பட்ட விவரங்கள்</span>
            </div>

            <div className={css.personalLayout}>
              <div className={css.personalFields}>
                <div className={css.grid}>
                  <div className={css.field}>
                    <FieldLabel en="Estate Name" ta="தோட்டத்தின் பெயர்" />
                    <TamilTextInput className={css.input} value={form.estateName} onValueChange={(value) => update("estateName", value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Full Name (as per Aadhaar)" ta="முழு பெயர் (ஆதார் அட்டையின்படி)" />
                    <TamilTextInput className={css.input} value={form.fullName} onValueChange={(value) => update("fullName", value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Father's / Husband's Name" ta="தகப்பனார் / கணவர் பெயர்" />
                    <TamilTextInput className={css.input} value={form.parentSpouseName} onValueChange={(value) => update("parentSpouseName", value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Date of Birth" ta="பிறந்த தேதி" />
                    <input type="date" className={css.input} value={form.dob} onChange={(e) => update("dob", e.target.value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Age" ta="வயது" />
                    <input type="number" min="0" max="120" className={css.input} value={form.age} onChange={(e) => update("age", e.target.value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Gender" ta="பாலினம்" />
                    <div className={css.radioRow}>
                      {[
                        ["M", "Male", "ஆண்"],
                        ["F", "Female", "பெண்"],
                        ["Other", "Other", "மற்றவை"],
                      ].map(([value, en, ta]) => (
                        <label key={value} className={css.radioLabel}>
                          <input type="radio" checked={form.gender === value} onChange={() => update("gender", value)} />
                          {en} <span className={css.tamil}>{ta}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Marital Status" ta="திருமண நிலை" />
                    <select className={css.select} value={form.maritalStatus} onChange={(e) => update("maritalStatus", e.target.value)}>
                      <option value="" />
                      <option>Single</option>
                      <option>Married</option>
                      <option>Widowed</option>
                      <option>Divorced</option>
                    </select>
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Aadhaar Number" ta="ஆதார் எண்" />
                    <input className={css.input} maxLength={14} placeholder="XXXX XXXX XXXX" value={form.aadhaar} onChange={(e) => update("aadhaar", e.target.value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="PAN (if any)" ta="பான் எண் (இருந்தால்)" />
                    <TamilTextInput className={css.input} value={form.pan} onValueChange={(value) => update("pan", value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Mobile Number" ta="அலைபேசி எண்" />
                    <input type="tel" className={css.input} value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Alternate Contact" ta="மாற்று தொடர்பு எண்" />
                    <input type="tel" className={css.input} value={form.altContact} onChange={(e) => update("altContact", e.target.value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Reference" ta="பரிந்துரைப்பவர்" />
                    <TamilTextInput className={css.input} value={form.reference} onValueChange={(value) => update("reference", value)} />
                  </div>
                </div>
              </div>

              <div className={css.photoBox}>
                <div className={css.photoFrame}>
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="Applicant photo" />
                  ) : (
                    <div className={css.photoPlaceholder}>
                      Photo
                      <br />
                      <span className={css.tamil}>புகைப்படம்</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" className={css.fileInput} onChange={handlePhoto} />
                <div className={css.caption}>
                  Upload passport photo
                  <br />
                  <span className={css.tamil}>பாஸ்போர்ட் அளவு புகைப்படம்</span>
                </div>
              </div>
            </div>

            <div className={css.grid} style={{ marginTop: 16 }}>
              <div className={`${css.field} ${css.span2}`}>
                <FieldLabel en="Permanent Address" ta="நிரந்தர முகவரி" />
                <TamilTextarea className={css.textarea} value={form.permAddress} onValueChange={(value) => update("permAddress", value)} />
              </div>
              <div className={`${css.field} ${css.span2}`}>
                <FieldLabel en="Current Address" ta="தற்போதைய முகவரி" />
                <TamilTextarea className={css.textarea} value={form.currAddress} onValueChange={(value) => update("currAddress", value)} />
              </div>
            </div>

            <h3 className={css.minorTitle}>
              Family Members&apos; Details{" "}
              <span className={`${css.ta} ${css.tamil}`}>குடும்ப உறுப்பினர்களின் விவரங்கள்</span>
            </h3>
            <div className={css.tableWrap}>
              <table className={css.family}>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>S.No <span className={`${css.ta} ${css.tamil}`}>வ.எண்</span></th>
                    <th>Name <span className={`${css.ta} ${css.tamil}`}>பெயர்</span></th>
                    <th>Relationship <span className={`${css.ta} ${css.tamil}`}>உறவுமுறை</span></th>
                    <th style={{ width: 80 }}>Age <span className={`${css.ta} ${css.tamil}`}>வயது</span></th>
                    <th>Aadhaar Number <span className={`${css.ta} ${css.tamil}`}>ஆதார் எண்</span></th>
                    <th className={css.removeCell} />
                  </tr>
                </thead>
                <tbody>
                  {family.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td><TamilTextInput className={css.familyInput} value={row.name} onValueChange={(value) => updateFamily(row.id, "name", value)} /></td>
                      <td><TamilTextInput className={css.familyInput} value={row.relationship} onValueChange={(value) => updateFamily(row.id, "relationship", value)} /></td>
                      <td><input className={css.familyInput} value={row.age} onChange={(e) => updateFamily(row.id, "age", e.target.value)} /></td>
                      <td><input className={css.familyInput} value={row.aadhaar} onChange={(e) => updateFamily(row.id, "aadhaar", e.target.value)} /></td>
                      <td className={css.removeCell}>
                        <button type="button" className={css.iconButton} onClick={() => removeFamily(row.id)} title="Remove row">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className={`${css.btn} ${css.addRow}`} onClick={() => setFamily((rows) => [...rows, blankFamily(nextFamilyId)])}>
              <Plus size={15} /> Add family member <span className={css.tamil}>| உறுப்பினரைச் சேர்க்க</span>
            </button>
          </section>

          <section className={css.block}>
            <div className={css.blockHead}>
              <span className={css.blockNum}>2</span>
              <span className={css.blockTitle}>Employment Details</span>
              <span className={`${css.blockTitleTa} ${css.tamil}`}>பணி விவரங்கள்</span>
            </div>
            <div className={`${css.grid} ${css.cols3}`}>
              <div className={css.field}><FieldLabel en="Employee ID / Code" ta="பணியாளர் எண்" /><input className={css.input} placeholder="MSP / SE / HR / ____" value={form.empId} onChange={(e) => update("empId", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Date of Joining" ta="பணியில் சேர்ந்த தேதி" /><input type="date" className={css.input} value={form.doj} onChange={(e) => update("doj", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Job Role / Designation" ta="பணி பதவி" /><TamilTextInput className={css.input} placeholder="e.g. Field Worker, Harvester" value={form.jobRole} onValueChange={(value) => update("jobRole", value)} /></div>
              <div className={css.field}><FieldLabel en="Section / Division" ta="பிரிவு" /><TamilTextInput className={css.input} value={form.section} onValueChange={(value) => update("section", value)} /></div>
              <div className={css.field}><FieldLabel en="Daily Wage / Salary" ta="தினசரி கூலி / சம்பளம்" /><TamilTextInput className={css.input} value={form.wage} onValueChange={(value) => update("wage", value)} /></div>
              <div className={css.field}>
                <FieldLabel en="Payment Mode" ta="சம்பளம் வழங்கும் முறை" />
                <div className={css.radioRow}>
                  {[
                    ["Cash", "Cash", "ரொக்கம்"],
                    ["Bank", "Bank", "வங்கி"],
                  ].map(([value, en, ta]) => (
                    <label key={value} className={css.radioLabel}>
                      <input type="radio" checked={form.payMode === value} onChange={() => update("payMode", value)} />
                      {en} <span className={css.tamil}>{ta}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className={css.field}><FieldLabel en="Bank Account Number" ta="வங்கி கணக்கு எண்" /><input className={css.input} value={form.bankAcc} onChange={(e) => update("bankAcc", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="IFSC Code" ta="IFSC குறியீடு" /><input className={css.input} value={form.ifsc} onChange={(e) => update("ifsc", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Previous Experience (Years)" ta="முன் அனுபவம் (ஆண்டுகள்)" /><TamilTextInput className={css.input} value={form.experience} onValueChange={(value) => update("experience", value)} /></div>
              <div className={css.field}><FieldLabel en="Education Level" ta="கல்வித் தகுதி" /><TamilTextInput className={css.input} value={form.education} onValueChange={(value) => update("education", value)} /></div>
              <div className={css.field}><FieldLabel en="EPF/PF UAN / Member ID" ta="EPF/PF UAN எண்" /><input className={css.input} value={form.epf} onChange={(e) => update("epf", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="ESI Number (if applicable)" ta="ESI எண் (இருந்தால்)" /><input className={css.input} value={form.esi} onChange={(e) => update("esi", e.target.value)} /></div>
            </div>
          </section>

          <section className={css.block}>
            <div className={css.blockHead}>
              <span className={css.blockNum}>3</span>
              <span className={css.blockTitle}>Other Information</span>
              <span className={`${css.blockTitleTa} ${css.tamil}`}>இதர தகவல்கள்</span>
            </div>
            <div className={`${css.grid} ${css.cols3}`}>
              <div className={css.field}><FieldLabel en="Emergency Contact Name & Relation" ta="அவசரகால தொடர்பு பெயர் & உறவுமுறை" /><TamilTextInput className={css.input} value={form.emName} onValueChange={(value) => update("emName", value)} /></div>
              <div className={css.field}><FieldLabel en="Emergency Contact Number" ta="அவசரகால தொடர்பு எண்" /><input type="tel" className={css.input} value={form.emNumber} onChange={(e) => update("emNumber", e.target.value)} /></div>
              <div className={css.field}>
                <FieldLabel en="Blood Group" ta="இரத்த வகை" />
                <select className={css.select} value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)}>
                  <option value="" />
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => <option key={group}>{group}</option>)}
                </select>
              </div>
              <div className={`${css.field} ${css.span3}`}><FieldLabel en="Medical Conditions / Allergies" ta="மருத்துவப் பிரச்சினைகள் / ஒவ்வாமை" /><TamilTextarea className={css.textarea} value={form.medical} onValueChange={(value) => update("medical", value)} /></div>
              <div className={css.field}><FieldLabel en="Nominee Name (for benefits)" ta="வாரிசுதாரர் பெயர்" /><TamilTextInput className={css.input} value={form.nomineeName} onValueChange={(value) => update("nomineeName", value)} /></div>
              <div className={css.field}><FieldLabel en="Relation" ta="உறவுமுறை" /><TamilTextInput className={css.input} value={form.nomineeRel} onValueChange={(value) => update("nomineeRel", value)} /></div>
            </div>
          </section>

          <section className={css.block}>
            <div className={css.declaration}>
              I hereby declare that the above information is true to the best of my knowledge.
              <span className={`${css.ta} ${css.tamil}`}>மேலே குறிப்பிட்டுள்ள விவரங்கள் அனைத்தும் எனது அறிவுக்கு எட்டியவரை உண்மை என்று இதன் மூலம் உறுதிப்படுத்துகிறேன்.</span>
            </div>
            <div className={css.sigGrid}>
              <div className={css.sigCell}>
                <div className={css.sigLine} />
                <div className={css.roleEn}>Signature of Employee</div>
                <div className={`${css.roleTa} ${css.tamil}`}>தொழிலாளியின் கையொப்பம்</div>
                <div className={css.dateLine}>Date: <input type="date" className={css.input} value={form.empSigDate} onChange={(e) => update("empSigDate", e.target.value)} /></div>
              </div>
              <div className={css.sigCell}>
                <div className={css.sigLine} />
                <div className={css.roleEn}>Signature of HR (Manager)</div>
                <div className={`${css.roleTa} ${css.tamil}`}>மனித வளங்கள் மேலாளர் கையொப்பம்</div>
                <div className={css.dateLine}>Date: <input type="date" className={css.input} value={form.hrSigDate} onChange={(e) => update("hrSigDate", e.target.value)} /></div>
              </div>
              <div className={css.sigCell}>
                <div className={css.sigLine} />
                <div className={css.roleEn}>Managing Director</div>
                <div className={`${css.roleTa} ${css.tamil}`}>நிர்வாக இயக்குநர்</div>
                <div className={css.dateLine}>Date: <input type="date" className={css.input} value={form.mdSigDate} onChange={(e) => update("mdSigDate", e.target.value)} /></div>
              </div>
            </div>
          </section>
        </form>

        <footer className={css.note}>
          This form can be filled, saved, re-opened and edited any number of times - nothing is lost.{" "}
          <span className={css.tamil}>இப்படிவத்தை நிரப்பி, சேமித்து, மீண்டும் திறந்து திருத்தலாம் - எந்த தகவலும் இழக்கப்படாது.</span>
        </footer>
        </div>
      </div>
    </div>
  );
}
