"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Download, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import css from "./employee-center.module.css";

type FamilyMember = {
  id: number;
  name: string;
  relationship: string;
  age: string;
  aadhaar: string;
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

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function FieldLabel({ en, ta }: { en: string; ta: string }) {
  return (
    <span className={css.label}>
      {en}
      <span className={`${css.ta} ${css.tamil}`}>{ta}</span>
    </span>
  );
}

export default function EmployeeCenterPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [family, setFamily] = useState<FamilyMember[]>(() => [blankFamily(1)]);
  const [photo, setPhoto] = useState("");
  const [status, setStatus] = useState("");

  const nextFamilyId = useMemo(
    () => Math.max(0, ...family.map((row) => row.id)) + 1,
    [family]
  );

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus((current) => (current === message ? "" : current)), 3500);
  };

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
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    if (!window.confirm("Clear all entered data on this form? This cannot be undone.")) return;
    setForm(initialForm);
    setFamily([blankFamily(1)]);
    setPhoto("");
    flash("Form cleared");
  };

  const downloadHtml = () => {
    const familyRows = family
      .map(
        (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.relationship)}</td>
            <td>${escapeHtml(row.age)}</td>
            <td>${escapeHtml(row.aadhaar)}</td>
          </tr>`
      )
      .join("");

    const field = (label: string, value: string) => `
      <div class="field"><strong>${label}</strong><span>${escapeHtml(value)}</span></div>`;

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
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 18px}.field strong{display:block;font-size:12px;color:#635a48}.field span{font-size:14px}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #dbd0b4;padding:7px;text-align:left;font-size:13px}th{background:#f2ebd9}
.sig{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.line{height:44px;border-bottom:1px solid #635a48}
@media(max-width:700px){.grid,.sig{grid-template-columns:1fr}.head{flex-direction:column;align-items:flex-start}}
</style>
</head>
<body><div class="sheet">
<div class="head"><div><h1>MSP Coffee (P) Ltd.</h1><p>Application Form - For Farm Labor</p><p>Stanmore Estate, Nagalur, Yercaud, Salem - 636602</p></div><div class="photo">${photo ? `<img src="${photo}" alt="Applicant photo">` : "Photo"}</div></div>
<div class="content">
<div class="section"><h2>Personal Details</h2><div class="grid">
${field("Estate Name", form.estateName)}${field("Full Name", form.fullName)}${field("Father's / Husband's Name", form.parentSpouseName)}${field("Date of Birth", form.dob)}${field("Age", form.age)}${field("Gender", form.gender)}${field("Marital Status", form.maritalStatus)}${field("Aadhaar Number", form.aadhaar)}${field("PAN", form.pan)}${field("Mobile", form.mobile)}${field("Alternate Contact", form.altContact)}${field("Reference", form.reference)}${field("Permanent Address", form.permAddress)}${field("Current Address", form.currAddress)}
</div><h3>Family Members</h3><table><thead><tr><th>S.No</th><th>Name</th><th>Relationship</th><th>Age</th><th>Aadhaar Number</th></tr></thead><tbody>${familyRows}</tbody></table></div>
<div class="section"><h2>Employment Details</h2><div class="grid">
${field("Employee ID / Code", form.empId)}${field("Date of Joining", form.doj)}${field("Job Role / Designation", form.jobRole)}${field("Section / Division", form.section)}${field("Daily Wage / Salary", form.wage)}${field("Payment Mode", form.payMode)}${field("Bank Account Number", form.bankAcc)}${field("IFSC Code", form.ifsc)}${field("Previous Experience", form.experience)}${field("Education Level", form.education)}${field("EPF/PF UAN / Member ID", form.epf)}${field("ESI Number", form.esi)}
</div></div>
<div class="section"><h2>Other Information</h2><div class="grid">
${field("Emergency Contact Name & Relation", form.emName)}${field("Emergency Contact Number", form.emNumber)}${field("Blood Group", form.bloodGroup)}${field("Medical Conditions / Allergies", form.medical)}${field("Nominee Name", form.nomineeName)}${field("Relation", form.nomineeRel)}
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
          <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={downloadHtml}>
            <Download size={15} /> Save filled form (.html)
          </button>
          <button type="button" className={css.btn} onClick={() => window.print()}>
            <Printer size={15} /> Print / Save as PDF
          </button>
          <button type="button" className={css.btn} onClick={resetForm}>
            <RotateCcw size={15} /> Clear form
          </button>
          <span className={css.status}>{status}</span>
        </div>

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
                    <input className={css.input} value={form.estateName} onChange={(e) => update("estateName", e.target.value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Full Name (as per Aadhaar)" ta="முழு பெயர் (ஆதார் அட்டையின்படி)" />
                    <input className={css.input} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
                  </div>
                  <div className={css.field}>
                    <FieldLabel en="Father's / Husband's Name" ta="தகப்பனார் / கணவர் பெயர்" />
                    <input className={css.input} value={form.parentSpouseName} onChange={(e) => update("parentSpouseName", e.target.value)} />
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
                    <input className={css.input} value={form.pan} onChange={(e) => update("pan", e.target.value)} />
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
                    <input className={css.input} value={form.reference} onChange={(e) => update("reference", e.target.value)} />
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
                <textarea className={css.textarea} value={form.permAddress} onChange={(e) => update("permAddress", e.target.value)} />
              </div>
              <div className={`${css.field} ${css.span2}`}>
                <FieldLabel en="Current Address" ta="தற்போதைய முகவரி" />
                <textarea className={css.textarea} value={form.currAddress} onChange={(e) => update("currAddress", e.target.value)} />
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
                      <td><input className={css.familyInput} value={row.name} onChange={(e) => updateFamily(row.id, "name", e.target.value)} /></td>
                      <td><input className={css.familyInput} value={row.relationship} onChange={(e) => updateFamily(row.id, "relationship", e.target.value)} /></td>
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
              <div className={css.field}><FieldLabel en="Job Role / Designation" ta="பணி பதவி" /><input className={css.input} placeholder="e.g. Field Worker, Harvester" value={form.jobRole} onChange={(e) => update("jobRole", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Section / Division" ta="பிரிவு" /><input className={css.input} value={form.section} onChange={(e) => update("section", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Daily Wage / Salary" ta="தினசரி கூலி / சம்பளம்" /><input className={css.input} value={form.wage} onChange={(e) => update("wage", e.target.value)} /></div>
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
              <div className={css.field}><FieldLabel en="Previous Experience (Years)" ta="முன் அனுபவம் (ஆண்டுகள்)" /><input className={css.input} value={form.experience} onChange={(e) => update("experience", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Education Level" ta="கல்வித் தகுதி" /><input className={css.input} value={form.education} onChange={(e) => update("education", e.target.value)} /></div>
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
              <div className={css.field}><FieldLabel en="Emergency Contact Name & Relation" ta="அவசரகால தொடர்பு பெயர் & உறவுமுறை" /><input className={css.input} value={form.emName} onChange={(e) => update("emName", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Emergency Contact Number" ta="அவசரகால தொடர்பு எண்" /><input type="tel" className={css.input} value={form.emNumber} onChange={(e) => update("emNumber", e.target.value)} /></div>
              <div className={css.field}>
                <FieldLabel en="Blood Group" ta="இரத்த வகை" />
                <select className={css.select} value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)}>
                  <option value="" />
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => <option key={group}>{group}</option>)}
                </select>
              </div>
              <div className={`${css.field} ${css.span3}`}><FieldLabel en="Medical Conditions / Allergies" ta="மருத்துவப் பிரச்சினைகள் / ஒவ்வாமை" /><textarea className={css.textarea} value={form.medical} onChange={(e) => update("medical", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Nominee Name (for benefits)" ta="வாரிசுதாரர் பெயர்" /><input className={css.input} value={form.nomineeName} onChange={(e) => update("nomineeName", e.target.value)} /></div>
              <div className={css.field}><FieldLabel en="Relation" ta="உறவுமுறை" /><input className={css.input} value={form.nomineeRel} onChange={(e) => update("nomineeRel", e.target.value)} /></div>
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
  );
}
