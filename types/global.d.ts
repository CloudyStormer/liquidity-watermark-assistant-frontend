/// <reference types="@tarojs/taro" />

declare namespace NodeJS {
  interface ProcessEnv {
    TARO_ENV?: string
    NODE_ENV: 'development' | 'production' | 'test'
  }
}
