// 带 code 的业务错误工具：网络预检测拦截 / 连接等待超时等场景，
// 抛出方挂 ERROR_CODE，消费方（chat 页 toast 归因、宿主排查）按 code 识别，不靠 message 匹配。

import type { ErrorCodeValue } from '../constants'

export interface EmCodedError extends Error {
  code?: ErrorCodeValue
}

/** 构造带业务错误码的 Error（走 Error 形态，不改变现有 catch/throw 结构） */
export function errorWithCode(code: ErrorCodeValue, message: string): EmCodedError {
  const err = new Error(message) as EmCodedError
  err.code = code
  return err
}

/** 读取未知错误的业务错误码；无 code 返回空串（普通 SDK/运行期错误） */
export function errorCodeOf(e: unknown): ErrorCodeValue | '' {
  const code = (e as EmCodedError | null)?.code
  return typeof code === 'string' ? (code as ErrorCodeValue) : ''
}
