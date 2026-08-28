'use client';

import { useState, useEffect, useRef } from 'react';
import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';
import { IconShield, IconCheck, IconCamera } from '@/components/icons';
import { PasscodeWalkthrough } from '@/components/profile/passcode-walkthrough';

const ROLE_COLOURS: Record<string, string> = {
  Admin:    'text-[#a855f7] bg-[rgba(168,85,247,0.12)] border-[rgba(168,85,247,0.3)]',
  Engineer: 'text-[#3b82f6] bg-[rgba(59,130,246,0.12)] border-[rgba(59,130,246,0.3)]',
  Operator: 'text-[#22c55e] bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.3)]',
};

const inputCls =
  'h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] ' +
  'placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors w-full';

export default function ProfilePage() {
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [staffCode, setStaffCode]         = useState<string | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError]     = useState<string | null>(null);
  const [newPw, setNewPw]                 = useState('');
  const [confirmPw, setConfirmPw]         = useState('');
  const [pwError, setPwError]             = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]         = useState(false);
  const [changing, setChanging]           = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('users')
      .select('staff_code')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setStaffCode(data?.staff_code ?? null));
  }, [user?.id]);

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const roleColour = ROLE_COLOURS[user?.role ?? ''] ?? ROLE_COLOURS['Operator'];
  const displayAvatar = localAvatarUrl ?? user?.avatarUrl;

  async function handleAvatarFile(file: File) {
    if (!user?.id) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024)    { setAvatarError('Image must be under 2 MB.'); return; }

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) { setAvatarError(uploadError.message); return; }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: urlWithBust } });
      if (updateError) { setAvatarError(updateError.message); return; }

      setLocalAvatarUrl(urlWithBust);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw.length < 8)    { setPwError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) { setPwError(error.message); return; }
      setPwSuccess(true);
      setNewPw('');
      setConfirmPw('');
    } finally {
      setChanging(false);
    }
  }

  return (
    <Shell title="Profile">
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-[640px] mx-auto flex flex-col gap-5">

          {/* Identity card */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#161616] p-6 flex flex-col items-center gap-3">
            {/* Clickable avatar */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              title="Change profile picture"
              className="relative w-14 h-14 rounded-full group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e]"
            >
              <div className="w-14 h-14 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-[18px] font-semibold font-mono text-[#f5f5f5] overflow-hidden">
                {displayAvatar
                  ? <img src={displayAvatar} alt={user?.name ?? ''} className="w-full h-full object-cover" />
                  : initials}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 group-disabled:opacity-100 transition-opacity">
                {avatarUploading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <IconCamera size={16} className="text-white" />}
              </div>
            </button>
            {avatarError && (
              <p className="text-[11.5px] text-red-400 text-center max-w-[260px]">{avatarError}</p>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-[17px] font-semibold text-[#f5f5f5]">{user?.name ?? '—'}</p>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${roleColour}`}>
                {user?.role ?? '—'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 pt-1 border-t border-[#2a2a2a] w-full mt-1">
              <p className="text-[13px] text-[#888888]">{user?.email ?? '—'}</p>
              <p className="text-[12px] font-mono text-[#5a5a5a]">
                {staffCode === null ? '—' : staffCode || '—'}
              </p>
            </div>
          </div>

          {/* Security card */}
          <div id="security" className="rounded-xl border border-[#2a2a2a] bg-[#161616] scroll-mt-6">
            {/* Card header */}
            <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center gap-2">
              <IconShield size={16} className="text-[#22c55e]" />
              <span className="text-[14px] font-semibold text-[#f5f5f5]">Security</span>
            </div>

            {/* Change password */}
            <div className="px-6 py-5 border-b border-[#2a2a2a]">
              <p className="text-[13px] font-semibold text-[#f5f5f5]">Change password</p>
              <p className="text-[12px] text-[#888888] mt-1">
                You&apos;re currently signed in as {user?.email ?? '—'}.
              </p>
              <form onSubmit={handleChangePw} className="flex flex-col gap-3 mt-4">
                <div>
                  <label htmlFor="new-pw" className="block text-[12px] text-[#888888] mb-1.5">
                    New password
                  </label>
                  <input
                    id="new-pw"
                    type="password"
                    placeholder="New password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    className={inputCls}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-pw" className="block text-[12px] text-[#888888] mb-1.5">
                    Confirm password
                  </label>
                  <input
                    id="confirm-pw"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className={inputCls}
                    autoComplete="new-password"
                  />
                </div>

                {pwError && (
                  <div className="rounded-md bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-3 py-2 text-[12px] text-[#ef4444]">
                    {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div className="rounded-md bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] px-3 py-2 text-[12px] text-[#22c55e] flex items-center gap-2">
                    <IconCheck size={13} />
                    Password updated successfully.
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={changing || !newPw || !confirmPw}
                    className="h-9 px-4 rounded-md bg-[#22c55e] text-[#0a0a0a] text-[13px] font-semibold hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
                  >
                    {changing ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              </form>
            </div>

            {/* Passcode walkthrough */}
            <div className="px-6 py-5">
              <p className="text-[13px] font-semibold text-[#f5f5f5]">Login passcode setup</p>
              <p className="text-[12px] text-[#888888] mt-1">
                New to the system? Use the guided walkthrough to set your login passcode.
              </p>
              <button
                onClick={() => setShowWalkthrough(true)}
                className="mt-3 h-9 px-4 rounded-md border border-[#2a2a2a] bg-transparent text-[#f5f5f5] text-[13px] hover:bg-[#1e1e1e] transition-colors"
              >
                Start walkthrough →
              </button>
            </div>
          </div>

        </div>
      </main>

      {showWalkthrough && (
        <PasscodeWalkthrough onClose={() => setShowWalkthrough(false)} />
      )}
    </Shell>
  );
}
