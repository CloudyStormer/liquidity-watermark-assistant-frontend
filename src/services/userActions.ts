import type { RatingResponse } from '@/types/media'
import { ensureLoggedIn } from './auth'
import { requestJson } from './request'

export async function submitRating(score: number, comment?: string) {
  const openid = await ensureLoggedIn()
  return requestJson<RatingResponse>('/ratings', {
    method: 'POST',
    data: {
      openid,
      score,
      comment: comment?.trim() || undefined
    }
  })
}

export async function submitFeedback(content: string, contact?: string) {
  const openid = await ensureLoggedIn()
  return requestJson('/feedback', {
    method: 'POST',
    data: {
      openid,
      type: 'general',
      content: content.trim(),
      contact: contact?.trim() || undefined
    }
  })
}

export async function getMyRatings() {
  const openid = await ensureLoggedIn()
  return requestJson<RatingResponse[]>(`/ratings/users/${encodeURIComponent(openid)}?limit=1`)
}
