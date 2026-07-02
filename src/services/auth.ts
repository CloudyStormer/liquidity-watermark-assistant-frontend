import Taro from '@tarojs/taro'
import { API_BASE_URL, WEAPP_LOGIN_PATH } from '@/config/api'
import { requestWeChatProfile } from './loginBridge'
import { requestJson } from './request'

const OPENID_STORAGE_KEY = 'wm_openid'
const USER_STORAGE_KEY = 'wm_user'
let sessionProfileConfirmed = false

export interface LoginResponse {
  openid: string
  nickname?: string
  avatar_url?: string
}

interface LoginOptions {
  reason?: string
  needProfile?: boolean
}

interface WeChatProfile {
  nickname?: string
  avatar_path?: string
  avatar_url?: string
}

interface UserProfileResponse {
  user: LoginResponse
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

export function getStoredUser() {
  try {
    return Taro.getStorageSync<LoginResponse>(USER_STORAGE_KEY) || null
  } catch {
    return null
  }
}

function storeUser(user: LoginResponse) {
  Taro.setStorageSync(OPENID_STORAGE_KEY, user.openid)
  Taro.setStorageSync(USER_STORAGE_KEY, user)
}

function clearStoredUser() {
  Taro.removeStorageSync(OPENID_STORAGE_KEY)
  Taro.removeStorageSync(USER_STORAGE_KEY)
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

async function exchangeCodeForOpenid(code: string, profile?: WeChatProfile) {
  const response = await requestJson<LoginResponse>(WEAPP_LOGIN_PATH, {
    method: 'POST',
    data: {
      code,
      nickname: profile?.nickname || '小程序用户',
      avatar_url: profile?.avatar_url
    }
  })

  if (!response?.openid) {
    throw new Error('openid missing')
  }

  storeUser(response)
  return response.openid
}

async function createDevUser(openid: string, profile?: WeChatProfile) {
  const user = await requestJson<LoginResponse>('/users/login', {
    method: 'POST',
    data: {
      openid,
      nickname: profile?.nickname || '小程序用户',
      avatar_url: profile?.avatar_url
    }
  })

  storeUser(user)
  return user.openid
}

async function validateStoredUser(openid: string) {
  const profile = await requestJson<UserProfileResponse>(`/users/${encodeURIComponent(openid)}/profile`)
  storeUser(profile.user)
  return profile.user
}

function parseUploadUser(response: Taro.uploadFile.SuccessCallbackResult) {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`头像上传失败：${response.statusCode}`)
  }

  return JSON.parse(response.data || '{}') as LoginResponse
}

async function uploadAvatar(openid: string, avatarPath?: string) {
  if (!avatarPath) {
    return getStoredUser()
  }

  try {
    const response = await Taro.uploadFile({
      url: `${API_BASE_URL}/users/${encodeURIComponent(openid)}/avatar`,
      filePath: avatarPath,
      name: 'file'
    })
    const user = parseUploadUser(response)
    storeUser(user)
    return user
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

async function getLoginCode() {
  try {
    const loginResult = await Taro.login()
    if (!loginResult.code) {
      throw new Error('微信未返回登录 code')
    }
    return loginResult.code
  } catch (error) {
    throw new Error(`微信登录失败：${getErrorMessage(error)}`)
  }
}

async function loginWithWeChatProfile(reason?: string) {
  const profileDraft = await requestWeChatProfile(reason)
  const profile: WeChatProfile = {
    nickname: profileDraft.nickname,
    avatar_path: profileDraft.avatar_path,
    avatar_url: profileDraft.avatar_url
  }
  if (!profile.nickname || (!profile.avatar_path && !profile.avatar_url)) {
    throw new Error('微信昵称和头像缺失，无法完成登录')
  }
  const code = await getLoginCode()

  try {
    const openid = await exchangeCodeForOpenid(code, profile)
    if (profile.avatar_path) {
      await uploadAvatar(openid, profile.avatar_path)
    }
    sessionProfileConfirmed = true
    return openid
  } catch (error) {
    if (!canUseDevOpenid()) {
      throw new Error(`微信登录失败：${getErrorMessage(error)}`)
    }
    const devOpenid = `dev_openid_${hashCode(code)}`
    await createDevUser(devOpenid, profile)
    if (profile.avatar_path) {
      await uploadAvatar(devOpenid, profile.avatar_path)
    }
    sessionProfileConfirmed = true
    return devOpenid
  }
}

export async function ensureLoggedIn(options: LoginOptions = {}) {
  const storedOpenid = getStoredOpenid()
  const needsProfile = options.needProfile !== false
  if (storedOpenid) {
    if (needsProfile && !sessionProfileConfirmed) {
      return loginWithWeChatProfile(options.reason || '请先使用微信头像和昵称完成登录后继续。')
    }

    const storedUser = getStoredUser()
    if (needsProfile && (!storedUser?.nickname || !storedUser?.avatar_url || storedUser.nickname === '小程序用户')) {
      return loginWithWeChatProfile(options.reason || '需要补充微信头像昵称后才能继续使用本功能。')
    }

    try {
      await validateStoredUser(storedOpenid)
    } catch {
      clearStoredUser()
      return loginWithWeChatProfile(options.reason || '登录状态已过期，请重新微信登录后继续。')
    }
    return storedOpenid
  }

  const openid = await loginWithWeChatProfile(options.reason)
  Taro.showToast({ title: '登录成功', icon: 'success' })
  return openid
}

export async function requireLoggedIn(reason?: string) {
  try {
    return await ensureLoggedIn({ reason, needProfile: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('取消登录')) {
      throw error
    }

    Taro.showModal({
      title: '登录失败',
      content: message || '请确认微信登录可用后重试',
      showCancel: false
    })
    throw error
  }
}
