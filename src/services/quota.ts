import type { DailyQuotaResponse } from '@/types/media'
import { ensureLoggedIn } from './auth'
import { requestJson } from './request'

export async function getDailyQuota() {
  const openid = await ensureLoggedIn()
  return requestJson<DailyQuotaResponse>(`/users/${encodeURIComponent(openid)}/quota`)
}

export async function grantDailyQuota(extra = 3) {
  const openid = await ensureLoggedIn()
  return requestJson<DailyQuotaResponse>(`/users/${encodeURIComponent(openid)}/quota/grant`, {
    method: 'POST',
    data: { extra }
  })
}
