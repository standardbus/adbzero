/**
 * Device Authentication Service
 * Gestisce l'associazione dispositivo-utente per il login automatico
 */

import { supabase } from './supabase'
import { getAppSettings } from '@/config/app'

/**
 * Associazione dispositivo-utente
 */
export interface DeviceUserAssociation {
  id: string
  user_id: string
  device_serial: string
  device_fingerprint: string
  device_model: string
  device_manufacturer: string
  is_primary: boolean
  last_connected_at: string
  created_at: string
}

/**
 * Verifica se un dispositivo è associato a un utente
 * @param deviceSerial Serial number del dispositivo
 * @returns L'associazione se esiste, null altrimenti
 */
export async function checkDeviceAssociation(
  deviceSerial: string
): Promise<DeviceUserAssociation | null> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('device_serial', deviceSerial)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - dispositivo non associato
        return null
      }
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Errore verifica associazione dispositivo:', error)
    return null
  }
}

/**
 * Verifica se un dispositivo è associato a un utente tramite fingerprint
 * @param fingerprint Fingerprint del dispositivo (più affidabile del serial)
 * @returns L'associazione se esiste, null altrimenti
 */
export async function checkDeviceByFingerprint(
  fingerprint: string
): Promise<DeviceUserAssociation | null> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('device_fingerprint', fingerprint)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Errore verifica associazione dispositivo:', error)
    return null
  }
}

/**
 * Associa un dispositivo all'utente corrente
 */
export async function associateDevice(
  userId: string,
  deviceInfo: {
    serial: string
    fingerprint: string
    model: string
    manufacturer: string
  }
): Promise<boolean> {
  try {
    // Verifica se il dispositivo è già associato a questo utente
    const existing = await checkDeviceByFingerprint(deviceInfo.fingerprint)
    
    if (existing) {
      // Aggiorna last_connected_at
      const { error: updateError } = await supabase
        .from('user_devices')
        .update({ 
          last_connected_at: new Date().toISOString(),
          device_serial: deviceInfo.serial // Aggiorna serial se cambiato
        })
        .eq('id', existing.id)
      
      if (updateError) throw updateError
      return true
    }
    
    // Crea nuova associazione
    const { error } = await supabase
      .from('user_devices')
      .insert({
        user_id: userId,
        device_serial: deviceInfo.serial,
        device_fingerprint: deviceInfo.fingerprint,
        device_model: deviceInfo.model,
        device_manufacturer: deviceInfo.manufacturer,
        is_primary: false, // Può essere settato manualmente dall'utente
        last_connected_at: new Date().toISOString()
      })
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Errore associazione dispositivo:', error)
    return false
  }
}

/**
 * Rimuove l'associazione di un dispositivo
 */
export async function disassociateDevice(
  deviceId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('id', deviceId)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Errore rimozione associazione dispositivo:', error)
    return false
  }
}

/**
 * Ottiene tutti i dispositivi associati a un utente
 */
export async function getUserDevices(
  userId: string
): Promise<DeviceUserAssociation[]> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_connected_at', { ascending: false })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Errore recupero dispositivi utente:', error)
    return []
  }
}

/**
 * Tenta il login automatico basato sul dispositivo
 * @param deviceSerial Serial number del dispositivo
 * @param deviceFingerprint Fingerprint del dispositivo
 * @returns user_id se l'auto-login è possibile, null altrimenti
 */
export async function attemptDeviceAutoLogin(
  deviceSerial: string,
  deviceFingerprint: string
): Promise<string | null> {
  // Controlla se l'auto-login è abilitato nelle impostazioni
  const settings = getAppSettings()
  if (!settings.deviceAutoLogin) {
    console.log('Auto-login dispositivo disabilitato nelle impostazioni')
    return null
  }
  
  // Cerca prima per fingerprint (più affidabile)
  let association = await checkDeviceByFingerprint(deviceFingerprint)
  
  // Fallback a serial
  if (!association && deviceSerial) {
    association = await checkDeviceAssociation(deviceSerial)
  }
  
  if (association) {
    // Aggiorna last_connected_at
    await supabase
      .from('user_devices')
      .update({ last_connected_at: new Date().toISOString() })
      .eq('id', association.id)
    
    return association.user_id
  }
  
  return null
}

/**
 * Imposta un dispositivo come primario per l'utente
 */
export async function setDeviceAsPrimary(
  userId: string,
  deviceId: string
): Promise<boolean> {
  try {
    // Prima rimuovi il flag primary da tutti i dispositivi dell'utente
    await supabase
      .from('user_devices')
      .update({ is_primary: false })
      .eq('user_id', userId)
    
    // Poi imposta il dispositivo selezionato come primario
    const { error } = await supabase
      .from('user_devices')
      .update({ is_primary: true })
      .eq('id', deviceId)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Errore impostazione dispositivo primario:', error)
    return false
  }
}

