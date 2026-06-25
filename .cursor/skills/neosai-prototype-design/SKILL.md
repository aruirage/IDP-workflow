---
name: neosai-prototype-design
description: >-
  NeosAI IDP/LLMOCR 高保真前端原型设计规范。基于 Vue 3、Element Plus、UnoCSS 与项目设计组件约定，
  生成一致的后台页面与原型。凡涉及前端页面设计、高保真原型、IDP、LLMOCR、OCR抽出、标注、文件预览、
  上传、表单、表格、布局、主题色或 UI 组件时，必须先读取并严格遵循本 Skill。
---

# NeosAI 原型设计规范

## 强制工作流

进行**任何**前端原型页面设计、页面实现或 UI 调整前，**必须**：

1. 读取本 Skill（`SKILL.md`）
2. 若需完整 token、组件清单或源码路径，再读 [reference.md](reference.md)
3. 设计完成后，用下方「一致性检查清单」逐项自检

**禁止**在未遵循本规范的情况下生成页面代码或原型 HTML/Vue。

---

## 品牌与 Logo（硬约束）

- 系统**无独立产品名称文案**；左上角**仅展示 Logo**，不追加「NeosAI」「IDP」「LLMOCR」等系统标题文字
- Logo 文件：`logo-CWaP-1CB.png`（项目根目录）；原型中引用该路径或复制到 `assets/logo.png` 后引用
- Logo 置于**全宽顶栏第一行**左侧（`padding-left: 8px`），与侧栏列左缘对齐；右侧为个人信息
- 侧栏从**第二行**起，仅含菜单切替与导航，**不含** Logo
- Logo 行横跨整页，不受侧栏列宽限制

### 顶栏两行结构（硬约束）

| 行 | 高度 | 内容 | 对齐 |
| --- | --- | --- | --- |
| **第一行** | `--logo-height`（48px） | **全宽**：左 Logo、右个人信息 | 横跨侧栏+主内容区 |
| **第二行** | `--tags-view-height`（32px） | **仅侧栏列**：菜单切替（列宽内靠右）；主内容区不设第二行 | 侧栏右边框从本行起 |

```
┌──────────────────────────────────────────────────────────┐
│ [Logo]                                   [ユーザー ▼] │  48px 全宽第一行
├──────────┬───────────────────────────────────────────────┤
│    [≡]   │  ContentWrap …                                │
│  侧栏    │                                               │
│  菜单    │                                               │
└──────────┴───────────────────────────────────────────────┘
```

- **禁止**将菜单切替放在主内容区顶栏右侧（整页靠右）
- 切替按钮位于侧栏第二行，**侧栏列宽范围内靠右对齐**
- **主内容区**顶栏仅第一行（Logo + 用户），**不**设第二行占位，**不** sticky / fixed 冻结
- 实现参考：`AppSidebar.vue`（切替）、`AppLayout.vue`（主区滚动容器）

```html
<!-- 原型布局 Logo 示例 -->
<div class="logo-area" style="height: var(--logo-height, 48px);">
  <img src="logo-CWaP-1CB.png" alt="Logo" style="height: 32px; object-fit: contain;" />
</div>
```

---

## 字体与业务术语

### 字体

- 原型全局字体：**Noto Sans JP**（Google Fonts）
- CSS 变量：`--app-font-family: 'Noto Sans JP', sans-serif`
- Element Plus 同步：`--el-font-family` 与 `--app-font-family` 一致

### 业务术语（日语界面）

- 原「認識 / 识别」阶段统一为 **OCR抽出**
- 示例：OCR抽出確認、OCR抽出完了、OCR抽出中、要分割OCR抽出
- 状态码：`OCR_EXTRACTING`（不用 `RECOGNIZING`）
- 产品方案详见 `product-spec.zh-CN.md`

### 案件列表字段

- **案件番号**：系统自动採番，只读（`CLAIM-2025-xxxxx`）
- **案件元**：保険金**請求番号**（`REQ-2025-xxxxxxx`），只读
- **取込元フォルダ名**：上传来源文件夹，只读
- 証券番号、氏名等出现在 OCR 抽出结果 / 案件詳細，不作为列表硬编码列

---

## 日式交互与留白（硬约束）

面向日本 B2B / 業務システム的交互气质：**克制、直接、留白、用户思维**。

### 按钮

- **实心主按钮（primary，非 link）**：常时**实心**主题色底 + 白字；**hover 不变色、不浮起、不加阴影**
- 须用 `.el-button--primary:not(.is-link)` 选择器（link 也带 `--primary` 类名，勿误伤）
- **链接按钮（link）**：透明底 + **主题色文字**；禁止白字
- **确认弹窗（MessageBox）**：主按钮文案统一 **OK**；取消按钮 **キャンセル**；使用 `MESSAGE_BOX_CONFIRM_DEFAULTS`（`src/constants/messageBox.ts`）
- **禁止**：渐变、scale、强 shadow、hover 时色相大幅变化

### 可点击卡片（任务卡片等）

- **保留** hover 边框高亮 + 轻 shadow 反馈（与实心主按钮规则分离）
- **禁止**在标题下生成解释说明 / 副标题文案；仅保留标题 + 必要操作

### 统计卡片 / 列表

- 统计卡片：**静态展示**，hover 不加阴影/边框动画
- 表格行 hover：浅灰底，不用彩色

### 动效

- **实心主按钮**：无 transition
- **可点击卡片**：可有 border/shadow 过渡
- 侧栏菜单：选中态用主题浅色底；未选中 hover 仅中性灰

### 适老化 Typography

- 正文 / 表格 / 链接：**≥ 15px**（`--app-font-size-base`）
- 页面标题：**28px**；区块标题：**18px**
- **禁止** 13px 及以下说明性小字

### 留白与信息

- 模块间距充足，避免挤满色块
- 一屏一个主要 CTA（如「新規アップロード」），其余降级为 link
- 状态用文案 + 必要语义色，不用动效博 attention
- **禁止**标题下的解释性副文案（如图卡片红框区域）

实现参考：`src/styles/element-overrides.scss`

---

## 技术栈与组件选型

| 层级 | 约定 |
| --- | --- |
| 框架 | Vue 3 + Vite + TypeScript |
| UI 库 | Element Plus `2.9.1` |
| 样式 | UnoCSS 原子类 + SCSS（scoped） |
| 布局 | 使用已有布局，默认 `left`（顶栏 + 左侧可折叠菜单） |
| 命名 | `useDesign()` → 前缀 `v-`，如 `v-content-wrap` |

### 页面结构（后台页）

1. `ContentWrap` 承载主区域
2. 查询区 → `Search`
3. 列表 → `Table` 或 `ElTable` + `Pagination`
4. 弹窗 → `Dialog`；表单 → `Form` + `schema`
5. 图标 → 全局 `Icon`
6. 颜色 → CSS 变量，**禁止**散落硬编码色值
7. 文案 → `useI18n()` / 语言文件

### IDP / LLMOCR 业务组件

优先复用已有业务组件，设计前先确认其数据结构与事件：

| 场景 | 组件路径 |
| --- | --- |
| 票据/图像标注 | `src/components/Annotation` |
| OCR 抽出结果与操作 | `src/components/Recognize` |
| 文件预览 | `src/components/FilePreview`、`src/components/vueOfficePreview` |
| 上传 | `src/components/UploadFile` |
| 动态表单 | `src/components/FormCreate` |
| 图表 | `src/components/Echart` |

---

## 主题与颜色（必须使用 CSS 变量）

| Token | 值 |
| --- | --- |
| 主色 `--el-color-primary` | `#175CD3` |
| 危险色 | `#e31b54` |
| 页面背景 `--app-content-bg-color` | `#fafafa` |
| 菜单/头部背景 | `#fff` |
| 悬停蓝 | `#357af2` |
| 按下蓝 | `#0f51c5` |
| 禁用灰 | `#d5d7da` |

### 色彩克制原则（硬约束）

除**成功、失败、异常**三类语义外，界面**不应**大量使用彩色状态标识，避免花哨。

| 场景 | 可用颜色 | 示例 |
| --- | --- | --- |
| **默认 / 常规** | 主题色 `--el-color-primary` + 中性灰 | 按钮、链接、图标底、进度条、进行中步骤、统计卡片 |
| **成功** | `--el-color-success` | PASS、処理完了、导出成功 |
| **失败** | `--el-color-danger` | FAIL、画質不合格、エラー Alert |
| **异常 / 要确认** | `--el-color-warning` | WARNING、要確認、需人工介入 |

**禁止**：

- 为不同业务模块（前処理 / OCR / 导出等）分配不同强调色
- 普通流程状态 Tag 使用 `success` / `info` / `warning` 混排
- 统计卡片、任务卡片按类型刷绿/黄/蓝

**推荐**：

- 列表状态：常规 → 默认 Tag 或纯文本；仅异常/失败/成功时上色
- 进度条、步骤点：统一主题色；未完成用灰色
- 主操作、可点击入口：主题色

```scss
color: var(--el-color-primary);
background: var(--app-content-bg-color);
transition: all var(--transition-time-02);
```

---

## 布局变量

| 变量 | 默认 |
| --- | --- |
| `--left-menu-max-width` | `200px` |
| `--left-menu-min-width` | `64px` |
| `--logo-height` / `--top-tool-height` | `48px` |
| `--tags-view-height` | `32px` |
| `--top-header-total-height` | `logo-height + tags-view-height`（80px） |
| `--app-content-padding` | `0` |
| `--transition-time-02` | `0.2s` |

- 不在业务页重复实现整体框架（顶栏、侧栏、标签页）
- 间距、flex、宽高优先 UnoCSS（如 `wh-full`）；边框用 `layout-border__*`；可点击区域用 `v-interactive`

---

## 原型页面模板

高保真原型应包含以下骨架（Vue 或静态 HTML 均可，但样式 token 必须一致）：

```
┌──────────┬──────────────────────────────────────────────┐
│  (占位)  │  [Logo]                         [ユーザー ▼] │  48px（主区随滚动）
│    [≡]   │  ContentWrap                               │
│  侧栏    │    ├─ Search（查询区）                     │
│  200px   │    ├─ 主内容（Table / 标注 / 预览 / OCR抽出）  │
│          │    └─ Pagination / Dialog                │
└──────────┴──────────────────────────────────────────────┘
```

### IDP 典型页面

- 文档列表 + 上传 + 预览 + 字段抽取结果
- 模板/规则配置 + 表单 schema
- 标注工作台：`Annotation` + `FilePreview` 分栏

### LLMOCR 典型页面

- OCR 抽出任务列表 + 批量上传
- OCR 抽出详情：`Recognize` + 原图/结果对照
- 模型/提示词配置（Form + Dialog）

---

## 国际化

- 语言文件：`src/locales/zh-CN.ts`、`ja.ts`、`en.ts`
- 按钮/提示复用 `common.query`、`common.reset`、`common.back` 等
- 新增页面同步维护 `zh-CN` 与 `ja`

---

## 一致性检查清单

交付前逐项确认：

- [ ] 已读本 Skill 与 reference（如需）
- [ ] 左上角仅有 Logo，无系统名称文字
- [ ] 主区顶栏仅一行（Logo+用户），随滚动不冻结；菜单切替仅在侧栏第二行
- [ ] 主色、背景、过渡使用 CSS 变量
- [ ] 色彩克制：常规态用主题色+中性灰；仅成功/失败/异常使用语义色
- [ ] 使用 ContentWrap / Search / Table / Dialog 等约定组件
- [ ] 布局未重复实现框架，侧栏宽度与顶栏高度符合变量
- [ ] UnoCSS 优先于内联样式；复杂样式放 scoped SCSS
- [ ] IDP/LLMOCR 场景优先复用 Annotation、Recognize、FilePreview、UploadFile
- [ ] 全局字体为 Noto Sans JP
- [ ] 界面日语使用 OCR抽出，不用「認識」
- [ ] 日式交互：仅实心主按钮无 hover 动效；link 为主题色字；任务卡片 hover 保留
- [ ] 无标题下解释性副文案；字号 ≥15px
- [ ] 文案走 i18n，无硬编码中文/日文混排遗漏

---

## 延伸阅读

完整组件索引、源码路径与 UnoCSS 规则见 [reference.md](reference.md)。
