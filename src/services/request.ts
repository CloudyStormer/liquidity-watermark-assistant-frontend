import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config/api'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  data?: Record<string, unknown>
  header?: Record<string, string>
}

function stringifyDetail(detail: unknown) {
  if (!detail) {
    return ''
  }

  if (typeof detail === 'string') {
    return detail
  }

  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

function getResponseErrorMessage(statusCode: number, data: unknown) {
  const payload = data as { detail?: unknown; message?: unknown; errMsg?: unknown }
  const message =
    stringifyDetail(payload?.detail) ||
    stringifyDetail(payload?.message) ||
    stringifyDetail(payload?.errMsg)

  return message || `Request failed: ${statusCode}`
}

function getRequestErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  const payload = error as { errMsg?: string; message?: string }
  return payload?.errMsg || payload?.message || '网络请求失败'
}

export async function requestJson<T>(path: string, options: RequestOptions = {}) {
  let response: Taro.request.SuccessCallbackResult<any>
  try {
    response = await Taro.request({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...(options.header || {})
      }
    })
  } catch (error) {
    throw new Error(getRequestErrorMessage(error))
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(getResponseErrorMessage(response.statusCode, response.data))
  }

  return response.data
}
