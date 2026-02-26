/**
 * Supabase Client Service
 * Gestisce autenticazione e database per ADBZero
 */

import { createClient, type User, type Session } from '@supabase/supabase-js'
import { validatePackageName, validateTextInput } from './command-sanitizer'

// Configurazione Supabase - Da sostituire con le tue credenziali
// Crea un progetto su https://supabase.com e copia URL e anon key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vlhrvpxlutozimawxpkc.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DMZV6IXob_9ilORZIrymGg_fGCojBk2'

// Verifica se Supabase è configurato correttamente
// Le chiavi possono essere JWT (eyJ...) o publishable (sb_publishable_...)
export const isSupabaseConfigured =
  (SUPABASE_ANON_KEY.startsWith('eyJ') || SUPABASE_ANON_KEY.startsWith('sb_')) &&
  !SUPABASE_URL.includes('your-project')

// Client Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ============================================
// TYPES
// ============================================

export interface Device {
  id: string
  manufacturer: string
  model: string
  android_version: string | null
  api_level: number | null
  fingerprint: string
  created_at: string
}

export interface DiscoveredPackage {
  id: string
  package_name: string
  device_id: string
  is_system: boolean
  apk_path: string | null
  suggested_category: string | null
  suggested_removal_level: string | null
  votes_safe: number
  votes_unsafe: number
  created_at: string
}

export interface UserAction {
  id: string
  user_id: string
  device_id: string
  package_name: string
  action: 'disable' | 'enable' | 'uninstall' | 'reinstall'
  created_at: string
}

export interface DegoogleProfile {
  id: string
  user_id: string
  device_id: string
  level: 'essential' | 'low' | 'medium' | 'high' | 'total'
  packages_removed: string[]
  created_at: string
}

export interface DebloatList {
  id: string
  user_id: string
  nickname: string
  title: string
  description: string | null
  is_public: boolean
  device_model: string | null
  device_manufacturer: string | null
  total_votes: number
  items_count: number
  created_at: string
  updated_at: string
  user_vote?: number // Virtual field for the current user's vote
}

export interface DebloatListItem {
  id: string
  list_id: string
  package_name: string
  label: string | null
  description: string | null
  level: 'Recommended' | 'Advanced' | 'Expert' | 'Unsafe'
  created_at: string
}

export interface DebloatComment {
  id: string
  list_id: string
  user_id: string | null
  parent_id: string | null
  nickname: string
  content: string
  total_votes: number
  created_at: string
  user_vote?: number
}

export interface MobileAudit {
  id: string
  user_id: string
  device_model: string
  manifest_data: any
  is_executed: boolean
  created_at: string
}

// ============================================
// DATABASE FUNCTIONS - DEVICES
// ============================================

/**
 * Registra un nuovo utente con email, password e nickname
 */
export async function signUp(email: string, password: string, nickname: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname: nickname
      }
    }
  })
  if (error) throw error
  return data
}

/**
 * Verifica se un nickname è disponibile chiamando l'RPC nel database
 */
export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  if (!nickname || nickname.length < 3) return false

  const { data, error } = await supabase.rpc('check_nickname_available', {
    p_nickname: nickname
  })

  if (error) {
    console.error('Error checking nickname availability:', error)
    return false
  }

  return !!data
}

/**
 * Login con email e password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Login con provider OAuth (Google, GitHub, etc.)
 */
export async function signInWithOAuth(provider: 'google' | 'github') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
  })
  if (error) throw error
  return data
}

/**
 * Logout
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Ottiene la sessione corrente
 */
export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Ottiene l'utente corrente
 */
export async function getUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Reset password via email
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  if (error) throw error
}

// ============================================
// DEVICE FUNCTIONS
// ============================================

/**
 * Genera un fingerprint unico per il dispositivo
 */
export function generateDeviceFingerprint(
  manufacturer: string,
  model: string,
  serialNumber: string
): string {
  // Rimuoviamo androidVersion per mantenere il fingerprint costante dopo gli aggiornamenti
  return `${manufacturer}:${model}:${serialNumber}`.toLowerCase()
}

/**
 * Registra o trova un dispositivo
 */
export async function upsertDevice(device: Omit<Device, 'id' | 'created_at'>): Promise<Device> {
  const { data, error } = await supabase
    .from('devices')
    .upsert(device, { onConflict: 'fingerprint' })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Ottiene un dispositivo per fingerprint
 */
export async function getDeviceByFingerprint(fingerprint: string): Promise<Device | null> {
  const { data, error } = await supabase
    .from('devices')
    .select()
    .eq('fingerprint', fingerprint)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

/**
 * Ottiene tutti i dispositivi dell'utente (basato sulle azioni)
 */
export async function getUserDevices(userId: string): Promise<Device[]> {
  const { data, error } = await supabase
    .from('user_actions')
    .select('device_id')
    .eq('user_id', userId)

  if (error) throw error

  const deviceIds = [...new Set(data.map(a => a.device_id))]

  if (deviceIds.length === 0) return []

  const { data: devices, error: devError } = await supabase
    .from('devices')
    .select()
    .in('id', deviceIds)

  if (devError) throw devError
  return devices || []
}

// ============================================
// PACKAGE FUNCTIONS
// ============================================

/**
 * Registra pacchetti scoperti (bulk)
 */
export async function uploadDiscoveredPackages(
  packages: Array<{
    package_name: string
  }>
): Promise<void> {
  // Sanitize input to ensure only valid columns are sent (defensive coding)
  const sanitizedPackages = packages.map(p => ({
    package_name: p.package_name
    // is_system removed as it does not exist in the DB schema
  }))

  const { error } = await supabase
    .from('uad_packages')
    .upsert(sanitizedPackages, {
      onConflict: 'package_name',
      ignoreDuplicates: true
    })

  if (error) throw error
}

/**
 * Ottiene pacchetti scoperti dalla community
 */
export async function getCommunityPackages(): Promise<DiscoveredPackage[]> {
  const { data, error } = await supabase
    .from('uad_packages')
    .select()
    .order('votes_safe', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Vota un pacchetto come safe o unsafe
 */
export async function votePackage(
  packageName: string,
  voteType: 'safe' | 'unsafe'
): Promise<void> {
  // Validate inputs
  const validatedPackage = validatePackageName(packageName)

  // Whitelist for vote types
  if (voteType !== 'safe' && voteType !== 'unsafe') {
    throw new Error('Invalid vote type')
  }

  const column = voteType === 'safe' ? 'votes_safe' : 'votes_unsafe'

  const { error } = await supabase.rpc('increment_vote', {
    p_package_name: validatedPackage,
    p_column: column
  })

  if (error) throw error
}

// Whitelist of allowed categories and removal levels
const ALLOWED_CATEGORIES = [
  'system', 'google', 'carrier', 'oem', 'misc', 'game', 'social', 'media', 'utility', 'other'
] as const

const ALLOWED_REMOVAL_LEVELS = [
  'Recommended', 'Advanced', 'Expert', 'Unsafe'
] as const

/**
 * Suggerisci categoria/livello per un pacchetto
 */
export async function suggestPackageInfo(
  packageName: string,
  category: string,
  removalLevel: string
): Promise<void> {
  // Validate package name
  const validatedPackage = validatePackageName(packageName)

  // Validate category against whitelist
  const trimmedCategory = validateTextInput(category, 'Category', 50, 1)
  if (!ALLOWED_CATEGORIES.includes(trimmedCategory as typeof ALLOWED_CATEGORIES[number])) {
    throw new Error(`Invalid category: "${trimmedCategory}". Allowed: ${ALLOWED_CATEGORIES.join(', ')}`)
  }

  // Validate removal level against whitelist
  const trimmedLevel = validateTextInput(removalLevel, 'Removal level', 50, 1)
  if (!ALLOWED_REMOVAL_LEVELS.includes(trimmedLevel as typeof ALLOWED_REMOVAL_LEVELS[number])) {
    throw new Error(`Invalid removal level: "${trimmedLevel}". Allowed: ${ALLOWED_REMOVAL_LEVELS.join(', ')}`)
  }

  const { error } = await supabase
    .from('uad_packages')
    .update({
      suggested_category: trimmedCategory,
      suggested_removal_level: trimmedLevel
    })
    .eq('package_name', validatedPackage)

  if (error) throw error
}

// ============================================
// USER ACTIONS FUNCTIONS
// ============================================

/**
 * Registra un'azione dell'utente e incrementa le statistiche del pacchetto
 */
export async function logUserAction(
  userId: string,
  deviceId: string,
  packageName: string,
  action: UserAction['action']
): Promise<void> {
  // 1. Logga l'azione
  const { error } = await supabase
    .from('user_actions')
    .insert({
      user_id: userId,
      device_id: deviceId,
      package_name: packageName,
      action
    })

  if (error) throw error

  // 2. Incrementa statistiche nel database globale
  await incrementPackageStat(packageName, action === 'disable' ? 'times_disabled' : 'times_enabled')
}

// Whitelist of allowed stat columns
const ALLOWED_STAT_COLUMNS = ['times_found', 'times_disabled', 'times_enabled'] as const
type StatColumn = typeof ALLOWED_STAT_COLUMNS[number]

/**
 * Incrementa un contatore per un pacchetto (times_found, times_disabled, etc.)
 */
export async function incrementPackageStat(
  packageName: string,
  column: StatColumn
): Promise<void> {
  try {
    // Validate package name
    const validatedPackage = validatePackageName(packageName)

    // Validate column against whitelist (TypeScript already enforces this, but double-check at runtime)
    if (!ALLOWED_STAT_COLUMNS.includes(column)) {
      throw new Error(`Invalid stat column: "${column}"`)
    }

    // Usiamo una RPC se disponibile, altrimenti un update diretto (meno preciso ma funzionante)
    // Se hai creato la funzione SQL increment_package_stat, usala:
    const { error } = await supabase.rpc('increment_package_stat', {
      p_package_name: validatedPackage,
      p_column: column
    })

    if (error) {
      // Fallback: aggiornamento diretto se la RPC fallisce (es. non esiste)
      const { data: current } = await supabase
        .from('uad_packages')
        .select(column)
        .eq('package_name', validatedPackage)
        .single()

      if (current) {
        const val = (current as Record<string, number>)[column] || 0
        await supabase
          .from('uad_packages')
          .update({ [column]: val + 1 })
          .eq('package_name', validatedPackage)
      }
    }
  } catch (e) {
    console.warn(`Failed to increment stat ${column} for ${packageName}:`, e)
  }
}

/**
 * Ottiene lo storico azioni per un dispositivo
 */
export async function getDeviceActions(
  userId: string,
  deviceId: string
): Promise<UserAction[]> {
  const { data, error } = await supabase
    .from('user_actions')
    .select()
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Ottiene tutte le azioni dell'utente
 */
export async function getAllUserActions(userId: string): Promise<UserAction[]> {
  const { data, error } = await supabase
    .from('user_actions')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Ottiene i pacchetti che erano stati rimossi ma ora sono ritornati (abilitati)
 */
export async function getReturnedPackages(
  userId: string,
  deviceId: string,
  currentEnabledPackages: string[]
): Promise<string[]> {
  // 1. Ottieni tutte le azioni dell'utente per questo dispositivo
  const { data: actions, error } = await supabase
    .from('user_actions')
    .select('package_name, action')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })

  if (error) throw error

  // 2. Determina l'ultimo stato voluto per ogni pacchetto
  const intendedDisabled = new Set<string>()
  const processed = new Set<string>()

  for (const action of (actions || [])) {
    if (!processed.has(action.package_name)) {
      processed.add(action.package_name)
      if (action.action === 'disable' || action.action === 'uninstall') {
        intendedDisabled.add(action.package_name)
      }
    }
  }

  // 3. Trova i pacchetti che dovrebbero essere disabilitati ma sono nella lista di quelli abilitati
  return currentEnabledPackages.filter(pkg => intendedDisabled.has(pkg))
}

// ============================================
// DEGOOGLE PROFILES FUNCTIONS
// ============================================

/**
 * Salva un profilo de-googling
 */
export async function saveDegoogleProfile(
  userId: string,
  deviceId: string,
  level: DegoogleProfile['level'],
  packagesRemoved: string[]
): Promise<void> {
  const { error } = await supabase
    .from('degoogle_profiles')
    .insert({
      user_id: userId,
      device_id: deviceId,
      level,
      packages_removed: packagesRemoved
    })

  if (error) throw error
}

/**
 * Ottiene profili de-googling per dispositivo
 */
export async function getDegoogleProfiles(
  userId: string,
  deviceId?: string
): Promise<DegoogleProfile[]> {
  let query = supabase
    .from('degoogle_profiles')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (deviceId) {
    query = query.eq('device_id', deviceId)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Sottoscrivi a cambiamenti auth
 */
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback)
}

// ============================================
// FEEDBACK / SUGGESTIONS
// ============================================

export interface Suggestion {
  id: string
  user_id: string
  subject: string
  message: string
  created_at: string
}

/**
 * Invia una proposta di miglioramento
 */
export async function sendSuggestion(
  userId: string,
  subject: string,
  message: string
): Promise<void> {
  // Input validation
  const trimmedSubject = subject.trim()
  const trimmedMessage = message.trim()

  if (!trimmedSubject || trimmedSubject.length > 200) {
    throw new Error('Subject must be between 1 and 200 characters')
  }
  if (!trimmedMessage || trimmedMessage.length > 5000) {
    throw new Error('Message must be between 1 and 5000 characters')
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID')
  }

  const { error } = await supabase
    .from('suggestions')
    .insert({
      user_id: userId,
      subject: trimmedSubject,
      message: trimmedMessage
    })

  if (error) throw error
}

// ============================================
// DEBLOAT LISTS FUNCTIONS
// ============================================

/**
 * Crea una nuova lista di debloating
 */
export async function createDebloatList(
  userId: string,
  nickname: string,
  title: string,
  description: string | null,
  isPublic: boolean,
  items: Array<Omit<DebloatListItem, 'id' | 'list_id' | 'created_at'>>,
  deviceModel?: string | null,
  deviceManufacturer?: string | null
): Promise<DebloatList> {
  const { data: list, error: listError } = await supabase
    .from('debloat_lists')
    .insert({
      user_id: userId,
      nickname,
      title,
      description,
      is_public: isPublic,
      device_model: deviceModel,
      device_manufacturer: deviceManufacturer
    })
    .select()
    .single()

  if (listError) throw listError

  if (items.length > 0) {
    const listItems = items.map(item => ({
      ...item,
      list_id: list.id
    }))

    const { error: itemsError } = await supabase
      .from('debloat_list_items')
      .insert(listItems)

    if (itemsError) throw itemsError
  }

  return list
}

/**
 * Ottiene le liste pubbliche della community, ordinate per voti
 */
export async function getCommunityDebloatLists(userId?: string): Promise<DebloatList[]> {
  // Se l'utente è loggato, mostriamo le liste pubbliche + le SUE liste (anche se private)
  let query = supabase
    .from('debloat_lists')
    .select('*, debloat_list_votes(vote)')

  if (userId) {
    query = query.or(`is_public.eq.true,user_id.eq.${userId}`)
  } else {
    query = query.eq('is_public', true)
  }

  const { data, error } = await query.order('total_votes', { ascending: false })

  if (error) throw error

  // Calculate user_vote from the joined table if userId is provided
  return (data || []).map(list => ({
    ...list,
    user_vote: (list.debloat_list_votes as any[])?.find((v: any) => v.user_id === userId)?.vote || 0
  }))
}

/**
 * Ottiene le liste private dell'utente
 */
export async function getMyDebloatLists(userId: string): Promise<DebloatList[]> {
  const { data, error } = await supabase
    .from('debloat_lists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Carica i dettagli di una lista (inclusi gli item)
 */
export async function getDebloatListDetails(listId: string): Promise<{ list: DebloatList, items: DebloatListItem[] }> {
  const { data: list, error: listError } = await supabase
    .from('debloat_lists')
    .select('*')
    .eq('id', listId)
    .single()

  if (listError) throw listError

  const { data: items, error: itemsError } = await supabase
    .from('debloat_list_items')
    .select('*')
    .eq('list_id', listId)

  if (itemsError) throw itemsError

  return { list, items: items || [] }
}

/**
 * Vota una lista (Reddit-style: 1, -1, 0 per rimuovere il voto)
 */
export async function voteDebloatList(
  userId: string,
  listId: string,
  vote: 1 | -1 | 0
): Promise<void> {
  if (vote === 0) {
    // Delete existing vote
    const { error } = await supabase
      .from('debloat_list_votes')
      .delete()
      .eq('user_id', userId)
      .eq('list_id', listId)

    if (error) throw error
  } else {
    // Upsert vote
    const { error } = await supabase
      .from('debloat_list_votes')
      .upsert({
        user_id: userId,
        list_id: listId,
        vote
      })

    if (error) throw error
  }

  // NOTE: In a real Supabase setup, you'd use a trigger to update 'total_votes' in 'debloat_lists'.
  // If no trigger exists, we do a quick RPC call here.
  const { error: rpcError } = await supabase.rpc('update_list_votes_count', {
    p_list_id: listId
  })

  if (rpcError) {
    console.warn('Voting trigger failed or not implemented, votes might be out of sync in list view.')
  }
}

/**
 * Elimina una lista
 */
export async function deleteDebloatList(userId: string, listId: string): Promise<void> {
  const { error } = await supabase
    .from('debloat_lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * Aggiorna la visibilità di una lista
 */
export async function updateDebloatListVisibility(userId: string, listId: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from('debloat_lists')
    .update({ is_public: isPublic })
    .eq('id', listId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * Ottiene i commenti di una lista
 */
export async function getDebloatListComments(listId: string, userId?: string): Promise<DebloatComment[]> {
  const { data, error } = await supabase
    .from('debloat_list_comments')
    .select('*, debloat_list_comment_votes(vote)')
    .eq('list_id', listId)
    .order('total_votes', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map(c => ({
    ...c,
    user_vote: (c.debloat_list_comment_votes as any[])?.find((v: any) => v.user_id === userId)?.vote || 0
  }))
}

/**
 * Invia un commento
 */
export async function postDebloatListComment(
  listId: string,
  userId: string,
  nickname: string,
  content: string,
  parentId: string | null = null
): Promise<DebloatComment> {
  const { data, error } = await supabase
    .from('debloat_list_comments')
    .insert({
      list_id: listId,
      user_id: userId,
      nickname,
      content,
      parent_id: parentId
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Vota un commento
 */
export async function voteDebloatListComment(
  userId: string,
  commentId: string,
  vote: 1 | -1 | 0
): Promise<void> {
  if (vote === 0) {
    const { error } = await supabase
      .from('debloat_list_comment_votes')
      .delete()
      .eq('user_id', userId)
      .eq('comment_id', commentId)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('debloat_list_comment_votes')
      .upsert({
        user_id: userId,
        comment_id: commentId,
        vote
      })

    if (error) throw error
  }

  // Trigger manuale se necessario (anche se abbiamo il trigger DB)
  await supabase.rpc('update_comment_votes_count_rpc', {
    p_comment_id: commentId
  })
}

// ============================================
// DATABASE FUNCTIONS - MOBILE AUDITS (BRIDGE)
// ============================================

/**
 * Fetches mobile audits for the current user
 */
export async function getMobileAudits(userId: string): Promise<MobileAudit[]> {
  const { data, error } = await supabase
    .from('mobile_audits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching mobile audits:', error)
    return []
  }

  return data as MobileAudit[]
}

/**
 * Deletes a mobile audit
 */
export async function deleteMobileAudit(auditId: string): Promise<boolean> {
  const { error } = await supabase
    .from('mobile_audits')
    .delete()
    .eq('id', auditId)

  if (error) {
    console.error('Error deleting mobile audit:', error)
    return false
  }

  return true
}

/**
 * Marks a mobile audit as executed (optional utility)
 */
export async function markMobileAuditExecuted(auditId: string): Promise<boolean> {
  const { error } = await supabase
    .from('mobile_audits')
    .update({ is_executed: true })
    .eq('id', auditId)

  if (error) {
    console.error('Error marking mobile audit as executed:', error)
    return false
  }

  return true
}
