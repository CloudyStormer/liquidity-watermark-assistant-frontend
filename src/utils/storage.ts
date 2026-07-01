import Taro from '@tarojs/taro'
import { DISCLAIMER_STORAGE_KEY, QUOTA_STORAGE_KEY, RESULT_STORAGE_KEY } from '@/data/constants'
import type { ProcessedFile } from '@/types/media'

interface QuotaPayload {
  date: string
  used: number
}

function todayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readQuota(): QuotaPayload {
  try {
    const stored = Taro.getStorageSync<QuotaPayload>(QUOTA_STORAGE_KEY)
    if (!stored || stored.date !== todayKey()) {
      return { date: todayKey(), used: 0 }
    }
    return {
      date: stored.date,
      used: Number(stored.used) || 0
    }
  } catch {
    return { date: todayKey(), used: 0 }
  }
}

function writeQuota(used: number) {
  Taro.setStorageSync(QUOTA_STORAGE_KEY, {
    date: todayKey(),
    used: Math.max(0, used)
  })
}

export function getUsedQuota() {
  return readQuota().used
}

export function consumeQuota() {
  const next = getUsedQuota() + 1
  writeQuota(next)
  return next
}

export function grantQuota(extra: number) {
  const next = Math.max(0, getUsedQuota() - extra)
  writeQuota(next)
  return next
}

export function hasAgreedDisclaimer() {
  try {
    return Taro.getStorageSync(DISCLAIMER_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function agreeDisclaimer() {
  Taro.setStorageSync(DISCLAIMER_STORAGE_KEY, '1')
}

export function saveLatestResult(result: ProcessedFile) {
  Taro.setStorageSync(RESULT_STORAGE_KEY, result)
}

export function getLatestResult(): ProcessedFile | null {
  try {
    return Taro.getStorageSync<ProcessedFile>(RESULT_STORAGE_KEY) || null
  } catch {
    return null
  }
}
