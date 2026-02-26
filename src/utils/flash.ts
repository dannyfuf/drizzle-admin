import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

const FLASH_COOKIE = '_flash'

export type FlashType = 'success' | 'error' | 'info'

export interface FlashMessage {
  type: FlashType
  message: string
}

export function setFlash(c: Context, type: FlashType, message: string): void {
  const value = JSON.stringify({ type, message })
  setCookie(c, FLASH_COOKIE, value, {
    httpOnly: true,
    maxAge: 60,
    path: '/',
  })
}

export function getFlash(c: Context): FlashMessage | null {
  const value = getCookie(c, FLASH_COOKIE)
  if (!value) return null

  setCookie(c, FLASH_COOKIE, '', { maxAge: 0, path: '/' })

  try {
    return JSON.parse(value) as FlashMessage
  } catch {
    return null
  }
}
