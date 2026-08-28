'use server'

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase admin env vars')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function adminCreateUser(
  email: string,
  fullName: string,
  roleId: string,
): Promise<{ userId?: string; error?: string }> {
  try {
    const admin = getAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) return { error: error.message }

    const { error: profileError } = await admin.from('users').upsert({
      id: data.user.id,
      full_name: fullName,
      role_id: roleId,
      is_active: true,
    }, { onConflict: 'id' })
    if (profileError) return { error: profileError.message }

    return { userId: data.user.id }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function adminUpdateUser(
  userId: string,
  fullName: string,
  roleId: string,
): Promise<{ error?: string }> {
  try {
    const admin = getAdminClient()
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: fullName },
    })
    if (authError) return { error: authError.message }

    const { error: profileError } = await admin
      .from('users')
      .update({ full_name: fullName, role_id: roleId })
      .eq('id', userId)
    if (profileError) return { error: profileError.message }

    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function adminDeleteUser(userId: string): Promise<{ error?: string }> {
  try {
    const admin = getAdminClient()
    const { error: authError } = await admin.auth.admin.deleteUser(userId)
    if (authError) return { error: authError.message }

    const { error: profileError } = await admin.from('users').delete().eq('id', userId)
    if (profileError) return { error: profileError.message }

    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function adminSetUserActive(
  userId: string,
  active: boolean,
): Promise<{ error?: string }> {
  try {
    const admin = getAdminClient()
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : '876600h',
    })
    if (authError) return { error: authError.message }

    const { error: profileError } = await admin
      .from('users')
      .update({ is_active: active })
      .eq('id', userId)
    if (profileError) return { error: profileError.message }

    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
