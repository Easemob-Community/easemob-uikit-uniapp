// Demo 场景目录：6 个典型 IM 场景的「业务上下文 + 聊天配置 + 自定义卡片」。
// 同一套 em-chat-page，仅换 props/banner/插槽配置，演示 UIKit 在非微信型业务页面里的改造空间。
// 卡片是「宿主插槽 + 数据」：本文件只放每条卡片的 event/params/ext，呈现逻辑在 demo/components/demo-card（宿主组件）。
// 仅 demo 层使用，不进 uni_modules。
import { MESSAGE_TYPE } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmMessageMenuExtra, EmQuickReply } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmIconName } from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icons'

export type ScenarioKey = 'service' | 'medical' | 'trade' | 'recruit' | 'education' | 'community'
export type ScenarioChatType = 'singleChat' | 'groupChat'

export interface ScenarioField {
  label: string
  value: string
}

/** 一条可发送的自定义卡片（event 由宿主 demo-card 识别，UIKit 不关心业务事件） */
export interface ScenarioCard {
  /** 面板按钮文案 */
  label: string
  /** 输入栏入口胶囊文案（短动词，宿主自定；Demo 用中文，正式接入可走 i18n） */
  entryLabel: string
  /** 输入栏入口胶囊图标 */
  entryIcon: EmIconName
  /** wire custom body.event（注册键） */
  event: string
  /** 字符串参数表（wire params；结构化内容放 ext） */
  params: Record<string, string>
  /** 结构化业务载荷（ext；内置约定 title/subtitle/badge/fields/footer/actionText/secondaryText） */
  ext: Record<string, unknown>
}

export interface ScenarioChatConfig {
  /** 聊天页导航标题 */
  title: string
  /** #banner 两行文案 */
  bannerTitle: string
  bannerDesc: string
  quickReplies: EmQuickReply[]
  extraMenus: EmMessageMenuExtra[]
  /** 本场景可发送的自定义卡片（每种 event 对应一个已注册渲染） */
  cards: ScenarioCard[]
  /** sendText 业务 ext 消息 */
  textLabel: string
  textContent: string
  extraExt: Record<string, unknown>
  /** insertLocalNotice 文案 */
  noticeLabel: string
  noticeText: string
  /** 业务长按动作弹窗标题 */
  contextDialogTitle: string
}

export interface ScenarioConfig {
  key: ScenarioKey
  name: string
  tagline: string
  icon: string
  /** 业务主色（仅 demo 视觉，不写入 UIKit token） */
  accent: string
  chatType: ScenarioChatType
  /** 对端角色：客服 / 主治医生 / 卖家 / HR / 班主任 / 群主 */
  peerLabel: string
  /** 详情页 hero 的关键指标（金额/薪资/复诊时间等） */
  metricLabel: string
  metricValue: string
  fields: ScenarioField[]
  capabilities: string[]
  steps: string[]
  chat: ScenarioChatConfig
}

const CONTEXT_MENU: EmMessageMenuExtra = {
  key: 'scene-context',
  text: '查看业务详情',
  icon: 'doc',
  types: [MESSAGE_TYPE.CUSTOM, MESSAGE_TYPE.TEXT]
}

export const SCENARIO_LIST: ScenarioConfig[] = [
  {
    key: 'service',
    name: '在线客服',
    tagline: '业务页直进客服会话，带来源/订单上下文与人工转接',
    icon: 'bubble-rect-2',
    accent: '#33B1FF',
    chatType: 'singleChat',
    peerLabel: '客服',
    metricLabel: '响应时效',
    metricValue: '≤ 1 分钟',
    fields: [
      { label: '服务单号', value: 'CS-20261020-01' },
      { label: '来源', value: '订单详情页' },
      { label: '会员等级', value: '黄金会员 · 优先响应' }
    ],
    capabilities: ['title / showAction', '#banner', '输入栏发卡入口', 'quickReplies', 'insertLocalNotice'],
    steps: ['业务页点「联系客服」直进会话', '横幅保留服务单/来源上下文', '输入栏「发订单/发工单」一点即发，卡片由宿主渲染、动作回传宿主'],
    chat: {
      title: '在线客服',
      bannerTitle: '服务单 CS-20261020-01',
      bannerDesc: '来源：订单详情 · 黄金会员 · 优先响应',
      quickReplies: [
        { label: '查询订单', text: '我的订单号是 SO-20261020-001，想查一下进度' },
        { label: '退换货', text: '我想申请退换货，需要怎么操作？' },
        { label: '人工客服', text: '请帮我转人工客服' }
      ],
      extraMenus: [{ ...CONTEXT_MENU, text: '查看工单' }],
      cards: [
        {
          label: '订单卡片',
          entryLabel: '发订单',
          entryIcon: 'cart-filled',
          event: 'orderCard',
          params: { orderId: 'SO-20261020-001' },
          ext: {
            title: '订单 · 待发货',
            subtitle: '九成新公路车 · ¥1,280',
            badge: '待发货',
            icon: 'cart-filled',
            fields: [
              { label: '订单号', value: 'SO-20261020-001' },
              { label: '下单时间', value: '10-20 14:06' },
              { label: '配送', value: '顺丰 · 预计明天' }
            ],
            footer: '需要修改地址请在发货前提出',
            actionText: '查看物流',
            actionKey: 'order-logistics'
          }
        },
        {
          label: '工单卡片',
          entryLabel: '发工单',
          entryIcon: 'board',
          event: 'serviceTicket',
          params: { ticketId: 'CS-20261020-01' },
          ext: {
            title: '服务工单 · 待处理',
            subtitle: '订单售后 · 优先响应',
            badge: '待处理',
            icon: 'bubble-rect-2',
            fields: [
              { label: '工单号', value: 'CS-20261020-01' },
              { label: '问题类型', value: '物流异常' },
              { label: '承诺时效', value: '2 小时内' }
            ],
            footer: '客服小环 · 已接单',
            actionText: '查看工单',
            actionKey: 'ticket-open'
          }
        },
        {
          label: '退款审核',
          entryLabel: '退款审核',
          entryIcon: 'wallet-filled',
          event: 'refundReview',
          params: { orderId: 'SO-20261020-001' },
          ext: {
            title: '退款申请待审核',
            subtitle: '订单 SO-20261020-001',
            badge: '待审核',
            icon: 'wallet-filled',
            fields: [
              { label: '退款金额', value: '¥1,280' },
              { label: '申请原因', value: '商品与描述不符' },
              { label: '到账方式', value: '原路退回' }
            ],
            footer: '审核结果将通知买家',
            actionText: '同意退款',
            actionKey: 'refund-approve',
            secondaryText: '拒绝',
            secondaryKey: 'refund-reject'
          }
        }
      ],
      textLabel: '订单追问',
      textContent: '订单什么时候能发货？',
      extraExt: { ticketId: 'CS-20261020-01', source: 'support-center' },
      noticeLabel: '转接提示',
      noticeText: '客服小环已接入，正在为您服务',
      contextDialogTitle: '业务动作 · 查看工单'
    }
  },
  {
    key: 'medical',
    name: '医患沟通',
    tagline: '病情摘要常驻顶部，病例/处方卡片与隐私友好的医患会话',
    icon: 'circle-person-filled',
    accent: '#16A34A',
    chatType: 'singleChat',
    peerLabel: '主治医生',
    metricLabel: '下次复诊',
    metricValue: '10 月 27 日',
    fields: [
      { label: '科室', value: '心血管内科' },
      { label: '主治医生', value: '张医生' },
      { label: '就诊卡', value: 'MR-88213' },
      { label: '过敏史', value: '青霉素' }
    ],
    capabilities: ['#banner 病情摘要', '输入栏发病例/处方', '隐私角标', '文件/图片报告', '双端可回传'],
    steps: ['患者从问诊单进入会话', '顶部常驻诊断/过敏史', '输入栏「发病例/发处方」一点即发，卡片由宿主渲染'],
    chat: {
      title: '在线问诊',
      bannerTitle: '张医生 · 心血管内科',
      bannerDesc: '就诊卡 MR-88213 · 过敏史：青霉素',
      quickReplies: [
        { label: '症状描述', text: '最近三天血压 150/95，偶尔头晕' },
        { label: '报告解读', text: '请帮我看一下这份检查报告' },
        { label: '用药咨询', text: '现在的降压药需要调整吗？' }
      ],
      extraMenus: [{ ...CONTEXT_MENU, text: '查看处方' }],
      cards: [
        {
          label: '发病例',
          entryLabel: '发病例',
          entryIcon: 'rect-idphoto',
          event: 'medicalCase',
          params: { patientId: 'MR-88213' },
          ext: {
            title: '病例摘要 · 初诊',
            subtitle: '患者 王先生 · 42 岁',
            badge: '仅医生可见',
            icon: 'rect-idphoto',
            fields: [
              { label: '主诉', value: '头晕伴血压升高 3 天' },
              { label: '血压', value: '150/95 mmHg' },
              { label: '过敏史', value: '青霉素' },
              { label: '检查', value: '血常规已上传' }
            ],
            footer: '患者发送 · 仅本次问诊医生可见',
            actionText: '查看病例',
            actionKey: 'case-open'
          }
        },
        {
          label: '处方卡片',
          entryLabel: '发处方',
          entryIcon: 'doc',
          event: 'prescription',
          params: { patientId: 'MR-88213' },
          ext: {
            title: '电子处方 · 3 项',
            subtitle: '用法用量已标注',
            badge: '待确认',
            fields: [
              { label: '就诊卡', value: 'MR-88213' },
              { label: '诊断', value: '原发性高血压' },
              { label: '用药', value: '氨氯地平 5mg / 日' },
              { label: '有效期', value: '3 天' }
            ],
            footer: '张医生 · 心血管内科',
            actionText: '查看处方',
            actionKey: 'prescription-open'
          }
        }
      ],
      textLabel: '病情追问',
      textContent: '最近血压偏高，需要调整用药吗？',
      extraExt: { patientId: 'MR-88213', department: '心血管内科' },
      noticeLabel: '问诊提示',
      noticeText: '问诊已开始，医生将在 24 小时内回复',
      contextDialogTitle: '业务动作 · 查看处方'
    }
  },
  {
    key: 'trade',
    name: '二手交易',
    tagline: '商品上下文 + 商品/砍价卡片 + 交易状态灰条，类闲鱼会话',
    icon: 'cart-filled',
    accent: '#FFAA19',
    chatType: 'singleChat',
    peerLabel: '卖家',
    metricLabel: '订单金额',
    metricValue: '¥1,280',
    fields: [
      { label: '商品', value: '九成新公路车' },
      { label: '订单号', value: 'SO-20261020-001' },
      { label: '金额', value: '¥1,280' },
      { label: '状态', value: '待发货' }
    ],
    capabilities: ['#banner 商品条', '输入栏发商品/报价', '双动作按钮', 'insertLocalNotice 交易状态', '同城自提'],
    steps: ['从商品详情点「联系卖家」', '顶部固定正在咨询的商品', '输入栏「发商品/发报价」一点即发，接受后落交易状态灰条'],
    chat: {
      title: '卖家 · 小北',
      bannerTitle: '正在咨询 · 九成新公路车',
      bannerDesc: '订单 SO-20261020-001 · ¥1,280',
      quickReplies: [
        { label: '还在吗', text: '您好，商品还在吗？' },
        { label: '能便宜点吗', text: '价格还能再优惠一点吗？' },
        { label: '包邮吗', text: '这个价格包邮吗？' }
      ],
      extraMenus: [{ ...CONTEXT_MENU, text: '查看订单' }],
      cards: [
        {
          label: '商品卡片',
          entryLabel: '发商品',
          entryIcon: 'cart-filled',
          event: 'productCard',
          params: { productId: 'P-9527' },
          ext: {
            title: '九成新公路车',
            subtitle: '¥1,280 · 同城自提',
            badge: '待发货',
            icon: 'cart-filled',
            fields: [
              { label: '订单号', value: 'SO-20261020-001' },
              { label: '交易方式', value: '同城自提' },
              { label: '卖家', value: '小北' }
            ],
            footer: '平台担保交易',
            actionText: '查看订单',
            actionKey: 'order-open'
          }
        },
        {
          label: '砍价卡片',
          entryLabel: '发报价',
          entryIcon: 'ringarrow-ccw',
          event: 'priceOffer',
          params: { productId: 'P-9527' },
          ext: {
            title: '卖家出价 ¥1,180',
            subtitle: '原价 ¥1,280 · 九成新公路车',
            badge: '待回应',
            icon: 'ringarrow-ccw',
            fields: [
              { label: '优惠', value: '¥100' },
              { label: '有效期', value: '24 小时' },
              { label: '包含', value: '锁具与头盔' }
            ],
            footer: '接受后将生成订单',
            actionText: '接受报价',
            actionKey: 'offer-accept',
            secondaryText: '还价',
            secondaryKey: 'offer-counter'
          }
        }
      ],
      textLabel: '订单追问',
      textContent: '这个订单什么时候发货？',
      extraExt: { orderId: 'SO-20261020-001', source: 'scenario-demo' },
      noticeLabel: '交易提示',
      noticeText: '对方已拍下，等待付款',
      contextDialogTitle: '业务动作 · 查看订单'
    }
  },
  {
    key: 'recruit',
    name: '招聘沟通',
    tagline: '职位条常驻 + 简历文件 + 面试邀约/手机号交换卡片',
    icon: 'person-card',
    accent: '#7C5CFF',
    chatType: 'singleChat',
    peerLabel: 'HR',
    metricLabel: '薪资范围',
    metricValue: '25-35K',
    fields: [
      { label: '职位', value: '资深前端工程师' },
      { label: '薪资', value: '25-35K' },
      { label: '公司', value: '环信科技' },
      { label: '阶段', value: '简历初筛' }
    ],
    capabilities: ['#banner 职位条', '输入栏发简历/邀约/换手机号', '宿主侧脱敏', '双动作按钮', '文件简历'],
    steps: ['职位详情点「立即沟通」', '顶部职位/薪资/阶段常驻', '输入栏「发简历/发邀约/换手机号」，卡片走同意/拒绝双动作'],
    chat: {
      title: 'HR · 王女士',
      bannerTitle: '资深前端工程师',
      bannerDesc: '25-35K · 环信科技 · 简历初筛',
      quickReplies: [
        { label: '期望薪资', text: '我的期望薪资是 25-30K' },
        { label: '到岗时间', text: '我可以在两周内到岗' },
        { label: '面试时间', text: '周五下午方便安排面试' }
      ],
      extraMenus: [{ ...CONTEXT_MENU, text: '查看职位' }],
      cards: [
        {
          label: '简历卡片',
          entryLabel: '发简历',
          entryIcon: 'person-card',
          event: 'resumeCard',
          params: { jobId: 'J-2048', candidateId: 'U-3301' },
          ext: {
            title: '张伟 · 资深前端',
            subtitle: '8 年经验 · 期望 25-30K · 两周到岗',
            badge: '已投递',
            icon: 'person-card',
            fields: [
              { label: '岗位', value: '资深前端工程师' },
              { label: '经历', value: '两段中大厂 · 带 4 人' },
              { label: '技能', value: 'Vue / TS / 性能优化' }
            ],
            footer: '简历附件已发送，可在线预览',
            actionText: '查看简历',
            actionKey: 'resume-open',
            secondaryText: '约面试',
            secondaryKey: 'resume-interview'
          }
        },
        {
          label: '面试邀约',
          entryLabel: '发邀约',
          entryIcon: 'calendar',
          event: 'interviewInvite',
          params: { jobId: 'J-2048' },
          ext: {
            title: '面试邀约 · 周五 15:00',
            subtitle: '资深前端工程师 · 技术二面',
            badge: '待确认',
            icon: 'calendar',
            fields: [
              { label: '轮次', value: '技术二面' },
              { label: '方式', value: '线上视频' },
              { label: '时长', value: '45 分钟' }
            ],
            footer: '环信科技 · 王女士',
            actionText: '确认参加',
            actionKey: 'interview-accept',
            secondaryText: '改期',
            secondaryKey: 'interview-reschedule'
          }
        },
        {
          label: '交换手机号',
          entryLabel: '换手机号',
          entryIcon: 'phone-filled',
          event: 'phoneExchange',
          params: { phone: '13812346621' },
          ext: {
            title: '交换手机号申请',
            subtitle: '候选人 张伟 · 资深前端工程师',
            badge: '待授权',
            icon: 'phone-filled',
            fields: [
              { label: '岗位', value: '资深前端工程师' },
              { label: '阶段', value: '简历初筛' }
            ],
            footer: '双方同意后可见完整号码',
            actionText: '同意交换',
            actionKey: 'phone-accept',
            secondaryText: '暂不',
            secondaryKey: 'phone-decline'
          }
        }
      ],
      textLabel: '求职追问',
      textContent: '我对这个职位很感兴趣，想了解一下团队情况',
      extraExt: { jobId: 'J-2048', stage: 'resume' },
      noticeLabel: '进度提示',
      noticeText: 'HR 已查看你的简历',
      contextDialogTitle: '业务动作 · 查看职位'
    }
  },
  {
    key: 'education',
    name: '家校沟通',
    tagline: '班级群 + 公告 + @老师 + 作业/请假卡片，家长与班主任的日常协同',
    icon: 'board',
    accent: '#FF7A45',
    chatType: 'groupChat',
    peerLabel: '班主任',
    metricLabel: '家长会',
    metricValue: '周五 19:00',
    fields: [
      { label: '班级', value: '三年级二班' },
      { label: '班主任', value: '李老师' },
      { label: '本周作业', value: '3 项' },
      { label: '家长会', value: '周五 19:00' }
    ],
    capabilities: ['群聊 groupChat', '群公告条', '@提及', '输入栏发作业/请假审批', '双动作按钮'],
    steps: ['班级通知页进入班级群', '群公告/成员昵称行原生呈现', '@老师 + 输入栏「发作业/请假审批」，家长直接提交审批卡'],
    chat: {
      title: '三年级二班',
      bannerTitle: '班级公告',
      bannerDesc: '周五家长会 19:00 · 请准时参加',
      quickReplies: [
        { label: '收到', text: '收到，谢谢老师' },
        { label: '请假', text: '孩子今天需要请假，麻烦老师批一下' },
        { label: '作业咨询', text: '请问今天的数学作业是哪几页？' }
      ],
      extraMenus: [{ ...CONTEXT_MENU, text: '查看作业' }],
      cards: [
        {
          label: '作业卡片',
          entryLabel: '发作业',
          entryIcon: 'board',
          event: 'homeworkCard',
          params: { classId: 'C-302' },
          ext: {
            title: '今日作业 · 3 项',
            subtitle: '数学 / 语文 / 英语',
            badge: '截止 21:00',
            icon: 'board',
            fields: [
              { label: '数学', value: '练习册 P32-34' },
              { label: '语文', value: '背诵古诗两首' },
              { label: '英语', value: '跟读 Unit 5' }
            ],
            footer: '李老师 · 三年级二班',
            actionText: '查看作业',
            actionKey: 'homework-open'
          }
        },
        {
          label: '请假审批',
          entryLabel: '请假审批',
          entryIcon: 'circle-checked-filled',
          event: 'leaveApproval',
          params: { studentId: 'S-0912' },
          ext: {
            title: '请假申请',
            subtitle: '学生 李小明 · 三年级二班',
            badge: '待审批',
            icon: 'circle-checked-filled',
            fields: [
              { label: '时间', value: '今天下午' },
              { label: '事由', value: '发烧就医' },
              { label: '家长', value: '李女士' }
            ],
            footer: '请假记录将同步班级考勤',
            actionText: '同意',
            actionKey: 'leave-approve',
            secondaryText: '驳回',
            secondaryKey: 'leave-reject'
          }
        }
      ],
      textLabel: '请假说明',
      textContent: '老师您好，孩子今天有点发烧，需要请假',
      extraExt: { classId: 'C-302', studentId: 'S-0912' },
      noticeLabel: '班级通知',
      noticeText: '李老师 发布了新的班级通知',
      contextDialogTitle: '业务动作 · 查看作业'
    }
  },
  {
    key: 'community',
    name: '兴趣社群',
    tagline: '同好群 + 活动公告 + 活动/装备卡片，社区俱乐部的轻运营形态',
    icon: 'bubble-hashtag',
    accent: '#00B8A9',
    chatType: 'groupChat',
    peerLabel: '群主',
    metricLabel: '活动时间',
    metricValue: '周六 7:30',
    fields: [
      { label: '圈子', value: '城市骑行社' },
      { label: '成员', value: '128 人' },
      { label: '话题', value: '#周末骑行路线#' },
      { label: '活动', value: '周六 7:30' }
    ],
    capabilities: ['群聊 groupChat', '@提及', '群公告', '输入栏发活动/装备清单', '双动作按钮'],
    steps: ['社群首页进入群聊', '公告/成员昵称/群成员数原生呈现', '@群主 + 输入栏「发活动/装备清单」，点卡片报名/收藏'],
    chat: {
      title: '城市骑行社',
      bannerTitle: '群公告',
      bannerDesc: '周六 7:30 城市绿道集合 · 佩戴头盔',
      quickReplies: [
        { label: '报名', text: '我报名参加周六活动' },
        { label: '路线', text: '请问路线和集合点在哪里？' },
        { label: '装备', text: '需要准备哪些装备？' }
      ],
      extraMenus: [{ ...CONTEXT_MENU, text: '查看活动' }],
      cards: [
        {
          label: '活动卡片',
          entryLabel: '发活动',
          entryIcon: 'bubble-hashtag',
          event: 'activityCard',
          params: { activityId: 'A-0712' },
          ext: {
            title: '周六骑行活动',
            subtitle: '城市绿道 · 20km',
            badge: '剩 6 位',
            icon: 'bubble-hashtag',
            fields: [
              { label: '集合', value: '周六 7:30' },
              { label: '路线', value: '绿道往返' },
              { label: '费用', value: 'AA' }
            ],
            footer: '城市骑行社 · 128 人',
            actionText: '报名',
            actionKey: 'activity-join',
            secondaryText: '详情',
            secondaryKey: 'activity-detail'
          }
        },
        {
          label: '装备清单',
          entryLabel: '装备清单',
          entryIcon: 'list',
          event: 'gearList',
          params: { activityId: 'A-0712' },
          ext: {
            title: '骑行装备清单',
            subtitle: '群主整理 · 6 项',
            badge: '建议收藏',
            fields: [
              { label: '头盔', value: '必备' },
              { label: '车灯', value: '前后灯' },
              { label: '补给', value: '水 1L' }
            ],
            footer: '出发前 10 分钟检查胎压',
            actionText: '保存清单',
            actionKey: 'gear-save'
          }
        }
      ],
      textLabel: '报名咨询',
      textContent: '周六的活动还有名额吗？',
      extraExt: { activityId: 'A-0712' },
      noticeLabel: '群通知',
      noticeText: '群主 发布了新的群公告',
      contextDialogTitle: '业务动作 · 查看活动'
    }
  }
]

export function scenarioOf(key: string): ScenarioConfig {
  const found = SCENARIO_LIST.find((item) => item.key === key)
  return found != null ? found : SCENARIO_LIST[2]
}
