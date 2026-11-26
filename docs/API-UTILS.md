# Utils

以下公开工具从 `@/uni_modules/easemob-uikit-uni/libs` 导入。

## 只读数据与展示

- `userStore`、`displayNameOf()`、`avatarOf()`、`mergeUserInfo()`：用户资料缓存与展示回落；业务身份注入使用 `EmKit.setUserPresentation()`。
- `contactStore`、`contactDisplayNameOf()`、`pendingInviteCount()`、`contactRequestUnreadCount`：联系人与申请数据。
- `conversationStore`、`totalConversationUnread`、`conversationUnreadCountOf()`：会话与未读数据。
- `groupStore`、`groupDisplayNameOf()`、`groupMemberDisplayNameOf()`、`sortGroupMembers()`：群与成员数据。
- `ensureUserInfos(userIds)`：批量预取用户资料。
- `setPinyinAdapter()`、`groupContacts()`、`matchContact()`、`resolveAlphabetKeyByOffsetY()`：拼音与字母分组。
- `filterActiveMentions()`、`parseMentions()`：@ 提及过滤与解析。
- `isStreamActive()`、`isStreamTerminal()`、`isPlainTextStream()`、`isRichStream()`：流式状态判定。

## 平台与媒体

- `PLATFORM_CAPABILITIES`、`isPageVisible()`：平台能力与页面可见性。
- `checkNetworkOnce()`：一次性探测系统网络状态，返回 `Promise<boolean | null>`；`null` 表示无法确定，不应据此阻断业务请求。
- `subscribeNetworkStatus(listener)`：监听系统网络连通性变化，返回取消订阅函数；页面卸载时必须调用。
- `chooseImage()`、`previewImage()`、`chooseVideo()`、`chooseFile()`：媒体选择与预览。
- `getCameraAuthorizeState()`：相机授权预检。
- `canOpenAuthorizeSetting()`：返回当前平台是否提供可用的系统授权设置入口；App 与微信小程序为 `true`，H5 为 `false`。
- `openAppAuthorizeSetting()`：打开系统授权设置；App 使用 `uni.openAppAuthorizeSetting`，微信小程序使用 `uni.openSetting`。调用前可用 `canOpenAuthorizeSetting()` 判断是否展示设置按钮。
- `isAlbumAuthDenied(error)`：识别图片/视频读取与相册保存的权限错误；支持 `errCode=1101005` 和跨端权限错误文本。
- `setAttachmentProvider()`、`refreshAttachmentAvailability()`、`hasAttachmentProvider()`、`canPickAttachment()`、`attachmentCapability()`、`pickAttachments()`、`resolveAttachment()`：附件能力。
- `startRecord()`、`stopRecord()`、`isRecording()`、`playAudio()`、`stopAudio()`：录音与播放。`stopRecord()` 在同一轮停止过程中重复调用会共享同一个 Promise；录音取消时该 Promise 以 `ERROR_CODE.RECORD_CANCELLED` 拒绝，原生录音错误也会使其拒绝，调用方需要处理异常。
- `setStorage()`、`getStorage()`：跨端本地存储。
- `copyText(text)`：复制文本，返回 `Promise<void>`。
- `downloadAttachment(message, options?)`：下载附件，返回 `Promise<EmMessageDownloadResult>`。
- `downloadKindOf(message)`、`downloadUrlOf(message)`、`attachmentFileNameOf(message, kind)`：分别解析消息的附件类型、原始下载地址与下载文件名，供宿主自绘附件卡或自定义下载流程复用。
- `downloadRequestUrlOf(message, kind)`：返回带环信重定向参数与附件 secret 的实际下载请求地址，供宿主转发或自定义下载流程复用。
- `getSafeAreaTop()`、`getSafeAreaBottom()`、`nextZIndex()`：安全区与浮层层级。

平台差异见[平台能力与差异](./PLATFORM.md)，附件协议见[平台与媒体类型](./API-TYPES-PLATFORM.md)。

## 日志与 SDK 加载

- `createLogger(ns)`、`setLogLevel(level)`、`getLogLevel()`、`getLogText()`、`clearLogBuffer()`、`getLogBufferSize()`、`logPayload()`。
- `ensureSdkModule()`、`setSdkLoader()`、`setSdkModule()`：小程序 SDK 加载注入口，通常由配置驱动。
