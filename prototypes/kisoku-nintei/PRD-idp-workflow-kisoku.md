# PRD：規則設定 — IDP Workflow 编辑器（Dify 式）

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 日期 | 2026-06-17 |
| 产品模块 | NeosAI IDP / 規則設定（业务场景工作流配置） |
| 界面语言 | 日语（UI 文案） |
| 目标交付 | 高保真可交互 HTML 原型（Vue 3 + Element Plus）或正式前端页面 |
| 参考视觉 | Dify / LangFlow 式节点画布；用户提供 IDP Workflow Platform 三栏布局参考图 |

---

## 1. 背景与目标

### 1.1 背景

NeosAI 是面向日本保险行业的智能文档处理（IDP）平台。运营人员需要在「規則設定」模块中，为每个**业务场景（業務シーン）**配置从文档输入到 OCR 抽出、AI 验证、人工确认再到输出的完整处理流水线。

旧版原型采用顶部 Tab + 线性节点列表，不符合现代 Workflow 编辑器的操作习惯。本次改版目标是 **Dify 式可视化工作流编辑器**：左侧节点库拖拽、中央画布连线、右侧上下文配置。

### 1.2 核心目标

1. **去掉顶部产品 Tab**，規則設定作为独立工作区页面。
2. **左侧业务场景栏可折叠**，节省横向空间。
3. **中央画布**展示可拖拽、可连线的节点流程（含条件分岔）。
4. **右侧 Inspector** 随选中节点切换配置面板（保留既有业务配置能力）。
5. 每个业务场景独立保存一套 `workflow` + 各节点业务配置。

### 1.3 非目标（本期不做）

- 画布 zoom / pan（缩放平移）
- 用户手动新增/删除连线、删除节点（可 Phase 2）
- 底部「设计方针 / I/O 对照表」信息面板（可 Phase 2）
- 帳票読取、帳票タイプ設定、セキュリティ設定 的完整页面（仅保留内部跳转链接）
- 后端 API 联调（原型用 localStorage 模拟持久化即可）

---

## 2. 用户与场景

| 角色 | 诉求 |
| --- | --- |
| 业务配置员 | 为「医療保険（通院給付）請求」等场景配置 OCR→验证→输出流程 |
| 审核规则管理员 | 配置 Master 照合工具链、文本/数据验证规则 |
| 运营主管 | 切换场景、查看 Phase 进度、保存配置 |

**典型用例**

1. 从左侧选择业务场景 → 画布加载该场景默认 workflow。
2. 从节点库拖入「前処理ノード」→ 点击节点 → 右侧配置旋转/分割开关。
3. 点击「AI検証ノード」→ 右侧配置 Master 照合规则 + 文本/数据验证规则。
4. 点击菱形分岔「OCR確認必要？」→ 右侧编辑分岔标签。
5. 点击「保存」→ 当前场景配置写入 localStorage。

---

## 3. 信息架构

```
規則設定页面
├── 顶栏：Logo | 規則設定 + 当前场景名 | 用户
├── 业务场景栏（可折叠）
│   ├── 搜索
│   └── 场景列表（5 条 mock 数据）
└── 主工作区
    ├── Workflow 顶栏：IDP Workflow | Phase1/2/3 | シーン設定 | リセット | 保存
    └── 三栏
        ├── 左：ノードライブラリ
        ├── 中：画布（点阵背景 + 节点卡片 + SVG 连线）
        └── 右：ノード設定 / シーン設定 Inspector
```

**明确删除**：原顶部 `product-tabs`（帳票読取 / 規則設定 / 帳票タイプ設定 / セキュリティ設定）。

---

## 4. 页面布局规格

### 4.1 顶栏（48px）

| 区域 | 内容 | 规则 |
| --- | --- | --- |
| 左 | Logo 图片 `logo-CWaP-1CB.png` | **禁止**追加 NeosAI / IDP 等产品名文字 |
| 中 | `規則設定` + 当前场景名（灰色副标题） | 仅 kisoku 模块显示 |
| 右 | 用户头像 + 用户名 | mock：`qianjun` |

### 4.2 业务场景栏

| 状态 | 宽度 | 内容 |
| --- | --- | --- |
| 展开 | ~240px | 标题「業務シーン」、搜索框、场景全称列表 |
| 折叠 | 52px | 折叠按钮 `›`、每项仅显示场景名首字 |

- 折叠按钮：`‹` 折叠 / `›` 展开
- 选中项：左侧 3px 主题色竖条 + 浅蓝背景 `#eff4ff`
- 搜索 placeholder：`検索`

**Mock 场景列表**

| ID | 名称 |
| --- | --- |
| 2064639102406844416 | 医療保険（通院給付）請求 |
| 2064639102406844417 | 医療保険（入院給付）請求 |
| 2064639102406844418 | 保険金請求（標準） |
| 2064639102406844419 | 新規契約・告知受領 |
| 2064639102406844420 | 保険金・給付金請求 |

### 4.3 Workflow 顶栏

```
IDP Workflow  [Phase1 基本]  Phase2 自動化  Phase3 拡張     シーン設定 | リセット | 保存
```

- Phase1 为 active 态（主题色底或下划线）
- Phase2/3 为 disabled 展示态（灰色，不可点）
- 「保存」为主按钮 solid primary

### 4.4 三栏工作区（grid）

| 列 | 宽度 | 内容 |
| --- | --- | --- |
| 节点库 | 220px | 固定宽，可纵向滚动 |
| 画布 | flex 1 | 灰色点阵背景 `#eef0f3`，overflow hidden |
| Inspector | 380px | 固定宽，纵向滚动 |

---

## 5. 节点库（ノードライブラリ）

### 5.1 节点类型（6 + 分岔）

| type | 分类 | 库中名称 | 卡片 accent（仅节点识别条，非全局模块色） |
| --- | --- | --- | --- |
| `input` | 入力 | ドキュメント入力 | `#175cd3` |
| `preprocess` | 前処理 | 前処理ノード | `#079455` |
| `ocr` | OCR抽出 | OCR抽出ノード | `#6941c6` |
| `confirm` | 確認待機 | 手動確認ノード | `#dc6803` |
| `ai_verify` | AI検証 | AI検証ノード | `#7c3aed` |
| `output` | 出力 | 出力ノード | `#039855` |
| `decision` | 分岐 | 分岐ノード | `#667085`（菱形） |

库卡片支持 **dragstart**，拖到画布 `drop` 后在落点创建节点。

### 5.2 画布节点卡片结构（非 decision）

```
┌─────────────────────────────┐
│ [badge]  节点标题            │  ← header，左侧 3px accent 色条
├─────────────────────────────┤
│ • 任务1                      │
│ • 任务2                      │  ← tasks 列表
│ • 任务3                      │
├─────────────────────────────┤
│ 入力  Document               │
│ 出力  Processed Doc          │  ← IO 行
└─────────────────────────────┘
```

**节点 meta（展示用，非 editable）**

| type | icon | tasks | input → output |
| --- | --- | --- | --- |
| input | IN | ファイル取込, 帳票登録 | Document → Document |
| preprocess | PP | 画像回転, 帳票分割, 補正・分類 | Document → Processed Doc |
| ocr | OC | OCR, LLM-OCR, フィールド抽出 | Processed Doc → Extracted Fields |
| confirm | HU | 手動確認タスク生成 | Fields → Confirmed |
| ai_verify | AI | Master照合, テキスト検証, データ検証 | Fields → Validation Result |
| output | EX | API, CSV / JSON, 画面表示 | Final Data → Export |

**decision 节点**：菱形（112×112），居中显示分岔问题文本，如 `OCR確認\n必要？`。

**尺寸**

- 普通节点：208 × 152 px
- 分岔节点：112 × 112 px

### 5.3 默认 Workflow（每个场景初始态）

横向从左到右：

```
①入力 → ②前処理 → ③OCR → ◇OCR確認必要？
                              ├─ YES → OCR確認待機 ─┐
                              └─ NO ─────────────────┤
                                                     ↓
                              ④AI検証 → ◇AI検証確認必要？
                                          ├─ YES → AI検証確認待機 ─┐
                                          └─ NO ───────────────────┤
                                                                   ↓
                                                              ⑤出力
```

**edges 数据结构**

```json
{
  "from": "wf-d1",
  "to": "wf-h1",
  "branch": "yes",
  "label": "YES"
}
```

- 普通边：无 branch
- 分岔边：`branch: "yes" | "no"`，`label: "YES" | "NO"`
- SVG 路径带箭头 marker；分岔 label 绘制在边中点

### 5.4 画布交互（MVP）

| 操作 | 行为 |
| --- | --- |
| 点击节点 | 选中（蓝色边框），右侧 Inspector 切换 |
| mousedown + move | 拖拽移动节点，连线实时重算 |
| 从库 drag → canvas drop | 新建节点 `{ id, type, x, y, label }` |
| 点击空白 | 不强制（可选：取消选中） |

---

## 6. 右侧 Inspector 映射

选中 workflow 节点 type → 展示对应配置 panel：

| workflow type | inspectorPanel | 配置内容 |
| --- | --- | --- |
| `input` | `input` | 输入渠道（アップロード / API連携）、API 端点 |
| `preprocess` | `image` | DPI、画像回転、透视校正、帳票分割及び各功能的 docType 范围 |
| `ocr` | `ocr` | 各帳票タイプ OCR 执行开关（策略只读，来自帳票タイプ設定） |
| `confirm` | `hitl` | HITL 角色分配（一般審査 / 医療審査 / 給付審査 / 保全審査） |
| `ai_verify` | `ai_verify` | **Master 照合** + **AI検証ルール**（见 §7） |
| `output` | `output` | 输出格式、命名规则、API 导出、マスキング |
| `decision` | `decision` | 分岐ラベル（单行 input） |
| （无选中 / 点シーン設定） | `scene` | 业务场景级配置（见 §8） |

Inspector 头部：

- 有选中节点：badge（accent 色）+ 节点名 + 节点 id（如 `wf-4`）
- 场景模式：标题「業務シーン設定」

**defaults toolbar**（input / image / hitl / ocr / output 节点）

- 徽章：`共通初期値` 或 `カスタム設定`
- 操作：`カスタマイズ` / `初期値に戻す`

---

## 7. 业务配置详情

### 7.1 Master 照合（在 ai_verify Inspector 内）

**数据结构 `form.master`**

```typescript
interface MasterConfig {
  enabled: boolean;
  templateId: 'dict_only' | 'dict_api' | 'full';
  onUnmatch: 'HITL' | '空欄出力' | '原文維持';
  toolChain: {
    internalDict: boolean;
    externalApi: boolean;
    externalApiEndpoint: string;
    webCrawl: boolean;
    crawlDomains: string;
    llmSemanticMatch: boolean;
  };
  mappings: MasterRule[];
}

interface MasterRule {
  id: string;
  docType: string;       // 帳票タイプ
  field: string;         // OCR 字段
  pipeline: PipelineTool[];  // 工具链，按顺序执行
  outputCodeField: string;
  outputNameField: string;
}
```

**Pipeline 工具类型**

| type | 名称 | 配置项 |
| --- | --- | --- |
| `dict` | 辞書照合 | dictionaryId, dictLookupField |
| `web_search` | Web検索 | queryTemplate（如 `{{OCR値}} マスタ照合`） |
| `web_crawl` | Webクロール | domains |
| `external_api` | 外部 API | endpoint |
| `llm` | LLM 補完 | （表記ゆれ补完，无额外字段） |

**UI 布局（三栏 Master 区，嵌在 ai_verify panel 内）**

- 左：照合规则列表（docType + field + pipeline 摘要 `辞書 → API`）
- 中：工具链可视化（可 drag 排序、从工具 palette 拖入）
- 右：选中工具的参数表单

**模板 presets**

| templateId | 含义 |
| --- | --- |
| dict_only | 仅内部辞書 |
| dict_api | 辞書 + 外部 API |
| full | 辞書 + API + Web クロール |

### 7.2 AI 验证规则（同 ai_verify panel）

**数据结构 `form.verify`**

```typescript
interface VerifyConfig {
  textEnabled: boolean;
  text: TextRule[];
  dataEnabled: boolean;
  dataRules: DataRule[];
}

interface TextRule {
  id: string;
  natural: string;    // 自然语言描述
  expression: string; // 执行式（可折叠展示）
  action: 'HITL審査';
}

interface DataRule {
  id: string;
  natural: string;
  expression: string;
  action: 'HITL審査';
  invalid?: boolean;  // 引用字段不存在时 true
}
```

**UI**

- 两个 `el-collapse`：テキスト検証ルール / データ検証ルール
- 每条规则：自然语言展示 + 編集/削除
- 底部 rule-split-card：左侧选帳票/フィールド插入，右侧 textarea + AI補助 + 保存

### 7.3 输出命名（output panel）

**`form.output.naming` tokens**

`{案件ID}`, `{案件番号}`, `{証券番号}`, `{業務シーン}`, `{帳票タイプ}`, `{yyyyMMdd}`, `{HHmmss}`, `{タイムスタンプ}`

patterns:

- caseFilePattern
- docFilePattern
- apiObjectKey
- apiPayloadName
- excelSheetPattern

---

## 8. 业务场景配置（scene panel）

**数据结构 `form.scene`**

```typescript
interface SceneConfig {
  name: string;
  documents: { type: string; submission: '必須' | '任意'; group: string }[];
  aggregateDocType: string;
  primaryKey: string;
  secondaryKeys: string[];
}
```

**UI 区块**

1. **基本**：業務シーン ID（只读）、業務シーン名（必填）
2. **案件集約**：帳票タイプ、主キー、副キー（多选）
3. **帳票一覧**：添加/删除帳票（最多 10 件），每项：帳票タイプ、提出区分、グループ

切换场景时：加载该场景 saved JSON → normalize workflow → 选中第一个 workflow 节点。

---

## 9. 数据持久化

- Key：`kisoku-nintei-v2`（localStorage）
- 结构：按 sceneId 存储完整 form（scene / input / image / ocr / master / verify / hitl / output / workflow）
- 保存按钮：`handleSave()` toast「保存しました」
- 重置按钮：`resetNode()` 恢复当前场景默认配置

**workflow 数据结构**

```typescript
interface Workflow {
  nodes: { id: string; type: string; x: number; y: number; label: string }[];
  edges: { from: string; to: string; branch?: 'yes' | 'no'; label?: string }[];
}
```

---

## 10. 视觉与设计规范（硬约束）

> 完整规范见项目 `.cursor/skills/neosai-prototype-design/SKILL.md`

### 10.1 技术栈（原型）

- Vue 3（CDN）+ Element Plus 2.9.1
- 字体：**Noto Sans JP**
- 单文件：`index.html` + `main.js` + `style.css`

### 10.2 颜色

| Token | 值 |
| --- | --- |
| 主题色 | `#175CD3` |
| 页面背景 | `#fafafa` |
| 画布背景 | `#eef0f3`（点阵 grid） |

- **禁止**为不同业务模块全局刷彩虹色；节点 accent 仅用于节点 header 识别条
- 成功/失败/警告仅用于语义状态

### 10.3 字体

- 正文 ≥ **15px**
- 页面标题 28px，区块标题 18px
- **禁止** 13px 及以下说明小字

### 10.4 按钮

- Primary solid：**hover 不变色、不加 shadow**
- Link 按钮：主题色文字，透明底
- MessageBox 确认：`OK` / `キャンセル`

### 10.5 日式 B2B 气质

- 克制、留白、一屏一个主 CTA
- **禁止**在卡片/模块标题下写冗长解释副标题（配置区 field-hint 除外）

### 10.6 术语

- 统一使用 **OCR抽出**（不用「認識」）
- HITL = 手動確認 / 手動審査

---

## 11. 参考资源

| 资源 | 路径 / 说明 |
| --- | --- |
| 现有原型代码 | `prototypes/kisoku-nintei/` |
| 设计 Skill | `.cursor/skills/neosai-prototype-design/SKILL.md` |
| 用户参考图 | IDP Workflow Platform 三栏布局（节点库 + 画布 + 节点设置 + Phase 条） |
| Logo | 项目根 `logo-CWaP-1CB.png` |

---

## 12. 验收标准

### 12.1 布局

- [ ] 无顶部 product-tabs
- [ ] 场景栏可折叠，折叠后约 52px
- [ ] 三栏：节点库 220px / 画布自适应 / Inspector 380px
- [ ] Workflow 顶栏含 Phase1/2/3 与保存

### 12.2 画布

- [ ] 默认 9 节点 + 分岔连线与参考流程一致
- [ ] 节点卡片含 header / tasks / IO
- [ ] 分岔为菱形，YES/NO 边带 label
- [ ] 节点可拖拽移动，连线跟随
- [ ] 库节点可拖入画布

### 12.3 Inspector

- [ ] 点击各类型节点，右侧展示对应配置（§6 映射表）
- [ ] ai_verify 含 Master 三栏 + 文本/数据验证
- [ ] decision 可编辑分岔标签
- [ ] 「シーン設定」打开 scene panel

### 12.4 数据

- [ ] 5 个 mock 场景可切换
- [ ] 保存/读取 localStorage
- [ ] 切换场景后 workflow 与 form 独立

### 12.5 设计规范

- [ ] Noto Sans JP，正文 ≥15px
- [ ] 主题色 `#175CD3`，primary 按钮 hover 不变色
- [ ] Logo 行无产品名文字

---

## 13. Phase 2  backlog（可选）

1. 画布 zoom（滚轮）+ pan（空格拖拽）
2. 手动连线 / 删边 / 删节点
3. 底部 I/O 对照表 + 设计方针折叠面板
4. 将 Master 拆为画布独立节点（当前合并在 ai_verify Inspector）
5. React Flow / AntV X6 替换手写 SVG
6. 与后端 Workflow API 对接

---

## 14. 附录：默认 mock 数据片段

### A. buildDefaultWorkflow nodes（坐标可微调）

```javascript
nodes: [
  { id: 'wf-1', type: 'input', x: 48, y: 168, label: '① ドキュメント入力' },
  { id: 'wf-2', type: 'preprocess', x: 296, y: 168, label: '② 前処理' },
  { id: 'wf-3', type: 'ocr', x: 544, y: 168, label: '③ OCR抽出' },
  { id: 'wf-d1', type: 'decision', x: 792, y: 188, label: 'OCR確認\n必要？' },
  { id: 'wf-h1', type: 'confirm', x: 952, y: 40, label: 'OCR確認\n待機' },
  { id: 'wf-4', type: 'ai_verify', x: 952, y: 288, label: '④ AI検証' },
  { id: 'wf-d2', type: 'decision', x: 1200, y: 308, label: 'AI検証\n確認必要？' },
  { id: 'wf-h2', type: 'confirm', x: 1360, y: 160, label: 'AI検証\n確認待機' },
  { id: 'wf-5', type: 'output', x: 1360, y: 368, label: '⑤ 出力' },
]
```

### B. 生成提示词模板（给下游 AI）

```
请根据 PRD-idp-workflow-kisoku.md 实现 NeosAI 規則設定页面的 Dify 式 IDP Workflow 编辑器。
技术栈：Vue 3 + Element Plus 2.9.1 + Noto Sans JP，单页 HTML 原型。
必须：去掉顶部 Tab；场景栏可折叠；三栏布局；默认 9 节点 workflow；右侧 Inspector 完整配置。
严格遵循 PRD §10 设计规范。参考现有代码 prototypes/kisoku-nintei/ 的数据结构与 mock 数据。
```

---

*文档结束*
