// uniApp UIKit 对外文档清单：source（uniApp 仓库内路径）→ to（community-docs 站点路径）。
// 新增公开页只改这份 PAGES：entries / sidebar / markdownReplacements 自动派生；
// editLink.pattern 必须自包含（VitePress 会序列化函数），因此仍保留一份字面量映射，
// 由 scripts/check-docs.mjs 校验两边一致。
export const pages = [
  { source: 'docs/HOME.md', to: 'uniapp/index.md', sidebar: false },

  // 开始
  { source: 'docs/QUICKSTART.md', to: 'uniapp/guide/quickstart.md', group: '开始', text: '快速开始' },
  { source: 'docs/CONCEPTS.md', to: 'uniapp/guide/concepts.md', group: '开始', text: '核心概念与架构' },

  // 页面指南
  { source: 'docs/PAGES-CONVERSATION.md', to: 'uniapp/guide/pages-conversation.md', group: '页面指南', text: '会话列表页' },
  { source: 'docs/PAGES-CHAT.md', to: 'uniapp/guide/pages-chat.md', group: '页面指南', text: '聊天页' },
  { source: 'docs/PAGES-CHAT-INFO.md', to: 'uniapp/guide/pages-chat-info.md', group: '页面指南', text: '聊天信息与群资料' },
  { source: 'docs/PAGES-CONTACTS.md', to: 'uniapp/guide/pages-contacts.md', group: '页面指南', text: '通讯录与好友' },
  { source: 'docs/PAGES-GROUPS.md', to: 'uniapp/guide/pages-groups.md', group: '页面指南', text: '群组列表与建群' },

  // 组件参考
  { source: 'docs/COMPONENTS.md', to: 'uniapp/guide/components.md', group: '组件参考', text: '组件总览' },
  { source: 'docs/COMPONENTS-BASIC.md', to: 'uniapp/guide/components-basic.md', group: '组件参考', text: '基础组件' },
  { source: 'docs/COMPONENTS-CONVERSATION.md', to: 'uniapp/guide/components-conversation.md', group: '组件参考', text: '会话与导航组件' },
  { source: 'docs/COMPONENTS-CHAT.md', to: 'uniapp/guide/components-chat.md', group: '组件参考', text: '聊天与消息组件' },
  { source: 'docs/COMPONENTS-CONTACT.md', to: 'uniapp/guide/components-contact.md', group: '组件参考', text: '联系人与群组组件' },

  // API 与配置
  { source: 'docs/API-KIT.md', to: 'uniapp/guide/api-kit.md', group: 'API 与配置', text: 'EmKit API' },
  { source: 'docs/API-TYPES.md', to: 'uniapp/guide/api-types.md', group: 'API 与配置', text: '类型与常量' },
  { source: 'docs/CONFIG.md', to: 'uniapp/guide/config.md', group: 'API 与配置', text: '配置参考' },
  { source: 'docs/MESSAGING.md', to: 'uniapp/guide/messaging.md', group: 'API 与配置', text: '消息与扩展协议' },

  // 设计与运行
  { source: 'docs/THEME-I18N.md', to: 'uniapp/guide/theme-i18n.md', group: '设计与运行', text: '主题与国际化' },
  { source: 'docs/DESIGN-TOKENS.md', to: 'uniapp/guide/design-tokens.md', group: '设计与运行', text: '设计变量' },
  { source: 'docs/PLATFORM.md', to: 'uniapp/guide/platform.md', group: '设计与运行', text: '平台能力与差异' },
  { source: 'docs/FAQ.md', to: 'uniapp/guide/faq.md', group: '设计与运行', text: '常见问题' },

  // 进阶接入
  { source: 'docs/GUIDE-MULTI-SCENARIO.md', to: 'uniapp/guide/multi-scenario.md', group: '进阶接入', text: '多场景接入' },
  { source: 'docs/AI-STREAM.md', to: 'uniapp/guide/ai-stream.md', group: '进阶接入', text: 'AI 流式消息' },
  { source: 'docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md', to: 'uniapp/guide/weapp-sdk-subpackage.md', group: '进阶接入', text: '微信小程序 SDK 分包' },
  { source: 'docs/HARMONY-REALDEVICE-RUN.md', to: 'uniapp/guide/harmony-realdevice-run.md', group: '进阶接入', text: '鸿蒙真机运行与签名' },

  // 示例与版本
  { source: 'docs/DEMO.md', to: 'uniapp/guide/demo.md', group: '示例与版本', text: '示例工程' },
  { source: 'uni_modules/easemob-uikit-uni/changelog.md', to: 'uniapp/guide/changelog.md', group: '示例与版本', text: '更新日志' },
]

function basename(path) {
  const index = path.lastIndexOf('/')
  return index >= 0 ? path.slice(index + 1) : path
}

const sidebarGroups = []
for (const page of pages) {
  if (page.sidebar === false || page.group == null) continue
  let group = sidebarGroups.find(item => item.text === page.group)
  if (group == null) {
    group = { text: page.group, items: [] }
    sidebarGroups.push(group)
  }
  group.items.push({
    text: page.text,
    link: `/${page.to.replace(/\.md$/, '')}`,
  })
}

const markdownReplacements = {}
for (const page of pages) {
  if (!page.source.endsWith('.md')) continue
  const from = `./${basename(page.source)}`
  const to = `./${basename(page.to)}`
  if (from !== to) markdownReplacements[from] = to
}

export default {
  product: 'uniapp',
  entries: [
    ...pages.map(page => ({ from: page.source, to: page.to })),
    { from: 'docs/assets', to: 'uniapp/guide/assets' },
  ],
  markdownReplacements,
  versionFiles: {
    uniapp: 'uni_modules/easemob-uikit-uni/package.json',
  },
  locale: {
    label: 'uniApp UIKit',
    themeConfig: {
      nav: [
        { text: '首页', link: '/uniapp/', activeMatch: '^/uniapp/$' },
        { text: '指南', link: '/uniapp/guide/quickstart', activeMatch: '^/uniapp/guide/(quickstart|concepts)' },
        { text: '页面', link: '/uniapp/guide/pages-conversation', activeMatch: '^/uniapp/guide/pages-' },
        { text: '组件', link: '/uniapp/guide/components', activeMatch: '^/uniapp/guide/components' },
        { text: 'API', link: '/uniapp/guide/api-kit', activeMatch: '^/uniapp/guide/(api-|config|messaging)' },
        { text: 'GitHub', link: 'https://github.com/Easemob-Community/easemob-uikit-uniapp' },
      ],
      sidebar: {
        '/uniapp/guide/': sidebarGroups,
      },
      editLink: {
        pattern: ({ relativePath }) => {
          const sourcePath = {
            'uniapp/index.md': 'docs/HOME.md',
            'uniapp/guide/quickstart.md': 'docs/QUICKSTART.md',
            'uniapp/guide/concepts.md': 'docs/CONCEPTS.md',
            'uniapp/guide/pages-conversation.md': 'docs/PAGES-CONVERSATION.md',
            'uniapp/guide/pages-chat.md': 'docs/PAGES-CHAT.md',
            'uniapp/guide/pages-chat-info.md': 'docs/PAGES-CHAT-INFO.md',
            'uniapp/guide/pages-contacts.md': 'docs/PAGES-CONTACTS.md',
            'uniapp/guide/pages-groups.md': 'docs/PAGES-GROUPS.md',
            'uniapp/guide/components.md': 'docs/COMPONENTS.md',
            'uniapp/guide/components-basic.md': 'docs/COMPONENTS-BASIC.md',
            'uniapp/guide/components-conversation.md': 'docs/COMPONENTS-CONVERSATION.md',
            'uniapp/guide/components-chat.md': 'docs/COMPONENTS-CHAT.md',
            'uniapp/guide/components-contact.md': 'docs/COMPONENTS-CONTACT.md',
            'uniapp/guide/api-kit.md': 'docs/API-KIT.md',
            'uniapp/guide/api-types.md': 'docs/API-TYPES.md',
            'uniapp/guide/config.md': 'docs/CONFIG.md',
            'uniapp/guide/messaging.md': 'docs/MESSAGING.md',
            'uniapp/guide/theme-i18n.md': 'docs/THEME-I18N.md',
            'uniapp/guide/design-tokens.md': 'docs/DESIGN-TOKENS.md',
            'uniapp/guide/platform.md': 'docs/PLATFORM.md',
            'uniapp/guide/faq.md': 'docs/FAQ.md',
            'uniapp/guide/multi-scenario.md': 'docs/GUIDE-MULTI-SCENARIO.md',
            'uniapp/guide/ai-stream.md': 'docs/AI-STREAM.md',
            'uniapp/guide/weapp-sdk-subpackage.md': 'docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md',
            'uniapp/guide/harmony-realdevice-run.md': 'docs/HARMONY-REALDEVICE-RUN.md',
            'uniapp/guide/demo.md': 'docs/DEMO.md',
            'uniapp/guide/changelog.md': 'uni_modules/easemob-uikit-uni/changelog.md',
          }[relativePath]
          if (!sourcePath)
            throw new Error(`No uniApp source mapping for ${relativePath}`)
          return `https://github.com/Easemob-Community/easemob-uikit-uniapp/edit/dev/${sourcePath}`
        },
        text: '在 GitHub 上编辑此页',
      },
    },
  },
}
