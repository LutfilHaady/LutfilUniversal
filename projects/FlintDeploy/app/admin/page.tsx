"use client";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { IconPlus, IconShield, IconUser } from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import supabase from "@/lib/supabase";
import { AlertRulesPanel } from "@/components/admin/alert-rules-panel";
import {
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminSetUserActive,
  adminResetPassword,
} from "@/app/actions/admin-users";

type Tab = "Users" | "Role Permissions" | "Audit Log" | "Settings";
const TABS: Tab[] = ["Users", "Role Permissions", "Audit Log", "Settings"];

type UserRow = { id: string; name: string; staffCode: string; roleId: string; role: string; active: boolean; lastLogin: string };

const ROLE_COLOR: Record<string, string> = { Admin: "#ef4444", Engineer: "#3b82f6", Operator: "#22c55e" };

interface AuditRow {
  event_type: string;
  batch_number: string | null;
  from_value: string | null;
  to_value: string | null;
  reason: string | null;
  user_name: string | null;
  created_at: string;
}

function formatAuditAction(row: AuditRow): string {
  if (row.event_type === "status_change") return `Status: ${row.from_value ?? "—"} → ${row.to_value ?? "—"}`;
  if (row.event_type === "qc_override") return `QC override: ${row.from_value ?? "Failed"} → ${row.to_value ?? "Passed"}`;
  return row.event_type;
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ` +
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Users");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Roles for selectors
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  // Add User modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Reset Password modal state
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [resetPwUserName, setResetPwUserName] = useState('');
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwError, setResetPwError] = useState<string | null>(null);
  const [resetPwSuccess, setResetPwSuccess] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);

  // Audit state (loaded from Supabase)
  const [auditRows, setAuditRows] = useState<AuditRow[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Audit filters
  const [userQuery, setUserQuery] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDay, setFilterDay] = useState("");

  // Audit date range — server-side filter, defaults to the last 30 days
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo]     = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    supabase.from('roles').select('id, name').then(({ data }) => {
      const r = data ?? [];
      setRoles(r);
      if (r.length > 0) setNewRoleId(r[0].id);
    });
  }, []);

  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, staff_code, role_id, is_active, roles(name)')
          .order('full_name');
        if (error) { setUsersError(error.message); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setUsers((data ?? []).map((u: any) => ({
          id: u.id,
          name: u.full_name ?? '—',
          staffCode: u.staff_code ?? 'ID not available',
          roleId: u.role_id ?? '',
          role: (Array.isArray(u.roles) ? u.roles[0]?.name : u.roles?.name) ?? 'Operator',
          active: u.is_active ?? true,
          lastLogin: '—',
        })));
      } finally {
        setUsersLoading(false);
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    if (tab !== "Audit Log") return;
    let cancelled = false;
    async function load() {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const { data, error } = await supabase
          .from("audit_log")
          .select("event_type, batch_number, from_value, to_value, reason, user_name, created_at")
          .gte("created_at", dateFrom)
          .lte("created_at", dateTo + "T23:59:59")
          .order("created_at", { ascending: false })
          .limit(200);
        if (cancelled) return;
        if (error) { setAuditError(error.message); return; }
        setAuditRows((data as AuditRow[]) ?? []);
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tab, dateFrom, dateTo]);

  const filteredAudit = useMemo(() => {
    if (!auditRows) return [] as AuditRow[];
    return auditRows.filter(e => {
      const userName = (e.user_name ?? "").toLowerCase();
      if (userQuery && !userName.includes(userQuery.toLowerCase())) return false;
      const actionText = formatAuditAction(e).toLowerCase();
      if (actionQuery && !actionText.includes(actionQuery.toLowerCase())) return false;
      const d = new Date(e.created_at);
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      if (filterYear && y !== filterYear) return false;
      if (filterMonth && m !== filterMonth) return false;
      if (filterDay && dd !== filterDay) return false;
      return true;
    });
  }, [auditRows, userQuery, actionQuery, filterYear, filterMonth, filterDay]);

  if (!user || user.role !== "Admin") {
    return (
      <Shell title="Admin" subtitle="/ User management & settings">
        <main className="flex-1 min-h-0 px-6 py-5 flex items-center justify-center">
          <div className="text-[13px] text-[#5a5a5a]">Access restricted — Admin only.</div>
        </main>
      </Shell>
    );
  }

  async function handleAddUser() {
    if (!newEmail.trim() || !newFullName.trim() || !newRoleId) return;
    setAddLoading(true);
    setAddError(null);
    const result = await adminCreateUser(newEmail.trim(), newFullName.trim(), newRoleId);
    if (result.error) { setAddError(result.error); setAddLoading(false); return; }
    setShowAddModal(false);
    setNewEmail(""); setNewFullName("");
    const { data } = await supabase.from('users').select('id, full_name, staff_code, role_id, is_active, roles(name)').order('full_name');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUsers((data ?? []).map((u: any) => ({
      id: u.id, name: u.full_name ?? '—', staffCode: u.staff_code ?? 'ID not available',
      roleId: u.role_id ?? '', role: (Array.isArray(u.roles) ? u.roles[0]?.name : u.roles?.name) ?? 'Operator', active: u.is_active ?? true, lastLogin: '—',
    })));
    setAddLoading(false);
  }

  async function handleSaveUser(u: UserRow) {
    setActionError(null);
    const result = await adminUpdateUser(u.id, editName, editRoleId);
    if (result.error) { setActionError(result.error); return; }
    const roleName = roles.find(r => r.id === editRoleId)?.name ?? u.role;
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, name: editName, role: roleName, roleId: editRoleId } : x));
    setEditingId(null);
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!confirm(`Delete user ${name}? This cannot be undone.`)) return;
    setActionError(null);
    const result = await adminDeleteUser(userId);
    if (result.error) { setActionError(result.error); return; }
    setUsers(prev => prev.filter(x => x.id !== userId));
  }

  async function handleToggleActive(userId: string, currentActive: boolean) {
    setUsers(prev => prev.map(x => x.id === userId ? { ...x, active: !currentActive } : x));
    const result = await adminSetUserActive(userId, !currentActive);
    if (result.error) {
      setUsers(prev => prev.map(x => x.id === userId ? { ...x, active: currentActive } : x));
      setActionError(result.error);
    }
  }

  async function handleResetPassword() {
    if (!resetPwUserId) return;
    if (resetPwValue.length < 8) { setResetPwError('Password must be at least 8 characters'); return; }
    setResetPwLoading(true);
    setResetPwError(null);
    const result = await adminResetPassword(resetPwUserId, resetPwValue);
    setResetPwLoading(false);
    if (result.error) { setResetPwError(result.error); return; }
    setResetPwSuccess(true);
    setResetPwValue('');
  }

  return (
    <Shell title="Admin" subtitle="/ User management & settings"
      headerActions={tab === "Users" ? (
        <button onClick={() => setShowAddModal(true)} className="h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors">
          <IconPlus size={14} /> Add User
        </button>
      ) : undefined}
    >
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111] border border-[#2a2a2a] rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-[15px] font-semibold text-[#f5f5f5]">Add User</div>
            <div className="flex flex-col gap-3">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" className="h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] outline-none focus:border-[#22c55e]" />
              <input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Full name" className="h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] outline-none focus:border-[#22c55e]" />
              <select value={newRoleId} onChange={e => setNewRoleId(e.target.value)} className="h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] outline-none focus:border-[#22c55e]">
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {addError && <div className="text-[12px] text-[#fca5a5]">{addError}</div>}
            <div className="flex gap-2 mt-1">
              <button onClick={() => { setShowAddModal(false); setAddError(null); }} className="flex-1 h-10 rounded-xl border border-[#2a2a2a] text-[13px] text-[#888888]">Cancel</button>
              <button onClick={handleAddUser} disabled={addLoading || !newEmail.trim() || !newFullName.trim()} className="flex-1 h-10 rounded-xl bg-[#22c55e] text-[13px] font-semibold text-black disabled:opacity-40">
                {addLoading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetPwUserId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111] border border-[#2a2a2a] rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-[15px] font-semibold text-[#f5f5f5]">Reset password for {resetPwUserName}</div>
            <div className="flex flex-col gap-3">
              <label htmlFor="reset-pw" className="text-[12px] text-[#888888]">New Password</label>
              <input
                id="reset-pw"
                type="password"
                value={resetPwValue}
                onChange={e => setResetPwValue(e.target.value)}
                placeholder="Enter new password (min 8 chars)"
                className="h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] outline-none focus:border-[#22c55e]"
              />
            </div>
            {resetPwError && <div className="text-[12px] text-[#fca5a5]">{resetPwError}</div>}
            {resetPwSuccess && <div className="text-[12px] text-[#22c55e]">Password has been reset successfully.</div>}
            <div className="flex gap-2 mt-1">
              <button onClick={() => setResetPwUserId(null)} className="flex-1 h-10 rounded-xl border border-[#2a2a2a] text-[13px] text-[#888888]">Cancel</button>
              <button
                onClick={handleResetPassword}
                disabled={resetPwLoading || !resetPwValue || resetPwSuccess}
                className="flex-1 h-10 rounded-xl bg-[#22c55e] text-[13px] font-semibold text-black disabled:opacity-40"
              >
                {resetPwLoading ? 'Resetting…' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        <div className="border-b border-[#2a2a2a] flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={'px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ' +
                (tab === t ? 'border-[#22c55e] text-[#f5f5f5]' : 'border-transparent text-[#888888] hover:text-[#f5f5f5]')}>{t}
            </button>
          ))}
        </div>

        {tab === 'Users' && (
          <div className="flex flex-col gap-3">
            {actionError && (
              <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-4 py-2.5 text-[12px] text-[#fca5a5]">{actionError}</div>
            )}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {['Name', 'Staff Code', 'Role', 'Last Login', 'Active'].map(h => (
                      <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {usersLoading ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-[12px] font-mono text-[#5a5a5a]">Loading…</td></tr>
                  ) : usersError ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-[12px] font-mono text-[#fca5a5]">{usersError}</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-[12px] font-mono text-[#5a5a5a]">No users found.</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="hover:bg-[#141414] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
                            <IconUser size={13} className="text-[#5a5a5a]" />
                          </div>
                          {editingId === u.id ? (
                            <div className="flex items-center gap-2">
                              <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-transparent border-b border-[#2a2a2a] text-[12.5px] text-[#f5f5f5] px-1" />
                              <button onClick={() => handleSaveUser(u)} className="text-[12px] text-[#22c55e]">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-[12px] text-[#888888]">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] text-[#f5f5f5]">{u.name}</span>
                              <button onClick={() => { setEditingId(u.id); setEditName(u.name); setEditRoleId(u.roleId); setActionError(null); }} className="text-[12px] text-[#888888]">Edit</button>
                              <button onClick={() => { setResetPwUserId(u.id); setResetPwUserName(u.name); setResetPwValue(''); setResetPwError(null); setResetPwSuccess(false); }} className="text-[12px] text-[#888888] hover:text-[#f5f5f5]">Reset Password</button>
                              <button onClick={() => handleDeleteUser(u.id, u.name)} className="text-[12px] text-red-400 ml-2">×</button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] text-[#888888]">{u.staffCode}</td>
                      <td className="px-5 py-3">
                        {editingId === u.id ? (
                          <select value={editRoleId} onChange={e => setEditRoleId(e.target.value)} className="h-7 px-2 bg-transparent border border-[#2a2a2a] rounded text-[12px] text-[#f5f5f5]">
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border" style={{ background: `${ROLE_COLOR[u.role]}15`, color: ROLE_COLOR[u.role], borderColor: `${ROLE_COLOR[u.role]}35` }}>
                            {u.role === 'Admin' && <IconShield size={10} />}
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{u.lastLogin}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleToggleActive(u.id, u.active)} className={'relative inline-flex h-5 w-9 rounded-full transition-colors ' + (u.active ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]')}>
                          <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ' + (u.active ? 'translate-x-4' : 'translate-x-0.5')} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Role Permissions' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2a2a2a] text-[13px] font-semibold text-[#f5f5f5]">Role Permission Matrix</div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">Permission</th>
                  {['Operator', 'Engineer', 'Admin'].map(r => (
                    <th key={r} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-center" style={{ color: ROLE_COLOR[r] }}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {[
                  { perm: 'View batches & lots', op: true, eng: true, adm: true },
                  { perm: 'Log process steps', op: true, eng: true, adm: true },
                  { perm: 'Log QC records', op: true, eng: true, adm: true },
                  { perm: 'Override QC verdict', op: false, eng: true, adm: true },
                  { perm: 'Generate lots', op: false, eng: true, adm: true },
                  { perm: 'Run recall investigation', op: false, eng: true, adm: true },
                  { perm: 'Manage recipes', op: false, eng: false, adm: true },
                  { perm: 'Manage users', op: false, eng: false, adm: true },
                ].map(row => (
                  <tr key={row.perm} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-2.5 text-[12px] text-[#888888]">{row.perm}</td>
                    {[row.op, row.eng, row.adm].map((allowed, i) => (
                      <td key={i} className="px-5 py-2.5 text-center">
                        <span className={'text-[14px] ' + (allowed ? 'text-[#22c55e]' : 'text-[#3a3a3a]')}>{allowed ? '✓' : '—'}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Audit Log' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#888888]">User</label>
                <input placeholder="Search user..." value={userQuery} onChange={e => setUserQuery(e.target.value)} className="h-8 px-2 bg-transparent border border-[#2a2a2a] rounded text-[13px] text-[#f5f5f5]" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#888888]">Action</label>
                <input placeholder="Search action..." value={actionQuery} onChange={e => setActionQuery(e.target.value)} className="h-8 px-2 bg-transparent border border-[#2a2a2a] rounded text-[13px] text-[#f5f5f5]" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#888888]">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 px-2 bg-transparent border border-[#2a2a2a] rounded text-[13px] text-[#f5f5f5]" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#888888]">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 px-2 bg-transparent border border-[#2a2a2a] rounded text-[13px] text-[#f5f5f5]" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#888888]">Year</label>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="h-8 px-2 bg-transparent border border-[#2a2a2a] rounded text-[13px] text-[#f5f5f5]">
                  <option value="">All</option>
                  {Array.from(new Set((auditRows ?? []).map(x => String(new Date(x.created_at).getFullYear())))).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#888888]">Month</label>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="h-8 px-2 bg-transparent border border-[#2a2a2a] rounded text-[13px] text-[#f5f5f5]">
                  <option value="">All</option>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[#888888]">Day</label>
                <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="h-8 px-2 bg-transparent border border-[#2a2a2a] rounded text-[13px] text-[#f5f5f5]">
                  <option value="">All</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="ml-auto">
                <button onClick={() => { setUserQuery(''); setActionQuery(''); setFilterYear(''); setFilterMonth(''); setFilterDay(''); setDateFrom(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)); setDateTo(new Date().toISOString().slice(0, 10)); }} className="h-8 px-3 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888]">Clear</button>
              </div>
            </div>

            {auditLoading && (
              <div className="px-5 py-6 text-[12px] text-[#5a5a5a] font-mono">Loading…</div>
            )}
            {auditError && (
              <div className="px-5 py-4 text-[12px] font-mono text-[#fca5a5]">{auditError}</div>
            )}
            {!auditLoading && !auditError && (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {['Timestamp', 'User', 'Action', 'Target', 'Reason'].map(h => (
                      <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {(filteredAudit ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[12px] text-[#5a5a5a] font-mono">No audit events yet — batch status changes and QC overrides will appear here.</td>
                    </tr>
                  ) : (filteredAudit ?? []).map((e, i) => (
                    <tr key={i} className="hover:bg-[#141414] transition-colors">
                      <td className="px-5 py-3 font-mono text-[12px] text-[#5a5a5a] whitespace-nowrap">{formatTs(e.created_at)}</td>
                      <td className="px-5 py-3 text-[12px] text-[#888888]">{e.user_name ?? '—'}</td>
                      <td className="px-5 py-3 text-[12px] text-[#f5f5f5]">{formatAuditAction(e)}</td>
                      <td className="px-5 py-3 font-mono text-[12px] text-[#93c5fd]">{e.batch_number ?? '—'}</td>
                      <td className="px-5 py-3 text-[12px] text-[#5a5a5a]">{e.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Settings' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a2a] text-[13px] font-semibold text-[#f5f5f5]">Instance Configuration</div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {['Factory Name', 'Time Zone', 'Batch ID Format'].map(label => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12.5px] text-[#888888]">{label}</span>
                    <div className="h-8 w-48 rounded-md bg-[#1a1a1a] border border-[#2a2a2a]" />
                  </div>
                ))}
              </div>
            </div>
            <AlertRulesPanel />
            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a2a] text-[13px] font-semibold text-[#f5f5f5]">Data Retention</div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {['Audit Log Retention', 'Process Run History', 'Archived Batch Records'].map(label => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12.5px] text-[#888888]">{label}</span>
                    <div className="h-8 w-32 rounded-md bg-[#1a1a1a] border border-[#2a2a2a]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>
    </Shell>
  );
}
