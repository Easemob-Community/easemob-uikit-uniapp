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
- `chooseImage()`、`previewImage()`、`chooseVideo()`、`chooseFile()`：媒体选择与预览。
- `getCameraAuthorizeState()`、`openAppAuthorizeSetting()`：相机授权预检与系统设置。
- `setAttachmentProvider()`、`refreshAttachmentAvailability()`、`hasAttachmentProvider()`、`canPickAttachment()`、`attachmentCapability()`、`pickAttachments()`、`resolveAttachment()`：附件能力。
- `startRecord()`、`stopRecord()`、`isRecording()`、`playAudio()`、`stopAudio()`：录音与播放。`stopRecord()` 在同一轮停止过程中重复调用会共享同一个 Promise；录音取消时该 Promise 以 `ERROR_CODE.RECORD_CANCELLED` 拒绝，原生录音错误也会使其拒绝，调用方需要处理异常。
- `setStorage()`、`getStorage()`：跨端本地存储。
- `copyText(text)`：复制文本，返回 `Promise<void>`。
- `downloadAttachment(message, options?)`：下载附件，返回 `Promise<EmMessageDownloadResult>`。
- `getSafeAreaTop()`、`getSafeAreaBottom()`、`nextZIndex()`：安全区与浮层层级。

平台差异见[平台能力与差异](./PLATFORM.md)，附件协议见[平台与媒体类型](./API-TYPES-PLATFORM.md)。

## 日志与 SDK 加载

- `createLogger(ns)`、`setLogLevel(level)`、`getLogLevel()`、`getLogText()`、`clearLogBuffer()`、`getLogBufferSize()`、`logPayload()`。
- `ensureSdkModule()`、`setSdkLoader()`、`setSdkModule()`：小程序 SDK 加载注入口，通常由配置驱动。
