'use client';

import { useState, useCallback } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  desig: string;
  gender: 'Male' | 'Female';
  cat: string;
};
type AttRecord = { status: 'P' | 'H' | 'A'; work: string };

// ── Constants ────────────────────────────────────────────────────────────────
const WAGE_CATS = [
  'Casual Male Worker', 'Casual Female Worker',
  'PF Male Worker', 'PF Female Worker',
  'Staff / Incharge', 'Field Assistant', 'Mistry',
  'Mechanic', 'Driver', 'Cook', 'Watchman', 'Coffee Roaster',
];

const WORK_OPTIONS = [
  'Weeding', 'Pruning', 'Picking', 'Spraying', 'Fertiliser application',
  'Digging / Trenching', 'Roads & drains', 'Nursery work', 'Shade tree work',
  'Loading / Transport', 'Drying / Processing', 'Watchman duty',
  'Cooking / Canteen', 'General maintenance',
];

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: '526', name: 'Rabeen',                   desig: 'Coffee Roaster', gender: 'Male',   cat: 'Coffee Roaster'   },
  { id: '295', name: 'Palani',                   desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '273', name: 'Sukru Hembrom',            desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '264', name: 'Etwa Hembrom',             desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '260', name: 'Moti Hembrom',             desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '259', name: 'Mali Soy',                 desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '499', name: 'V Mani',                   desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '443', name: 'Chelladurai',              desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '442', name: 'Thamaraiselvi Siva',       desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '441', name: 'Budhani Purti',            desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '438', name: 'Lakshmi Arumugam',         desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '437', name: 'M Murugeshwari',           desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '436', name: 'Mangaleshwari Kumar',      desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '435', name: 'Sutha',                    desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '434', name: 'P Sadatchi',               desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '433', name: 'S Rasathi',                desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '432', name: 'Manjula Gnansekaran',      desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '431', name: 'Palaniyammal Panner',      desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '430', name: 'Sivalakshmi Govindharaj', desig: 'Worker',          gender: 'Female', cat: 'PF Female Worker' },
  { id: '429', name: 'Chinthamani Palanisamy',  desig: 'Worker',          gender: 'Female', cat: 'PF Female Worker' },
  { id: '428', name: 'Kuppayi Palanisamy',       desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '427', name: 'Ramayee',                  desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '426', name: 'A Annapoorani',            desig: 'Cook',           gender: 'Female', cat: 'Cook'             },
  { id: '425', name: 'T Sumathi',                desig: 'Cook',           gender: 'Female', cat: 'Cook'             },
  { id: '424', name: 'Sivakami',                 desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '423', name: 'S Sumathi',                desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '420', name: 'Kuppusamy',                desig: 'Watchman',       gender: 'Male',   cat: 'Watchman'         },
  { id: '414', name: 'Sanika Hembrom',           desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker' },
  { id: '412', name: 'Mangra Diggi',             desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '410', name: 'Pitchai',                  desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '409', name: 'Thangavel',                desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '408', name: 'K Annamalai',              desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '407', name: 'M Rupan',                  desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '406', name: 'Pannerselvam',             desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '405', name: 'G Arumugam',               desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'   },
  { id: '404', name: 'P Palanisamy',             desig: 'Mistry',         gender: 'Male',   cat: 'Mistry'           },
  { id: '403', name: 'R Siva',                   desig: 'Driver',         gender: 'Male',   cat: 'Driver'           },
  { id: '402', name: 'D Sivakumar',              desig: 'Field Asst',     gender: 'Male',   cat: 'Field Assistant'  },
  { id: '401', name: 'T Jawaharan',              desig: 'Mech',           gender: 'Male',   cat: 'Mechanic'         },
  { id: '400', name: 'P Govindharaj',            desig: 'Incharge',       gender: 'Male',   cat: 'Staff / Incharge' },
];

const today = new Date().toISOString().split('T')[0];

export default function StanmoreLabourPage() {
  const [tab, setTab]             = useState<'daily' | 'employees' | 'wages'>('daily');
  const [reportDate, setReportDate] = useState(today);
  const [supervisor, setSupervisor] = useState('');
  const [employees, setEmployees]  = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [wages, setWages]          = useState<Record<string, number>>(
    Object.fromEntries(WAGE_CATS.map(c => [c, 0]))
  );
  const [attendance, setAttendance] = useState<Record<string, AttRecord>>(
    Object.fromEntries(DEFAULT_EMPLOYEES.map(e => [e.id, { status: 'P', work: '' }]))
  );
  const [pendingWages, setPendingWages] = useState<Record<string, string>>(
    Object.fromEntries(WAGE_CATS.map(c => [c, '0']))
  );
  const [newId, setNewId]       = useState('');
  const [newName, setNewName]   = useState('');
  const [newDesig, setNewDesig] = useState('Worker');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [newCat, setNewCat]     = useState(WAGE_CATS[0]);

  const getWage = (cat: string) => wages[cat] ?? 0;
  const getDays = (status: string) => status === 'P' ? 1 : status === 'H' ? 0.5 : 0;

  const setAtt = useCallback((id: string, field: keyof AttRecord, val: string) => {
    setAttendance(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }, []);

  const stats = employees.reduce(
    (acc, e) => {
      const att  = attendance[e.id] ?? { status: 'P', work: '' };
      const days = getDays(att.status);
      if (att.status === 'P') acc.present++;
      else if (att.status === 'H') acc.half++;
      else acc.absent++;
      if (att.status !== 'A') { if (e.gender === 'Male') acc.male++; else acc.female++; }
      acc.totalDays += days;
      acc.totalCost += days * getWage(e.cat);
      return acc;
    },
    { present: 0, half: 0, absent: 0, male: 0, female: 0, totalDays: 0, totalCost: 0 }
  );

  const addEmployee = () => {
    if (!newId.trim() || !newName.trim()) return;
    if (employees.find(e => e.id === newId.trim())) { alert('ID already exists.'); return; }
    const emp: Employee = { id: newId.trim(), name: newName.trim(), desig: newDesig, gender: newGender, cat: newCat };
    setEmployees(prev => [...prev, emp]);
    setAttendance(prev => ({ ...prev, [emp.id]: { status: 'P', work: '' } }));
    setNewId(''); setNewName('');
  };

  const removeEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setAttendance(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveWages = () => {
    const updated: Record<string, number> = {};
    WAGE_CATS.forEach(c => { updated[c] = parseFloat(pendingWages[c] ?? '0') || 0; });
    setWages(updated);
  };

  const exportReport = () => {
    const lines = [
      'STANMORE ESTATE — DAILY LABOUR REPORT',
      `Date: ${reportDate}  |  Supervisor: ${supervisor || '—'}`,
      '',
      `${'#'.padEnd(5)}${'Name'.padEnd(26)}${'Status'.padEnd(8)}${'Days'.padEnd(7)}${'Cost (RM)'.padEnd(12)}Work Assigned`,
      ...employees.map((e, i) => {
        const att  = attendance[e.id] ?? { status: 'P', work: '' };
        const days = getDays(att.status);
        const cost = days * getWage(e.cat);
        return `${String(i + 1).padEnd(5)}${e.name.padEnd(26)}${att.status.padEnd(8)}${days.toFixed(1).padEnd(7)}${cost.toFixed(2).padEnd(12)}${att.work || ''}`;
      }),
      '',
      `${'TOTAL'.padEnd(39)}${stats.totalDays.toFixed(1).padEnd(7)}${stats.totalCost.toFixed(2)}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Stanmore_Labour_${reportDate}.txt`;
    a.click();
  };

  // ── Shared field styles using design tokens ──────────────────────────────
  const fieldCls = [
    'px-3 py-1.5 rounded-lg border text-sm w-full',
    'focus:outline-none focus:ring-2',
  ].join(' ');
  const fieldStyle: React.CSSProperties = {
    borderColor: 'var(--t-border)',
    background:  'var(--t-card)',
    color:       'var(--t-text)',
  };
  const selectStyle: React.CSSProperties = {
    ...fieldStyle,
    padding: '5px 8px',
    borderRadius: 8,
    border: '1px solid var(--t-border)',
    fontSize: 13,
    cursor: 'pointer',
  };

  const statusColor = (s: string) =>
    s === 'P' ? 'var(--t-accent)' : s === 'H' ? '#d97706' : 'var(--msp-danger, #e8524a)';

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'daily',     label: 'Daily entry'  },
    { key: 'employees', label: 'Employees'    },
    { key: 'wages',     label: 'Wage rates'   },
  ];

  return (
    <div className="ds-page" style={{ padding: '1.5rem' }}>

      {/* ── Filter / control bar ── */}
      <div className="ds-filter-bar" style={{ marginBottom: '1.25rem' }}>
        <div>
          <span className="ds-filter-label">Date</span>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
            className={fieldCls} style={{ ...fieldStyle, width: 160 }} />
        </div>
        <div>
          <span className="ds-filter-label">Supervisor</span>
          <input type="text" value={supervisor} onChange={e => setSupervisor(e.target.value)}
            placeholder="Name" className={fieldCls} style={{ ...fieldStyle, width: 180 }} />
        </div>
        <button onClick={exportReport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 ml-auto"
          style={{ background: 'var(--t-accent)', color: '#fff' }}>
          <Download className="h-4 w-4" /> Export report
        </button>
      </div>

      {/* ── KPI summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Present',    val: stats.present,                          accent: 'var(--t-accent)' },
          { label: 'Half day',   val: stats.half,                             accent: '#d97706'         },
          { label: 'Absent',     val: stats.absent,                           accent: '#e8524a'         },
          { label: 'Male',       val: stats.male,                             accent: 'var(--t-accent)' },
          { label: 'Female',     val: stats.female,                           accent: 'var(--t-accent)' },
          { label: 'Total cost', val: `RM ${stats.totalCost.toFixed(2)}`,     accent: 'var(--t-gold)'   },
        ].map(({ label, val, accent }) => (
          <div key={label} className="ds-kpi-card" style={{ '--kpi-accent': accent } as React.CSSProperties & Record<string,string>}>
            <style>{`.ds-kpi-card { --kpi-accent: var(--t-accent); } .ds-kpi-card::before { background: var(--kpi-accent) !important; }`}</style>
            <div className="ds-kpi-label">{label}</div>
            <div className="ds-kpi-value" style={{ fontSize: label === 'Total cost' ? '1.1rem' : '1.75rem' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--t-border)', marginBottom: '1rem' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--t-font)',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === key ? '2px solid var(--t-accent)' : '2px solid transparent',
              color: tab === key ? 'var(--t-heading)' : 'var(--t-muted)',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DAILY ENTRY TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'daily' && (
        <div className="ds-chart-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontFamily: 'var(--t-font)' }}>
              <thead>
                <tr style={{ background: 'var(--t-subtle)' }}>
                  {['ID','Name','Designation','Gender','Category','Wage (RM)','Status','Work assigned','Days','Cost (RM)'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 12px',
                      textAlign: i >= 5 ? 'center' : 'left',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--t-label)',
                      borderBottom: '1px solid var(--t-border)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((e, idx) => {
                  const att  = attendance[e.id] ?? { status: 'P', work: '' };
                  const days = getDays(att.status);
                  const cost = days * getWage(e.cat);
                  const rowBg = idx % 2 === 0 ? 'var(--t-card)' : 'var(--t-subtle)';
                  return (
                    <tr key={e.id} style={{ background: rowBg }}>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--t-muted)', borderBottom: '1px solid var(--t-border)' }}>{e.id}</td>
                      <td style={{ padding: '7px 12px', fontWeight: 600, fontSize: 13, color: 'var(--t-text)', borderBottom: '1px solid var(--t-border)', whiteSpace: 'nowrap' }}>{e.name}</td>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--t-muted)', borderBottom: '1px solid var(--t-border)' }}>{e.desig}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', borderBottom: '1px solid var(--t-border)' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                          background: e.gender === 'Male' ? 'rgba(56,189,248,0.15)' : 'rgba(236,72,153,0.12)',
                          color:      e.gender === 'Male' ? '#0369a1'              : '#be185d',
                        }}>{e.gender === 'Male' ? 'M' : 'F'}</span>
                      </td>
                      <td style={{ padding: '7px 12px', fontSize: 11, color: 'var(--t-muted)', borderBottom: '1px solid var(--t-border)', whiteSpace: 'nowrap' }}>
                        {e.cat.replace('PF Male Worker','PF M').replace('PF Female Worker','PF F')
                              .replace('Casual Male Worker','Cas M').replace('Casual Female Worker','Cas F')}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 13, color: 'var(--t-text)', borderBottom: '1px solid var(--t-border)' }}>{getWage(e.cat).toFixed(2)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid var(--t-border)' }}>
                        <select value={att.status} onChange={ev => setAtt(e.id, 'status', ev.target.value)}
                          style={{ ...selectStyle, width: 60, fontWeight: 700, color: statusColor(att.status) }}>
                          <option value="P" style={{ color: 'var(--t-accent)' }}>P</option>
                          <option value="H" style={{ color: '#d97706' }}>H</option>
                          <option value="A" style={{ color: '#e8524a' }}>A</option>
                        </select>
                      </td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid var(--t-border)' }}>
                        <select value={att.work} onChange={ev => setAtt(e.id, 'work', ev.target.value)}
                          style={{ ...selectStyle, width: '100%', minWidth: 150 }}>
                          <option value="">— select —</option>
                          {WORK_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: statusColor(att.status), borderBottom: '1px solid var(--t-border)' }}>
                        {days.toFixed(1)}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--t-text)', borderBottom: '1px solid var(--t-border)' }}>
                        {cost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--t-subtle)' }}>
                  <td colSpan={8} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--t-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: 'var(--t-heading)' }}>{stats.totalDays.toFixed(1)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--t-heading)' }}>{stats.totalCost.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          EMPLOYEES TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Add form */}
          <div className="ds-chart-card">
            <div className="ds-section-hdr">Add employee</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <span className="ds-filter-label">Emp ID</span>
                <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="e.g. 530"
                  className={fieldCls} style={{ ...fieldStyle, width: 90 }} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <span className="ds-filter-label">Full name</span>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Employee name"
                  className={fieldCls} style={fieldStyle} />
              </div>
              <div>
                <span className="ds-filter-label">Designation</span>
                <select value={newDesig} onChange={e => setNewDesig(e.target.value)} style={{ ...selectStyle, width: 140 }}>
                  {['Worker','Driver','Mistry','Field Asst','Mech','Incharge','Cook','Watchman','Coffee Roaster'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <span className="ds-filter-label">Gender</span>
                <select value={newGender} onChange={e => setNewGender(e.target.value as 'Male' | 'Female')} style={{ ...selectStyle, width: 100 }}>
                  <option>Male</option><option>Female</option>
                </select>
              </div>
              <div>
                <span className="ds-filter-label">Category</span>
                <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{ ...selectStyle, width: 170 }}>
                  {WAGE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={addEmployee}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: 'var(--t-accent)', color: '#fff', alignSelf: 'flex-end' }}>
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>

          {/* Employee table */}
          <div className="ds-chart-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontFamily: 'var(--t-font)' }}>
                <thead>
                  <tr style={{ background: 'var(--t-subtle)' }}>
                    {['ID','Name','Designation','Gender','Category','Daily wage (RM)',''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t-label)', borderBottom: '1px solid var(--t-border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e, idx) => (
                    <tr key={e.id} style={{ background: idx % 2 === 0 ? 'var(--t-card)' : 'var(--t-subtle)' }}>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--t-muted)', borderBottom: '1px solid var(--t-border)' }}>{e.id}</td>
                      <td style={{ padding: '7px 12px', fontWeight: 600, fontSize: 13, color: 'var(--t-text)', borderBottom: '1px solid var(--t-border)' }}>{e.name}</td>
                      <td style={{ padding: '7px 12px', fontSize: 13, color: 'var(--t-muted)', borderBottom: '1px solid var(--t-border)' }}>{e.desig}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--t-border)' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                          background: e.gender === 'Male' ? 'rgba(56,189,248,0.15)' : 'rgba(236,72,153,0.12)',
                          color:      e.gender === 'Male' ? '#0369a1'              : '#be185d' }}>
                          {e.gender}
                        </span>
                      </td>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--t-muted)', borderBottom: '1px solid var(--t-border)' }}>{e.cat}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 13, color: 'var(--t-text)', borderBottom: '1px solid var(--t-border)' }}>{getWage(e.cat).toFixed(2)}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--t-border)' }}>
                        <button onClick={() => removeEmployee(e.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                          style={{ color: '#e8524a', border: '1px solid rgba(232,82,74,0.3)', background: 'rgba(232,82,74,0.06)' }}>
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          WAGE RATES TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'wages' && (
        <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--t-muted)' }}>Set daily wages per category. Click "Save rates" to apply across all cost calculations.</p>
          <div className="ds-chart-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--t-font)' }}>
              <thead>
                <tr style={{ background: 'var(--t-subtle)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t-label)', borderBottom: '1px solid var(--t-border)' }}>Category</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t-label)', borderBottom: '1px solid var(--t-border)' }}>Daily wage (RM)</th>
                </tr>
              </thead>
              <tbody>
                {WAGE_CATS.map((cat, idx) => (
                  <tr key={cat} style={{ background: idx % 2 === 0 ? 'var(--t-card)' : 'var(--t-subtle)' }}>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--t-text)', borderBottom: '1px solid var(--t-border)' }}>{cat}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', borderBottom: '1px solid var(--t-border)' }}>
                      <input type="number" min="0" step="0.50"
                        value={pendingWages[cat] ?? '0'}
                        onChange={e => setPendingWages(prev => ({ ...prev, [cat]: e.target.value }))}
                        style={{ ...fieldStyle, width: 110, textAlign: 'right', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--t-border)', fontSize: 13 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={saveWages}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 self-start"
            style={{ background: 'var(--t-accent)', color: '#fff' }}>
            Save rates
          </button>
        </div>
      )}
    </div>
  );
}
