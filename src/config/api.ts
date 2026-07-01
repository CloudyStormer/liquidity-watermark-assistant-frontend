export const API_BASE_URL = 'http://127.0.0.1:8000/api'

// True WeChat openid exchange requires backend appSecret access.
// If the backend adds this endpoint later, the auth service will use it first.
export const WEAPP_LOGIN_PATH = '/users/weapp-login'
