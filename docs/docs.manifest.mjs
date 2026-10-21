export default {
  product: 'uniapp',
  entries: [
    { from: 'docs/HOME.md', to: 'uniapp/index.md' },
    { from: 'docs/QUICKSTART.md', to: 'uniapp/guide/quickstart.md' },
    { from: 'docs/GUIDE-MULTI-SCENARIO.md', to: 'uniapp/guide/multi-scenario.md' },
    { from: 'docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md', to: 'uniapp/guide/weapp-sdk-subpackage.md' },
    { from: 'docs/HARMONY-REALDEVICE-RUN.md', to: 'uniapp/guide/harmony-realdevice-run.md' },
    { from: 'docs/DESIGN-TOKENS.md', to: 'uniapp/guide/design-tokens.md' },
    { from: 'uni_modules/easemob-uikit-uni/changelog.md', to: 'uniapp/guide/changelog.md' },
    { from: 'docs/assets', to: 'uniapp/guide/assets' },
  ],
  markdownReplacements: {
    './GUIDE-MULTI-SCENARIO.md': './multi-scenario.md',
    './GUIDE-WEAPP-SDK-SUBPACKAGE.md': './weapp-sdk-subpackage.md',
    './HARMONY-REALDEVICE-RUN.md': './harmony-realdevice-run.md',
    './DESIGN-TOKENS.md': './design-tokens.md',
  },
  versionFiles: {
    uniapp: 'uni_modules/easemob-uikit-uni/package.json',
  },
  locale: {
    label: 'uniApp UIKit',
    themeConfig: {
      nav: [
        { text: '首页', link: '/uniapp/', activeMatch: '^/uniapp/$' },
        { text: '指南', link: '/uniapp/guide/quickstart', activeMatch: '^/uniapp/guide/' },
        { text: 'GitHub', link: 'https://github.com/Easemob-Community/easemob-uikit-uniapp' },
      ],
      sidebar: {
        '/uniapp/guide/': [
          {
            text: '开始',
            items: [
              { text: '快速开始', link: '/uniapp/guide/quickstart' },
            ],
          },
          {
            text: '接入指南',
            items: [
              { text: '多场景接入', link: '/uniapp/guide/multi-scenario' },
              { text: '微信小程序 SDK 分包', link: '/uniapp/guide/weapp-sdk-subpackage' },
              { text: '鸿蒙真机运行与签名', link: '/uniapp/guide/harmony-realdevice-run' },
            ],
          },
          {
            text: '设计与版本',
            items: [
              { text: '设计变量（Design Tokens）', link: '/uniapp/guide/design-tokens' },
              { text: '更新日志', link: '/uniapp/guide/changelog' },
            ],
          },
        ],
      },
      editLink: {
        pattern: ({ relativePath }) => {
          const sourcePath = {
            'uniapp/index.md': 'docs/HOME.md',
            'uniapp/guide/quickstart.md': 'docs/QUICKSTART.md',
            'uniapp/guide/multi-scenario.md': 'docs/GUIDE-MULTI-SCENARIO.md',
            'uniapp/guide/weapp-sdk-subpackage.md': 'docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md',
            'uniapp/guide/harmony-realdevice-run.md': 'docs/HARMONY-REALDEVICE-RUN.md',
            'uniapp/guide/design-tokens.md': 'docs/DESIGN-TOKENS.md',
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
