// uniApp UIKit 对外文档清单：source（uniApp 仓库内路径）→ to（community-docs 站点路径）。
// 新增公开页只改这份 PAGES：entries / sidebar / markdownReplacements 自动派生；
// editLink.pattern 必须自包含（VitePress 会序列化函数），因此仍保留一份字面量映射，
// 由 scripts/check-docs.mjs 校验两边一致。
export const pages = [
  { source: 'docs/HOME.md', to: 'uniapp/index.md', sidebar: false },

  // 开始
  { source: 'docs/QUICKSTART.md', to: 'uniapp/guide/quickstart.md', group: '开始', text: '快速开始' },
  { source: 'docs/CONCEPTS.md', to: 'uniapp/guide/concepts.md', group: '开始', text: '核心概念与架构' },

  // AI 接入 Skills
  { source: 'docs/GUIDE-AGENT-SKILLS.md', to: 'uniapp/guide/agent-skills.md', group: 'AI 接入 Skills', text: 'Skills 总览', editSource: 'skills/README.md' },
  { source: 'docs/SKILLS-INTEGRATION.md', to: 'uniapp/guide/skills-integration.md', group: 'AI 接入 Skills', text: '宿主接入总纲', editSource: 'skills/em-host-integration/SKILL.md' },
  { source: 'docs/SKILLS-CONVERSATION-CHAT.md', to: 'uniapp/guide/skills-conversation-chat.md', group: 'AI 接入 Skills', text: '会话与聊天', editSource: 'skills/em-host-conversation-chat/SKILL.md' },
  { source: 'docs/SKILLS-CONTACTS-GROUPS.md', to: 'uniapp/guide/skills-contacts-groups.md', group: 'AI 接入 Skills', text: '通讯录与群组', editSource: 'skills/em-host-contacts-groups/SKILL.md' },
  { source: 'docs/SKILLS-BUSINESS-EXTENSION.md', to: 'uniapp/guide/skills-business-extension.md', group: 'AI 接入 Skills', text: '业务扩展', editSource: 'skills/em-host-business-extension/SKILL.md' },
  { source: 'docs/SKILLS-AI-STREAM.md', to: 'uniapp/guide/skills-ai-stream.md', group: 'AI 接入 Skills', text: 'AI 流式消息', editSource: 'skills/em-host-ai-stream/SKILL.md' },
  { source: 'docs/SKILLS-THEME-I18N.md', to: 'uniapp/guide/skills-theme-i18n.md', group: 'AI 接入 Skills', text: '主题与国际化', editSource: 'skills/em-host-theme-i18n/SKILL.md' },
  { source: 'docs/SKILLS-MP-SUBPACKAGE.md', to: 'uniapp/guide/skills-mp-subpackage.md', group: 'AI 接入 Skills', text: '微信小程序分包', editSource: 'skills/em-host-mp-subpackage/SKILL.md' },
  { source: 'docs/SKILLS-TROUBLESHOOTING.md', to: 'uniapp/guide/skills-troubleshooting.md', group: 'AI 接入 Skills', text: '接入排错', editSource: 'skills/em-host-troubleshooting/SKILL.md' },

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
  { source: 'docs/API.md', to: 'uniapp/api/index.md', group: 'API 与配置', text: 'API 总览' },
  { source: 'docs/API-COMPONENTS.md', to: 'uniapp/api/components.md', group: 'API 与配置', apiGroup: '组件 Components', text: '组件 API' },
  { source: 'docs/API-COMPOSABLES.md', to: 'uniapp/api/composables.md', group: 'API 与配置', apiGroup: 'Composables', text: 'Composables' },
  { source: 'docs/API-UTILS.md', to: 'uniapp/api/utils.md', group: 'API 与配置', apiGroup: 'Utils', text: 'Utils' },
  { source: 'docs/API-KIT.md', to: 'uniapp/guide/api-kit.md', group: 'API 与配置', apiGroup: 'EmKit', text: 'EmKit API' },
  { source: 'docs/API-KIT-STATE.md', to: 'uniapp/api/kit-state.md', group: 'API 与配置', apiGroup: 'EmKit', text: '状态与只读 Store' },
  { source: 'docs/API-KIT-LIFECYCLE.md', to: 'uniapp/api/kit-lifecycle.md', group: 'API 与配置', apiGroup: 'EmKit', text: '初始化与生命周期' },
  { source: 'docs/API-KIT-MESSAGES.md', to: 'uniapp/api/kit-messages.md', group: 'API 与配置', apiGroup: 'EmKit', text: '发送消息' },
  { source: 'docs/API-KIT-MESSAGE-OPERATIONS.md', to: 'uniapp/api/kit-message-operations.md', group: 'API 与配置', apiGroup: 'EmKit', text: '消息操作' },
  { source: 'docs/API-KIT-CONVERSATIONS.md', to: 'uniapp/api/kit-conversations.md', group: 'API 与配置', apiGroup: 'EmKit', text: '会话' },
  { source: 'docs/API-KIT-CONTACTS.md', to: 'uniapp/api/kit-contacts.md', group: 'API 与配置', apiGroup: 'EmKit', text: '联系人' },
  { source: 'docs/API-KIT-GROUPS.md', to: 'uniapp/api/kit-groups.md', group: 'API 与配置', apiGroup: 'EmKit', text: '群组' },
  { source: 'docs/API-KIT-LOGS.md', to: 'uniapp/api/kit-logs.md', group: 'API 与配置', apiGroup: 'EmKit', text: '日志与调试' },
  { source: 'docs/API-TYPES.md', to: 'uniapp/guide/api-types.md', group: 'API 与配置', apiGroup: 'Types & Constants', text: '类型与常量' },
  { source: 'docs/API-TYPES-MESSAGES.md', to: 'uniapp/api/types-messages.md', group: 'API 与配置', apiGroup: 'Types & Constants', text: '消息类型与常量' },
  { source: 'docs/API-TYPES-CONVERSATIONS.md', to: 'uniapp/api/types-conversations.md', group: 'API 与配置', apiGroup: 'Types & Constants', text: '会话类型与常量' },
  { source: 'docs/API-TYPES-CONTACTS-GROUPS.md', to: 'uniapp/api/types-contacts-groups.md', group: 'API 与配置', apiGroup: 'Types & Constants', text: '用户、联系人与群组类型' },
  { source: 'docs/API-TYPES-COMPONENTS.md', to: 'uniapp/api/types-components.md', group: 'API 与配置', apiGroup: 'Types & Constants', text: '组件公共类型' },
  { source: 'docs/API-TYPES-THEME.md', to: 'uniapp/api/types-theme.md', group: 'API 与配置', apiGroup: 'Types & Constants', text: '主题、语言与状态常量' },
  { source: 'docs/API-TYPES-PLATFORM.md', to: 'uniapp/api/types-platform.md', group: 'API 与配置', apiGroup: 'Types & Constants', text: '平台与媒体类型' },
  { source: 'docs/CONFIG.md', to: 'uniapp/guide/config.md', group: 'API 与配置', apiGroup: '配置与协议', text: '配置参考' },
  { source: 'docs/MESSAGING.md', to: 'uniapp/guide/messaging.md', group: 'API 与配置', apiGroup: '配置与协议', text: '消息与扩展协议' },

  // 设计与运行
  { source: 'docs/THEME-I18N.md', to: 'uniapp/guide/theme-i18n.md', group: '设计与运行', text: '主题与国际化' },
  { source: 'docs/DESIGN-TOKENS.md', to: 'uniapp/guide/design-tokens.md', group: '设计与运行', text: '设计变量' },
  { source: 'docs/GUIDE-STYLING.md', to: 'uniapp/guide/styling.md', group: '设计与运行', text: '样式定制' },
  { source: 'docs/PLATFORM.md', to: 'uniapp/guide/platform.md', group: '设计与运行', text: '平台能力与差异' },
  { source: 'docs/FAQ.md', to: 'uniapp/guide/faq.md', group: '设计与运行', text: '常见问题' },
  { source: 'docs/PLATFORM-DEVICES.md', to: 'uniapp/guide/platform-devices.md', group: '设计与运行', text: '设备与端差异' },

  // 进阶接入
  { source: 'docs/GUIDE-MULTI-SCENARIO.md', to: 'uniapp/guide/multi-scenario.md', group: '进阶接入', text: '多场景接入' },
  { source: 'docs/AI-STREAM.md', to: 'uniapp/guide/ai-stream.md', group: '进阶接入', text: 'AI 流式消息' },
  { source: 'docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md', to: 'uniapp/guide/weapp-sdk-subpackage.md', group: '进阶接入', text: '微信小程序 SDK 分包' },
  { source: 'docs/GUIDE-ON-DEMAND.md', to: 'uniapp/guide/on-demand.md', group: '进阶接入', text: '按需接入与包体积' },
  { source: 'docs/HARMONY-REALDEVICE-RUN.md', to: 'uniapp/guide/harmony-realdevice-run.md', group: '进阶接入', text: '鸿蒙真机运行与签名' },

  // 界面参考
  { source: 'docs/SCREENSHOTS.md', to: 'uniapp/guide/screenshots.md', group: '界面参考', text: '界面截图' },

  // 示例与版本
  { source: 'docs/DEMO.md', to: 'uniapp/guide/demo.md', group: '示例与版本', text: '示例工程' },
  { source: 'uni_modules/easemob-uikit-uni/changelog.md', to: 'uniapp/guide/changelog.md', group: '示例与版本', text: '更新日志' },
]

function basename(path) {
  const index = path.lastIndexOf('/')
  return index >= 0 ? path.slice(index + 1) : path
}

function sidebarLink(page) {
  if (page.to.endsWith('/index.md')) return `/${page.to.slice(0, -'index.md'.length)}`
  return `/${page.to.replace(/\.md$/, '')}`
}

const sidebarGroups = []
const apiSidebarGroups = []
for (const page of pages) {
  if (page.sidebar !== false && page.group != null) {
    let group = sidebarGroups.find(item => item.text === page.group)
    if (group == null) {
      group = { text: page.group, items: [] }
      sidebarGroups.push(group)
    }
    group.items.push({ text: page.text, link: sidebarLink(page) })
  }
  if (page.apiGroup != null) {
    let group = apiSidebarGroups.find(item => item.text === page.apiGroup)
    if (group == null) {
      group = { text: page.apiGroup, items: [] }
      apiSidebarGroups.push(group)
    }
    group.items.push({ text: page.text, link: sidebarLink(page) })
  }
}

const markdownReplacements = {}
for (const page of pages) {
  if (!page.source.endsWith('.md')) continue
  const from = `./${basename(page.source)}`
  const to = sidebarLink(page)
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
        { text: 'API', link: '/uniapp/api/', activeMatch: '^/uniapp/(api/|guide/(api-|config|messaging))' },
        { text: 'GitHub', link: 'https://github.com/Easemob-Community/easemob-uikit-uniapp' },
      ],
      sidebar: {
        '/uniapp/guide/': sidebarGroups,
        '/uniapp/api/': [{
          text: 'API 与配置',
          items: [
            { text: 'API 总览', link: '/uniapp/api/' },
            ...apiSidebarGroups,
          ],
        }],
      },
      editLink: {
        pattern: ({ relativePath }) => {
          const sourcePath = {
            'uniapp/index.md': 'docs/HOME.md',
            'uniapp/guide/quickstart.md': 'docs/QUICKSTART.md',
            'uniapp/guide/concepts.md': 'docs/CONCEPTS.md',
            'uniapp/guide/agent-skills.md': 'skills/README.md',
            'uniapp/guide/skills-integration.md': 'skills/em-host-integration/SKILL.md',
            'uniapp/guide/skills-conversation-chat.md': 'skills/em-host-conversation-chat/SKILL.md',
            'uniapp/guide/skills-contacts-groups.md': 'skills/em-host-contacts-groups/SKILL.md',
            'uniapp/guide/skills-business-extension.md': 'skills/em-host-business-extension/SKILL.md',
            'uniapp/guide/skills-ai-stream.md': 'skills/em-host-ai-stream/SKILL.md',
            'uniapp/guide/skills-theme-i18n.md': 'skills/em-host-theme-i18n/SKILL.md',
            'uniapp/guide/skills-mp-subpackage.md': 'skills/em-host-mp-subpackage/SKILL.md',
            'uniapp/guide/skills-troubleshooting.md': 'skills/em-host-troubleshooting/SKILL.md',
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
            'uniapp/api/index.md': 'docs/API.md',
            'uniapp/api/components.md': 'docs/API-COMPONENTS.md',
            'uniapp/api/composables.md': 'docs/API-COMPOSABLES.md',
            'uniapp/api/utils.md': 'docs/API-UTILS.md',
            'uniapp/guide/api-kit.md': 'docs/API-KIT.md',
            'uniapp/api/kit-state.md': 'docs/API-KIT-STATE.md',
            'uniapp/api/kit-lifecycle.md': 'docs/API-KIT-LIFECYCLE.md',
            'uniapp/api/kit-messages.md': 'docs/API-KIT-MESSAGES.md',
            'uniapp/api/kit-message-operations.md': 'docs/API-KIT-MESSAGE-OPERATIONS.md',
            'uniapp/api/kit-conversations.md': 'docs/API-KIT-CONVERSATIONS.md',
            'uniapp/api/kit-contacts.md': 'docs/API-KIT-CONTACTS.md',
            'uniapp/api/kit-groups.md': 'docs/API-KIT-GROUPS.md',
            'uniapp/api/kit-logs.md': 'docs/API-KIT-LOGS.md',
            'uniapp/guide/api-types.md': 'docs/API-TYPES.md',
            'uniapp/api/types-messages.md': 'docs/API-TYPES-MESSAGES.md',
            'uniapp/api/types-conversations.md': 'docs/API-TYPES-CONVERSATIONS.md',
            'uniapp/api/types-contacts-groups.md': 'docs/API-TYPES-CONTACTS-GROUPS.md',
            'uniapp/api/types-components.md': 'docs/API-TYPES-COMPONENTS.md',
            'uniapp/api/types-theme.md': 'docs/API-TYPES-THEME.md',
            'uniapp/api/types-platform.md': 'docs/API-TYPES-PLATFORM.md',
            'uniapp/guide/config.md': 'docs/CONFIG.md',
            'uniapp/guide/messaging.md': 'docs/MESSAGING.md',
            'uniapp/guide/theme-i18n.md': 'docs/THEME-I18N.md',
            'uniapp/guide/design-tokens.md': 'docs/DESIGN-TOKENS.md',
            'uniapp/guide/styling.md': 'docs/GUIDE-STYLING.md',
            'uniapp/guide/platform.md': 'docs/PLATFORM.md',
            'uniapp/guide/faq.md': 'docs/FAQ.md',
            'uniapp/guide/platform-devices.md': 'docs/PLATFORM-DEVICES.md',
            'uniapp/guide/multi-scenario.md': 'docs/GUIDE-MULTI-SCENARIO.md',
            'uniapp/guide/ai-stream.md': 'docs/AI-STREAM.md',
            'uniapp/guide/weapp-sdk-subpackage.md': 'docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md',
            'uniapp/guide/on-demand.md': 'docs/GUIDE-ON-DEMAND.md',
            'uniapp/guide/harmony-realdevice-run.md': 'docs/HARMONY-REALDEVICE-RUN.md',
            'uniapp/guide/screenshots.md': 'docs/SCREENSHOTS.md',
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
