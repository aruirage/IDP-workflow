# NeosAI 设计组件规范（完整参考）

> 基于项目代码整理。原型设计时与 SKILL.md 配合使用。最后整理：2026-06-15。

## 1. 技术与组件基础

- 前端：Vue 3、Vite、TypeScript、Element Plus、UnoCSS、SCSS
- Element Plus：`2.9.1`
- 自定义组件：`src/components`
- 布局组件：`src/layout/components`
- 全局样式：`src/styles`
- 主题/尺寸/暗色/布局状态：`src/store/modules/app.ts`

## 2. 设计规范相关源码

| 类型 | 位置 | 说明 |
| --- | --- | --- |
| 全局样式入口 | `src/styles/index.scss` | 变量、主题、FormCreate；覆盖按钮、单选、表格悬停、消息框 |
| CSS 变量 | `src/styles/var.css` | 菜单、头部、内容区、过渡时间 |
| SCSS 命名空间 | `src/styles/variables.scss` | `$namespace: v`，`$elNamespace: el` |
| SCSS 模块变量 | `src/styles/global.module.scss` | 暴露 namespace 给 `useDesign` |
| 主题状态 | `src/store/modules/app.ts` | 主题色、布局、暗色、尺寸、菜单折叠 |
| UnoCSS | `uno.config.ts` | `custom-hover`、布局边框、`wh-full` 等 |
| Element Plus 注册 | `src/plugins/elementPlus/index.ts` | ElLoading、ElScrollbar、ElButton |
| 全局组件 | `src/components/index.ts` | Icon、FormTable |
| 国际化 | `src/locales/zh-CN.ts`、`ja.ts`、`en.ts` | 多语言文案 |

## 3. 命名与样式约定

```ts
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('content-wrap')
// → v-content-wrap
```

新增公共组件继续使用 `useDesign` 前缀，避免冲突。

## 4. 主题与颜色

| 用途 | 值 |
| --- | --- |
| 主色 `elColorPrimary` | `#175CD3` |
| 危险色 | `#e31b54` |
| 页面背景 | `#fafafa` |
| 左侧菜单/头部背景 | `#fff` |
| 悬停蓝 | `#357af2` |
| 按下蓝 | `#0f51c5` |
| 禁用灰 | `#d5d7da` |

主题色经 `setCssVarTheme()` 写入 CSS 变量；`setPrimaryLight()` 生成 `--el-color-primary-light-*` 与 `--el-color-primary-dark-2`。

## 5. 布局

渲染逻辑：`src/layout/components/useRenderLayout.tsx`

| 模式 | 说明 |
| --- | --- |
| `left` | 默认：顶栏 + 左侧可折叠菜单 |
| `classic` | 经典左侧菜单 |
| `topLeft` | 顶栏 + 左侧菜单 |
| `top` | 顶部菜单 |
| `cutMenu` | 分栏菜单 |

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `--left-menu-max-width` | `200px` | 侧栏展开 |
| `--left-menu-min-width` | `64px` | 侧栏折叠 |
| `--logo-height` | `48px` | Logo/顶栏高度 |
| `--top-tool-height` | `var(--logo-height)` | 顶栏高度 |
| `--tags-view-height` | `32px` | 标签页 |
| `--app-content-padding` | `0` | 内容区内边距 |
| `--transition-time-02` | `0.2s` | 过渡 |

## 6. UnoCSS

快捷类：

- `wh-full` → `w-full h-full`

自定义规则：

- `v-interactive` — 可点击区域，hover 仅中性灰底（**不用** `custom-hover`）
- `layout-border__left` / `__right` / `__top` / `__bottom`

建议：布局用原子类；边框用自定义规则；复杂样式放 scoped SCSS 或全局样式。

## 6.1 色彩克制（原型）

- 常规 UI：主题色 + 中性灰
- 语义色仅限：成功（绿）/ 失败（红）/ 异常·要確認（黄）
- 详见 SKILL.md「色彩克制原则」

## 6.2 日式交互（原型）

- 实心主按钮：`:not(.is-link)`；link 按钮主题色字
- 任务卡片：保留 hover 边框+shadow；无标题下说明文
- 字号：`--app-font-size-base` 15px 起
- 详见 SKILL.md「日式交互与留白」

## 7. 国际化

```ts
const { t } = useI18n()
```

- 标题、按钮、提示、校验写入语言文件
- 复用 `common.*` key
- 中日双语同步 `zh-CN.ts` 与 `ja.ts`

## 8. 页面开发结构

1. ContentWrap
2. Search（查询）
3. Table / ElTable + Pagination
4. Dialog（增删改详情）
5. Form + schema
6. Icon
7. CSS 变量着色
8. i18n 文案
9. 复杂页用领域组件：Annotation、Recognize、FilePreview、UploadFile 等

## 9. 业务组件

| 类型 | 位置 |
| --- | --- |
| 标注 | `src/components/Annotation` |
| OCR 抽出 | `src/components/Recognize` |
| 预览 | `src/components/FilePreview`、`vueOfficePreview` |
| 上传 | `src/components/UploadFile` |
| 表单设计 | `src/components/FormCreate` |
| 图表 | `src/components/Echart` |
| 页面装修 | `DiyEditor`、`MagicCubeEditor` |

使用前阅读目录内 `index.vue`、`config.ts`、`data.js` 或 hooks，确认数据结构与事件契约。

## 10. Logo 与品牌（原型专用）

- 文件：`logo-CWaP-1CB.png`（项目根目录）
- 位置：顶栏**第一行**左上角，高度 48px 区域内
- **禁止**在 Logo 旁显示系统名称或其他品牌文字
- Logo 即唯一品牌标识

## 11. 原型顶栏两行布局

| 行 | 变量 | 内容 |
| --- | --- | --- |
| 第一行 | `--logo-height` | **全宽**：左 Logo、右用户信息；侧栏不含 Logo |
| 第二行 | `--tags-view-height` | **仅侧栏**：菜单切替（列内靠右）；主内容区无第二行 |
| 主区滚动 | — | 顶栏随内容滚动，不 sticky / fixed |

- 顶栏：`AppHeader.vue`；切替：`AppSidebar.vue`；布局：`AppLayout.vue`
