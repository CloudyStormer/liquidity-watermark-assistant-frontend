import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config/api'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  data?: Record<string, unknown>
  header?: Record<string, string>
}

export async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const response = await Taro.request<T>({
    url: `${API_BASE_URL}${path}`,
    method: options.method || 'GET',
    data: options.data,
    header: {
      'content-type': 'application/json',
      ...(options.header || {})
    }
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Request failed: ${response.statusCode}`)
  }

  return response.data
}
