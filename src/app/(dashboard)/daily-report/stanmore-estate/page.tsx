'use client';

import { useState, useCallback } from 'react';

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
  { id: '526', name: 'Rabeen',                desig: 'Coffee Roaster', gender: 'Male',   cat: 'Coffee Roaster'    },
  { id: '295', name: 'Palani',                desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '273', name: 'Sukru Hembrom',         desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '264', name: 'Etwa Hembrom',          desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '260', name: 'Moti Hembrom',          desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '259', name: 'Mali Soy',              desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '499', name: 'V Mani',               desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '443', name: 'Chelladurai',           desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '442', name: 'Thamaraiselvi Siva',   desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '441', name: 'Budhani Purti',        desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '438', name: 'Lakshmi Arumugam',     desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '437', name: 'M Murugeshwari',       desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '436', name: 'Mangaleshwari Kumar',  desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '435', name: 'Sutha',               desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '434', name: 'P Sadatchi',          desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '433', name: 'S Rasathi',           desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '432', name: 'Manjula Gnansekaran', desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '431', name: 'Palaniyammal Panner', desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '430', name: 'Sivalakshmi Govindharaj', desig: 'Worker',    gender: 'Female', cat: 'PF Female Worker'  },
  { id: '429', name: 'Chinthamani Palanisamy', desig: 'Worker',     gender: 'Female', cat: 'PF Female Worker'  },
  { id: '428', name: 'Kuppayi Palanisamy',   desig: 'Worker',        gender: 'Female', cat: 'PF Female Worker'  },
  { id: '427', name: 'Ramayee',             desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '426', name: 'A Annapoorani',        desig: 'Cook',           gender: 'Female', cat: 'Cook'              },
  { id: '425', name: 'T Sumathi',           desig: 'Cook',           gender: 'Female', cat: 'Cook'              },
  { id: '424', name: 'Sivakami',            desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '423', name: 'S Sumathi',           desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '420', name: 'Kuppusamy',           desig: 'Watchman',       gender: 'Male',   cat: 'Watchman'          },
  { id: '414', name: 'Sanika Hembrom',      desig: 'Worker',         gender: 'Female', cat: 'PF Female Worker'  },
  { id: '412', name: 'Mangra Diggi',        desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '410', name: 'Pitchai',            desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '409', name: 'Thangavel',          desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '408', name: 'K Annamalai',        desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '407', name: 'M Rupan',            desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '406', name: 'Pannerselvam',       desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '405', name: 'G Arumugam',         desig: 'Worker',         gender: 'Male',   cat: 'PF Male Worker'    },
  { id: '404', name: 'P Palanisamy',       desig: 'Mistry',         gender: 'Male',   cat: 'Mistry'            },
  { id: '403', name: 'R Siva',            desig: 'Driver',         gender: 'Male',   cat: 'Driver'            },
  { id: '402', name: 'D Sivakumar',       desig: 'Field Asst',     gender: 'Male',   cat: 'Field Assistant'   },
  { id: '401', name: 'T Jawaharan',       desig: 'Mech',           gender: 'Male',   cat: 'Mechanic'          },
  { id: '400', name: 'P Govindharaj',     desig: 'Incharge',       gender: 'Male',   cat: 'Staff / Incharge'  },
];

const today = new Date().toISOString().split('T')[0];

// ── Component ────────────────────────────────────────────────────────────────
export default function StanmoreLabourPage() {
  const [tab, setTab] = useState<'daily' | 'employees' | 'wages'>('daily');
  const [reportDate, setReportDate] = useState(today);
  const [supervisor, setSupervisor] = useState('');
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [wages, setWages] = useState<Record<string, number>>(
    Object.fromEntries(WAGE_CATS.map(c => [c, 0]))
  );
  const [attendance, setAttendance] = useState<Record<string, AttRecord>>(
    Object.fromEntries(DEFAULT_EMPLOYEES.map(e => [e.id, { status: 'P', work: '' }]))
  );
  const [pendingWages, setPendingWages] = useState<Record<string, string>>(
    Object.fromEntries(WAGE_CATS.map(c => [c, '0']))
  );

  // ── New employee form ──
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesig, setNewDesig] = useState('Worker');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [newCat, setNewCat] = useState(WAGE_CATS[0]);

  const getWage = (cat: string) => wages[cat] ?? 0;
  const getDays = (status: string) => status === 'P' ? 1 : status === 'H' ? 0.5 : 0;

  const setAtt = useCallback((id: string, field: keyof AttRecord, val: string) => {
    setAttendance(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }, []);

  // ── Summary stats ──
  const stats = employees.reduce((acc, e) => {
    const att = attendance[e.id] ?? { status: 'P', work: '' };
    const days = getDays(att.status);
    if (att.status === 'P') acc.present++;
    else if (att.status === 'H') acc.half++;
    else acc.absent++;
    if (att.status !== 'A') {
      if (e.gender === 'Male') acc.male++; else acc.female++;
    }
    acc.totalDays += days;
    acc.totalCost += days * getWage(e.cat);
    return acc;
  }, { present: 0, half: 0, absent: 0, male: 0, female: 0, totalDays: 0, totalCost: 0 });

  // ── Add employee ──
  const addEmployee = () => {
    if (!newId.trim() || !newName.trim()) return;
    if (employees.find(e => e.id === newId.trim())) {
      alert('Employee ID already exists.'); return;
    }
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
        const att = attendance[e.id] ?? { status: 'P', work: '' };
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

  // ── Shared styles ──
  const inputCls = 'w-full px-3 py-1.5 rounded-md border border-white/20 bg-white/10 text-white text-sm focus:outline-none focus:border-white/50 placeholder:text-white/30';
  const selectCls = 'px-2 py-1 rounded border border-white/20 bg-[#1a3a1a] text-white text-sm focus:outline-none';
  const thCls = 'px-3 py-2.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wider bg-white/5 border-b border-white/10 whitespace-nowrap';
  const tdCls = 'px-3 py-2 border-b border-white/5 text-sm text-white/90';

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Date</label>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
            className={inputCls} style={{ width: 160 }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Supervisor</label>
          <input type="text" value={supervisor} onChange={e => setSupervisor(e.target.value)}
            placeholder="Name" className={inputCls} style={{ width: 160 }} />
        </div>
        <button onClick={exportReport}
          className="ml-auto px-4 py-2 rounded-lg text-sm font-medium transition"
          style={{ background: 'rgba(232,200,74,0.15)', color: '#e8c84a', border: '1px solid rgba(232,200,74,0.3)' }}>
          ↓ Export report
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Present',     val: stats.present },
          { label: 'Half day',    val: stats.half },
          { label: 'Absent',      val: stats.absent },
          { label: 'Male',        val: stats.male },
          { label: 'Female',      val: stats.female },
          { label: 'Total cost',  val: `RM ${stats.totalCost.toFixed(2)}`, highlight: true },
        ].map(({ label, val, highlight }) => (
          <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-xs text-white/50 mb-1">{label}</div>
            <div className={`font-semibold ${highlight ? 'text-base text-yellow-300' : 'text-xl text-white'}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        {(['daily', 'employees', 'wages'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium transition capitalize"
            style={tab === t
              ? { color: '#e8c84a', borderBottom: '2px solid #e8c84a', marginBottom: -1 }
              : { color: 'rgba(255,255,255,0.5)' }}>
            {t === 'daily' ? 'Daily entry' : t === 'employees' ? 'Employees' : 'Wage rates'}
          </button>
        ))}
      </div>

      {/* ── Daily entry tab ── */}
      {tab === 'daily' && (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <table className="w-full min-w-[800px]">
            <thead>
              <tr>
                {['ID', 'Name', 'Desig', 'Gender', 'Category', 'Wage (RM)', 'Status', 'Work assigned', 'Days', 'Cost (RM)'].map(h => (
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const att = attendance[e.id] ?? { status: 'P', work: '' };
                const days = getDays(att.status);
                const cost = days * getWage(e.cat);
                const statusColor = att.status === 'P' ? '#4ade80' : att.status === 'H' ? '#facc15' : '#f87171';
                return (
                  <tr key={e.id} className="hover:bg-white/5 transition">
                    <td className={tdCls} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{e.id}</td>
                    <td className={tdCls} style={{ fontWeight: 500 }}>{e.name}</td>
                    <td className={tdCls} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{e.desig}</td>
                    <td className={tdCls}>
                      <span className="px-2 py-0.5 rounded text-xs font-medium"
                        style={e.gender === 'Male'
                          ? { background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }
                          : { background: 'rgba(236,72,153,0.2)', color: '#f9a8d4' }}>
                        {e.gender === 'Male' ? 'M' : 'F'}
                      </span>
                    </td>
                    <td className={tdCls} style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                      {e.cat.replace('PF Male Worker', 'PF M').replace('PF Female Worker', 'PF F')
                            .replace('Casual Male Worker', 'Cas M').replace('Casual Female Worker', 'Cas F')}
                    </td>
                    <td className={tdCls} style={{ textAlign: 'right' }}>{getWage(e.cat).toFixed(2)}</td>
                    <td className={tdCls}>
                      <select value={att.status} onChange={ev => setAtt(e.id, 'status', ev.target.value)}
                        className={selectCls} style={{ width: 64, color: statusColor }}>
                        <option value="P" style={{ color: '#4ade80' }}>P</option>
                        <option value="H" style={{ color: '#facc15' }}>H</option>
                        <option value="A" style={{ color: '#f87171' }}>A</option>
                      </select>
                    </td>
                    <td className={tdCls}>
                      <select value={att.work} onChange={ev => setAtt(e.id, 'work', ev.target.value)}
                        className={selectCls} style={{ width: '100%', minWidth: 140 }}>
                        <option value="">— select —</option>
                        {WORK_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </td>
                    <td className={tdCls} style={{ textAlign: 'center', color: statusColor }}>{days.toFixed(1)}</td>
                    <td className={tdCls} style={{ textAlign: 'right' }}>{cost.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(232,200,74,0.08)' }}>
                <td colSpan={8} className="px-3 py-2.5 text-sm font-semibold text-right text-white/60">Total</td>
                <td className="px-3 py-2.5 text-sm font-bold text-center text-yellow-300">{stats.totalDays.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-sm font-bold text-right text-yellow-300">{stats.totalCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Employees tab ── */}
      {tab === 'employees' && (
        <div className="space-y-5">
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Add employee</div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Emp ID</label>
                <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="e.g. 530"
                  className={inputCls} style={{ width: 90 }} />
              </div>
              <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 150 }}>
                <label className="text-xs text-white/40">Full name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Employee name"
                  className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Designation</label>
                <select value={newDesig} onChange={e => setNewDesig(e.target.value)} className={selectCls}>
                  {['Worker','Driver','Mistry','Field Asst','Mech','Incharge','Cook','Watchman','Coffee Roaster'].map(d =>
                    <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Gender</label>
                <select value={newGender} onChange={e => setNewGender(e.target.value as 'Male' | 'Female')} className={selectCls}>
                  <option>Male</option><option>Female</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Category</label>
                <select value={newCat} onChange={e => setNewCat(e.target.value)} className={selectCls}>
                  {WAGE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={addEmployee}
                className="px-4 py-2 rounded-lg text-sm font-medium transition self-end"
                style={{ background: 'rgba(232,200,74,0.15)', color: '#e8c84a', border: '1px solid rgba(232,200,74,0.3)' }}>
                + Add
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  {['ID', 'Name', 'Designation', 'Gender', 'Category', 'Daily wage (RM)', ''].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id} className="hover:bg-white/5 transition">
                    <td className={tdCls} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{e.id}</td>
                    <td className={tdCls} style={{ fontWeight: 500 }}>{e.name}</td>
                    <td className={tdCls} style={{ color: 'rgba(255,255,255,0.65)' }}>{e.desig}</td>
                    <td className={tdCls}>
                      <span className="px-2 py-0.5 rounded text-xs font-medium"
                        style={e.gender === 'Male'
                          ? { background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }
                          : { background: 'rgba(236,72,153,0.2)', color: '#f9a8d4' }}>
                        {e.gender}
                      </span>
                    </td>
                    <td className={tdCls} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{e.cat}</td>
                    <td className={tdCls} style={{ textAlign: 'right' }}>{getWage(e.cat).toFixed(2)}</td>
                    <td className={tdCls}>
                      <button onClick={() => removeEmployee(e.id)}
                        className="px-2 py-1 rounded text-xs transition"
                        style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Wage rates tab ── */}
      {tab === 'wages' && (
        <div className="space-y-4" style={{ maxWidth: 480 }}>
          <p className="text-sm text-white/50">Set daily wages per category. Changes apply to all cost calculations when saved.</p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={thCls}>Category</th>
                  <th className={thCls} style={{ textAlign: 'right' }}>Daily wage (RM)</th>
                </tr>
              </thead>
              <tbody>
                {WAGE_CATS.map(cat => (
                  <tr key={cat} className="hover:bg-white/5 transition">
                    <td className={tdCls}>{cat}</td>
                    <td className={tdCls}>
                      <input type="number" min="0" step="0.50"
                        value={pendingWages[cat] ?? '0'}
                        onChange={e => setPendingWages(prev => ({ ...prev, [cat]: e.target.value }))}
                        className="w-28 px-2 py-1 rounded border border-white/20 bg-white/10 text-white text-sm text-right focus:outline-none focus:border-yellow-400/50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={saveWages}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition"
            style={{ background: 'rgba(232,200,74,0.18)', color: '#e8c84a', border: '1px solid rgba(232,200,74,0.35)' }}>
            Save rates
          </button>
        </div>
      )}
    </div>
  );
}
