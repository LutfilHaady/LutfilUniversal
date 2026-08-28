'use client';
import { useState } from 'react';
import { Shell } from '@/components/shell';
import { IconPlus, IconShield, IconUser } from '@/components/icons';

type Tab = 'Users' | 'Role Permissions' | 'Audit Log' | 'Settings';
const TABS: Tab[] = ['Users', 'Role Permissions', 'Audit Log', 'Settings'];

const USERS = [
  { name: 'Kenji Chen',   staffCode: 'EMP-001', role: 'Engineer',  active: true,  lastLogin: '2026-04-30 09:14' },
  { name: 'L. Tan',       staffCode: 'EMP-002', role: 'Operator',  active: true,  lastLogin: '2026-04-30 07:30' },
  { name: 'R. Mehta',     staffCode: 'EMP-003', role: 'Operator',  active: true,  lastLogin: '2026-04-30 08:50' },
  { name: 'J. Park',      staffCode: 'EMP-004', role: 'Operator',  active: true,  lastLogin: '2026-04-29 19:10' },
  { name: 'Admin User',   staffCode: 'EMP-000', role: 'Admin',     active: true,  lastLogin: '2026-04-30 06:00' },
  { name: 'Former Staff', staffCode: 'EMP-099', role: 'Operator',  active: false, lastLogin: '2026-03-01 14:22' },
];

const ROLE_COLOR: Record<string, string> = { Admin: '#ef4444', Engineer: '#3b82f6', Operator: '#22c55e' };

const AUDIT_LOG = [
  { ts: '2026-04-30 11:42', user: 'K. Chen',   action: 'Submitted QC record',     target: 'MIXC-20260430-A01-03' },
  { ts: '2026-04-30 09:33', user: 'J. Park',   action: 'Placed sub-batch on Hold', target: 'SLIT-20260430-B02-01' },
  { ts: '2026-04-30 09:14', user: 'L. Tan',    action: 'Started process log',      target: 'MIXC-20260430-A01-03' },
  { ts: '2026-04-30 07:01', user: 'System',    action: 'Shift handover completed', target: '—' },
  { ts: '2026-04-30 06:52', user: 'K. Chen',   action: 'Submitted QC record',     target: 'MIXC-20260430-A01-01' },
  { ts: '2026-04-29 22:10', user: 'L. Tan',    action: 'Generated lot',            target: 'L-20260429-010' },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('Users');
  const [actives, setActives] = useState<Record<string, boolean>>(
    Object.fromEntries(USERS.map(u => [u.staffCode, u.active]))
  );

  return (
    <Shell title="Admin" subtitle="/ User management &amp; settings"
      headerActions={tab === 'Users' ? (
        <button className="h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors">
          <IconPlus size={14} /> Add User
        </button>
      ) : undefined}
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        {/* Tab bar */}
        <div className="border-b border-[#2a2a2a] flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={'px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ' +
                (tab === t ? 'border-[#22c55e] text-[#f5f5f5]' : 'border-transparent text-[#888888] hover:text-[#f5f5f5]')}>
              {t}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'Users' && (
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
                {USERS.map(u => (
                  <tr key={u.staffCode} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
                          <IconUser size={13} className="text-[#5a5a5a]" />
                        </div>
                        <span className="text-[12.5px] text-[#f5f5f5]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[12px] text-[#888888]">{u.staffCode}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border"
                        style={{ background: `${ROLE_COLOR[u.role]}15`, color: ROLE_COLOR[u.role], borderColor: `${ROLE_COLOR[u.role]}35` }}>
                        {u.role === 'Admin' && <IconShield size={10} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{u.lastLogin}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setActives(prev => ({ ...prev, [u.staffCode]: !prev[u.staffCode] }))}
                        className={'relative inline-flex h-5 w-9 rounded-full transition-colors ' + (actives[u.staffCode] ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]')}
                      >
                        <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ' + (actives[u.staffCode] ? 'translate-x-4' : 'translate-x-0.5')} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Role Permissions tab */}
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

        {/* Audit Log tab */}
        {tab === 'Audit Log' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Timestamp', 'User', 'Action', 'Target'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {AUDIT_LOG.map((e, i) => (
                  <tr key={i} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-[#5a5a5a]">{e.ts}</td>
                    <td className="px-5 py-3 text-[12px] text-[#888888]">{e.user}</td>
                    <td className="px-5 py-3 text-[12px] text-[#f5f5f5]">{e.action}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-[#93c5fd]">{e.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Settings tab */}
        {tab === 'Settings' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-8 flex flex-col items-center gap-3">
            <div className="text-[#5a5a5a] text-[13px]">System settings</div>
            <div className="text-[12px] text-[#3a3a3a] font-mono">Connect to Supabase to configure</div>
          </div>
        )}

        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>
    </Shell>
  );
}
