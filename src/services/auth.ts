import Taro from '@tarojs/taro'
import { WEAPP_LOGIN_PATH } from '@/config/api'
import { requestJson } from './request'

const OPENID_STORAGE_KEY = 'wm_openid'
const USER_STORAGE_KEY = 'wm_user'

interface LoginResponse {
  openid: string
  nickname?: string
  avatar_url?: string
}

function hashCode(input: string) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

export function getStoredOpenid() {
  try {
    return Taro.getStorageSync<string>(OPENID_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function storeUser(user: LoginResponse) {
  Taro.setStorageSync(OPENID_STORAGE_KEY, user.openid)
  Taro.setStorageSync(USER_STORAGE_KEY, user)
}

function canUseDevOpenid() {
  return process.env.NODE_ENV === 'development'
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  const payload = error as { errMsg?: string; message?: string }
  return payload?.errMsg || payload?.message || '未知错误'
}

async function exchangeCodeForOpenid(code: string) {
  const response = await requestJson<LoginResponse>(WEAPP_LOGIN_PATH, {
    method: 'POST',
    data: {
      code,
      nickname: '小程序用户'
    }
  })

  if (!response?.openid) {
    throw new Error('openid missing')
  }

  storeUser(response)
  return response.openid
}

async function syncUser(openid: string) {
  const user = await requestJson<LoginResponse>('/users/login', {
    method: 'POST',
    data: {
      openid,
      nickname: '小程序用户'
    }
  })

  storeUser(user)
  return user.openid
}

export async function ensureLoggedIn() {
  const storedOpenid = getStoredOpenid()
  if (storedOpenid) {
    try {
      await syncUser(storedOpenid)
    } catch {
      // Keep local identity available when the backend is not running in dev.
    }
    return storedOpenid
  }

  let loginResult: Taro.login.SuccessCallbackResult
  try {
    loginResult = await Taro.login()
  } catch (error) {
    throw new Error(`微信登录失败：${getErrorMessage(error)}`)
  }

  const code = loginResult.code || `${Date.now()}`

  let openid = ''
  try {
    openid = await exchangeCodeForOpenid(code)
  } catch (error) {
    if (!canUseDevOpenid()) {
      throw new Error(`微信登录失败：${getErrorMessage(error)}`)
    }
    openid = `dev_openid_${hashCode(code)}`
  }

  Taro.setStorageSync(OPENID_STORAGE_KEY, openid)

  try {
    await syncUser(openid)
  } catch {
    storeUser({ openid, nickname: '小程序用户' })
  }

  return openid
}

export async function requireLoggedIn() {
  try {
    return await ensureLoggedIn()
  } catch (error) {
    Taro.showModal({
      title: '登录失败',
      content: error instanceof Error ? error.message : '请确认微信登录可用后重试',
      showCancel: false
    })
    throw error
  }
}
