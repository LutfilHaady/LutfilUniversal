import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateUserId(type: 'BUYER' | 'SUPPLIER'): string {
  const prefix = type === 'BUYER' ? 'BJ' : 'SP'
  const randomNum = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}${randomNum.toString().padStart(4, '0')}`
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Low Risk', color: 'text-status-success' }
  if (score >= 60) return { label: 'Medium Risk', color: 'text-status-warning' }
  if (score >= 40) return { label: 'Caution', color: 'text-status-warning' }
  return { label: 'High Risk', color: 'text-status-error' }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#3C7F58'
  if (score >= 60) return '#C69F33'
  if (score >= 40) return '#C69F33'
  return '#B44A4A'
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string, locale: string = 'en-US'): string {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function getUserTypeFromUserId(userId: string): 'BUYER' | 'SUPPLIER' {
  // BJ prefix = Buyer, SP prefix = Supplier
  if (userId.startsWith('BJ')) return 'BUYER'
  if (userId.startsWith('SP')) return 'SUPPLIER'
  // Default fallback (should not happen in production)
  return 'SUPPLIER'
}

export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters except +
  const cleaned = value.replace(/[^\d+]/g, '')
  
  // If it starts with +62, format it
  if (cleaned.startsWith('+62')) {
    const digits = cleaned.slice(3) // Remove +62
    
    if (digits.length <= 3) {
      return `+62 ${digits}`
    } else if (digits.length <= 7) {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3)}`
    } else if (digits.length <= 11) {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    } else {
      // Limit to 11 digits after +62
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
    }
  } else if (cleaned.startsWith('62')) {
    // If user types 62 without +, add it
    const digits = cleaned.slice(2)
    
    if (digits.length <= 3) {
      return `+62 ${digits}`
    } else if (digits.length <= 7) {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3)}`
    } else if (digits.length <= 11) {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    } else {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
    }
  } else if (cleaned.length > 0 && !cleaned.startsWith('+')) {
    // If user starts typing without +62, auto-add it
    const digits = cleaned
    
    if (digits.length <= 3) {
      return `+62 ${digits}`
    } else if (digits.length <= 7) {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3)}`
    } else if (digits.length <= 11) {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    } else {
      return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
    }
  }
  
  return value
}

/**
 * Normalize phone number to E.164 format for Twilio API
 * Converts formatted phone numbers (e.g., "+62 812-3456-7890") to E.164 format (e.g., "+6281234567890")
 * 
 * @param phoneNumber - Phone number in any format (e.g., "+62 812-3456-7890", "081234567890", etc.)
 * @returns Phone number in E.164 format (e.g., "+6281234567890")
 * 
 * @example
 * normalizePhoneForTwilio("+62 812-3456-7890") // Returns "+6281234567890"
 * normalizePhoneForTwilio("081234567890") // Returns "+6281234567890"
 * normalizePhoneForTwilio("+6281234567890") // Returns "+6281234567890"
 */
export function normalizePhoneForTwilio(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '')
  
  // If it starts with +62, keep it and remove spaces/dashes
  if (cleaned.startsWith('+62')) {
    return cleaned.replace(/[^\d+]/g, '')
  }
  
  // If it starts with 62 (without +), add +
  if (cleaned.startsWith('62')) {
    return '+' + cleaned
  }
  
  // If it starts with 0, replace with +62
  if (cleaned.startsWith('0')) {
    return '+62' + cleaned.slice(1)
  }
  
  // If it's just digits (8-11 digits), assume it's Indonesian number and add +62
  if (/^\d{8,11}$/.test(cleaned)) {
    return '+62' + cleaned
  }
  
  // If it already has + but not +62, assume it's correct
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  // Default: add +62 prefix
  return '+62' + cleaned
}

