export function validateLoginRoute(source, label) {
  if (!source.includes('/sub-im/pages/chat/chat')) {
    throw new Error(`${label} 缺少 /sub-im/pages/chat/chat 登录跳转`)
  }
  if (source.replaceAll('/sub-im/pages/chat/chat', '').includes('/pages/chat/chat')) {
    throw new Error(`${label} 仍包含主包聊天页路径 /pages/chat/chat`)
  }
}
