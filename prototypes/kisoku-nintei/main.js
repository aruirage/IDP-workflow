const { createApp, ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } = Vue;

const PROTOTYPE_BUILD = '336-wf-default-layout';

const WF_ZOOM_MIN = 0.25;
const WF_ZOOM_MAX = 2;
const WF_ZOOM_STEP = 1.12;

const NODE_ORDER = ['scene', 'input', 'image', 'ocr', 'master', 'verify', 'hitl', 'output'];

const WF_NODE_GAP = 72;

/** 左侧菜单：帳票設定下区分两个 Workflow 模块（非顶栏 Tab） */
const APP_NAV_GROUPS = [
  { id: 'home', label: 'ホーム', icon: '⌂', placeholder: true },
  { id: 'read', label: '帳票読取', icon: '▣', placeholder: true },
  {
    id: 'doc-settings',
    label: '帳票設定',
    icon: '⚙',
    menu: true,
    children: [
      { id: 'fixed-doc', label: '定型帳票設定' },
      { id: 'case-workflow', label: '案件Workflow設定' },
      { id: 'mcp-servers', label: 'MCP サーバー管理' },
      { id: 'dict', label: '辞書設定', placeholder: true },
      { id: 'image-settings', label: '画像処理設定', placeholder: true },
    ],
  },
  { id: 'system', label: 'システム設定', icon: '☰', placeholder: true },
  { id: 'ai-agent', label: 'AI入力エージェント', icon: '◎', placeholder: true },
];

const MODULE_PAGE_META = {
  'fixed-doc': {
    title: '定型帳票設定',
    subtitle: '帳票タイプごとの OCR テンプレート・抽出フィールド',
  },
  'case-workflow': {
    title: '案件Workflow設定',
    subtitleConfigure: '設定モード：Workflow 固定・ノード内パラメータのみ変更',
    subtitleEdit: '編集モード：ノード追加・削除・接続を自由に変更',
    templateNote: '起始ノード（入力）から 前処理 → OCR → 外部API → AI検証 → 出力 の順を推奨。編集モードで N キーまたはツールバー + でノード追加。',
    connectHint: '出力ポートをドラッグしてノード間を接続します。ノード前後または連線上の + でノードを追加・挿入できます。',
    flowKey: 'case',
  },
  'mcp-servers': {
    title: 'MCP サーバー管理',
    subtitle: 'Server 接続・Tool 定義・入力パラメータを集中管理。Workflow では Server / Tool の選択のみ行います。',
  },
};

/** Inspector セクションタイトル横 ? ツールチップ用（本文は編集欄に表示しない） */
const INSPECTOR_HINTS = {
  edgeEdit: '接続線をクリックで選択（ハイライト）。Backspace / Delete で削除できます。出力ポートをドラッグして再接続できます。',
  edgeReadonly: '設定モードでは接続の変更はできません。',
  connect: '出力ポートをドラッグして下流ノードの入力ポートへ接続します。連線上の + で途中にノードを挿入できます。',
  connectReadonly: '設定モードでは接続の変更はできません。',
  scene: '業務シーン作成時、またはステップ1で関連帳票・案件集約・帳票間関連を設定します。',
  inputSetting: '画面上アップロードまたは APIアップロードでファイルを受け付けます。APIアップロードを有効にした場合はエンドポイント URL を指定します。',
  inputLimits: 'ファイル形式・最大ファイルサイズ（上限 20MB・それ以下のみ）を指定します。',
  preprocess: '物理ファイルを OCR 可能な論理文書集合へ変換します。\n\n・画像回転：スキャン方向の自動補正。対象帳票未指定時は全帳票タイプが対象。\n・画像補正：歪み・傾きの透视補正。対象帳票未指定時は全帳票タイプが対象。\n・帳票分割：1画像に複数帳票が含まれる場合に分割。対象帳票未指定時は全帳票タイプが対象。\n・画像排序：同一帳票タイプ内の画像を整列。並び順ルールは帳票タイプ設定で定義。',
  ocrSetting: 'LLM-OCR と信頼度閾値を設定します。閾値未満フィールドは要確認として扱います。',
  ocrExtract: '業務シーン設定で登録した関連帳票を参照します。帳票タイプごとに OCR 抽出の ON/OFF を設定します。主帳票／関連帳票の区分はシーン設定に従い表示のみ（変更は Step1）。必須／任意の提出属性は完全性検査で設定します。テンプレート・フィールド詳細は帳票タイプ設定から連携します。',
  masterMatch: '上流 MCP からナレッジ源を自動連携します。照合対象フィールド・出力先・出力形式を設定します。',
  masterMatchInput: 'ナレッジ源は上流 MCP ノードから自動取得します（Server / Tool 設定は MCP ノード側）。OCR 抽出フィールドは照合設定で指定した項目を参照します。',
  masterMatchOutput: '正規化フィールド：案件データセットへ書き戻し。参照 JSON：照合結果を JSON 出力。分段列表：检索分段 + メタデータを配列出力。',
  masterMatchOutputFields: 'MCP 照合・正規化結果を書き込む出力フィールドを指定します。',
  masterMatchFields: '照合対象 OCR フィールドを選択します。策略：コード精確検索 / キーワード / 類似度 / ハイブリッド。',
  masterMatchStrategy: '照合アルゴリズムを選択します。',
  mcpTool: 'Workflow では MCP サーバーと Tool を選択するだけです。接続情報・Tool 定義・入力パラメータ（定数 / 変数参照）は「MCP サーバー管理」で設定します。\n\nOCR抽出 → MCP → マスタ照合 → AI検証 の主処理チェーンの一段。REST / Web API・DB・RPA など任意の外部連携に利用できます。',
  mcpServer: '登録済み MCP サーバーを選択します。新規登録・Tool・パラメータの編集は「サーバー管理へ」から MCP サーバー管理画面を開いてください。',
  mcpToolSelect: '選択中サーバーが提供する Tool を1つ選びます。パラメータの詳細設定は「Tool・パラメータ設定へ」からサーバー管理画面を開いてください。',
  mcpParams: '各パラメータの定数 / 変数参照は MCP サーバー管理で設定します。Workflow では設定済み内容を参照のみ表示します。',
  mcpAdminOverview: 'MCP サーバー接続・Tool 一覧・各 Tool の入力パラメータをここで集中管理します。OAuth 等の認証設定も本画面（または接続ウィザード）で行います。',
  mcpAdminTools: 'Tool ごとにパラメータ schema と既定値（定数 / 上流変数参照）を設定します。保存後、当該 Server / Tool を使う Workflow ノードに反映されます。',
  mcpError: 'タイムアウト（秒）・リトライ上限・失敗時の動作（スキップ / リトライ / ワークフロー停止）を設定します。',
  nodeOutput: '後続ノード・IF/ELSE 条件・MCP 変数参照で使える出力変数です。{ノード変数名.項目} 形式で指定します。',
  nodeOutputPreprocess: '前処理の実行結果。IF/ELSE では {preprocess.result} や {preprocess.status}（HITL 要否）を参照できます。',
  nodeOutputOcr: 'OCR 抽出結果。MCP・マスタ照合の変数参照や IF/ELSE で {ocr.fields} 等を利用します。',
  nodeOutputVerify: 'AI検証の合否・不備一覧。IF/ELSE 分岐や通知ノードで {verify.result} / {verify.status} を参照します。',
  mcpOutput: 'Tool 実行後に後続ノードへ渡される出力変数です。IF/ELSE やマスタ照合の入力として参照できます。',
  externalApiIo: '前工程から自動連携される入力です。',
  knowledgeSelect: 'ナレッジ数据源を選択します。+ ボタンから新規作成（文档上传 / Web Site API）ができます。',
  knowledgeRetrieval: 'Vector Search の類似度・Top N・参照文字数上限を設定します（Dify Knowledge Retrieval 相当）。',
  knowledgeOutput: '检索結果として後続ノードへ渡される出力変数です。',
  externalApiConfig: '检索パラメータを設定します。',
  externalApiOutput: '检索結果として後続ノードへ渡される出力変数です。',
  masterKnowledge: '照合に使用する内部マスタ辞書を選択します。辞書の項目定義は辞書設定で管理します。',
  masterMatchRules: '帳票タイプ・OCR 項目と辞書フィールドの照合ルールを定義します。結果は案件データセットに付与されます。',
  masterApi: 'リトライ回数・キャッシュ TTL・例外時の動作を指定します。',
  masterRules: '登録済み照合ルールの一覧です。下のフォームから追加・編集できます。',
  masterRuleAdd: '帳票タイプ・照合元 OCR 項目・照合先・出力フィールドを指定してルールを追加します。',
  aiVerify: '完全性・テキスト・データ・印鑑の検証ルールを設定します。不備検出時は HITL キューへ送ります。',
  completeness: '必須・任意帳票の収集状態を検証します。帳票タイプは業務シーン設定で登録し、ここで必須/任意を指定します。',
  textVerify: '自然言語で記述し、AI補助で実行式を生成します。入力欄の下にプレビューが表示されます。',
  dataVerify: '帳票間の整合性と業務ロジックを自然言語で記述し、AI補助で実行式をプレビュー表示します。',
  seal: '署名・印鑑が存在するかを検出します。類似度閾値未満は不備として扱います。',
  hitlGate: '待機・確認ゲートです。確認コンテキストと審査ロールを設定します。分岐ルーティングは行いません。',
  hitlContext: '確認対象の工程を選びます（前処理 / OCR抽出 / AI検証）。',
  hitlActions: '審査者が実行できる操作を選択します（最低 1 件）。',
  decision: 'IF / ELIF / ELSE を変数・演算子で自由に設定します。上流ノードの出力変数を選択して分岐条件を組み立てます。',
  decisionContext: '案件就緒・検証結果・処理完了など、分岐の業務意味を選びます。変更時は既定条件で上書きされます。',
  decisionElseLabel: '接続線ラベルや実行ログに表示される名称です。',
  decisionOutputVar: '分岐名は後続ノードの条件式で参照できます。',
  fraudDetect: '画像の PS 痕跡・改ざんの有無を判定します。画像リスクスコアが閾値以上の場合、条件分岐または人工確認へ送ります。',
  notify: '補件依頼または案件処理完了のメール通知です。テンプレート選択後も件名・本文を編集できます。',
  startTriggers: 'Workflow 開始条件。案件イベント・スケジュールを複数組み合わせ可能。',
  startTriggerCaseEvent: '指定の案件イベント発生時に Workflow を開始します。複数選択可。例：不備検出 → 補件依頼 → 補件受領で再開。',
  startTriggerSchedule: '固定時刻または定期間隔でバッチ実行します。稼働日のみの実行も指定できます。',
  notifyRecipients: '通知の送信先です。メール＝宛先アドレス、Slack＝チャンネル名、Webhook＝受信 URL。形式が不正な場合は警告のみ表示し、保存はブロックしません。',
  code: 'Python スクリプトで上流変数を加工し、後続ノードへ結果を渡します。入力パラメータ・戻り値の定義は本パネルで設定します。',
  codeInput: 'スクリプト内で参照する引数名と、上流ノードの出力変数またはカスタム値の対応を定義します。「+ 追加」からパラメータを登録できます。',
  codePython: 'def main(inputs: dict) -> dict 形式で記述します。戻り値は {ノード変数名.result} へ格納されます。',
  codeReturn: 'OFF の場合、このノードの内容はユーザーに出力されません。ユーザーにこのノードの出力を表示したい場合は、スイッチを ON にしてください。',
  codeOutput: 'スクリプト戻り値の各項目名とデータ型を定義します。後続ノードでは {ノード変数名.項目名} 形式で参照できます。',
  codeParamName: 'スクリプト内で参照する引数の名前です。64 文字以内で指定します。',
  codeParamDataType: '引数または出力値のデータ型を選択します。',
  codeParamSource: '参照パラメータ：上流ノードの出力変数を使用します。カスタム：固定値を直接指定します。',
  codeParamReference: '上流ノードの出力変数を選択します。',
  codeParamCustom: '固定値としてスクリプトへ渡す値を入力します。',
  codeParamRequired: '必須にすると、値が未設定の場合は実行時にエラーとして扱われます。',
  hitlLegacy: '前処理・OCR抽出・外部API連携・AI検証・出力の各ノードで HITL が発生した場合の復核ロールを設定します。',
  output: '自動エクスポート設定です。命名規則・ファイル形式・出力フィールドを指定します。',
  outputFields: 'OCR 抽出フィールドの出力有無と順序を設定します。',
  outputNaming: '貴社命名規則の詳細（チューリッヒ様提供予定）に合わせてテンプレートを調整します。',
  outputExport: '文字エンコーディング・Excel 出力形式などエクスポートファイルの設定です。',
  outputApi: 'エクスポート完了後、抽出結果を外部 API へ送信します。',
  caseLinkDocs: '案件に紐づく帳票タイプを登録します。1件を主帳票（案件集約）として指定してください。',
  caseLinkAggregate: '主帳票を1件指定します。帳票間の紐付けは下の「帳票間関連設定」で行います。',
  docFieldLinks: '帳票間で一致させるフィールドを指定します。主帳票（案件集約）への関連付けを推奨します。',
  docFieldNetwork: '主帳票を中央に配置し、主帳票のフィールドから関連帳票へ矢印を表示します。',
  sceneMatching: 'マッチング優先度を指定します。',
  sceneMatchingDefaults: '既定動作：補件ファイルは既存案件に紐付け、マスタなしファイルは保留プールへ送ります（本画面では変更できません）。',
};

const MOCK_USER_ROLES = [
  { value: 'configurator', label: '業務設定者', canEditTopology: false },
  { value: 'admin', label: 'プラットフォーム管理者', canEditTopology: true },
];

const WF_TOPOLOGY_MODE_STORAGE_KEY = 'kisoku-wf-topology-mode';
const MOCK_USER_ROLE_STORAGE_KEY = 'kisoku-mock-user-role';

const CASE_WORKFLOW_TEMPLATE_VERSION = 4;
const WF_LAYOUT_PAD = { x: 48, y: 48 };
const WF_BRANCH_LANE_GAP = 56;

const DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS = [
  'wf-pp', 'wf-hu-pre', 'wf-oc', 'wf-hu-ocr', 'wf-ms', 'wf-ai', 'wf-d-final',
  'wf-n-ok', 'wf-hu-final', 'wf-n-ng',
];

const PREVIOUS_CASE_WORKFLOW_TEMPLATE_NODE_IDS = [
  'wf-intake', 'wf-d-quality', 'wf-d-ocr', 'wf-logic', 'wf-auto', 'wf-d-audit',
  'wf-hu-quality', 'wf-hu-audit', 'wf-hu-prelim',
];

const LEGACY_CASE_WORKFLOW_TEMPLATE_NODE_IDS = [
  'wf-pp', 'wf-oc', 'wf-hu-oc', 'wf-d-ready', 'wf-wait', 'wf-n-def',
  'wf-mcp', 'wf-ms', 'wf-ai', 'wf-d-verify', 'wf-hu-verify',
  'wf-d-done', 'wf-n-supp', 'wf-out',
];

/** 主処理チェーンの推奨順序（Dify Start → 処理ノード） */
const WORKFLOW_MAIN_CHAIN_ORDER = [
  { type: 'preprocess', label: '前処理', step: 1 },
  { type: 'ocr', label: 'OCR抽出', step: 2 },
  { type: 'mcp', label: 'MCP', step: 3 },
  { type: 'master_match', label: 'マスタ照合', step: 4 },
  { type: 'ai_verify', label: 'AI検証', step: 5 },
];

const WORKFLOW_MAIN_CHAIN_TYPE_ORDER = Object.fromEntries(
  WORKFLOW_MAIN_CHAIN_ORDER.map((item, idx) => [item.type, idx]),
);

/** 処理ノード（制御・ナレッジ以外） */
const WORKFLOW_PROCESSING_NODE_TYPES = new Set([
  'preprocess', 'ocr', 'ai_verify', 'mcp', 'master_match', 'code',
]);

/** ノード出力変数の既定名（IF/ELSE で {varName}.result として参照） */
const WORKFLOW_NODE_DEFAULT_VAR = {
  preprocess: 'preprocess',
  ocr: 'ocr',
  mcp: 'mcp',
  master_match: 'master_match',
  ai_verify: 'verify',
  code: 'code',
};

function getWorkflowNodeDefaultVarName(type) {
  return WORKFLOW_NODE_DEFAULT_VAR[type] || type;
}

function slugifyWorkflowVarName(id) {
  if (!id) return '';
  let slug = String(id).trim().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (slug && /^\d/.test(slug)) slug = `n_${slug}`;
  return slug;
}

function autoGenerateWorkflowNodeVarName(node, workflow = null) {
  if (!node) return '';
  const fromId = slugifyWorkflowVarName(node.id);
  if (fromId) return fromId;
  const base = getWorkflowNodeDefaultVarName(node.type);
  if (!workflow?.nodes?.length) return base;
  const sameType = workflow.nodes.filter((n) => n.type === node.type);
  if (sameType.length <= 1) return base;
  const idx = sameType.findIndex((n) => n.id === node.id);
  return idx > 0 ? `${base}_${idx + 1}` : base;
}

function ensureWorkflowNodeVarName(node, workflow = null) {
  if (!node || (!WORKFLOW_PROCESSING_NODE_TYPES.has(node.type) && node.type !== 'master_match')) return node;
  return { ...node, varName: autoGenerateWorkflowNodeVarName(node, workflow) };
}

function getWorkflowNodeVarName(node, workflow = null) {
  return autoGenerateWorkflowNodeVarName(node, workflow);
}

function isWorkflowProcessingNode(node) {
  return node && WORKFLOW_PROCESSING_NODE_TYPES.has(node.type);
}

/** 案件フロー：ノードライブラリ分组 */
const CASE_FLOW_NODE_GROUPS = [
  {
    category: '端点ノード',
    nodes: [
      { type: 'start', label: '開始', summary: 'Workflow 開始・トリガー条件' },
      { type: 'end', label: '終了', summary: '命名規則・成果物確定' },
    ],
  },
  {
    category: '処理ノード',
    nodes: [
      { type: 'preprocess', label: '前処理', summary: '画像処理・文書集合生成' },
      { type: 'ocr', label: 'OCR抽出', summary: 'OCR / LLM-OCR・フィールド抽出' },
      { type: 'ai_verify', label: 'AI検証', summary: '完全性・テキスト・データ検証' },
    ],
  },
  {
    category: '外部連携',
    nodes: [
      { type: 'mcp', label: 'MCP', summary: 'REST / DB / RPA · 任意接口 Tool 调用' },
      { type: 'master_match', label: 'マスタ照合', summary: 'MCP ナレッジ照合 · 出力フィールド設定' },
      { type: 'code', label: 'カスタム関数', summary: 'Python スクリプト · データ加工・API 呼び出し' },
    ],
  },
  {
    category: '制御ノード',
    nodes: [
      { type: 'decision', label: '条件判断', summary: 'IF / ELIF / ELSE · 変数で自由設定' },
      { type: 'hitl_gate', label: '人工確認', summary: '確認・修正・承認', defaultHitlContext: 'ocr' },
      { type: 'notify', label: '通知', summary: '補件依頼・案件処理完了', defaultNotifyTemplate: 'supplement' },
    ],
  },
];

const CASE_FLOW_NODES = CASE_FLOW_NODE_GROUPS.flatMap((g) => g.nodes.map((n) => ({ ...n, category: g.category })));

const FLOW_NODE_OPTIONS = {
  case: CASE_FLOW_NODES,
};

const REMOVED_WORKFLOW_NODE_TYPES = new Set([
  'doc_classify', 'doc_process_rules', 'doc_effect_test', 'doc_store', 'doc_subflow',
  'supplement_upload', 'case_pool_update', 'verify_rerun', 'status_update',
  'case_link', 'scene_aggregate', 'scene_completeness',
  'input', 'output', 'fraud_detect',
]);

const WORKFLOW_INSPECTOR_MAP = {
  start: 'start',
  end: 'end',
  preprocess: 'image',
  ocr: 'ocr',
  ai_verify: 'ai_verify',
  mcp: 'mcp',
  master_match: 'master_match',
  decision: 'decision',
  hitl_gate: 'hitl_gate',
  notify: 'notify',
  code: 'code',
};

const CASE_WORKFLOW_TRIGGER_EVENTS = [
  { value: 'SUPPLEMENT', label: '補件', desc: '補件依頼・追加書類提出待ち' },
  { value: 'SUPPLEMENT_RECEIVED', label: '補件受領', desc: '補件ファイル受領済み・処理再開' },
  { value: 'NEW_CASE', label: '新規作成', desc: '新規案件が作成された' },
  { value: 'DEFICIENCY', label: '不備検出', desc: 'AI検証・完全性で不備が検出された' },
  { value: 'REPROCESS', label: '再処理', desc: '手動またはシステムからの再実行要求' },
];

/** @deprecated migrated to CASE_WORKFLOW_TRIGGER_EVENTS */
const CASE_WORKFLOW_LEGACY_STATUS_TO_EVENT = {
  AWAITING_SUPPLEMENT: 'SUPPLEMENT',
  SUPPLEMENT_RECEIVED: 'SUPPLEMENT_RECEIVED',
  NEW: 'NEW_CASE',
  DEFICIENCY_REVIEW: 'DEFICIENCY',
  PROCESSING: 'REPROCESS',
};

const WORKFLOW_SCHEDULE_MODES = [
  { value: 'fixed', label: '固定時刻' },
  { value: 'interval', label: '定期間隔' },
];

const WORKFLOW_INTERVAL_UNITS = [
  { value: 'minutes', label: '分' },
  { value: 'hours', label: '時間' },
  { value: 'days', label: '日' },
];

function getDefaultStartTriggerConfig() {
  return {
    caseEvents: ['SUPPLEMENT'],
    schedule: null,
  };
}

function migrateCaseEventsFromRaw(raw) {
  const legacyStatuses = Array.isArray(raw?.caseStatuses) ? raw.caseStatuses : [];
  const directEvents = Array.isArray(raw?.caseEvents) ? raw.caseEvents : [];
  const merged = [...directEvents, ...legacyStatuses.map((s) => CASE_WORKFLOW_LEGACY_STATUS_TO_EVENT[s] || s)];
  return [...new Set(merged.filter((e) => CASE_WORKFLOW_TRIGGER_EVENTS.some((o) => o.value === e)))];
}

function normalizeStartTriggerConfig(raw) {
  if (!raw || typeof raw !== 'object') return getDefaultStartTriggerConfig();
  const caseEvents = migrateCaseEventsFromRaw(raw);
  let schedule = null;
  if (raw.schedule && typeof raw.schedule === 'object') {
    const mode = raw.schedule.mode === 'interval' ? 'interval' : 'fixed';
    schedule = {
      mode,
      fixedTime: String(raw.schedule.fixedTime || '09:00').slice(0, 5),
      runOnWeekdays: raw.schedule.runOnWeekdays !== false,
      intervalValue: Math.max(1, Number(raw.schedule.intervalValue) || 30),
      intervalUnit: WORKFLOW_INTERVAL_UNITS.some((u) => u.value === raw.schedule.intervalUnit)
        ? raw.schedule.intervalUnit
        : 'minutes',
    };
  }
  const cfg = { caseEvents, schedule };
  if (!cfg.caseEvents.length && !cfg.schedule) {
    cfg.caseEvents = ['SUPPLEMENT'];
  }
  return cfg;
}

function migrateLegacyStartTriggers(triggers) {
  const cfg = {
    caseEvents: [],
    schedule: null,
  };
  if (!Array.isArray(triggers) || !triggers.length) return getDefaultStartTriggerConfig();
  triggers.forEach((t) => {
    if (t.enabled === false) return;
    if (t.type === 'intake') {
      if (!cfg.caseEvents.includes('NEW_CASE')) cfg.caseEvents.push('NEW_CASE');
    }
    if (t.type === 'case_status' && t.caseStatus) {
      const mapped = CASE_WORKFLOW_LEGACY_STATUS_TO_EVENT[t.caseStatus] || t.caseStatus;
      if (!cfg.caseEvents.includes(mapped)) cfg.caseEvents.push(mapped);
    }
    if (t.type === 'schedule') {
      cfg.schedule = {
        mode: t.scheduleMode === 'interval' ? 'interval' : 'fixed',
        fixedTime: String(t.fixedTime || '09:00').slice(0, 5),
        runOnWeekdays: t.runOnWeekdays !== false,
        intervalValue: Math.max(1, Number(t.intervalValue) || 30),
        intervalUnit: t.intervalUnit || 'minutes',
      };
    }
  });
  if (!cfg.caseEvents.length && !cfg.schedule) cfg.caseEvents = ['SUPPLEMENT'];
  return normalizeStartTriggerConfig(cfg);
}

function normalizeStartNode(node) {
  if (!node || node.type !== 'start') return node;
  let triggerConfig;
  if (node.triggerConfig && typeof node.triggerConfig === 'object') {
    triggerConfig = normalizeStartTriggerConfig(node.triggerConfig);
  } else if (Array.isArray(node.triggers)) {
    triggerConfig = migrateLegacyStartTriggers(node.triggers);
  } else {
    triggerConfig = getDefaultStartTriggerConfig();
  }
  const { triggers, ...rest } = node;
  return { ...rest, isStart: true, triggerConfig };
}

function getCaseWorkflowEventLabel(event) {
  return CASE_WORKFLOW_TRIGGER_EVENTS.find((e) => e.value === event)?.label || event;
}

function formatScheduleSummary(schedule) {
  if (!schedule) return null;
  const weekdayNote = schedule.runOnWeekdays === false ? '' : '・平日';
  if (schedule.mode === 'interval') {
    const unit = WORKFLOW_INTERVAL_UNITS.find((u) => u.value === schedule.intervalUnit)?.label || '';
    return `${schedule.intervalValue}${unit}毎${weekdayNote}`;
  }
  return schedule.runOnWeekdays === false
    ? `毎日 ${schedule.fixedTime}`
    : `平日 ${schedule.fixedTime}`;
}

function isStartCaseEventEnabled(node) {
  return normalizeStartTriggerConfig(node?.triggerConfig).caseEvents.length > 0;
}

const END_NAMING_DEFAULT_PATTERN = '{案件番号}_{証券番号}_{業務シーン}_{処理結果}_{yyyyMMdd}';

function getDefaultEndNamingConfig() {
  return { pattern: END_NAMING_DEFAULT_PATTERN };
}

function normalizeEndNamingConfig(raw) {
  if (!raw || typeof raw !== 'object') return getDefaultEndNamingConfig();
  if (typeof raw.pattern === 'string') {
    return { pattern: raw.pattern || END_NAMING_DEFAULT_PATTERN };
  }
  if (raw.rules && typeof raw.rules === 'object') {
    const legacyKey = ['case_dataset', 'doc_files', 'verify_report', 'api_payload']
      .find((key) => raw.rules[key]?.enabled !== false && raw.rules[key]?.pattern);
    if (legacyKey) {
      return { pattern: String(raw.rules[legacyKey].pattern || END_NAMING_DEFAULT_PATTERN) };
    }
  }
  return getDefaultEndNamingConfig();
}

function normalizeEndNode(node) {
  if (!node || node.type !== 'end') return node;
  return {
    ...node,
    isEnd: true,
    namingConfig: normalizeEndNamingConfig(node.namingConfig),
  };
}

const WORKFLOW_NODE_META = {
  start: {
    icon: '▶',
    title: '開始',
    desc: 'トリガー条件で Workflow 実行',
    tasks: [],
    accent: '#067647',
  },
  end: {
    icon: '■',
    title: '終了',
    desc: '命名規則で成果物を確定',
    tasks: [],
    accent: '#667085',
  },
  preprocess: {
    icon: 'PP',
    title: '前処理',
    desc: '画像処理・文書集合生成',
    tasks: ['画像回転', '画像補正', '帳票分割', '画像排序'],
    input: 'Physical Files',
    output: 'Logical Document Set',
    accent: '#079455',
  },
  ocr: {
    icon: 'OC',
    title: 'OCR抽出',
    desc: 'OCR / LLM-OCR・フィールド抽出',
    tasks: ['OCR実行', 'フィールド抽出'],
    input: 'Logical Document',
    output: 'Extracted Fields',
    accent: '#6941c6',
  },
  ai_verify: {
    icon: 'AI',
    title: 'AI検証',
    desc: '完全性・テキスト・データ検証',
    tasks: ['完全性検査', 'テキスト検証', 'データ検証', '印鑑検証'],
    input: 'Case Data Pool',
    output: 'Validation Result',
    accent: '#7c3aed',
  },
  mcp: {
    icon: 'MCP',
    title: 'MCP',
    desc: '外部 API · DB · RPA 連携',
    tasks: ['REST API', 'DB', 'RPA'],
    input: 'Case · OCR Fields',
    output: 'External Data',
    accent: '#175cd3',
  },
  master_match: {
    icon: '照',
    title: 'マスタ照合',
    desc: 'MCP ナレッジ照合 · 出力設定',
    tasks: ['照合設定', '出力フィールド'],
    input: 'MCP · OCR Fields',
    output: 'Match Result',
    accent: '#0ea5e9',
  },
  decision: {
    icon: 'IF',
    title: '条件判断',
    desc: '変数で IF / ELSE 分岐',
    tasks: [],
    input: 'Node Result',
    output: 'Branch',
    accent: '#175cd3',
  },
  hitl_gate: {
    icon: '人',
    title: '人工確認',
    desc: '確認・修正・承認',
    tasks: [],
    input: 'Process Result',
    output: 'Confirmed',
    accent: '#dc6803',
  },
  notify: {
    icon: 'NT',
    title: '通知',
    desc: '補件依頼・案件処理完了',
    tasks: [],
    input: 'Case Event',
    output: 'Notified',
    accent: '#d92d20',
  },
  code: {
    icon: 'fx',
    title: 'カスタム関数',
    desc: 'Python · データ加工',
    tasks: [],
    input: 'Upstream Variables',
    output: 'Result',
    accent: '#079455',
  },
};

const MASTER_MATCH_STRATEGIES = [
  { value: 'code', label: 'コード精確検索', desc: 'マスタコード・キー値の完全一致' },
  { value: 'keyword', label: 'キーワード検索', desc: 'キーワード・トークンによる全文検索' },
  { value: 'similarity', label: '類似度検索', desc: 'ベクトル / 文字列類似度による近似照合' },
  { value: 'hybrid', label: 'ハイブリッド', desc: 'コード → キーワード → 類似度の段階的フォールバック' },
];

const MASTER_MATCH_LEGACY_STRATEGIES = {
  semantic: 'similarity',
  fuzzy: 'similarity',
  llm_normalize: 'hybrid',
};

function normalizeMasterMatchStrategy(value) {
  const v = MASTER_MATCH_LEGACY_STRATEGIES[value] || value;
  return MASTER_MATCH_STRATEGIES.some((s) => s.value === v) ? v : 'code';
}

const MASTER_MATCH_OUTPUT_FORMATS = [
  { value: 'normalized_fields', label: '正規化フィールド', desc: '照合成功値を案件データセットのフィールドへ書き戻し' },
  { value: 'reference_json', label: '参照 JSON', desc: 'ナレッジ检索・照合結果を JSON オブジェクトで出力' },
  { value: 'paragraph_list', label: '分段列表', desc: '检索分段 + 照合メタデータを配列で出力' },
];

const WORKFLOW_NODE_OUTPUT_VAR_DEFS = {
  preprocess: [
    { id: 'result', label: '処理結果' },
    { id: 'status', label: '実行ステータス（HITL 要否）' },
    { id: 'documents', label: '論理文書集合' },
  ],
  ocr: [
    { id: 'result', label: '抽出結果' },
    { id: 'fields', label: 'フィールド一覧' },
    { id: 'confidence', label: '最低信頼度' },
  ],
  mcp: [
    { id: 'result', label: 'Tool 実行結果' },
    { id: 'status', label: 'HTTP / 実行ステータス' },
    { id: 'latencyMs', label: 'レイテンシ (ms)' },
  ],
  master_match: [
    { id: 'data', label: '照合・检索結果' },
    { id: 'paragraph_list', label: '检索分段列表' },
    { id: 'directly_return', label: '直接回答分段' },
    { id: 'normalized_fields', label: '正規化フィールド' },
  ],
  ai_verify: [
    { id: 'result', label: '検証結果' },
    { id: 'status', label: '合否ステータス' },
    { id: 'issues', label: '不備一覧' },
  ],
  code: [
    { id: 'result', label: '実行結果' },
  ],
};

const MCP_OUTPUT_VARS = WORKFLOW_NODE_OUTPUT_VAR_DEFS.mcp.map((item) => ({
  ...item,
  token: `{${item.id}}`,
}));

const WORKFLOW_NODE_OUTPUT_HINT_KEYS = {
  preprocess: 'nodeOutputPreprocess',
  ocr: 'nodeOutputOcr',
  ai_verify: 'nodeOutputVerify',
  mcp: 'mcpOutput',
  master_match: 'masterMatchOutput',
  code: 'codeOutput',
};

function formatWorkflowOutputVarToken(node, workflow, varId) {
  return `{${getWorkflowNodeVarName(node, workflow)}.${varId}}`;
}

function formatMcpOutputVarToken(node, workflow, varId) {
  return formatWorkflowOutputVarToken(node, workflow, varId);
}

function getWorkflowNodeOutputVarItems(node, workflow = null) {
  if (!node?.type) return [];
  const defs = WORKFLOW_NODE_OUTPUT_VAR_DEFS[node.type];
  if (!defs?.length) return [];
  return defs.map((item) => ({
    ...item,
    token: formatWorkflowOutputVarToken(node, workflow, item.id),
  }));
}

const MCP_SERVER_STATUS_META = {
  connected: { label: '接続済', tagType: 'success' },
  disconnected: { label: '未接続', tagType: 'info' },
  error: { label: 'エラー', tagType: 'danger' },
};

const MCP_SERVER_TYPES = [
  { value: 'http', label: 'HTTP / REST' },
  { value: 'db', label: 'Database' },
  { value: 'rpa', label: 'RPA Bot' },
];

const MCP_PARAM_MODES = [
  { value: 'fixed', label: '定数' },
  { value: 'variable', label: '変数参照' },
];

const MCP_SERVER_SEEDS = [
  {
    id: 'master_db',
    label: '社内マスタ DB',
    description: '社内マスタ・辞書 DB への read-only 接続',
    status: 'connected',
    serverType: 'db',
    tools: [
      {
        id: 'lookup',
        label: '辞書検索',
        description: 'キー値でマスタレコードを検索',
        params: [
          { key: 'table', label: 'テーブル', type: 'string', required: true, placeholder: 'm_icd10' },
          { key: 'lookupKey', label: '照合キー', type: 'string', required: true, placeholder: '{{ocr.claim.diagnosis}}' },
        ],
      },
      {
        id: 'fetch',
        label: 'レコード取得',
        description: '主キーで単一レコードを取得',
        params: [
          { key: 'table', label: 'テーブル', type: 'string', required: true, placeholder: 'm_customer' },
          { key: 'id', label: '主キー', type: 'string', required: true, placeholder: '{{case.primaryKey}}' },
        ],
      },
    ],
  },
  {
    id: 'contract_api',
    label: '契約管理 API',
    description: '契約・約款情報の REST API',
    status: 'connected',
    serverType: 'http',
    tools: [
      {
        id: 'fetch_contract',
        label: '契約情報取得',
        description: '証券番号から契約詳細を取得',
        params: [
          { key: 'policyNo', label: '証券番号', type: 'string', required: true, placeholder: '{{ocr.claim.policy_no}}' },
          { key: 'includeRiders', label: '特約を含む', type: 'boolean', required: false, placeholder: 'true' },
        ],
      },
      {
        id: 'verify_coverage',
        label: '保障範囲確認',
        description: '診断名・給付種別の保障可否を確認',
        params: [
          { key: 'policyNo', label: '証券番号', type: 'string', required: true, placeholder: '{{ocr.claim.policy_no}}' },
          { key: 'diagnosisCode', label: '診断コード', type: 'string', required: true, placeholder: '{{ocr.claim.diagnosis_code}}' },
        ],
      },
    ],
  },
  {
    id: 'customer_api',
    label: '顧客情報 API',
    description: 'CRM / 顧客マスタ連携',
    status: 'disconnected',
    serverType: 'http',
    tools: [
      {
        id: 'search_customer',
        label: '顧客検索',
        description: '氏名・生年月日で顧客を検索',
        params: [
          { key: 'name', label: '氏名', type: 'string', required: true, placeholder: '{{ocr.claim.insured_name}}' },
          { key: 'birthDate', label: '生年月日', type: 'string', required: false, placeholder: '{{ocr.claim.birth_date}}' },
        ],
      },
    ],
  },
  {
    id: 'rpa_bot',
    label: 'RPA Bot',
    description: 'レガシーシステム操作 RPA',
    status: 'connected',
    serverType: 'rpa',
    tools: [
      {
        id: 'execute',
        label: '処理実行',
        description: '定義済み RPA フローを実行',
        params: [
          { key: 'flowId', label: 'フロー ID', type: 'string', required: true, placeholder: 'claim_status_check' },
          { key: 'caseId', label: '案件 ID', type: 'string', required: true, placeholder: '{{case.id}}' },
        ],
      },
    ],
  },
  {
    id: 'custom_http',
    label: 'カスタム HTTP',
    description: '任意 REST エンドポイント呼び出し',
    status: 'error',
    serverType: 'http',
    tools: [
      {
        id: 'get',
        label: 'GET リクエスト',
        description: 'HTTP GET で外部 API を呼び出し',
        params: [
          { key: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://api.example.com/v1/lookup' },
          { key: 'query', label: 'Query パラメータ', type: 'string', required: false, placeholder: 'code={{ocr.claim.diagnosis_code}}' },
        ],
      },
      {
        id: 'post',
        label: 'POST リクエスト',
        description: 'HTTP POST で外部 API を呼び出し',
        params: [
          { key: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://api.example.com/v1/submit' },
          { key: 'body', label: 'リクエスト Body', type: 'string', required: false, placeholder: '{"policyNo":"{{ocr.claim.policy_no}}"}' },
        ],
      },
    ],
  },
];

/** @deprecated use mergeMcpServerCatalog — 互換エイリアス */
const MCP_REGISTRY = MCP_SERVER_SEEDS;

/** 客户 workshop 确认清单（只读参考） */
const WORKFLOW_WORKSHOP_CHECKLIST = [
  { id: 'k1', topic: 'マスタ照合', question: '必須の知识源：内部文档库 / 行业标准 API / Web Search / 客户自建 MCP Search？' },
  { id: 'k2', topic: 'マスタ照合', question: '照合输出：仅返回候选参考文本，还是写回 OCR 字段的标准化值？' },
  { id: 'k3', topic: 'マスタ照合', question: '低置信度时：自动 HITL / 条件判断 / WARNING 继续？' },
  { id: 'k4', topic: 'マスタ照合', question: '是否允许多知识源同时检索再合并（multi-knowledge）？' },
  { id: 'm1', topic: 'MCP', question: '需要哪些 MCP Server（DB / RPA / CRM / 自定义 HTTP）？' },
  { id: 'm2', topic: 'MCP', question: 'Tool 调用是编排固定顺序，还是将来 Agent 式自动选 Tool？（Fixed-only vs 预留 Auto）' },
  { id: 'm3', topic: 'MCP', question: 'Web Search 照合：走 MCP Search Tool 还是マスタ照合内置 provider？' },
  { id: 'b1', topic: '边界', question: '内部辞書（form.master.mappings）→ マスタ照合；外部知识 → マスタ照合 — 是否认可？' },
];

function normalizeMcpServerItem(server) {
  const s = cloneJson(server || {});
  return {
    ...s,
    status: MCP_SERVER_STATUS_META[s.status] ? s.status : 'connected',
    serverType: s.serverType || 'http',
    tools: Array.isArray(s.tools) ? s.tools : [],
  };
}

function mergeMcpServerCatalog(seeds, custom = []) {
  const map = new Map();
  [...(seeds || []), ...(custom || [])].forEach((s) => {
    map.set(s.id, normalizeMcpServerItem(s));
  });
  return [...map.values()];
}

function getMcpServerDef(serverId, catalog = MCP_SERVER_SEEDS) {
  return (catalog || []).find((s) => s.id === serverId) || null;
}

function getMcpToolDef(serverId, toolId, catalog = MCP_SERVER_SEEDS) {
  const server = getMcpServerDef(serverId, catalog);
  if (!server || !toolId) return null;
  return server.tools?.find((t) => t.id === toolId) || null;
}

function buildMcpVariableOptions(workflow, nodeId, sceneDocuments, docLabelFn) {
  const options = [];
  options.push(
    { value: '{{case.id}}', label: '案件 ID' },
    { value: '{{case.primaryKey}}', label: '主キー値' },
    { value: '{{case.policyNo}}', label: '証券番号' },
    { value: '{{ocr.fields}}', label: 'OCR抽出フィールド（全体）' },
  );
  (sceneDocuments || []).forEach((doc) => {
    (getDocSchema(doc.type).fields || []).forEach((f) => {
      options.push({
        value: `{{${doc.type}.${f}}}`,
        label: `${docLabelFn(doc.type)} · ${f}`,
      });
    });
  });
  getDecisionVariableOptions(workflow, nodeId).forEach((opt) => {
    options.push({
      value: `{{${opt.varName}.result}}`,
      label: `${opt.label}（result）`,
    });
  });
  return options;
}

function isMcpServerSelectable(server) {
  return server?.status === 'connected';
}

function getWorkflowNodeIo(node) {
  const meta = getWorkflowNodeMeta(node?.type);
  return { input: meta.input || '', output: meta.output || '' };
}

function parseMcpInputsFromLegacy(node) {
  if (Array.isArray(node.mcpInputs) && node.mcpInputs.length) {
    return node.mcpInputs.map((row) => {
      const value = row.value ?? '';
      const mode = row.mode || (String(value).trim().startsWith('{{') ? 'variable' : 'fixed');
      return { key: row.key || '', value, mode };
    });
  }
  if (typeof node.mcpParams === 'string' && node.mcpParams.trim()) {
    try {
      const obj = JSON.parse(node.mcpParams);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return Object.entries(obj).map(([key, value]) => ({
          key,
          value: String(value),
          mode: 'fixed',
        }));
      }
    } catch {
      /* legacy free-text — ignore */
    }
  }
  return [];
}

function buildDefaultMcpInputs(serverId, toolId, catalog = MCP_SERVER_SEEDS, profiles = null) {
  const saved = profiles?.[serverId]?.[toolId];
  if (Array.isArray(saved) && saved.length) return cloneJson(saved);
  const tool = getMcpToolDef(serverId, toolId, catalog);
  if (!tool?.params?.length) return [];
  return tool.params.map((p) => ({
    key: p.key,
    value: p.placeholder || '',
    mode: String(p.placeholder || '').startsWith('{{') ? 'variable' : 'fixed',
  }));
}

function resolveMcpToolParamRows(serverId, toolId, catalog, profiles) {
  return buildDefaultMcpInputs(serverId, toolId, catalog, profiles);
}

function isMcpCustomServer(serverId) {
  return String(serverId || '').startsWith('mcp-custom-');
}

function normalizeMcpNode(node, workflow = null) {
  const base = ensureWorkflowNodeVarName(node, workflow);
  const serverId = base.mcpServerId || base.mcpServer || '';
  const toolId = base.mcpToolId || base.mcpTool || '';
  let mcpInputs = parseMcpInputsFromLegacy(base);
  if (!mcpInputs.length && serverId && toolId) {
    mcpInputs = buildDefaultMcpInputs(serverId, toolId);
  }
  return {
    ...base,
    mcpServerId: serverId,
    mcpToolId: toolId,
    mcpInputs,
    mcpTimeout: base.mcpTimeout ?? 30,
    mcpRetryMax: base.mcpRetryMax ?? 3,
    mcpErrorAction: base.mcpErrorAction || 'retry',
  };
}

function getMasterMatchUpstreamMcp(workflow, nodeId) {
  const upstreamIds = getDecisionUpstreamNodeIds(workflow, nodeId);
  const nodes = workflow?.nodes || [];
  const mcpNodes = upstreamIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n) => n?.type === 'mcp');
  return mcpNodes[mcpNodes.length - 1] || null;
}

function normalizeMasterMatchNode(node, workflow = null) {
  const base = ensureWorkflowNodeVarName(node, workflow);
  return {
    ...base,
    matchFieldIds: Array.isArray(base.matchFieldIds) ? [...base.matchFieldIds] : [],
    outputFieldIds: Array.isArray(base.outputFieldIds) ? [...base.outputFieldIds] : [],
    matchStrategy: normalizeMasterMatchStrategy(base.matchStrategy),
    outputFormat: base.outputFormat || 'normalized_fields',
  };
}

function getMcpNodeCanvasSummary(node) {
  const server = getMcpServerDef(node?.mcpServerId || node?.mcpServer);
  const tool = getMcpToolDef(node?.mcpServerId || node?.mcpServer, node?.mcpToolId || node?.mcpTool);
  if (!server && !tool) return null;
  return {
    serverLabel: server?.label || node?.mcpServerId || '未設定',
    toolLabel: tool?.label || node?.mcpToolId || 'ツール未選択',
  };
}

const WORKFLOW_NODE_SIZE = {
  default: { w: 208, h: 152 },
  decision: { w: 240, h: 56 },
  terminal: { w: 88, h: 44 },
};

function isWorkflowTerminalNode(node) {
  return node?.type === 'start' || node?.type === 'end';
}

function wfBezierControls(x1, y1, x2, y2) {
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return {
    c1x: x1 + dx,
    c1y: y1,
    c2x: x2 - dx,
    c2y: y2,
  };
}

function wfBezierPath(x1, y1, x2, y2) {
  const { c1x, c1y, c2x, c2y } = wfBezierControls(x1, y1, x2, y2);
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

function wfBezierPoint(x1, y1, x2, y2, t = 0.5) {
  const { c1x, c1y, c2x, c2y } = wfBezierControls(x1, y1, x2, y2);
  const u = 1 - t;
  return {
    x: u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2,
    y: u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2,
  };
}

/** @deprecated use wfBezierPath */
function wfStraightPath(x1, y1, x2, y2) {
  return wfBezierPath(x1, y1, x2, y2);
}

const INSPECTOR_HEAD_HINT_KEYS = {
  start: 'startTriggers',
  end: null,
  image: 'preprocess',
  ocr: 'ocrExtract',
  master_match: 'masterMatch',
  mcp: 'mcpTool',
  ai_verify: 'aiVerify',
  decision: 'decision',
  hitl_gate: 'hitlGate',
  notify: 'notify',
  code: 'code',
  edge: 'edgeEdit',
  scene: 'scene',
  overview: null,
};

const PREPROCESS_SETTING_ITEMS = [
  {
    key: 'rotate',
    label: '画像回転',
    switchKey: 'rotate',
    detailType: 'rotate',
    docTypesKey: 'rotateDocTypes',
  },
  {
    key: 'perspective',
    label: '画像補正',
    switchKey: 'perspective',
    detailType: 'perspective',
    docTypesKey: 'perspectiveDocTypes',
  },
  {
    key: 'split',
    label: '帳票分割',
    switchKey: 'split',
    detailType: 'split',
    docTypesKey: 'splitDocTypes',
  },
  {
    key: 'sort',
    label: '画像排序',
    switchKey: 'sort',
    detailType: 'sort',
    docTypesKey: 'sortDocTypes',
  },
];

const NODE_IO_DEFAULTS = {
  preprocess: {
    inputType: 'Document',
    maxFileSizeMb: 100,
    inputFormats: ['PDF', 'JPG', 'PNG', 'TIFF'],
    outputType: 'Processed Document',
    outputFormat: 'PDF',
  },
  input: {
    inputType: 'Document',
    maxFileSizeMb: 100,
    inputFormats: ['PDF', 'JPG', 'PNG', 'TIFF'],
    outputType: 'Document',
    outputFormat: 'Document',
  },
  ocr: {
    inputType: 'Processed Document',
    maxFileSizeMb: 100,
    inputFormats: ['PDF', 'JPG', 'PNG', 'TIFF'],
    outputType: 'Extracted Fields',
    outputFormat: 'JSON',
  },
  output: {
    inputType: 'Final Data',
    maxFileSizeMb: 100,
    inputFormats: ['JSON'],
    outputType: 'Export',
    outputFormat: 'JSON',
  },
};

const INPUT_FORMAT_OPTIONS = ['フォルダ', 'ZIP', 'PDF', 'PNG', 'JPG', 'TIFF'];
const INPUT_MAX_FILE_SIZE_MB = 20;

const INPUT_CHANNEL_MIGRATE = {
  アップロード: '画面上アップロード',
  API連携: 'APIアップロード',
};
const INPUT_FORMAT_MIGRATE = {
  JPEG: 'JPG',
};

function getWorkflowNodeMeta(type) {
  return WORKFLOW_NODE_META[type] || WORKFLOW_NODE_META.preprocess;
}

const DECISION_CONDITION_TYPES = [
  {
    value: 'case_ready',
    label: '案件就绪判断',
    defaultLabel: '案件就绪？',
    yesRule: '必要資料が揃い、案件データの整合性 OK',
    noRule: '資料不足・不備あり（補件または差し戻し）',
  },
  {
    value: 'deficiency_hitl',
    label: '不備時の人工確認',
    defaultLabel: '不備要確認？',
    yesRule: '必須帳票欠落・完全性 NG（要審査）',
    noRule: '完全性 OK（次工程へ）',
  },
  {
    value: 'preprocess_hitl',
    label: '前処理結果の要確認',
    defaultLabel: '前処理確認必要？',
    yesRule: '分割/補正の要確認',
    noRule: '前処理 PASS（自動確定）',
  },
  {
    value: 'ocr_hitl',
    label: 'OCR抽出結果の要確認',
    defaultLabel: 'OCR確認必要？',
    yesRule: '要確認フィールドあり、または信頼度が閾値未満',
    noRule: '全フィールドが自動確定可能',
  },
  {
    value: 'verify_hitl',
    label: 'AI検証結果の要確認',
    defaultLabel: 'AI検証確認必要？',
    yesRule: '検証ルール違反・WARNING・Master未一致',
    noRule: '検証 PASS（自動確定）',
  },
  {
    value: 'verify_pass',
    label: 'AI検証通過判断',
    defaultLabel: 'AI検証通過？',
    yesRule: '検証ルール ALL PASS・WARNING なし',
    noRule: '検証 NG または要確認あり',
  },
  {
    value: 'notify_required',
    label: '不備通知必要',
    defaultLabel: '不備通知必要？',
    yesRule: '不備あり・補件または差し戻し通知が必要',
    noRule: '通知不要（次工程へ）',
  },
  {
    value: 'custom',
    label: 'カスタム',
    defaultLabel: '条件分岐',
    yesRule: '',
    noRule: '上記 YES 条件に該当しない場合',
  },
];

const JUDGMENT_CONTEXT_OPTIONS = [
  { value: 'case_readiness', label: '案件就緒判断' },
  { value: 'verification_result', label: '検証結果判断' },
  { value: 'processing_completion', label: '処理完了判断' },
  { value: 'custom', label: 'カスタム' },
];

const JUDGMENT_ELSE_LABELS = {
  case_readiness: '未就緒（不備あり）',
  verification_result: '要確認',
  processing_completion: '補件依頼',
  custom: 'ELSE',
};

const HITL_CONTEXT_OPTIONS = [
  { value: 'preprocess', label: '前処理抽出確認' },
  { value: 'ocr', label: 'OCR抽出確認' },
  { value: 'verification', label: 'AI検証確認' },
  { value: 'deficiency', label: '不備確認' },
  { value: 'custom', label: 'カスタム' },
];

const HITL_PRESET_OPTIONS = HITL_CONTEXT_OPTIONS.filter((o) => ['preprocess', 'ocr', 'verification'].includes(o.value));

const HITL_ACTION_OPTIONS = [
  { value: 'confirm', label: '確認' },
  { value: 'correct', label: '修正' },
  { value: 'approve', label: '承認' },
];

const HITL_DEFAULT_ACTIONS = ['confirm', 'correct', 'approve'];

const HITL_CONTEXT_DEFAULT_ROLE = {
  preprocess: '一般審査',
  ocr: '医療審査',
  verification: '給付審査',
  deficiency: '一般審査',
  custom: '一般審査',
};

const HITL_LEGACY_CONTEXT_MAP = {
  preprocess_hitl: 'preprocess',
  ocr_hitl: 'ocr',
  verify_hitl: 'verification',
  deficiency_hitl: 'deficiency',
  custom: 'custom',
};

const NOTIFY_CHANNELS = [
  { value: 'email', label: 'メール' },
  { value: 'slack', label: 'Slack' },
  { value: 'webhook', label: 'Webhook' },
];

const NOTIFY_TEMPLATES = [
  {
    value: 'supplement',
    label: '補件依頼',
    defaultSubject: '【補件依頼】{{case.claimNo}} 追加書類のご提出のお願い',
    defaultBody: 'お客様各位\n\n審査の結果、以下の書類の追加提出が必要です。\n\n■ 必要書類\n{{verify.missing_docs}}\n\n■ 提出期限\n{{case.deadline}}\n\n■ 案件番号\n{{case.claimNo}}',
  },
  {
    value: 'completed',
    label: '案件処理完了',
    defaultSubject: '【処理完了】{{case.claimNo}} 案件処理完了のお知らせ',
    defaultBody: 'お客様各位\n\n案件番号 {{case.claimNo}} の処理が完了しました。\n\n■ 処理結果\n{{verify.result}}\n\nご不明点がございましたらお問い合わせください。',
  },
];

const NOTIFY_TEMPLATE_LEGACY_MAP = {
  deficiency: 'supplement',
  custom: 'completed',
  approval: 'completed',
};

function migrateNotifyTemplate(value) {
  const raw = String(value || '').trim();
  if (NOTIFY_TEMPLATES.some((t) => t.value === raw)) return raw;
  return NOTIFY_TEMPLATE_LEGACY_MAP[raw] || 'supplement';
}

function getNotifyTemplateDefaults(templateValue) {
  const tpl = NOTIFY_TEMPLATES.find((t) => t.value === templateValue) || NOTIFY_TEMPLATES[0];
  return { subject: tpl.defaultSubject || '', body: tpl.defaultBody || '' };
}

function getNotifyRecipientsLabel(channel) {
  if (channel === 'slack') return 'Slack チャンネル';
  if (channel === 'webhook') return 'Webhook URL';
  return 'メールアドレス';
}

function getNotifyRecipientsPlaceholder(channel) {
  if (channel === 'slack') return '#channel-name';
  if (channel === 'webhook') return 'https://hooks.example.com/...';
  return 'example@company.co.jp';
}

function validateNotifyRecipients(channel, value) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, message: '' };
  if (channel === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return { ok: false, message: 'メールアドレスの形式を確認してください' };
    }
    return { ok: true, message: '' };
  }
  if (channel === 'slack') return { ok: true, message: '' };
  if (channel === 'webhook') {
    if (!/^https?:\/\/.+/i.test(v)) {
      return { ok: false, message: 'Webhook URL は http:// または https:// で始めてください' };
    }
    return { ok: true, message: '' };
  }
  return { ok: true, message: '' };
}

function inferJudgmentContext(node) {
  return 'custom';
}

function inferHitlContext(node) {
  if (node?.hitlContext && HITL_CONTEXT_OPTIONS.some((o) => o.value === node.hitlContext)) {
    return node.hitlContext;
  }
  const legacy = node?.conditionType;
  if (legacy && HITL_LEGACY_CONTEXT_MAP[legacy]) return HITL_LEGACY_CONTEXT_MAP[legacy];
  if (node?.type === 'ocr_confirm') return 'ocr';
  if (node?.type === 'verify_confirm' || node?.type === 'confirm') return 'verification';
  return 'verification';
}

function getHitlContextMeta(hitlContext) {
  return HITL_CONTEXT_OPTIONS.find((o) => o.value === hitlContext) || HITL_CONTEXT_OPTIONS[0];
}

function resolveUpstreamNodesByType(workflow, nodeId, nodeType) {
  const nodeMap = Object.fromEntries((workflow?.nodes || []).map((n) => [n.id, n]));
  return getDecisionUpstreamNodeIds(workflow, nodeId)
    .map((id) => nodeMap[id])
    .filter((n) => n?.type === nodeType);
}

function judgmentCond(variable, value = '1') {
  return createDecisionCondition({ variable, operator: 'is', value });
}

function buildJudgmentCasesFromContext(judgmentContext, workflow, nodeId, verifyConfig = null) {
  const vCfg = verifyConfig || {};
  if (judgmentContext === 'case_readiness') {
    const ifConditions = [];
    resolveUpstreamNodesByType(workflow, nodeId, 'preprocess').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.result`));
    });
    if (!ifConditions.length) ifConditions.push(judgmentCond('preprocess.result'));
    resolveUpstreamNodesByType(workflow, nodeId, 'ocr').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.result`));
    });
    if (!resolveUpstreamNodesByType(workflow, nodeId, 'ocr').length) ifConditions.push(judgmentCond('ocr.result'));
    resolveUpstreamNodesByType(workflow, nodeId, 'hitl_gate').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.result`));
    });
    return [
      createDecisionCase('if', { id: 'if', label: '就緒完了', conditions: ifConditions }),
      createDecisionCase('elif', {
        id: 'elif-reupload',
        label: '再アップロード待ち',
        conditions: [judgmentCond('case.reupload_required')],
      }),
    ];
  }
  if (judgmentContext === 'verification_result') {
    const verifyNodes = resolveUpstreamNodesByType(workflow, nodeId, 'ai_verify');
    const vn = verifyNodes.length
      ? getWorkflowNodeVarName(verifyNodes[verifyNodes.length - 1], workflow)
      : 'verify';
    const ifConditions = [];
    if (vCfg.completenessEnabled !== false) {
      ifConditions.push(judgmentCond(`${vn}.categories.completeness.result`));
    }
    if (vCfg.textEnabled !== false) {
      ifConditions.push(judgmentCond(`${vn}.categories.text.result`));
    }
    if (vCfg.dataEnabled !== false) {
      ifConditions.push(judgmentCond(`${vn}.categories.data.result`));
    }
    if (vCfg.sealEnabled !== false) {
      ifConditions.push(judgmentCond(`${vn}.categories.seal.result`));
    }
    if (!ifConditions.length) ifConditions.push(judgmentCond(`${vn}.result`));
    return [createDecisionCase('if', { id: 'if', label: '自動パス', conditions: ifConditions })];
  }
  if (judgmentContext === 'processing_completion') {
    const ifConditions = [];
    resolveUpstreamNodesByType(workflow, nodeId, 'master_match').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.result`));
    });
    if (!ifConditions.length) ifConditions.push(judgmentCond('master_match.result'));
    resolveUpstreamNodesByType(workflow, nodeId, 'ai_verify').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.result`));
    });
    if (!resolveUpstreamNodesByType(workflow, nodeId, 'ai_verify').length) ifConditions.push(judgmentCond('verify.result'));
    resolveUpstreamNodesByType(workflow, nodeId, 'hitl_gate').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.result`));
    });
    return [createDecisionCase('if', { id: 'if', label: '承認・完結', conditions: ifConditions })];
  }
  return [createDecisionCase('if', { id: 'if', label: 'IF', conditions: [judgmentCond('')] })];
}

const HITL_GATE_PRESET_VALUES = ['preprocess_hitl', 'ocr_hitl', 'verify_hitl', 'deficiency_hitl', 'custom'];
const CONDITION_NODE_PRESET_VALUES = JUDGMENT_CONTEXT_OPTIONS.map((o) => o.value);

/** 控制类 Gateway 判断类型 */
const GATEWAY_JUDGMENT_TYPES = [
  { value: 'branch', label: '条件分岐', desc: 'YES/NO で次ノードを切り替え' },
  { value: 'wait', label: '待機', desc: '条件成立またはタイムアウトまで待機' },
  { value: 'pass', label: 'パススルー', desc: '評価のみ記録し常に次工程へ' },
  { value: 'return', label: '差し戻し', desc: '条件成立時に指定ノードへ戻す' },
];

const GATEWAY_CONDITION_LOGIC = [
  { value: 'and', label: 'AND（すべて満たす）' },
  { value: 'or', label: 'OR（いずれか満たす）' },
];

const GATEWAY_TIMEOUT_STRATEGIES = [
  { value: 'continue', label: 'タイムアウト後も次工程へ' },
  { value: 'hitl', label: 'タイムアウト後 HITL へ' },
  { value: 'fail', label: 'タイムアウトで案件エラー' },
];

const GATEWAY_RERUN_POLICIES = [
  { value: 'none', label: '再実行なし（次工程へ）' },
  { value: 'upstream', label: '直前ノードから再実行' },
  { value: 'return_node', label: '指定ノードから再実行' },
];

const GATEWAY_THRESHOLD_PRESETS = new Set(['ocr_hitl', 'preprocess_hitl']);

const HITL_GATE_PRESETS = HITL_CONTEXT_OPTIONS;
const CONDITION_NODE_PRESETS = JUDGMENT_CONTEXT_OPTIONS;

function getGatewayTypeMeta(gatewayType) {
  return GATEWAY_JUDGMENT_TYPES.find((t) => t.value === gatewayType) || GATEWAY_JUDGMENT_TYPES[0];
}

function decisionUsesThreshold(node) {
  return node?.type === 'decision' && GATEWAY_THRESHOLD_PRESETS.has(node.conditionType);
}

function getDecisionDefaultThreshold(node) {
  if (node?.conditionType === 'ocr_hitl') return 80;
  if (node?.conditionType === 'preprocess_hitl') return 200;
  return null;
}

function inferHitlGateConditionType(node) {
  if (node?.conditionType && HITL_GATE_PRESET_VALUES.includes(node.conditionType)) return node.conditionType;
  if (node?.type === 'ocr_confirm') return 'ocr_hitl';
  if (node?.type === 'verify_confirm') return 'verify_hitl';
  if (node?.type === 'confirm') return 'verify_hitl';
  return 'verify_hitl';
}

function getHitlGateDefaultRole(hitlContext) {
  return HITL_CONTEXT_DEFAULT_ROLE[hitlContext] || '一般審査';
}

function isHitlGateNode(node) {
  return node?.type === 'hitl_gate'
    || ['ocr_confirm', 'verify_confirm', 'confirm'].includes(node?.type);
}

function getHitlGatePreset(node) {
  if (!node) return null;
  const hitlContext = inferHitlContext(node);
  return getHitlContextMeta(hitlContext);
}

function normalizeHitlGateActions(actions) {
  const list = Array.isArray(actions) ? actions.filter((a) => HITL_ACTION_OPTIONS.some((o) => o.value === a)) : [];
  return list.length ? list : [...HITL_DEFAULT_ACTIONS];
}

function normalizeHitlGateNode(node) {
  if (!isHitlGateNode(node)) return node;
  const hitlContext = inferHitlContext(node);
  const meta = getHitlContextMeta(hitlContext);
  return {
    ...node,
    type: 'hitl_gate',
    hitlContext,
    label: node.label || '人工確認',
    role: node.role || getHitlGateDefaultRole(hitlContext),
    actions: normalizeHitlGateActions(node.actions),
    description: node.description || '',
  };
}

function normalizeNotifyNode(node) {
  if (node?.type !== 'notify') return node;
  const template = migrateNotifyTemplate(node.template);
  const defaults = getNotifyTemplateDefaults(template);
  return {
    ...node,
    type: 'notify',
    label: node.label || '通知',
    template,
    channel: node.channel || 'email',
    recipients: node.recipients || '',
    subject: node.subject != null && String(node.subject).trim() !== '' ? node.subject : defaults.subject,
    body: node.body != null && String(node.body).trim() !== '' ? node.body : defaults.body,
  };
}

const CODE_PARAM_DATA_TYPES = [
  { value: 'string', label: '文字列' },
  { value: 'int', label: '整数' },
  { value: 'float', label: '浮動小数' },
  { value: 'dict', label: '辞書' },
  { value: 'array', label: '配列' },
];

const CODE_PARAM_SOURCES = [
  { value: 'reference', label: '参照パラメータ' },
  { value: 'custom', label: 'カスタム' },
];

/** @deprecated use CODE_PARAM_DATA_TYPES */
const CODE_OUTPUT_TYPES = CODE_PARAM_DATA_TYPES;

function migrateCodeDataType(value) {
  const legacy = { number: 'float', object: 'dict', boolean: 'string' };
  const mapped = legacy[value] || value;
  return CODE_PARAM_DATA_TYPES.some((t) => t.value === mapped) ? mapped : 'string';
}

function getCodeParamDataTypeLabel(value) {
  return CODE_PARAM_DATA_TYPES.find((t) => t.value === value)?.label || value || '文字列';
}

function getCodeParamSourceLabel(value) {
  return CODE_PARAM_SOURCES.find((s) => s.value === value)?.label || '参照パラメータ';
}

const DEFAULT_CODE_PYTHON = `def main(inputs: dict) -> dict:
    """
    inputs: 入力パラメータから渡される dict
    戻り値は {result} に格納されます
    """
    return inputs
`;

function createCodeInputRow(index = 0) {
  return {
    id: newRuleId('cin'),
    name: `input_${index + 1}`,
    dataType: 'string',
    source: 'reference',
    required: true,
    variable: '',
    customValue: '',
  };
}

function createCodeOutputRow() {
  return { id: newRuleId('cout'), name: 'result', dataType: 'dict' };
}

function createCodeParamDialogDraft(mode = 'input') {
  if (mode === 'output') {
    return { id: '', name: '', dataType: 'string' };
  }
  return {
    id: '',
    name: '',
    dataType: 'string',
    source: 'reference',
    required: true,
    variable: '',
    customValue: '',
  };
}

function normalizeCodeInputRow(row, index = 0) {
  return {
    id: row?.id || newRuleId('cin'),
    name: (row?.name || '').trim() || `input_${index + 1}`,
    dataType: migrateCodeDataType(row?.dataType || row?.type || 'string'),
    source: row?.source === 'custom' ? 'custom' : 'reference',
    required: row?.required !== false,
    variable: row?.variable || '',
    customValue: row?.customValue != null ? String(row.customValue) : '',
  };
}

function normalizeCodeOutputRow(row, index = 0) {
  const dataType = migrateCodeDataType(row?.dataType || row?.type || 'dict');
  return {
    id: row?.id || newRuleId('cout'),
    name: (row?.name || '').trim() || (index === 0 ? 'result' : `output_${index + 1}`),
    dataType,
  };
}

function normalizeCodeNode(node, workflow = null) {
  if (node?.type !== 'code') return node;
  const inputs = Array.isArray(node.inputs) && node.inputs.length
    ? node.inputs.map((r, i) => normalizeCodeInputRow(r, i))
    : [];
  const outputParams = Array.isArray(node.outputParams) && node.outputParams.length
    ? node.outputParams.map((r, i) => normalizeCodeOutputRow(r, i))
    : [createCodeOutputRow()];
  const withVar = ensureWorkflowNodeVarName({
    ...node,
    type: 'code',
    label: node.label || 'カスタム関数',
    pythonCode: node.pythonCode != null && String(node.pythonCode).trim() !== ''
      ? node.pythonCode
      : DEFAULT_CODE_PYTHON,
    inputs,
    outputParams,
    returnContent: !!node.returnContent,
  }, workflow);
  return withVar;
}

function buildCodeVariableOptions(workflow, nodeId, verifyConfig = null) {
  return getDecisionVariableOptions(workflow, nodeId, verifyConfig);
}

function formatCodeInputVariableToken(variable) {
  if (!variable) return '—';
  return variable.includes('.') && !variable.startsWith('{') ? `{${variable}}` : variable;
}

function formatCodeInputRowDisplay(row) {
  if (!row) return '—';
  if (row.source === 'custom') {
    const val = (row.customValue || '').trim();
    return val || '（カスタム値未設定）';
  }
  return formatCodeInputVariableToken(row.variable);
}

function migrateHitlDecisionsInWorkflow(workflow) {
  if (!workflow?.nodes?.length) return;
  workflow.nodes.forEach((node, idx) => {
    if (node.type !== 'decision') return;
    if (!HITL_GATE_PRESET_VALUES.includes(node.conditionType)) return;
    if (node.conditionType === 'custom') return;
    const outEdges = (workflow.edges || []).filter((e) => e.from === node.id);
    const elseEdge = outEdges.find((e) => e.branch === 'else') || outEdges.find((e) => !e.branch);
    const elseTarget = elseEdge?.to;
    workflow.nodes[idx] = normalizeHitlGateNode({ ...node, type: 'hitl_gate' });
    workflow.edges = (workflow.edges || []).filter((e) => e.from !== node.id);
    if (elseTarget) workflow.edges.push({ from: node.id, to: elseTarget });
  });
}

const DECISION_RESULT_VALUES = [
  { value: '1', label: '1（命中）' },
  { value: '0', label: '0（违反）' },
];

const DECISION_OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'start with' },
  { value: 'ends_with', label: 'end with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

const DECISION_VALUELESS_OPERATORS = new Set(['is_empty', 'is_not_empty']);

function getDecisionUpstreamNodeIds(workflow, nodeId) {
  const edges = workflow?.edges || [];
  const visited = new Set();
  const queue = [nodeId];
  const upstream = [];
  while (queue.length) {
    const current = queue.shift();
    edges.filter((e) => e.to === current).forEach((edge) => {
      if (visited.has(edge.from)) return;
      visited.add(edge.from);
      upstream.push(edge.from);
      queue.push(edge.from);
    });
  }
  return upstream;
}

function appendDecisionVarOption(options, spec) {
  options.push({
    group: spec.group || '変数',
    nodeType: spec.nodeType || '',
    nodeId: spec.nodeId || '',
    varName: spec.varName || '',
    value: spec.value,
    label: spec.label,
    hint: spec.hint || `{${spec.value}}`,
  });
}

function expandVerifyVarCatalog(varName, title, verifyConfig, options) {
  const groupBase = title || 'AI検証';
  appendDecisionVarOption(options, {
    value: `${varName}.result`,
    label: `汇总 · {${varName}.result}`,
    group: `${groupBase} · 汇总`,
    nodeType: 'ai_verify',
    varName,
  });
  appendDecisionVarOption(options, {
    value: `${varName}.status`,
    label: `ステータス · {${varName}.status}`,
    group: `${groupBase} · 汇总`,
    nodeType: 'ai_verify',
    varName,
  });
  const v = verifyConfig || {};
  if (v.completenessEnabled !== false) {
    appendDecisionVarOption(options, {
      value: `${varName}.categories.completeness.result`,
      label: '完全性検証',
      group: `${groupBase} · カテゴリ`,
      nodeType: 'ai_verify',
      varName,
    });
  }
  if (v.textEnabled !== false) {
    appendDecisionVarOption(options, {
      value: `${varName}.categories.text.result`,
      label: 'テキスト検証',
      group: `${groupBase} · カテゴリ`,
      nodeType: 'ai_verify',
      varName,
    });
    (v.text || []).forEach((rule) => {
      const rid = rule.id || `r_${(rule.label || '').slice(0, 8)}`;
      appendDecisionVarOption(options, {
        value: `${varName}.rules.${rid}.result`,
        label: rule.label || rid,
        group: `${groupBase} · ルール`,
        nodeType: 'ai_verify',
        varName,
      });
    });
  }
  if (v.dataEnabled !== false) {
    appendDecisionVarOption(options, {
      value: `${varName}.categories.data.result`,
      label: 'データ検証',
      group: `${groupBase} · カテゴリ`,
      nodeType: 'ai_verify',
      varName,
    });
    (v.dataRules || []).forEach((rule) => {
      const rid = rule.id || `r_${(rule.label || '').slice(0, 8)}`;
      appendDecisionVarOption(options, {
        value: `${varName}.rules.${rid}.result`,
        label: rule.label || rid,
        group: `${groupBase} · ルール`,
        nodeType: 'ai_verify',
        varName,
      });
    });
  }
  if (v.sealEnabled !== false) {
    appendDecisionVarOption(options, {
      value: `${varName}.categories.seal.result`,
      label: '印鑑・署名検証',
      group: `${groupBase} · カテゴリ`,
      nodeType: 'ai_verify',
      varName,
    });
  }
}

function buildDecisionVariableCatalog(workflow, nodeId, verifyConfig = null) {
  const nodeMap = Object.fromEntries((workflow?.nodes || []).map((n) => [n.id, n]));
  const options = [];
  appendDecisionVarOption(options, {
    value: 'case.reupload_required',
    label: '再アップロード要 · {case.reupload_required}',
    group: '案件',
    nodeType: 'case',
  });
  getDecisionUpstreamNodeIds(workflow, nodeId).forEach((id) => {
    const n = nodeMap[id];
    if (!n || n.type === 'decision' || n.type === 'notify') return;
    const varName = getWorkflowNodeVarName(n, workflow);
    const meta = getWorkflowNodeMeta(n.type);
    const title = n.label || meta.title;
    if (n.type === 'ai_verify') {
      expandVerifyVarCatalog(varName, title, verifyConfig, options);
      return;
    }
    if (n.type === 'hitl_gate') {
      appendDecisionVarOption(options, {
        value: `${varName}.result`,
        label: `${title} · {${varName}.result}`,
        group: title,
        nodeType: 'hitl_gate',
        nodeId: n.id,
        varName,
      });
      return;
    }
    if (n.type === 'master_match') {
      appendDecisionVarOption(options, {
        value: `${varName}.result`,
        label: `${title} · 照合結果`,
        group: title,
        nodeType: 'master_match',
        nodeId: n.id,
        varName,
      });
      (n.matchFieldIds || []).forEach((fid) => {
        appendDecisionVarOption(options, {
          value: `${varName}.rules.${fid}.result`,
          label: `照合 ${fid}`,
          group: `${title} · ルール`,
          nodeType: 'master_match',
          nodeId: n.id,
          varName,
        });
      });
      return;
    }
    appendDecisionVarOption(options, {
      value: `${varName}.result`,
      label: `${title} · {${varName}.result}`,
      group: title,
      nodeType: n.type,
      nodeId: n.id,
      varName,
    });
  });
  if (options.length > 1) return options;
  return [
    { value: 'preprocess.result', label: '前処理 · 判定結果', group: '前処理', nodeType: 'preprocess', varName: 'preprocess' },
    { value: 'ocr.result', label: 'OCR抽出 · 判定結果', group: 'OCR抽出', nodeType: 'ocr', varName: 'ocr' },
    { value: 'verify.result', label: 'AI検証 · 判定結果', group: 'AI検証', nodeType: 'ai_verify', varName: 'verify' },
    { value: 'case.reupload_required', label: '再アップロード要', group: '案件', nodeType: 'case' },
  ];
}

function getDecisionVariableOptionGroups(options) {
  const groups = [];
  const map = new Map();
  (options || []).forEach((opt) => {
    const key = opt.group || 'その他';
    if (!map.has(key)) {
      map.set(key, []);
      groups.push({ label: key, options: map.get(key) });
    }
    map.get(key).push(opt);
  });
  return groups;
}

function getDecisionVariableOptions(workflow, nodeId, verifyConfig = null) {
  return buildDecisionVariableCatalog(workflow, nodeId, verifyConfig);
}

function getDecisionVariableLabel(value, options = []) {
  return options.find((o) => o.value === value)?.label || value || '変数';
}

function decisionUsesValueField(operator) {
  return !DECISION_VALUELESS_OPERATORS.has(operator);
}

function decisionUsesResultValue(operator) {
  return operator === 'is' || operator === 'is_not';
}

const DECISION_PRESET_VARIABLE = {
  case_ready: 'case.readiness',
  deficiency_hitl: 'case.completeness',
  preprocess_hitl: 'preprocess.status',
  ocr_hitl: 'ocr.confidence',
  verify_hitl: 'verify.status',
  verify_pass: 'verify.status',
  notify_required: 'case.deficiency',
  custom: 'custom',
};

/** プリセット YES 条件に対応する実行式（エンジン判定） */
const DECISION_PRESET_EXPRESSION = {
  case_ready: '{{case.readiness}} = OK',
  deficiency_hitl: '{{case.completeness}} = NG',
  preprocess_hitl: '{{preprocess.status}} = REVIEW_REQUIRED',
  ocr_hitl: 'ANY({{ocr.fields.confidence}}) < {{ocr.threshold}}',
  verify_hitl: '{{verify.status}} IN (NG, WARNING) OR {{master.match}} = UNMATCHED',
  verify_pass: '{{verify.status}} = PASS AND {{verify.warning_count}} = 0',
  notify_required: '{{case.has_deficiency}} = true',
};

function compileWorkflowYesExpression(yesRule, conditionType, docTypes = [], node = null) {
  const rule = (yesRule || '').trim();
  if (!rule && !conditionType) return '';
  if (/\{\{[^}]+\}\}/.test(rule)) return rule;
  const fromNatural = compileNaturalToExpression(rule, docTypes);
  if (fromNatural) return fromNatural;
  if (conditionType === 'ocr_hitl') {
    const threshold = node?.threshold ?? getDecisionDefaultThreshold({ conditionType: 'ocr_hitl' });
    return `ANY({{ocr.fields.confidence}}) < ${threshold}`;
  }
  if (conditionType === 'preprocess_hitl') {
    const minDpi = node?.threshold ?? getDecisionDefaultThreshold({ conditionType: 'preprocess_hitl' });
    return `{{preprocess.min_dpi}} < ${minDpi}`;
  }
  return DECISION_PRESET_EXPRESSION[conditionType] || '';
}

function syncWorkflowYesExpression(node, docTypes = []) {
  if (!node) return;
  const conditionType = node.conditionType
    || (node.type === 'decision' ? inferDecisionConditionType(node) : inferHitlGateConditionType(node));
  node.yesExpression = compileWorkflowYesExpression(node.yesRule, conditionType, docTypes, node);
  if (node.type === 'decision' && node.cases?.[0]?.conditions?.[0]) {
    node.cases[0].conditions[0].value = node.yesRule || '';
    node.cases[0].conditions[0].expression = node.yesExpression || '';
    node.cases[0].conditions[0].logic = node.conditionLogic || 'and';
  }
}

function getWorkflowYesExpression(node) {
  if (!node) return '';
  if (node.yesExpression?.trim()) return node.yesExpression.trim();
  const conditionType = node.conditionType
    || (node.type === 'decision' ? inferDecisionConditionType(node) : inferHitlGateConditionType(node));
  return DECISION_PRESET_EXPRESSION[conditionType] || '';
}

function createDecisionCondition(overrides = {}) {
  return {
    id: newRuleId('dc'),
    variable: '',
    operator: 'is',
    value: '1',
    preset: '',
    ...overrides,
  };
}

function createDecisionCase(kind = 'if', overrides = {}) {
  return {
    id: kind === 'if' ? 'if' : newRuleId('elif'),
    kind,
    conditions: [createDecisionCondition()],
    ...overrides,
  };
}

function normalizeDecisionCondition(condition) {
  const c = condition || {};
  return {
    id: c.id || newRuleId('dc'),
    variable: c.variable || '',
    operator: c.operator || 'is',
    value: c.value ?? '1',
    preset: c.preset || '',
  };
}

function normalizeDecisionCase(decisionCase, index) {
  const kind = decisionCase?.kind || (index === 0 ? 'if' : 'elif');
  const conditions = decisionCase?.conditions?.length
    ? decisionCase.conditions.map(normalizeDecisionCondition)
    : [createDecisionCondition()];
  return {
    id: decisionCase?.id || (kind === 'if' ? 'if' : newRuleId('elif')),
    kind,
    label: decisionCase?.label || '',
    conditions,
  };
}

const DECISION_PRESET_UPSTREAM_TYPES = {
  case_ready: ['scene_completeness', 'scene_aggregate', 'case_link'],
  ocr_hitl: ['ocr'],
  verify_pass: ['ai_verify'],
  verify_hitl: ['ai_verify'],
  fraud_detect: ['fraud_detect'],
  preprocess_hitl: ['preprocess'],
  deficiency_hitl: ['scene_completeness'],
  notify_required: ['scene_completeness'],
  custom: [],
};

/** プリセット IF 条件の期待値：命中=1 / 违反=0 */
const DECISION_PRESET_IF_RESULT = {
  case_ready: '1',
  ocr_hitl: '1',
  verify_pass: '1',
  verify_hitl: '1',
  fraud_detect: '1',
  preprocess_hitl: '1',
  deficiency_hitl: '1',
  notify_required: '1',
  custom: '1',
};

function syncDecisionVariablesInWorkflow(workflow) {
  if (!workflow?.nodes?.length) return;
  workflow.nodes.filter((n) => n.type === 'decision').forEach((node) => {
    const options = getDecisionVariableOptions(workflow, node.id);
    if (!options.length) return;
    const optionValues = new Set(options.map((o) => o.value));
    (node.cases || []).forEach((c) => {
      (c.conditions || []).forEach((cond) => {
        if (cond.variable && optionValues.has(cond.variable)) return;
        const preset = cond.preset || node.conditionType;
        const resolved = resolveDecisionPresetVariable(workflow, node.id, preset);
        cond.variable = resolved && optionValues.has(resolved) ? resolved : options[0].value;
      });
    });
  });
}

function resolveDecisionPresetVariable(workflow, nodeId, presetValue) {
  const options = getDecisionVariableOptions(workflow, nodeId);
  const types = DECISION_PRESET_UPSTREAM_TYPES[presetValue] || [];
  for (const nodeType of types) {
    const match = options.find((o) => o.nodeType === nodeType);
    if (match) return match.value;
  }
  return options[0]?.value || '';
}

function buildDecisionCasesFromPreset(presetValue, workflow, nodeId, verifyConfig = null) {
  const judgmentContext = JUDGMENT_CONTEXT_OPTIONS.some((o) => o.value === presetValue)
    ? presetValue
    : inferJudgmentContext({ judgmentContext: presetValue, conditionType: presetValue });
  if (judgmentContext === 'custom') {
    return [createDecisionCase('if', { id: 'if', label: 'IF' })];
  }
  return buildJudgmentCasesFromContext(judgmentContext, workflow, nodeId, verifyConfig);
}

function inferDecisionConditionType(node) {
  return inferJudgmentContext(node);
}

function buildDecisionCasesFromLegacy(node, preset, workflow = null, verifyConfig = null) {
  if (Array.isArray(node?.cases) && node.cases.length) {
    return node.cases.map((c, i) => normalizeDecisionCase(c, i));
  }
  return [createDecisionCase('if', { id: 'if', label: 'IF' })];
}

function normalizeDecisionNode(node, workflow = null, verifyConfig = null) {
  if (node?.type !== 'decision') return node;
  let cases = buildDecisionCasesFromLegacy(node, null, workflow, verifyConfig);
  if (workflow && node.id) {
    const options = buildDecisionVariableCatalog(workflow, node.id, verifyConfig);
    const optionValues = new Set(options.map((o) => o.value));
    cases = cases.map((c) => ({
      ...c,
      conditions: c.conditions.map((cond) => ({
        ...cond,
        variable: cond.variable && optionValues.has(cond.variable)
          ? cond.variable
          : (options.find((o) => o.nodeType && cond.variable?.startsWith(o.varName))?.value || options[0]?.value || cond.variable),
      })),
    }));
  }
  return {
    ...node,
    label: node.label || '条件判断',
    description: node.description || '',
    judgmentContext: 'custom',
    conditionType: 'custom',
    gatewayType: 'branch',
    conditionLogic: node.conditionLogic || 'and',
    waitCondition: '',
    timeoutMinutes: 0,
    timeoutStrategy: 'continue',
    returnTargetId: '',
    rerunPolicy: 'none',
    rerunTargetId: '',
    cases,
    elseLabel: node.elseLabel || 'ELSE',
    elseDescription: node.elseDescription || node.elseLabel || '条件に該当しない場合',
    outputVar: 'branch_name',
  };
}

function getDecisionPreset(node) {
  if (!node || node.type !== 'decision') return null;
  const judgmentContext = inferJudgmentContext(node);
  return JUDGMENT_CONTEXT_OPTIONS.find((o) => o.value === judgmentContext)
    || JUDGMENT_CONTEXT_OPTIONS[0];
}

function getDecisionYesExpression(node, docTypes = []) {
  if (!node || node.type !== 'decision') return '';
  if (node.yesExpression) return node.yesExpression;
  const preset = getDecisionPreset(node);
  if (preset && preset.value !== 'custom') {
    return compileWorkflowYesExpression('', preset.value, docTypes, node);
  }
  return (node.yesRule || '').trim();
}

function getDecisionConditionDisplay(node, docTypes = [], variableOptions = []) {
  const firstCase = node?.cases?.[0];
  if (firstCase) return decisionConditionPreview(firstCase, variableOptions);
  return '条件未設定';
}

function decisionConditionPreview(decisionCase, variableOptions = []) {
  const conditions = decisionCase?.conditions || [];
  if (!conditions.length) return '条件未設定';
  const parts = conditions.map((c) => {
    const variable = formatDecisionConditionToken(c.variable);
    const operator = DECISION_OPERATORS.find((o) => o.value === c.operator)?.label || c.operator;
    if (!decisionUsesValueField(c.operator)) return `${variable} ${operator}`;
    return `${variable} ${operator} ${c.value ?? '1'}`;
  });
  return parts.join(' AND ');
}

function getDecisionCaseCanvasPreview(node, decisionCase) {
  if (!decisionCase?.conditions?.some((c) => c.variable)) return '条件未設定';
  if (decisionCase.label) return decisionCase.label;
  return decisionConditionPreview(decisionCase);
}

function getDecisionElseCanvasPreview(node) {
  return node?.elseLabel || 'ELSE';
}

function getDecisionYesRule(node) {
  if (!node || node.type !== 'decision') return '';
  if (node.yesRule != null && String(node.yesRule).trim() !== '') return node.yesRule;
  return getDecisionPreset(node)?.yesRule || '';
}

function getDecisionNoRule(node) {
  if (!node || node.type !== 'decision') return '';
  if (node.noRule != null && String(node.noRule).trim() !== '') return node.noRule;
  return node.elseDescription || getDecisionPreset(node)?.noRule || '条件に該当しない場合';
}

function getDecisionElseDisplayText(node) {
  return node?.elseLabel || node?.elseDescription || '条件に該当しない場合';
}

function getDecisionCaseDisplayText(node, decisionCase, caseIdx, workflow = null) {
  if (!decisionCase) return '条件未設定';
  const options = workflow && node?.id ? getDecisionVariableOptions(workflow, node.id) : [];
  return decisionConditionPreview(decisionCase, options);
}

function getDecisionIfCondition(node) {
  return node?.cases?.[0]?.conditions?.[0] || null;
}

function getDecisionElseConditionPreview(node, workflow = null) {
  const cond = getDecisionIfCondition(node);
  if (!cond?.variable) return '{変数} is 0';
  const varLabel = cond.variable.includes('.') ? `{${cond.variable}}` : cond.variable;
  if (cond.operator === 'is' && String(cond.value) === '1') return `${varLabel} is 0`;
  if (cond.operator === 'is' && String(cond.value) === '0') return `${varLabel} is 1`;
  return `${varLabel} ≠ ${cond.value || '1'}`;
}

function formatDecisionConditionToken(variable) {
  if (!variable) return '—';
  return variable.includes('.') && !variable.startsWith('{') ? `{${variable}}` : variable;
}

function truncateWorkflowPreview(text, maxLen = 42) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  return value.length <= maxLen ? value : `${value.slice(0, maxLen)}…`;
}

function getNotifyNodeSubject(node) {
  if (!node || node.type !== 'notify') return '';
  const normalized = normalizeNotifyNode(node);
  return normalized.subject || '';
}

function getNotifyNodeBodyPreview(node, maxLen = 56) {
  if (!node || node.type !== 'notify') return '';
  const normalized = normalizeNotifyNode(node);
  return truncateWorkflowPreview(String(normalized.body || '').replace(/\n/g, ' '), maxLen);
}

function getNotifyNodeBodyText(node) {
  if (!node || node.type !== 'notify') return '';
  return normalizeNotifyNode(node).body || '';
}

function getHitlGateYesRule(node) {
  if (!node || !isHitlGateNode(node)) return '';
  if (node.yesRule != null && String(node.yesRule).trim() !== '') return node.yesRule;
  return getHitlGatePreset(node)?.yesRule || '';
}

function getHitlGateNoRule(node) {
  if (!node || !isHitlGateNode(node)) return '';
  if (node.noRule != null && String(node.noRule).trim() !== '') return node.noRule;
  return getHitlGatePreset(node)?.noRule || '';
}

function getDecisionNodeBranches(node) {
  const cases = node?.cases?.length ? node.cases : [createDecisionCase('if')];
  const total = cases.length + 1;
  const branches = cases.map((c, i) => ({
    key: c.id,
    label: c.kind === 'if' || i === 0 ? 'IF' : 'ELIF',
    caseLabel: `CASE ${i + 1}`,
    ratio: (i + 0.5) / total,
  }));
  branches.push({
    key: 'else',
    label: 'ELSE',
    caseLabel: 'ELSE',
    ratio: (cases.length + 0.5) / total,
  });
  return branches;
}

function getDecisionBranchEdgeLabel(branch, node) {
  if (branch === 'else') return node?.elseLabel || 'ELSE';
  const cases = node?.cases || [];
  const match = cases.find((c) => c.id === branch);
  if (match?.label) return match.label;
  const idx = cases.findIndex((c) => c.id === branch);
  if (idx === 0) return 'IF';
  if (idx > 0) return 'ELIF';
  if (branch === 'if') return 'IF';
  return String(branch || '').toUpperCase();
}

function migrateDecisionEdges(workflow) {
  const nodeMap = Object.fromEntries((workflow?.nodes || []).map((n) => [n.id, n]));
  (workflow?.edges || []).forEach((edge) => {
    if (edge.branch === 'yes') edge.branch = 'if';
    else if (edge.branch === 'no') edge.branch = 'else';
    const from = nodeMap[edge.from];
    if (from?.type === 'decision' && edge.branch) {
      edge.label = getDecisionBranchEdgeLabel(edge.branch, from);
    }
  });
}

/** 条件分岐：無 branch 出力・余分な分岐を除去し IF/ELSE のみに統一 */
function sanitizeDecisionEdges(workflow) {
  if (!workflow?.edges?.length) return;
  const nodeMap = Object.fromEntries((workflow.nodes || []).map((n) => [n.id, n]));

  workflow.edges = workflow.edges.filter((edge) => {
    const from = nodeMap[edge.from];
    if (from?.type !== 'decision') return true;
    if (!edge.branch) return false;
    return edge.branch === 'else' || (from.cases || []).some((c) => c.id === edge.branch);
  });

  const seen = new Set();
  workflow.edges = workflow.edges.filter((edge) => {
    const from = nodeMap[edge.from];
    if (from?.type !== 'decision' || !edge.branch) return true;
    const key = `${edge.from}|${edge.branch}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  workflow.edges.forEach((edge) => {
    const from = nodeMap[edge.from];
    if (from?.type === 'decision' && edge.branch) {
      edge.label = getDecisionBranchEdgeLabel(edge.branch, from);
    }
  });
}

/** 旧挿入ロジック（IF→次ノード）を ELSE→次ノード に移行 */
function migrateDecisionFlowEdges(workflow) {
  if (!workflow?.nodes?.length) return;
  (workflow.nodes || []).forEach((node) => {
    if (node.type !== 'decision') return;
    const preset = getDecisionPreset(node);
    if (preset?.value === 'custom') return;
    const out = (workflow.edges || []).filter((e) => e.from === node.id);
    const ifEdge = out.find((e) => e.branch === 'if');
    const elseEdge = out.find((e) => e.branch === 'else');
    if (ifEdge && !elseEdge) {
      workflow.edges.push({
        from: node.id,
        to: ifEdge.to,
        branch: 'else',
        label: 'ELSE',
      });
      workflow.edges = workflow.edges.filter((e) => e !== ifEdge);
    }
  });
}

function ensureDecisionElseContinuesFlow(workflow, nodeId, fallbackTargetId) {
  if (!workflow || !nodeId || !fallbackTargetId) return;
  const node = workflow.nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== 'decision') return;
  const hasElse = workflow.edges.some((e) => e.from === nodeId && e.branch === 'else');
  if (hasElse) return;
  workflow.edges.push({
    from: nodeId,
    to: fallbackTargetId,
    branch: 'else',
    label: 'ELSE',
  });
}

function buildDefaultCaseWorkflow() {
  const nodes = [];
  const edges = [];
  const wf = { nodes, edges };

  function place(spec) {
    const {
      id, type, label, judgmentContext, hitlContext, role, template, isStart,
    } = spec;
    let node;
    if (type === 'hitl_gate') {
      node = normalizeHitlGateNode({
        id,
        type,
        label: label || '人工確認',
        x: 0,
        y: 0,
        hitlContext: hitlContext || 'ocr',
        role: role || getHitlGateDefaultRole(hitlContext || 'ocr'),
      });
    } else if (type === 'notify') {
      node = normalizeNotifyNode({
        id,
        type,
        label: label || '通知',
        x: 0,
        y: 0,
        template: template || 'supplement',
      });
    } else if (type === 'decision') {
      node = normalizeDecisionNode({
        id,
        type,
        label: label || '条件判断',
        x: 0,
        y: 0,
        judgmentContext: judgmentContext || 'custom',
      }, wf);
    } else if (type === 'mcp') {
      node = normalizeMcpNode({
        id,
        type,
        label: label || 'MCP',
        x: 0,
        y: 0,
        mcpServerId: 'contract_api',
        mcpToolId: 'fetch_contract',
        ...(isStart ? { isStart: true } : {}),
      }, wf);
    } else if (type === 'master_match') {
      node = normalizeMasterMatchNode({
        id,
        type,
        label: label || 'マスタ照合',
        x: 0,
        y: 0,
        matchFieldIds: [],
        outputFieldIds: [],
        matchStrategy: 'code',
      }, wf);
    } else if (type === 'start' || type === 'end') {
      node = type === 'start'
        ? normalizeStartNode({
          id,
          type,
          label: label || getWorkflowNodeMeta(type).title,
          x: 0,
          y: 0,
          isStart: true,
        })
        : normalizeEndNode({
          id,
          type,
          label: label || getWorkflowNodeMeta(type).title,
          x: 0,
          y: 0,
          isEnd: true,
        });
    } else {
      node = ensureWorkflowNodeVarName({
        id,
        type,
        label: label || getWorkflowNodeMeta(type).title,
        x: 0,
        y: 0,
        ...(isStart ? { isStart: true } : {}),
      }, wf);
    }
    nodes.push(node);
    return node;
  }

  place({ id: 'wf-start', type: 'start', label: '開始' });
  place({ id: 'wf-pp', type: 'preprocess', label: '前処理' });
  place({
    id: 'wf-hu-pre',
    type: 'hitl_gate',
    label: '人工確認',
    hitlContext: 'preprocess',
    role: '入力オペレータ',
  });
  place({ id: 'wf-oc', type: 'ocr', label: 'OCR抽出' });
  place({
    id: 'wf-hu-ocr',
    type: 'hitl_gate',
    label: '人工確認',
    hitlContext: 'ocr',
    role: '医療審査',
  });
  place({ id: 'wf-ms', type: 'master_match', label: 'マスタ照合' });
  place({ id: 'wf-ai', type: 'ai_verify', label: 'AI確認' });
  place({ id: 'wf-d-final', type: 'decision', label: '条件判断', judgmentContext: 'custom' });
  place({ id: 'wf-n-ok', type: 'notify', label: '通知', template: 'completed' });
  place({
    id: 'wf-hu-final',
    type: 'hitl_gate',
    label: '人工確認',
    hitlContext: 'verification',
    role: '給付審査',
  });
  place({ id: 'wf-n-ng', type: 'notify', label: '通知', template: 'supplement' });
  place({ id: 'wf-end', type: 'end', label: '終了' });

  const aiVar = getWorkflowNodeVarName(nodes.find((n) => n.id === 'wf-ai'), wf);
  const dFinal = nodes.find((n) => n.id === 'wf-d-final');
  Object.assign(dFinal, {
    judgmentContext: 'custom',
    cases: [createDecisionCase('if', { id: 'if', label: '通過', conditions: [judgmentCond(`${aiVar}.result`)] })],
    elseLabel: '要確認',
  });

  edges.push(
    { from: 'wf-start', to: 'wf-pp' },
    { from: 'wf-pp', to: 'wf-hu-pre' },
    { from: 'wf-hu-pre', to: 'wf-oc' },
    { from: 'wf-oc', to: 'wf-hu-ocr' },
    { from: 'wf-hu-ocr', to: 'wf-ms' },
    { from: 'wf-ms', to: 'wf-ai' },
    { from: 'wf-ai', to: 'wf-d-final' },
    { from: 'wf-d-final', to: 'wf-n-ok', branch: 'if', label: '通過' },
    { from: 'wf-d-final', to: 'wf-hu-final', branch: 'else', label: '要確認' },
    { from: 'wf-n-ok', to: 'wf-end' },
    { from: 'wf-hu-final', to: 'wf-n-ng' },
    { from: 'wf-n-ng', to: 'wf-end' },
  );

  wf.nodes = wf.nodes.map((n) => {
    if (n.type === 'start') return normalizeStartNode(n);
    if (n.type === 'end') return normalizeEndNode(n);
    if (n.type === 'decision') return normalizeDecisionNode(n, wf);
    if (n.type === 'notify') return normalizeNotifyNode(n);
    if (n.type === 'code') return normalizeCodeNode(n, wf);
    if (isHitlGateNode(n)) return normalizeHitlGateNode(n);
    return n;
  });
  migrateDecisionEdges(wf);
  sanitizeDecisionEdges(wf);
  ensureWorkflowStartNode(wf);
  layoutWorkflowGraph(wf);

  return {
    nodes,
    edges,
    isTemplate: true,
    templateVersion: CASE_WORKFLOW_TEMPLATE_VERSION,
    startNodeId: wf.startNodeId,
  };
}

function workflowHasTemplateNodeIds(workflow, templateIds) {
  const nodes = workflow?.nodes || [];
  if (!nodes.length) return false;
  const ids = new Set(nodes.map((n) => n.id));
  return templateIds.every((id) => ids.has(id));
}

function isLegacyCaseWorkflowTemplate(workflow) {
  return workflowHasTemplateNodeIds(workflow, LEGACY_CASE_WORKFLOW_TEMPLATE_NODE_IDS);
}

function isDefaultCaseWorkflowTemplate(workflow) {
  return workflowHasTemplateNodeIds(workflow, DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS)
    && workflow?.templateVersion === CASE_WORKFLOW_TEMPLATE_VERSION;
}

function shouldMigrateCaseWorkflowToDefault(workflow) {
  if (!workflow?.nodes?.length) return true;
  if (isLegacyCaseWorkflowTemplate(workflow)) return true;
  if (!workflow.templateVersion || workflow.templateVersion < CASE_WORKFLOW_TEMPLATE_VERSION) {
    if (workflow.isTemplate) return true;
    return workflowHasTemplateNodeIds(workflow, DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS)
      || workflowHasTemplateNodeIds(workflow, PREVIOUS_CASE_WORKFLOW_TEMPLATE_NODE_IDS)
      || isLegacyCaseWorkflowTemplate(workflow);
  }
  return false;
}

function getWorkflowGraphEntryNode(workflow) {
  const nodes = workflow?.nodes || [];
  const edges = workflow?.edges || [];
  const mainIn = new Set(edges.filter((e) => !e.branch).map((e) => e.to));
  return nodes.find((n) => n.type !== 'start' && !mainIn.has(n.id))
    || nodes.find((n) => n.type === 'preprocess')
    || nodes.find((n) => n.id === 'wf-pp')
    || nodes[0]
    || null;
}

function findLegacyWorkflowOutputNode(workflow) {
  return (workflow?.nodes || []).find((n) =>
    n.id === 'wf-out'
    || n.type === 'output'
    || (n.type === 'mcp' && /出力/.test(n.label || '')),
  ) || null;
}

function ensureFormWorkflows(form, { force = false } = {}) {
  // #region agent log
  if (!ensureFormWorkflows._c) ensureFormWorkflows._c = 0;
  ensureFormWorkflows._c += 1;
  const _wfCase = form.workflows?.case;
  const _shouldMigrate = _wfCase ? shouldMigrateCaseWorkflowToDefault(_wfCase) : false;
  if (ensureFormWorkflows._c <= 30 || ensureFormWorkflows._c % 100 === 0) {
    fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:ensureFormWorkflows',message:'ensureFormWorkflows call',data:{callCount:ensureFormWorkflows._c,force,hasCase:!!_wfCase,isTemplate:!!_wfCase?.isTemplate,templateVersion:_wfCase?.templateVersion,shouldMigrate:_shouldMigrate,nodeCount:_wfCase?.nodes?.length},timestamp:Date.now(),hypothesisId:'H1',runId:'post-fix'})}).catch(()=>{});
  }
  // #endregion
  if (!form.workflows?.case && form.workflow) {
    form.workflows = {
      case: normalizeWorkflow(form.workflow, 'case'),
    };
    delete form.workflow;
    if (shouldMigrateCaseWorkflowToDefault(form.workflows.case)) {
      form.workflows.case = buildDefaultCaseWorkflow();
    }
    return;
  }
  if (form.workflows?.case) {
    if (!force) {
      if (shouldMigrateCaseWorkflowToDefault(form.workflows.case)) {
        form.workflows.case = buildDefaultCaseWorkflow();
      } else if (!form.workflows.case.layoutVersion || form.workflows.case.layoutVersion < 4) {
        layoutWorkflowGraph(form.workflows.case);
      }
      return;
    }
    if (shouldMigrateCaseWorkflowToDefault(form.workflows.case)) {
      form.workflows.case = buildDefaultCaseWorkflow();
      return;
    }
    form.workflows.case = normalizeWorkflow(form.workflows.case, 'case');
    return;
  }
  form.workflows = { case: buildDefaultCaseWorkflow() };
}

function migrateRemoveLegacyIoNodes(workflow) {
  if (!workflow?.nodes?.length) return;
  const removedTypes = new Set(['input', 'output', 'fraud_detect']);
  const removeIds = new Set(workflow.nodes.filter((n) => removedTypes.has(n.type)).map((n) => n.id));
  if (!removeIds.size) return;
  const inputNode = workflow.nodes.find((n) => n.type === 'input');
  const inputWasStart = inputNode?.isStart || workflow.startNodeId === inputNode?.id;

  removeIds.forEach((nodeId) => {
    const inMain = workflow.edges.filter((e) => e.to === nodeId && !e.branch);
    const outMain = workflow.edges.filter((e) => e.from === nodeId && !e.branch);
    const inBranch = workflow.edges.filter((e) => e.to === nodeId && e.branch);
    const outBranch = workflow.edges.filter((e) => e.from === nodeId && e.branch);
    inMain.forEach((ie) => {
      outMain.forEach((oe) => {
        if (!workflow.edges.some((e) => !e.branch && e.from === ie.from && e.to === oe.to)) {
          workflow.edges.push({ from: ie.from, to: oe.to });
        }
      });
    });
    inBranch.forEach((ie) => {
      outMain.forEach((oe) => {
        if (!workflow.edges.some((e) => e.from === ie.from && e.to === oe.to && e.branch === ie.branch)) {
          workflow.edges.push({ from: ie.from, to: oe.to, branch: ie.branch, label: ie.label });
        }
      });
    });
    inMain.forEach((ie) => {
      outBranch.forEach((oe) => {
        if (!workflow.edges.some((e) => e.from === ie.from && e.to === oe.to && e.branch === oe.branch)) {
          workflow.edges.push({ from: ie.from, to: oe.to, branch: oe.branch, label: oe.label });
        }
      });
    });
  });

  workflow.nodes = workflow.nodes.filter((n) => !removeIds.has(n.id));
  workflow.edges = workflow.edges.filter((e) => !removeIds.has(e.from) && !removeIds.has(e.to));

  workflow.nodes.forEach((n) => {
    if (n.type === 'decision' && n.conditionType === 'fraud_detect') n.conditionType = 'custom';
    if (isHitlGateNode(n) && n.conditionType === 'fraud_detect') n.conditionType = 'custom';
  });

  if (inputWasStart) {
    const pp = workflow.nodes.find((n) => n.type === 'preprocess');
    if (pp) {
      workflow.nodes.forEach((n) => { if (n.isStart) n.isStart = false; });
      pp.isStart = false;
      workflow.startNodeId = null;
    }
  }
}

function createTerminalWorkflowNode(type, id, x, y) {
  const base = {
    id,
    type,
    label: getWorkflowNodeMeta(type).title,
    x,
    y,
  };
  if (type === 'start') {
    return normalizeStartNode({ ...base, isStart: true });
  }
  if (type === 'end') {
    return normalizeEndNode({ ...base, isEnd: true });
  }
  return { ...base, isEnd: true };
}

function migrateEnsureTerminalNodes(workflow) {
  if (!workflow?.nodes?.length) return;
  const termW = WORKFLOW_NODE_SIZE.terminal.w;
  const gap = WF_NODE_GAP;

  let startNode = workflow.nodes.find((n) => n.type === 'start');
  if (!startNode) {
    const entry = getWorkflowGraphEntryNode(workflow);
    const startId = workflow.nodes.some((n) => n.id === 'wf-start') ? `wf-start-${Date.now()}` : 'wf-start';
    startNode = createTerminalWorkflowNode(
      'start',
      startId,
      Math.max(8, (entry?.x ?? 40) - termW - gap),
      entry?.y ?? 200,
    );
    workflow.nodes.push(startNode);
    if (entry && entry.type !== 'start' && !workflow.edges.some((e) => e.from === startNode.id && e.to === entry.id)) {
      workflow.edges.push({ from: startNode.id, to: entry.id });
    }
  }

  workflow.nodes.forEach((n) => {
    if (n.type === 'start') Object.assign(n, normalizeStartNode(n));
    else if (n.type === 'end') Object.assign(n, normalizeEndNode(n));
    else if (n.isStart) delete n.isStart;
  });

  let endNode = workflow.nodes.find((n) => n.type === 'end');
  const legacyOut = findLegacyWorkflowOutputNode(workflow);
  if (!endNode && legacyOut) {
    const endId = workflow.nodes.some((n) => n.id === 'wf-end') ? `wf-end-${Date.now()}` : 'wf-end';
    endNode = createTerminalWorkflowNode('end', endId, legacyOut.x, legacyOut.y);
    workflow.edges.forEach((e) => {
      if (e.from === legacyOut.id) e.from = endId;
      if (e.to === legacyOut.id) e.to = endId;
    });
    const idx = workflow.nodes.findIndex((n) => n.id === legacyOut.id);
    if (idx >= 0) workflow.nodes[idx] = endNode;
    else workflow.nodes.push(endNode);
  }

  if (!endNode) {
    const doneDecision = workflow.nodes.find((n) => n.id === 'wf-d-done')
      || workflow.nodes.find((n) => n.type === 'decision' && /完了|完結/.test(n.label || ''));
    const approveEdge = workflow.edges.find((e) =>
      e.from === doneDecision?.id && (e.branch === 'if' || /承認|完結/.test(e.label || '')),
    );
    if (approveEdge) {
      const prevTarget = workflow.nodes.find((n) => n.id === approveEdge.to);
      const endId = workflow.nodes.some((n) => n.id === 'wf-end') ? `wf-end-${Date.now()}` : 'wf-end';
      endNode = createTerminalWorkflowNode(
        'end',
        endId,
        prevTarget?.x ?? ((doneDecision?.x || 0) + WORKFLOW_NODE_SIZE.decision.w + gap),
        prevTarget?.y ?? doneDecision?.y ?? 200,
      );
      if (prevTarget && prevTarget.type !== 'end') {
        workflow.edges.forEach((e) => {
          if (e.from === prevTarget.id) e.from = endId;
          if (e.to === prevTarget.id) e.to = endId;
        });
        const idx = workflow.nodes.findIndex((n) => n.id === prevTarget.id);
        if (idx >= 0) workflow.nodes[idx] = endNode;
        else workflow.nodes.push(endNode);
      } else {
        workflow.nodes.push(endNode);
        approveEdge.to = endId;
      }
    }
  }

  workflow.nodes.forEach((n) => {
    if (n.type === 'end') Object.assign(n, normalizeEndNode(n));
  });
}

function migrateRemoveCaseLinkNodes(workflow) {
  if (!workflow?.nodes?.length) return;
  const removedTypes = new Set(['case_link', 'scene_aggregate', 'scene_completeness']);
  const removeIds = new Set(workflow.nodes.filter((n) => removedTypes.has(n.type)).map((n) => n.id));
  if (!removeIds.size) return;
  removeIds.forEach((nodeId) => {
    const inMain = workflow.edges.filter((e) => e.to === nodeId && !e.branch);
    const outMain = workflow.edges.filter((e) => e.from === nodeId && !e.branch);
    inMain.forEach((ie) => {
      outMain.forEach((oe) => {
        if (!workflow.edges.some((e) => !e.branch && e.from === ie.from && e.to === oe.to)) {
          workflow.edges.push({ from: ie.from, to: oe.to });
        }
      });
    });
  });
  workflow.nodes = workflow.nodes.filter((n) => !removeIds.has(n.id));
  workflow.edges = workflow.edges.filter((e) => !removeIds.has(e.from) && !removeIds.has(e.to));
}

function normalizeWorkflow(workflow, flowKey = 'case') {
  const w = cloneJson(workflow || {});
  if (!Array.isArray(w.nodes) || !w.nodes.length) {
    return buildDefaultCaseWorkflow();
  }
  if (!Array.isArray(w.edges)) w.edges = [];
  migrateRemoveLegacyIoNodes(w);
  migrateRemoveCaseLinkNodes(w);
  if (w.nodes.some((n) => REMOVED_WORKFLOW_NODE_TYPES.has(n.type))) {
    w.nodes = w.nodes.filter((n) => !REMOVED_WORKFLOW_NODE_TYPES.has(n.type));
    const ids = new Set(w.nodes.map((n) => n.id));
    w.edges = w.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }
  migrateHitlDecisionsInWorkflow(w);
  w.nodes = w.nodes.map((n) => {
    if (n.type === 'start') return normalizeStartNode(n);
    if (n.type === 'end') return normalizeEndNode(n);
    if (isHitlGateNode(n)) return normalizeHitlGateNode(n);
    if (n.type === 'decision') return normalizeDecisionNode(n, w);
    if (n.type === 'notify') return normalizeNotifyNode(n);
    if (n.type === 'code') return normalizeCodeNode(n, w);
    if (n.type === 'mcp') return normalizeMcpNode(n, w);
    if (n.type === 'master_match') return normalizeMasterMatchNode(n, w);
    if (isWorkflowProcessingNode(n)) return ensureWorkflowNodeVarName(n, w);
    return n;
  });
  syncDecisionVariablesInWorkflow(w);
  migrateDecisionEdges(w);
  migrateDecisionFlowEdges(w);
  sanitizeDecisionEdges(w);
  migrateEnsureTerminalNodes(w);
  ensureWorkflowStartNode(w);
  layoutWorkflowGraph(w);
  return w;
}

function getWorkflowStartNode(workflow) {
  const nodes = workflow?.nodes || [];
  if (!nodes.length) return null;
  const edges = workflow?.edges || [];
  const mainIn = new Set(edges.filter((e) => !e.branch).map((e) => e.to));
  return nodes.find((n) => n.type === 'start')
    || nodes.find((n) => n.isStart)
    || nodes.find((n) => n.id === workflow?.startNodeId)
    || nodes.find((n) => !mainIn.has(n.id))
    || nodes[0];
}

function ensureWorkflowStartNode(workflow) {
  if (!workflow?.nodes?.length) return;
  const start = getWorkflowStartNode(workflow);
  workflow.nodes.forEach((n) => {
    if (n.isStart && n.id !== start?.id) n.isStart = false;
  });
  if (start) {
    start.isStart = true;
    workflow.startNodeId = start.id;
  }
}

function getWorkflowMainChainOrderLabel(type) {
  const item = WORKFLOW_MAIN_CHAIN_ORDER.find((o) => o.type === type);
  return item ? `Step ${item.step} · ${item.label}` : '';
}

function getWorkflowMainChainIds(workflow) {
  const nodes = workflow?.nodes || [];
  const edges = workflow?.edges || [];
  if (!nodes.length) return [];
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const start = getWorkflowStartNode(workflow) || nodes[0];
  const chain = [];
  let cur = start;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur.id);
    const next = edges.find((e) => e.from === cur.id && !e.branch);
    cur = next ? nodeMap[next.to] : null;
  }
  return chain;
}

function getWorkflowNodeOrder(workflow, nodeId) {
  const chain = getWorkflowMainChainIds(workflow);
  const idx = chain.indexOf(nodeId);
  return idx >= 0 ? idx + 1 : null;
}

function swapAdjacentMainChainEdges(wf, firstId, secondId) {
  const inEdge = wf.edges.find((e) => e.to === firstId && !e.branch);
  const midEdge = wf.edges.find((e) => e.from === firstId && e.to === secondId && !e.branch);
  const outEdge = wf.edges.find((e) => e.from === secondId && !e.branch);
  if (!midEdge) return false;
  const prevId = inEdge?.from;
  const nextId = outEdge?.to;
  wf.edges = wf.edges.filter((e) => e !== inEdge && e !== midEdge && e !== outEdge);
  if (prevId) wf.edges.push({ from: prevId, to: secondId });
  wf.edges.push({ from: secondId, to: firstId });
  if (nextId) wf.edges.push({ from: firstId, to: nextId });
  return true;
}

function formatWorkflowHistoryTime(date = new Date()) {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function measureWorkflowNodeBodyHeight(tasks, contentWidth) {
  if (!tasks?.length) return 0;
  const GAP = 6;
  const MIN_TAG_W = 72;
  const CHAR_W = 15;
  const TAG_PAD = 20;
  const TAG_LINE_H = 28;
  let totalHeight = 0;
  let rowWidth = 0;
  let rowMaxHeight = 0;

  tasks.forEach((text) => {
    const str = String(text);
    const naturalW = Math.max(MIN_TAG_W, str.length * CHAR_W + TAG_PAD);
    const tagW = Math.min(contentWidth, naturalW);
    const lineCount = Math.max(1, Math.ceil((str.length * CHAR_W + TAG_PAD) / contentWidth));
    const tagH = lineCount * TAG_LINE_H;

    if (rowWidth > 0 && rowWidth + GAP + tagW > contentWidth) {
      totalHeight += rowMaxHeight + GAP;
      rowWidth = tagW;
      rowMaxHeight = tagH;
    } else {
      rowWidth += (rowWidth ? GAP : 0) + tagW;
      rowMaxHeight = Math.max(rowMaxHeight, tagH);
    }
  });

  return totalHeight + rowMaxHeight;
}

function getWorkflowNodeSize(node, taskCount = 0, tasks = []) {
  if (node?.type === 'start' || node?.type === 'end') {
    return { ...WORKFLOW_NODE_SIZE.terminal };
  }

  const nodeW = WORKFLOW_NODE_SIZE.default.w;
  const tagTexts = tasks?.length ? tasks : (taskCount ? Array.from({ length: taskCount }, () => 'tag') : []);
  const HEADER_H = 52;
  const BODY_TOP_PAD = 0;
  const BODY_BOTTOM_PAD = 14;
  const IO_FOOTER_H = 44;
  const contentWidth = (node?.type === 'case_link' || node?.type === 'scene_aggregate' || node?.type === 'scene_completeness' ? 240 : nodeW) - 28;

  if (node?.type === 'case_link' || node?.type === 'scene_aggregate' || node?.type === 'scene_completeness') {
    if (!tagTexts.length) return { w: 240, h: 76 };
    const bodyHeight = measureWorkflowNodeBodyHeight(tagTexts, contentWidth);
    const h = HEADER_H + BODY_TOP_PAD + bodyHeight + BODY_BOTTOM_PAD;
    return { w: 240, h: Math.max(76, h) };
  }

  const showIoFooter = node?.type && !['decision', 'notify'].includes(node.type);
  const footerH = showIoFooter ? IO_FOOTER_H : 0;

  if (!tagTexts.length) return { w: nodeW, h: Math.max(76, HEADER_H + footerH) + (node?.isStart ? 6 : 0) };

  const bodyHeight = measureWorkflowNodeBodyHeight(tagTexts, contentWidth);
  let h = HEADER_H + BODY_TOP_PAD + bodyHeight + BODY_BOTTOM_PAD + footerH;
  if (node?.isStart) h += 6;
  return { w: nodeW, h: Math.max(76, h) };
}

function estimateWorkflowNodeLayoutTasks(node) {
  if (!node || isWorkflowTerminalNode(node)) return [];
  if (node.type === 'decision') {
    const tags = [];
    (node.cases || []).forEach((c) => {
      if (c.label) tags.push(c.label);
    });
    if (node.elseLabel) tags.push(`ELSE:${node.elseLabel}`);
    return tags.length ? tags : ['条件判断'];
  }
  if (node.type === 'hitl_gate') return [node.label || '人工確認'];
  if (node.type === 'preprocess') return ['前処理'];
  if (node.type === 'ocr') return ['OCR抽出'];
  if (node.type === 'ai_verify') return ['AI検証'];
  if (node.type === 'master_match') return ['マスタ照合'];
  if (node.type === 'mcp') return ['MCP'];
  if (node.type === 'notify') return ['通知'];
  const meta = WORKFLOW_NODE_META[node.type];
  if (meta?.tasks?.length) return [...meta.tasks];
  return [meta?.title || node.label || node.type];
}

function getWorkflowNodeLayoutSize(node) {
  const tasks = estimateWorkflowNodeLayoutTasks(node);
  return getWorkflowNodeSize(node, tasks.length, tasks);
}

function pickWorkflowMainChainEdge(workflow, fromId) {
  const edges = (workflow.edges || []).filter((e) => e.from === fromId);
  if (!edges.length) return null;
  const from = (workflow.nodes || []).find((n) => n.id === fromId);
  if (from?.type === 'decision') {
    return edges.find((e) => e.branch === 'if')
      || edges.find((e) => e.branch && String(e.branch).startsWith('elif'))
      || edges.find((e) => !e.branch)
      || edges[0];
  }
  return edges.find((e) => !e.branch) || edges[0];
}

function buildWorkflowMainChain(workflow) {
  const nodes = workflow?.nodes || [];
  const start = getWorkflowStartNode(workflow);
  if (!start) return [];
  const chain = [];
  const seen = new Set();
  let cur = start;
  while (cur && !seen.has(cur.id)) {
    if (cur.type === 'end') break;
    seen.add(cur.id);
    chain.push(cur);
    const edge = pickWorkflowMainChainEdge(workflow, cur.id);
    const next = edge ? nodes.find((n) => n.id === edge.to) : null;
    if (!next || next.type === 'end') break;
    cur = next;
  }
  return chain;
}

function layoutWorkflowBranchChain(workflow, startNodeId, startX, laneY, sizes) {
  const nodes = workflow?.nodes || [];
  const edges = workflow?.edges || [];
  let x = startX;
  let curId = startNodeId;
  const visited = new Set();
  while (curId && !visited.has(curId)) {
    visited.add(curId);
    const node = nodes.find((n) => n.id === curId);
    if (!node || node.type === 'end') break;
    const size = sizes.get(node.id);
    node.x = x;
    node.y = laneY;
    x += size.w + WF_NODE_GAP;
    const outEdges = edges.filter((e) => e.from === curId);
    const nextEdge = outEdges.find((e) => {
      const target = nodes.find((n) => n.id === e.to);
      return target && target.type !== 'end';
    });
    if (!nextEdge) break;
    curId = nextEdge.to;
  }
  return x;
}

function resolveWorkflowBranchOverlaps(branchNodes, sizes) {
  const sorted = [...branchNodes].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevSize = sizes.get(prev.id);
    const curSize = sizes.get(cur.id);
    const overlapX = Math.abs(cur.x - prev.x) < Math.max(prevSize.w, curSize.w) * 0.85;
    const minY = prev.y + prevSize.h + 24;
    if (overlapX && cur.y < minY) cur.y = minY;
  }
}

function layoutWorkflowGraph(workflow) {
  if (!workflow?.nodes?.length) return workflow;
  const nodes = workflow.nodes;
  const edges = workflow.edges || [];
  const sizes = new Map(nodes.map((n) => [n.id, getWorkflowNodeLayoutSize(n)]));
  const mainChain = buildWorkflowMainChain(workflow);
  const mainIds = new Set(mainChain.map((n) => n.id));

  if (mainChain.length) {
    const maxMainH = Math.max(...mainChain.map((n) => sizes.get(n.id).h));
    let x = WF_LAYOUT_PAD.x;
    mainChain.forEach((node) => {
      const size = sizes.get(node.id);
      node.x = x;
      node.y = WF_LAYOUT_PAD.y + Math.round((maxMainH - size.h) / 2);
      x += size.w + WF_NODE_GAP;
    });
  }

  const branchNodes = nodes.filter((n) => !mainIds.has(n.id) && n.type !== 'end');
  const decisionNode = [...mainChain].reverse().find((n) => n.type === 'decision')
    || mainChain[mainChain.length - 1];
  const branchStartX = decisionNode
    ? decisionNode.x + sizes.get(decisionNode.id).w + WF_NODE_GAP
    : WF_LAYOUT_PAD.x;
  const elseLaneY = decisionNode
    ? decisionNode.y + sizes.get(decisionNode.id).h + WF_BRANCH_LANE_GAP
    : WF_LAYOUT_PAD.y + 180;

  branchNodes.forEach((node) => {
    const inEdges = edges.filter((e) => e.to === node.id);
    const fromDecision = inEdges.find((e) => e.from === decisionNode?.id && e.branch === 'else');
    if (fromDecision) {
      layoutWorkflowBranchChain(workflow, fromDecision.to, branchStartX, elseLaneY, sizes);
      return;
    }
    const sourceEdge = inEdges.find((e) => mainIds.has(e.from)) || inEdges[0];
    const source = sourceEdge ? nodes.find((n) => n.id === sourceEdge.from) : null;
    const size = sizes.get(node.id);
    if (source) {
      const srcSize = sizes.get(source.id);
      const branch = sourceEdge.branch;
      const isElse = branch === 'else';
      const isElif = branch && String(branch).startsWith('elif');
      if (isElif) {
        node.x = source.x + Math.round((srcSize.w - size.w) / 2);
        node.y = source.y + srcSize.h + WF_BRANCH_LANE_GAP;
      } else if (isElse) {
        node.x = branchStartX;
        node.y = elseLaneY;
      } else {
        node.x = source.x + srcSize.w + WF_NODE_GAP;
        node.y = source.y + srcSize.h + WF_BRANCH_LANE_GAP;
      }
      return;
    }
    node.x = WF_LAYOUT_PAD.x;
    node.y = elseLaneY + 120;
  });

  resolveWorkflowBranchOverlaps(branchNodes, sizes);

  const endNode = nodes.find((n) => n.type === 'end');
  if (endNode) {
    let maxX = WF_LAYOUT_PAD.x;
    nodes.forEach((node) => {
      if (node.type === 'end') return;
      const size = sizes.get(node.id);
      maxX = Math.max(maxX, node.x + size.w);
    });
    const mainY = mainChain[0]?.y ?? WF_LAYOUT_PAD.y;
    const mainH = mainChain.length
      ? Math.max(...mainChain.map((n) => sizes.get(n.id).h))
      : sizes.get(endNode.id).h;
    endNode.x = maxX + WF_NODE_GAP;
    endNode.y = mainY + Math.round((mainH - sizes.get(endNode.id).h) / 2);
  }

  workflow.layoutVersion = 4;
  return workflow;
}


const NODES = [
  { id: 'scene', label: 'シーン', tier: 'a' },
  { id: 'input', label: '入力', tier: 'c' },
  { id: 'image', label: '前処理', tier: 'c' },
  { id: 'ocr', label: 'OCR抽出', tier: 'c' },
  { id: 'master', label: 'Master', tier: 'a' },
  { id: 'verify', label: 'AI検証', tier: 'a' },
  { id: 'hitl', label: 'HITL', tier: 'b' },
  { id: 'output', label: '出力', tier: 'a' },
];

const SCENES = [
  { id: '2064639102406844416', name: '医療保険（通院給付）請求' },
  { id: '2064639102406844417', name: '医療保険（入院給付）請求' },
  { id: '2064639102406844418', name: '保険金請求（標準）' },
  { id: '2064639102406844419', name: '新規契約・告知受領' },
  { id: '2064639102406844420', name: '保険金・給付金請求' },
];

const MAX_DOCS = 10;

function cloneJson(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const CASE_MATCHING_PRIORITY_OPTIONS = [
  { value: 'primary_first', label: '主キー優先' },
  { value: 'secondary_first', label: '副キー優先' },
  { value: 'strict', label: '全キー一致' },
];
const CASE_MASTERLESS_OPTIONS = [
  { value: 'new_case', label: '新規案件を作成' },
  { value: 'hold', label: '保留プールへ' },
  { value: 'reject', label: '受付拒否' },
];
const CASE_SUPPLEMENT_OPTIONS = [
  { value: 'link_existing', label: '既存案件に紐付け' },
  { value: 'new_supplement', label: '補件案件として新規' },
];

/** 業務シーン：マッチング関連の固定既定値 */
const SCENE_MATCHING_DEFAULTS = {
  masterlessPolicy: 'hold',
  supplementPolicy: 'link_existing',
};

const WORKFLOW_DEFAULTS = {
  input: {
    channels: ['画面上アップロード'],
    apiEndpoint: '',
    allowedFormats: ['PDF', 'PNG', 'JPG', 'TIFF'],
    maxFileSizeMb: 20,
  },
  image: {
    rotate: true,
    rotateDocTypes: [],
    perspective: true,
    perspectiveDocTypes: [],
    split: true,
    splitDocTypes: [],
    sort: true,
    sortDocTypes: [],
    io: cloneJson(NODE_IO_DEFAULTS.preprocess),
  },
  hitl: {
    role: '一般審査',
    useSpecificRoles: false,
    imageRole: '一般審査',
    ocrRole: '医療審査',
    masterRole: '医療審査',
    verifyRole: '給付審査',
    exportRole: '一般審査',
  },
  ocrExtract: {
    enabledTypes: [],
    confidenceThreshold: 85,
    llmOcrEnabled: true,
  },
  fraudDetect: {
    targetDocTypes: [],
    detectCategory: 'ps_tamper',
    riskThreshold: 70,
  },
};

const FRAUD_DETECT_PS_CATEGORY = {
  value: 'ps_tamper',
  label: 'PS痕跡の有無',
  desc: '画像に Photoshopped 等の加工痕跡があるかを判定します',
};

/** @deprecated 旧 UI 互換 */
const FRAUD_DETECT_METHOD_OPTIONS = [
  { value: 'image_tamper', label: '画像改ざん検知', desc: 'PS痕跡・再圧縮・異常エッジを検出' },
];

function normalizeFraudDetectConfig(fraudDetect) {
  const raw = fraudDetect || {};
  const base = { ...cloneJson(WORKFLOW_DEFAULTS.fraudDetect), ...raw };
  if (Array.isArray(raw.methods) && raw.methods.length && !raw.detectCategory) {
    base.detectCategory = raw.methods.includes('image_tamper') ? 'ps_tamper' : 'ps_tamper';
  }
  base.detectCategory = base.detectCategory === 'ps_tamper' ? 'ps_tamper' : 'ps_tamper';
  base.targetDocTypes = Array.isArray(base.targetDocTypes)
    ? base.targetDocTypes.filter(Boolean)
    : [];
  const threshold = Number(base.riskThreshold);
  base.riskThreshold = Number.isFinite(threshold) ? Math.min(100, Math.max(0, Math.round(threshold))) : 70;
  delete base.methods;
  delete base.blockOnDetect;
  return base;
}

const INPUT_CHANNELS = [
  { id: '画面上アップロード', label: '画面上アップロード', desc: '管理画面からファイル・フォルダを直接アップロード' },
  {
    id: 'APIアップロード', label: 'APIアップロード', desc: '外部システムから API で案件・書類を受付',
    configKey: 'apiEndpoint', configLabel: 'API エンドポイント', configPlaceholder: 'https://api.example.com/v1/intake',
  },
];

const OUTPUT_NAMING_DEFAULTS = {
  caseFilePattern: '{案件番号}_{業務シーン}_{yyyyMMdd}_{HHmmss}',
  docFilePattern: '{案件番号}_{帳票タイプ}_{yyyyMMdd}_{HHmmss}',
  usePerDocFilePattern: false,
  apiObjectKey: '{案件番号}/{帳票タイプ}/{タイムスタンプ}',
  apiPayloadName: '{案件番号}_IDP_export',
  excelSheetPattern: '{帳票タイプ}',
  separator: '_',
};

const OUTPUT_NAMING_TOKENS = [
  { token: '{案件ID}', label: '案件ID', example: 'CASE-2026-001234' },
  { token: '{案件番号}', label: '案件番号', example: 'A20260617001' },
  { token: '{証券番号}', label: '証券番号', example: 'POL-88991234' },
  { token: '{業務シーン}', label: '業務シーン名', example: '医療保険通院給付' },
  { token: '{帳票タイプ}', label: '帳票タイプ', example: '診断書' },
  { token: '{yyyyMMdd}', label: '処理日', example: '20260617' },
  { token: '{HHmmss}', label: '処理時刻', example: '143025' },
  { token: '{タイムスタンプ}', label: '日時連結', example: '20260617_143025' },
];

const END_NAMING_TOKENS = [
  ...OUTPUT_NAMING_TOKENS,
  { token: '{処理結果}', label: '処理結果', example: 'PASS' },
  { token: '{給付種別}', label: '給付種別', example: '通院給付' },
  { token: '{請求種別}', label: '請求種別', example: '保険金請求' },
];

const OUTPUT_DEFAULTS = {
  conflictResolution: '最新値を優先',
  format: 'JSON',
  encoding: 'UTF-8',
  sheetExportMode: '帳票別Sheetで出力',
  fileNamePattern: '{案件番号}_{業務シーン}_{yyyyMMdd}_{HHmmss}',
  naming: cloneJson(OUTPUT_NAMING_DEFAULTS),
  maskingLevel: '部分マスキング',
  apiExportEnabled: false,
  apiExportEndpoint: '',
  includeVerifyReport: true,
  masterFields: [],
};

const SCENE_AGGREGATE_DEFAULTS = {
  mainDocTypes: [],
  aggregateDocType: '',
  primaryKey: '',
  secondaryKeys: [],
};

const OUTPUT_CONFLICT_RESOLUTIONS = ['最新値を優先', '先入力を優先', '空欄のみ補完'];
const OUTPUT_MASKING_LEVELS = ['なし', '部分マスキング', '全面マスキング'];
const OUTPUT_FORMATS = ['JSON', 'CSV', 'Excel'];
const OUTPUT_ENCODINGS = ['UTF-8', 'Shift_JIS'];
const OUTPUT_SHEET_EXPORT_MODE_OPTIONS = [
  { value: '帳票別Sheetで出力', label: '1ファイルにまとめる' },
  { value: '帳票別ファイルで出力', label: '帳票タイプごとに別ファイル' },
];

/** 旧設定値の互換マップ */
const OUTPUT_SHEET_EXPORT_MODE_LEGACY = {
  '単一Sheetで出力': '帳票別Sheetで出力',
  '書類別Sheetで出力': '帳票別Sheetで出力',
  '帳票別Sheet + 帳票別ファイルで出力': '帳票別ファイルで出力',
};

function normalizeSheetExportMode(mode) {
  return OUTPUT_SHEET_EXPORT_MODE_LEGACY[mode] || mode;
}
const HITL_ROLE_OPTIONS = [
  { value: '一般審査', label: '一般審査', hint: '標準案件の一次復核を担当' },
  { value: '医療審査', label: '医療審査', hint: '診療明細・診断書の整合性を重点確認' },
  { value: '給付審査', label: '給付審査', hint: '給付要件・支払可否の最終判定を担当' },
  { value: '保全審査', label: '保全審査', hint: '契約変更・保全系案件の復核を担当' },
];

const DOC_TYPE_REGISTRY = [
  { id: '保険金請求書', category: 'claim', icon: '請', fields: ['氏名', '請求金額', '診療日', '医療機関名'] },
  { id: '請求書_new', category: 'claim', icon: '請', fields: ['氏名', '請求金額', '診療日', '医療機関名', '明細合計'] },
  { id: '請求書', category: 'claim', icon: '請', fields: ['氏名', '請求金額', '診療日', '医療機関名'] },
  { id: '保険金・給付金請求書', category: 'claim', icon: '給', fields: ['氏名', '証券番号', '請求種別', '申請金額'] },
  { id: '申込書', category: 'application', icon: '申', fields: ['氏名', '生年月日', '証券番号', '申請金額', '保険種別'] },
  { id: '告知書', category: 'notice', icon: '告', fields: ['氏名', '証券番号', '告知日', '告知内容'] },
  { id: 'E診断書', category: 'medical', icon: '診', fields: ['氏名', '生年月日', '診断名', '発行日', '医療機関名'] },
  { id: '診断書', category: 'medical', icon: '診', fields: ['氏名', '生年月日', '診断名', '発行日', '医療機関名'] },
  { id: '入院診断書', category: 'medical', icon: '診', fields: ['氏名', '入院日', '診断名', '医療機関名'] },
  { id: '死亡診断書', category: 'medical', icon: '診', fields: ['氏名', '死亡日', '死因', '医療機関名'] },
  { id: '入院証明書', category: 'certificate', icon: '証', fields: ['氏名', '入院日', '退院日', '医療機関名'] },
  { id: '退院証明書', category: 'certificate', icon: '証', fields: ['氏名', '退院日', '医療機関名'] },
  { id: '通院証明書', category: 'certificate', icon: '証', fields: ['氏名', '通院期間', '医療機関名'] },
  { id: '手術証明書', category: 'certificate', icon: '証', fields: ['氏名', '手術日', '手術名', '医療機関名'] },
  { id: '診療明細書', category: 'receipt', icon: '明', fields: ['氏名', '診療日', '金額', '項目名'] },
  { id: '領収書', category: 'receipt', icon: '領', fields: ['氏名', '診療日', '金額', '医療機関名'] },
  { id: '処方箋', category: 'prescription', icon: '処', fields: ['氏名', '調剤日', '薬品名'] },
  { id: '人間ドック', category: 'checkup', icon: '検', fields: ['氏名', '検査日', '検査項目', '医療機関名'] },
  { id: '人間ドックテスト', category: 'checkup', icon: '検', fields: ['氏名', '検査日', '検査項目', '医療機関名'] },
  { id: '契約変更申請書', category: 'policy', icon: '変', fields: ['氏名', '証券番号', '変更内容', '申請日'] },
  { id: '受取人変更届', category: 'policy', icon: '変', fields: ['氏名', '証券番号', '新受取人', '申請日'] },
  { id: '解約申請書', category: 'policy', icon: '解', fields: ['氏名', '証券番号', '解約理由', '申請日'] },
  { id: '入院給付金請求書', category: 'claim', icon: '入', fields: ['氏名', '証券番号', '入院日', '申請金額'] },
  { id: '通院給付金請求書', category: 'claim', icon: '通', fields: ['氏名', '証券番号', '通院期間', '申請金額'] },
  { id: '手術給付金請求書', category: 'claim', icon: '手', fields: ['氏名', '証券番号', '手術日', '申請金額'] },
  { id: '死亡保険金請求書', category: 'claim', icon: '死', fields: ['被保険者氏名', '死亡日', '請求者氏名', '申請金額'] },
  { id: 'がん診断給付請求書', category: 'claim', icon: '癌', fields: ['氏名', '証券番号', '診断日', '申請金額'] },
  { id: '振込先指定届', category: 'policy', icon: '振', fields: ['氏名', '証券番号', '金融機関名', '口座番号'] },
  { id: '被保険者証写し', category: 'certificate', icon: '証', fields: ['氏名', '証券番号', '保険種別'] },
  { id: '介護認定通知書', category: 'nursing', icon: '介', fields: ['氏名', '認定日', '要介護度'] },
  { id: '診療報酬明細書', category: 'receipt', icon: '明', fields: ['氏名', '診療日', '点数', '金額', '医療機関名'] },
];

const EXTRACT_FIELDS = DOC_TYPE_REGISTRY.map(({ id, fields }) => ({ type: id, fields }));

const DOC_TYPE_MAP = Object.fromEntries(DOC_TYPE_REGISTRY.map((d) => [d.id, d]));

/** 手動エクスポート画面と同一のフィールド名（帳票タイプ設定から連携） */
const DOC_FIELD_SCHEMA = {
  保険金請求書: {
    exportLabel: '保険金請求書',
    fields: [
      '証券番号',
      'ご契約者氏名',
      'ご契約者氏名（カナ）',
      '被保険者氏名',
      '被保険者生年月日',
      '請求区分',
      '入院日',
      '退院日',
      '入院日数',
      '請求金額',
      '振込先金融機関名',
    ],
    tables: { 明細テーブル: ['項目名', '数量', '単価', '金額'] },
  },
  保険金・給付金請求書: {
    exportLabel: '保険金・給付金請求書',
    fields: [
      '証券番号',
      'ご契約者氏名',
      'ご契約者氏名（カナ）',
      '被保険者氏名',
      '被保険者生年月日',
      '請求区分',
      '入院日',
      '退院日',
      '入院日数',
      '請求金額',
      '振込先金融機関名',
    ],
    tables: {},
  },
  診療明細書: {
    exportLabel: '領収書・診療明細書',
    fields: ['被保険者氏名', '合計金額', '医療機関名'],
    tables: { 明細行: ['診療日', '診療内容', '点数', '金額'] },
  },
  領収書: {
    fields: ['被保険者氏名', '診療日', '金額', '医療機関名'],
    tables: { 明細: ['項目', '金額'] },
  },
  申込書: {
    fields: ['被保険者氏名', '被保険者生年月日', '証券番号', '申請金額', '保険種別', '申請日', '診断日'],
    tables: {},
  },
  診断書: {
    fields: ['被保険者氏名', '被保険者生年月日', '傷病名', '診断名', '発行日', '医療機関名'],
    tables: {},
  },
  請求書_new: {
    exportLabel: '請求書',
    fields: ['氏名', '請求金額', '診療日', '医療機関名', '明細合計'],
    tables: {},
  },
};

/** 出力設定では一旦非表示にするテーブル（後日対応） */
const OUTPUT_DEFERRED_TABLES = new Set(['明細テーブル']);

function getDocExportLabel(docType) {
  return DOC_FIELD_SCHEMA[docType]?.exportLabel || docType;
}

/** 旧開発用帳票 ID → 現行 ID */
const LEGACY_DOC_TYPE_IDS = {
  請求書_多表格: '保険金請求書',
};

function migrateDocTypeId(type) {
  return LEGACY_DOC_TYPE_IDS[type] || type;
}

/** 画面表示用の帳票名（内部 ID ではなく日本語ラベル） */
function getDocDisplayLabel(docType) {
  const id = migrateDocTypeId(docType);
  return getDocExportLabel(id);
}

/** ルール文などに含まれる内部帳票 ID を表示名に置換 */
function replaceDocTypeIdsInText(text) {
  if (!text) return text;
  let result = String(text);
  const ids = [
    ...DOC_TYPE_REGISTRY.map((d) => d.id),
    ...Object.keys(DOC_FIELD_SCHEMA),
    '請求書_多表格',
  ];
  [...new Set(ids)].sort((a, b) => b.length - a.length).forEach((id) => {
    const label = getDocDisplayLabel(id);
    if (label && label !== id) result = result.split(id).join(label);
  });
  return result;
}

/** 出力設定：左プレビュー用（帳票単位・辞書照合は帳票内） */
function buildExportPreviewTree(docFields) {
  return {
    id: 'export-root',
    kind: 'group',
    label: 'エクスポート対象',
    children: (docFields || []).map((doc) => ({
      id: `export-doctype:${doc.docType}`,
      kind: 'doctype',
      docType: doc.docType,
      label: getDocExportLabel(doc.docType),
    })),
  };
}

function collectExportPreviewNodes(node, list = []) {
  if (!node) return list;
  list.push(node);
  (node.children || []).forEach((child) => collectExportPreviewNodes(child, list));
  return list;
}

function flattenExportPreviewTree(node, expandedMap, depth = 0, rows = []) {
  if (!node) return rows;
  rows.push({ node, depth });
  if (node.children?.length && expandedMap[node.id] !== false) {
    node.children.forEach((child) => flattenExportPreviewTree(child, expandedMap, depth + 1, rows));
  }
  return rows;
}

function submissionDisplayLabel(submission) {
  return submission === '代替可' ? '任意' : submission;
}

function submissionTagType(submission) {
  return submission === '必須' ? 'danger' : 'info';
}

function getDocSchema(docType) {
  if (DOC_FIELD_SCHEMA[docType]) return DOC_FIELD_SCHEMA[docType];
  return { fields: DOC_TYPE_MAP[docType]?.fields || [], tables: {} };
}

/** 帳票タイプ別 OCR ポリシー（帳票タイプ設定から連携・Workflow では読取専用） */
const OCR_PROFILES = {
  保険金請求書: { mode: 'ハイブリッド', regions: ['明細テーブル'] },
  申込書: { mode: 'LLM-OCR' },
  告知書: { mode: 'LLM-OCR' },
  診断書: { mode: 'ハイブリッド', regions: ['診断名・所見'] },
  入院診断書: { mode: 'ハイブリッド', regions: ['診断名・所見'] },
  E診断書: { mode: 'ハイブリッド', regions: ['診断名・所見'] },
  領収書: { mode: 'ハイブリッド', regions: ['金額・日付（手書き）'] },
  診療明細書: { mode: 'ハイブリッド', regions: ['明細行'] },
  処方箋: { mode: 'LLM-OCR' },
};

function getDocOcrProfile(docType) {
  return OCR_PROFILES[docType] || { mode: '標準 OCR', regions: [] };
}

function ocrModeTagType(mode) {
  if (mode === 'LLM-OCR') return 'primary';
  if (mode === 'ハイブリッド') return 'warning';
  return 'info';
}

const SCENE_ROUTE = {
  '2064639102406844416': 'invoice_multi',
  '2064639102406844417': 'application',
  '2064639102406844418': 'invoice_simple',
  '2064639102406844419': 'notice',
  '2064639102406844420': 'insurance_general',
};

function buildDataRule(id, description, tolerance, action, expression = '') {
  return {
    id,
    mode: 'natural',
    description,
    natural: description,
    expression,
    tolerance: tolerance || '—',
    action: action || 'HITL審査',
    invalid: false,
  };
}

const DEFAULT_VERIFY_ACTION = 'HITL審査';

const DEFAULT_SEAL = {
  targetDocs: [],
  detectionTarget: '両方',
  threshold: 80,
  signatureRequiredFields: [],
  sealRequiredFields: [],
};

function sealFromDocs(docs, detectionTarget = '両方', extra = {}) {
  return {
    ...DEFAULT_SEAL,
    targetDocs: [...docs],
    detectionTarget,
    ...extra,
  };
}

const MASTER_DICTIONARIES = [
  {
    id: 'icd10',
    label: 'ICD-10 傷病名辞書',
    lookupField: '傷病名称',
    codeField: 'ICD-10コード',
    nameField: '標準傷病名',
  },
  {
    id: 'medical_facility',
    label: '医療機関マスタ',
    lookupField: '医療機関名',
    codeField: '機関コード',
    nameField: '標準医療機関名',
  },
  {
    id: 'diagnosis_dept',
    label: '診療科分類辞書',
    lookupField: '診療科名',
    codeField: '診療科コード',
    nameField: '標準診療科名',
  },
  {
    id: 'drug_generic',
    label: '医薬品一般名辞書',
    lookupField: '医薬品名',
    codeField: 'YJコード',
    nameField: '一般名',
  },
];

function getMasterDictionary(dictionaryId) {
  return MASTER_DICTIONARIES.find((d) => d.id === dictionaryId) || null;
}

function getMasterDictionaryFieldValues(dict) {
  if (!dict) return [];
  return [...new Set([dict.lookupField, dict.codeField, dict.nameField].filter(Boolean))];
}

function getMasterDictFieldOptions(dictionaryId) {
  const dict = getMasterDictionary(dictionaryId);
  if (!dict) return [];
  return [
    { label: `照合キー：${dict.lookupField}`, value: dict.lookupField },
    { label: `コード：${dict.codeField}`, value: dict.codeField },
    { label: `名称：${dict.nameField}`, value: dict.nameField },
  ];
}

const KNOWLEDGE_SOURCE_TYPES = [
  { value: 'document', label: 'General', desc: 'Upload local documents' },
  { value: 'website', label: 'Web Site', desc: 'Sync text data from a web site / Web Search API' },
];

const KNOWLEDGE_EMBEDDING_MODELS = [
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small' },
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
  { value: 'bge-m3', label: 'bge-m3' },
];

const KNOWLEDGE_RETRIEVAL_MODES = [
  { value: 'vector', label: 'Vector Search' },
];

const KNOWLEDGE_OUTPUT_VARS = WORKFLOW_NODE_OUTPUT_VAR_DEFS.master_match.map((item) => ({
  ...item,
  token: `{${item.id}}`,
}));

const KNOWLEDGE_SOURCE_SEEDS = [
  {
    id: 'policy-guide',
    name: '約款・ガイドナレッジ',
    description: '約款・商品ガイドの参照用ナレッジ。詳細な説明は検索精度向上に有効です。',
    type: 'document',
    embeddingModel: 'text-embedding-3-small',
    fileCount: 24,
  },
  {
    id: 'product-faq',
    name: '商品FAQナレッジ',
    description: '商品に関する FAQ と回答集。',
    type: 'document',
    embeddingModel: 'text-embedding-3-small',
    fileCount: 18,
  },
  {
    id: 'claims-manual',
    name: '請求業務マニュアル',
    description: '請求業務の手順書・判定基準。',
    type: 'document',
    embeddingModel: 'text-embedding-3-small',
    fileCount: 12,
  },
  {
    id: 'regulatory-web',
    name: '規制情報 Web 参照',
    description: '外部 Web サイトから規制・通達情報を同期。',
    type: 'website',
    embeddingModel: 'text-embedding-3-small',
    webRootUrl: 'https://example.com/regulatory',
    selector: 'body',
    apiEndpoint: 'https://api.example.com/v1/web-search',
    apiKey: '',
  },
];

const KNOWLEDGE_RETRIEVAL_DEFAULTS = {
  selectedSourceIds: ['policy-guide'],
  retrievalMode: 'vector',
  scoreThreshold: 0.6,
  topK: 3,
  maxCharsPerRef: 5000,
  queryVariable: '{{ocr.fields}}',
};

const EXTERNAL_API_IO = {
  inputs: [
    { id: 'caseId', label: '案件ID', source: '{{case.id}}' },
    { id: 'customerId', label: '顧客ID', source: '{{case.customerId}}' },
    { id: 'policyNo', label: '証券番号', source: '{{case.policyNo}}' },
    { id: 'ocrFields', label: 'OCR抽出フィールド', source: '{{ocr.fields}}' },
  ],
  outputs: KNOWLEDGE_OUTPUT_VARS.map((o) => ({ id: o.id, label: o.label, token: o.token })),
};

/** @deprecated */
const EXTERNAL_API_CALL_MODES = [
  { value: 'knowledge', label: 'ナレッジ检索' },
];

function normalizeKnowledgeSourceItem(raw) {
  const base = {
    id: raw?.id || newRuleId('kb'),
    name: raw?.name || '',
    description: raw?.description || '',
    type: raw?.type === 'website' ? 'website' : 'document',
    embeddingModel: raw?.embeddingModel || KNOWLEDGE_EMBEDDING_MODELS[0].value,
    fileCount: raw?.fileCount || 0,
    webRootUrl: raw?.webRootUrl || '',
    selector: raw?.selector || 'body',
    apiEndpoint: raw?.apiEndpoint || '',
    apiKey: raw?.apiKey || '',
  };
  return base;
}

function getKnowledgeCatalog(allSources, id) {
  return (allSources || []).find((s) => s.id === id) || null;
}

function mergeKnowledgeCatalog(seeds, custom = []) {
  const map = new Map();
  [...(seeds || []), ...(custom || [])].forEach((s) => {
    map.set(s.id, normalizeKnowledgeSourceItem(s));
  });
  return [...map.values()];
}

function normalizeExternalApiConfig(cfg) {
  const raw = cloneJson(cfg || {});
  if (raw.knowledgeSource) {
    raw.selectedSourceIds = raw.knowledgeSource.knowledgeBaseId
      ? [raw.knowledgeSource.knowledgeBaseId]
      : raw.selectedSourceIds;
    raw.queryVariable = raw.knowledgeSource.queryTemplate || raw.queryCondition || raw.queryVariable;
    delete raw.knowledgeSource;
  }
  if (raw.knowledgeBaseId && !raw.selectedSourceIds?.length) {
    raw.selectedSourceIds = [raw.knowledgeBaseId];
  }
  if (raw.callMode === 'external_api' && !raw.selectedSourceIds?.length) {
    raw.selectedSourceIds = [];
  }
  const base = { ...cloneJson(KNOWLEDGE_RETRIEVAL_DEFAULTS), ...raw };
  base.selectedSourceIds = Array.isArray(base.selectedSourceIds) ? base.selectedSourceIds.filter(Boolean) : [];
  if (!base.selectedSourceIds.length && KNOWLEDGE_SOURCE_SEEDS[0]) {
    base.selectedSourceIds = [KNOWLEDGE_SOURCE_SEEDS[0].id];
  }
  base.scoreThreshold = base.scoreThreshold ?? 0.6;
  base.topK = base.topK ?? 3;
  base.maxCharsPerRef = base.maxCharsPerRef ?? 5000;
  base.queryVariable = base.queryVariable || '{{ocr.fields}}';
  delete base.callMode;
  delete base.apiEndpoint;
  delete base.authMethod;
  delete base.apiKey;
  delete base.requestMappings;
  delete base.responseMappings;
  delete base.knowledgeBaseId;
  return base;
}

function getExternalApiCallModeLabel(cfg) {
  const normalized = normalizeExternalApiConfig(cfg);
  const count = normalized.selectedSourceIds?.length || 0;
  return count ? `ナレッジ ${count} 件` : '未選択';
}

function getKnowledgeSourceTypeLabel(type) {
  return KNOWLEDGE_SOURCE_TYPES.find((t) => t.value === type)?.label || type;
}

/** @deprecated use normalizeExternalApiConfig */
function normalizeRagConfig(cfg) {
  return normalizeExternalApiConfig(cfg);
}

function getRagKnowledgeSourceLabel(source) {
  return getExternalApiCallModeLabel({ ...(source?.type ? { knowledgeSource: source } : {}), ...source });
}

const MASTER_KNOWLEDGE_SOURCE_TYPES = [
  { value: 'dict', label: '辞書' },
];

const MASTER_WEB_SEARCH_OUTPUT_FIELDS = [
  'タイトル',
  'URL',
  'スニペット',
  '要約',
  '検索結果一覧',
];

const MASTER_API_OUTPUT_FIELDS = [
  'コード',
  '名称',
  '標準名称',
  'マッチスコア',
  'レスポンス原文',
];

function normalizeKnowledgeSource(source) {
  if (!source?.type) {
    return createMasterPipelineTool('dict', { id: 'master-source', dictionaryId: 'icd10' });
  }
  const normalized = createMasterPipelineTool(source.type, { id: 'master-source', ...source });
  if (!normalized.apiEndpoint && normalized.endpoint) {
    normalized.apiEndpoint = normalized.endpoint;
  }
  return normalized;
}

function getMasterOutputFieldOptions(knowledgeSource) {
  const source = normalizeKnowledgeSource(knowledgeSource);
  if (source.type === 'dict') {
    return getMasterDictOutputFieldOptions(source);
  }
  if (source.type === 'web_search') {
    return MASTER_WEB_SEARCH_OUTPUT_FIELDS.map((f) => ({ label: f, value: f }));
  }
  if (source.type === 'external_api') {
    return MASTER_API_OUTPUT_FIELDS.map((f) => ({ label: f, value: f }));
  }
  return [];
}

function getMasterDictOutputFieldOptions(knowledgeSource) {
  const source = normalizeKnowledgeSource(knowledgeSource);
  if (source.type !== 'dict') return [];
  const dict = getMasterDictionary(source.dictionaryId);
  return getMasterDictionaryFieldValues(dict).map((f) => ({ label: f, value: f }));
}

function getKnowledgeSourceLabel(source) {
  const normalized = normalizeKnowledgeSource(source);
  if (normalized.type === 'dict') {
    return getMasterDictionary(normalized.dictionaryId)?.label || normalized.dictionaryId || '辞書';
  }
  return getMasterPipelineToolMeta(normalized.type).label;
}

function resolveMasterRuleOutputFields(rule, dict) {
  if (Array.isArray(rule?.outputFields) && rule.outputFields.length) {
    return rule.outputFields.filter(Boolean);
  }
  const fields = [];
  const code = rule?.outputCodeField || rule?.codeField || dict?.codeField;
  const name = rule?.outputNameField || rule?.nameField || dict?.nameField;
  if (code) fields.push(code);
  if (name && name !== code) fields.push(name);
  return fields;
}

const MASTER_PIPELINE_TOOLS = [
  { type: 'dict', label: '辞書照合', shortLabel: '辞書', desc: '内部マスタ辞書でコード化' },
  { type: 'web_search', label: 'Web検索', shortLabel: '検索', desc: '外部検索で候補を取得' },
  { type: 'web_crawl', label: 'Webクロール', shortLabel: 'クロール', desc: '許可ドメインから照合（Add-on）' },
  { type: 'external_api', label: '外部 API', shortLabel: 'API', desc: '外部マスタ API を参照' },
  { type: 'llm', label: 'LLM 補完', shortLabel: 'LLM', desc: '表記ゆれを意味マッチで補完' },
];

function getMasterPipelineToolMeta(type) {
  return MASTER_PIPELINE_TOOLS.find((t) => t.type === type) || { type, label: type, shortLabel: type, desc: '' };
}

function createMasterPipelineTool(type, overrides = {}) {
  const id = overrides.id || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const base = { id, type, enabled: overrides.enabled !== false };
  switch (type) {
    case 'dict': {
      const dict = getMasterDictionary(overrides.dictionaryId);
      return {
        ...base,
        dictionaryId: overrides.dictionaryId || 'icd10',
        dictLookupField: overrides.dictLookupField ?? dict?.lookupField ?? '',
        ...overrides,
        id,
      };
    }
    case 'web_search':
      return {
        ...base,
        apiEndpoint: overrides.apiEndpoint || overrides.endpoint || '',
        apiKey: overrides.apiKey || '',
        queryTemplate: overrides.queryTemplate || '{{OCR値}}',
        ...overrides,
        id,
      };
    case 'web_crawl':
      return { ...base, domains: overrides.domains || '', ...overrides, id };
    case 'external_api':
      return {
        ...base,
        apiEndpoint: overrides.apiEndpoint || overrides.endpoint || '',
        apiKey: overrides.apiKey || '',
        ...overrides,
        id,
      };
    case 'llm':
      return { ...base, ...overrides, id };
    default:
      return { ...base, ...overrides, id };
  }
}

function normalizeRulePipeline(rule) {
  if (Array.isArray(rule.pipeline) && rule.pipeline.length) {
    return rule.pipeline.map((tool) => {
      const normalized = createMasterPipelineTool(tool.type, tool);
      return { ...normalized, id: tool.id || normalized.id };
    });
  }
  if (rule.dictionaryId) {
    return [
      createMasterPipelineTool('dict', {
        id: `t-${rule.id || 'x'}-dict`,
        dictionaryId: rule.dictionaryId,
        dictLookupField: rule.dictLookupField,
      }),
    ];
  }
  return [createMasterPipelineTool('dict')];
}

function getDictToolFromRule(rule) {
  const pipeline = rule.pipeline || [];
  return pipeline.find((t) => t.type === 'dict' && t.enabled !== false)
    || pipeline.find((t) => t.type === 'dict');
}

function pipelineSummaryText(pipeline) {
  const labels = (pipeline || [])
    .filter((t) => t.enabled !== false)
    .map((t) => getMasterPipelineToolMeta(t.type).shortLabel);
  return labels.length ? labels.join(' → ') : '—';
}

function pipelineToolDetail(tool) {
  const meta = getMasterPipelineToolMeta(tool.type);
  switch (tool.type) {
    case 'dict': {
      const dict = getMasterDictionary(tool.dictionaryId);
      return dict?.label || tool.dictionaryId || meta.label;
    }
    case 'web_search':
      return tool.apiEndpoint || tool.queryTemplate || 'Web検索 API 未設定';
    case 'web_crawl':
      return tool.domains || 'ドメイン未設定';
    case 'external_api':
      return tool.apiEndpoint || tool.endpoint || 'API 未設定';
    case 'llm':
      return '表記ゆれ補完';
    default:
      return meta.label;
  }
}

function enrichMasterRule(rule, knowledgeSource) {
  const source = normalizeKnowledgeSource(knowledgeSource || rule?.knowledgeSource);
  const dict = source.type === 'dict' ? getMasterDictionary(source.dictionaryId) : null;
  const lookupField = source.type === 'dict'
    ? (rule?.lookupField || rule?.dictLookupField || dict?.lookupField || '')
    : '';
  const outputFields = resolveMasterRuleOutputFields(rule, dict);
  const outputCodeField = outputFields[0] || rule?.outputCodeField || rule?.codeField || dict?.codeField || '';
  const outputNameField = outputFields[1] || rule?.outputNameField || rule?.nameField || dict?.nameField || '';
  return {
    ...rule,
    lookupField,
    dictLookupField: lookupField,
    dictionaryId: source.type === 'dict' ? (source.dictionaryId || '') : '',
    dictionaryLabel: source.type === 'dict' ? (getMasterDictionary(source.dictionaryId)?.label || '') : '',
    outputFields,
    outputCodeField,
    outputNameField,
    codeField: outputCodeField,
    sourceType: source.type,
    sourceLabel: getKnowledgeSourceLabel(source),
  };
}

function buildMasterRule(id, docType, field, lookupField, outputFields = [], knowledgeSource) {
  const source = normalizeKnowledgeSource(knowledgeSource);
  const dict = source.type === 'dict' ? getMasterDictionary(source.dictionaryId) : null;
  const resolvedOutput = outputFields.length
    ? outputFields
    : [dict?.codeField, dict?.nameField].filter(Boolean);
  return enrichMasterRule({
    id,
    docType,
    field,
    lookupField,
    outputFields: resolvedOutput,
  }, source);
}

const MASTER_TOOL_TEMPLATES = [
  { id: 'dict_only', label: '内部辞書のみ', desc: '登録済みマスタ辞書で照合' },
  { id: 'dict_api', label: '辞書 + 外部 API', desc: '内部辞書の後、外部マスタ API を参照' },
  { id: 'full', label: 'フルツールチェーン', desc: '辞書・外部 API・Web クロール（Add-on）' },
];

const MASTER_TOOL_CHAIN_DEFAULTS = {
  internalDict: true,
  externalApi: false,
  externalApiEndpoint: '',
  webCrawl: false,
  crawlDomains: '',
  llmSemanticMatch: true,
};

function masterBlock(mappings = [], extra = {}) {
  const { knowledgeSource, ...rest } = extra;
  return {
    enabled: true,
    templateId: 'dict_api',
    onUnmatch: 'HITL',
    toolChain: { ...MASTER_TOOL_CHAIN_DEFAULTS },
    mappings,
    ...rest,
    knowledgeSource: normalizeKnowledgeSource(knowledgeSource),
  };
}

function normalizeMasterConfig(master, legacyVerify) {
  const m = cloneJson(master || {});
  if ((!m.mappings || !m.mappings.length) && legacyVerify?.master?.length) {
    m.mappings = cloneJson(legacyVerify.master);
  }
  m.enabled = true;
  if (!m.knowledgeSource) {
    const firstRule = m.mappings?.[0];
    const firstTool = firstRule?.pipeline?.[0];
    m.knowledgeSource = firstTool || { type: 'dict', dictionaryId: firstRule?.dictionaryId || 'icd10' };
  }
  m.knowledgeSource = normalizeKnowledgeSource(m.knowledgeSource);
  if (m.knowledgeSource.type !== 'dict') {
    m.knowledgeSource = normalizeKnowledgeSource({
      type: 'dict',
      dictionaryId: m.knowledgeSource.dictionaryId || 'icd10',
    });
  }
  m.mappings = (Array.isArray(m.mappings) ? m.mappings : []).map((rule) => {
    const cleaned = { ...rule, docType: migrateDocTypeId(rule.docType) };
    if (!cleaned.lookupField && cleaned.dictLookupField) cleaned.lookupField = cleaned.dictLookupField;
    if (!cleaned.lookupField) {
      const dictTool = getDictToolFromRule(cleaned);
      cleaned.lookupField = dictTool?.dictLookupField || cleaned.dictLookupField || '';
    }
    return enrichMasterRule(cleaned, m.knowledgeSource);
  });
  m.templateId = m.templateId || 'dict_api';
  m.onUnmatch = m.onUnmatch || 'HITL';
  m.toolChain = { ...MASTER_TOOL_CHAIN_DEFAULTS, ...(m.toolChain || {}) };
  if (m.templateId === 'dict_only') {
    m.toolChain.externalApi = false;
    m.toolChain.webCrawl = false;
  } else if (m.templateId === 'dict_api') {
    m.toolChain.externalApi = true;
    m.toolChain.webCrawl = false;
  } else if (m.templateId === 'full') {
    m.toolChain.externalApi = true;
    m.toolChain.webCrawl = true;
  }
  m.retryCount = m.retryCount != null ? m.retryCount : 3;
  m.cacheEnabled = m.cacheEnabled != null ? m.cacheEnabled : true;
  m.cacheTtlMinutes = m.cacheTtlMinutes != null ? m.cacheTtlMinutes : 60;
  return m;
}

function buildDocDictFields(docType, mappings, knowledgeSource, existing = [], legacyMasterFields = []) {
  const legacyMap = Object.fromEntries(
    (legacyMasterFields || []).map((f) => [f.ruleId, f])
  );
  const existingMap = Object.fromEntries(
    (existing || []).map((f) => [f.ruleId, f])
  );
  return (mappings || [])
    .filter((rule) => migrateDocTypeId(rule.docType) === docType)
    .map((rule) => {
      const enriched = enrichMasterRule(rule, knowledgeSource);
      const prev = existingMap[rule.id] || legacyMap[rule.id];
      const codeOn = prev?.exportCodeChecked !== false && prev?.checked !== false;
      const nameOn = prev?.exportNameChecked !== false && prev?.checked !== false;
      return {
        ruleId: rule.id,
        sourceField: rule.field,
        dictLabel: enriched.dictionaryLabel,
        dictLookupField: enriched.dictLookupField,
        codeField: enriched.outputCodeField,
        nameField: enriched.outputNameField,
        exportCodeChecked: prev ? codeOn : true,
        exportNameChecked: prev ? nameOn : true,
      };
    });
}

function attachDictFieldsToDocFields(docFields, masterMappings, knowledgeSource, legacyMasterFields = []) {
  return (docFields || []).map((doc) => ({
    ...doc,
    dictFields: buildDocDictFields(
      doc.docType,
      masterMappings,
      knowledgeSource,
      doc.dictFields,
      legacyMasterFields
    ),
  }));
}

function normalizeOutputNaming(output) {
  const legacy = output?.fileNamePattern || OUTPUT_DEFAULTS.fileNamePattern;
  const naming = { ...cloneJson(OUTPUT_NAMING_DEFAULTS), ...(output?.naming || {}) };
  if (!output?.naming?.caseFilePattern && legacy) {
    naming.caseFilePattern = legacy;
  }
  return naming;
}

function resolveNamingPattern(pattern, context = {}) {
  if (!pattern) return '';
  const samples = {
    '{案件ID}': 'CASE-2026-001234',
    '{案件番号}': 'A20260617001',
    '{証券番号}': 'POL-88991234',
    '{業務シーン}': (context.sceneName || '医療保険通院給付').replace(/\s+/g, ''),
    '{帳票タイプ}': context.docType || '診断書',
    '{yyyyMMdd}': '20260617',
    '{HHmmss}': '143025',
    '{タイムスタンプ}': '20260617_143025',
    '{yyyyMMdd_HHmmss}': '20260617_143025',
    '{処理結果}': context.outcome || 'PASS',
    '{給付種別}': context.benefitType || '通院給付',
    '{請求種別}': context.claimType || '保険金請求',
  };
  let result = String(pattern);
  Object.entries(samples).forEach(([token, value]) => {
    result = result.split(token).join(value);
  });
  return result;
}

function buildTextRule(id, text, action = DEFAULT_VERIFY_ACTION, natural = '') {
  return {
    id,
    mode: 'natural',
    text,
    natural: natural || ruleReadableText(text),
    action,
  };
}

function normalizeDataRule(rule) {
  const natural = rule.description || rule.natural || rule.text || rule.label || '';
  return {
    ...rule,
    mode: rule.mode || 'natural',
    description: natural,
    natural,
    expression: rule.expression || '',
    label: rule.label || natural,
    tolerance: rule.tolerance || '—',
    action: rule.action || 'HITL審査',
    invalid: rule.invalid || false,
  };
}

function normalizeVerifyConfig(verify) {
  const v = cloneJson(verify || {});
  v.textEnabled = v.textEnabled !== false;
  v.dataEnabled = v.dataEnabled !== false;
  v.completenessEnabled = v.completenessEnabled !== false;
  v.sealEnabled = v.sealEnabled !== false;
  v.text = (Array.isArray(v.text) ? v.text : []).map((rule) => ({
    ...rule,
    action: DEFAULT_VERIFY_ACTION,
  }));
  const legacyRules = [
    ...(Array.isArray(v.dataRules) ? v.dataRules : []),
    ...(Array.isArray(v.crossDoc) ? v.crossDoc : []),
    ...(Array.isArray(v.business) ? v.business : []),
  ];
  v.dataRules = legacyRules.map((rule) => ({
    ...normalizeDataRule(rule),
    action: DEFAULT_VERIFY_ACTION,
  }));
  v.seal = {
    ...DEFAULT_SEAL,
    ...(v.seal || {}),
    targetDocs: (v.seal?.targetDocs || []).map(migrateDocTypeId),
    signatureRequiredFields: Array.isArray(v.seal?.signatureRequiredFields)
      ? v.seal.signatureRequiredFields
      : [],
    sealRequiredFields: Array.isArray(v.seal?.sealRequiredFields)
      ? v.seal.sealRequiredFields
      : [],
  };
  delete v.master;
  delete v.masterEnabled;
  const migrateRuleText = (s) =>
    s ? String(s).replaceAll('請求書_多表格', '保険金請求書') : s;
  v.text = v.text.map((rule) => ({
    ...rule,
    docType: rule.docType ? migrateDocTypeId(rule.docType) : rule.docType,
    natural: migrateRuleText(rule.natural),
    label: migrateRuleText(rule.label),
    text: migrateRuleText(rule.text),
  }));
  v.dataRules = v.dataRules.map((rule) => ({
    ...rule,
    natural: migrateRuleText(rule.natural),
    label: migrateRuleText(rule.label),
    description: migrateRuleText(rule.description),
    text: migrateRuleText(rule.text),
    expression: migrateRuleText(rule.expression),
  }));
  return v;
}

function normalizeHitlConfig(hitl) {
  const role = hitl?.role || WORKFLOW_DEFAULTS.hitl.role;
  return {
    role,
    useSpecificRoles: hitl?.useSpecificRoles === true,
    imageRole: hitl?.imageRole || role,
    ocrRole: hitl?.ocrRole || role,
    masterRole: hitl?.masterRole || role,
    verifyRole: hitl?.verifyRole || role,
    exportRole: hitl?.exportRole || role,
  };
}

function filterImageDocTypes(docTypes, allowedTypes) {
  const allowed = new Set(allowedTypes || []);
  return (docTypes || []).filter((t) => allowed.has(t));
}

function defaultImageDocTypes(enabled, docTypes, allowedTypes) {
  if (!enabled) return [];
  const filtered = filterImageDocTypes(docTypes, allowedTypes);
  if (filtered.length) return filtered;
  return allowedTypes?.length ? [...allowedTypes] : [];
}

function normalizeInputConfig(input) {
  const base = { ...cloneJson(WORKFLOW_DEFAULTS.input), ...(input || {}) };
  const size = Number(base.maxFileSizeMb);
  base.maxFileSizeMb = Number.isFinite(size)
    ? Math.min(INPUT_MAX_FILE_SIZE_MB, Math.max(1, Math.round(size)))
    : INPUT_MAX_FILE_SIZE_MB;
  const allowedChannelIds = new Set(INPUT_CHANNELS.map((ch) => ch.id));
  base.channels = (base.channels || [])
    .map((id) => INPUT_CHANNEL_MIGRATE[id] || id)
    .filter((id) => allowedChannelIds.has(id));
  if (!base.channels.length) base.channels = [...WORKFLOW_DEFAULTS.input.channels];
  const allowedFormatSet = new Set(INPUT_FORMAT_OPTIONS);
  base.allowedFormats = (base.allowedFormats || [])
    .map((fmt) => INPUT_FORMAT_MIGRATE[fmt] || fmt)
    .filter((fmt) => allowedFormatSet.has(fmt));
  if (!base.allowedFormats.length) base.allowedFormats = [...WORKFLOW_DEFAULTS.input.allowedFormats];
  delete base.receptionType;
  return base;
}

function getInputChannelLabel(channelId) {
  return INPUT_CHANNELS.find((ch) => ch.id === channelId)?.label || channelId;
}

function normalizeImageConfig(image, documents) {
  const allowedTypes = (documents || []).map((d) => d.type);
  const rotate = image?.rotate !== false;
  const perspective = image?.perspective !== false;
  const split = image?.split !== false;
  const sortEnabled = image?.sort !== undefined
    ? image.sort !== false
    : (image?.classify !== undefined ? image.classify !== false : true);
  const sortDocTypesRaw = (image?.sortDocTypes?.length ? image.sortDocTypes : null)
    ?? image?.classifyDocTypes
    ?? [];
  return {
    rotate,
    rotateDocTypes: defaultImageDocTypes(rotate, image?.rotateDocTypes, allowedTypes),
    perspective,
    perspectiveDocTypes: defaultImageDocTypes(perspective, image?.perspectiveDocTypes, allowedTypes),
    split,
    splitDocTypes: filterImageDocTypes(image?.splitDocTypes, allowedTypes),
    sort: sortEnabled,
    sortDocTypes: defaultImageDocTypes(sortEnabled, sortDocTypesRaw, allowedTypes),
    io: { ...NODE_IO_DEFAULTS.preprocess, ...(image?.io || {}) },
  };
}

function syncOcrExtractTypesOnForm(formData) {
  if (!formData.processing) return;
  if (!formData.processing.ocrExtract) {
    formData.processing.ocrExtract = { enabledTypes: [] };
  }
  const types = (formData.scene?.documents || []).map((d) => d.type);
  let enabled = formData.processing.ocrExtract.enabledTypes || [];
  if (!enabled.length && types.length) {
    formData.processing.ocrExtract.enabledTypes = [...types];
    return;
  }
  enabled = enabled.filter((t) => types.includes(t));
  types.forEach((t) => {
    if (!enabled.includes(t)) enabled.push(t);
  });
  formData.processing.ocrExtract.enabledTypes = enabled;
}

function processingBlock() {
  const block = {
    input: cloneJson(WORKFLOW_DEFAULTS.input),
    image: normalizeImageConfig(cloneJson(WORKFLOW_DEFAULTS.image)),
    hitl: normalizeHitlConfig(cloneJson(WORKFLOW_DEFAULTS.hitl)),
    ocrExtract: cloneJson(WORKFLOW_DEFAULTS.ocrExtract),
    fraudDetect: normalizeFraudDetectConfig(cloneJson(WORKFLOW_DEFAULTS.fraudDetect)),
    externalApi: normalizeExternalApiConfig(cloneJson(KNOWLEDGE_RETRIEVAL_DEFAULTS)),
  };
  const allowed = new Set(INPUT_CHANNELS.map((ch) => ch.id));
  block.input.channels = (block.input.channels || []).filter((id) => allowed.has(id));
  return block;
}

function outputBlock(fields, pii = ['氏名', '生年月日']) {
  return {
    ...cloneJson(OUTPUT_DEFAULTS),
    fields,
    docFields: [],
    pii,
  };
}

function buildOutputDocFields(documents, legacyFields = [], existingDocFields = []) {
  const legacyEnabled = new Set(
    (legacyFields || [])
      .filter((f) => f.checked)
      .map((f) => f.name)
  );
  const existingMap = Object.fromEntries((existingDocFields || []).map((d) => [d.docType, d]));
  return (documents || []).map((doc) => {
    const schema = getDocSchema(doc.type);
    const existing = existingMap[doc.type];
    const fields = mergeSchemaItemOrder(schema.fields || [], existing?.fields, (name, existingField) => ({
      name,
      checked: existingField?.checked ?? legacyEnabled.has(name) ?? true,
    }));
    const schemaTables = schema.tables || {};
    const schemaTableNames = Object.keys(schemaTables).filter((name) => !OUTPUT_DEFERRED_TABLES.has(name));
    const existingTableOrder = (existing?.tables || [])
      .map((t) => t.name)
      .filter((name) => schemaTableNames.includes(name));
    const tableNames = [
      ...existingTableOrder,
      ...schemaTableNames.filter((name) => !existingTableOrder.includes(name)),
    ];
    const existingTableMap = Object.fromEntries((existing?.tables || []).map((t) => [t.name, t]));
    const tables = tableNames.map((tableName) => {
      const existingTable = existingTableMap[tableName];
      const tableChecked = existingTable?.checked ?? true;
      const columnNames = schemaTables[tableName] || [];
      return {
        name: tableName,
        checked: tableChecked,
        columns: mergeSchemaItemOrder(columnNames, existingTable?.columns, (colName, existingCol) => ({
          name: colName,
          checked: existingCol?.checked ?? tableChecked,
        })),
      };
    });
    const docEntry = {
      docType: doc.type,
      fields,
      tables,
    };
    docEntry.itemOrder = normalizeItemOrder(
      existing?.itemOrder,
      buildDefaultItemOrder(fields, tables)
    );
    applyItemOrderToDoc(docEntry);
    return docEntry;
  });
}

function buildDefaultItemOrder(fields, tables) {
  const order = [];
  (fields || []).forEach((f) => order.push(`field:${f.name}`));
  (tables || []).forEach((table) => {
    (table.columns || []).forEach((col) => {
      order.push(`column:${table.name}:${col.name}`);
    });
  });
  return order;
}

function normalizeItemOrder(existingOrder, defaultOrder) {
  if (!existingOrder?.length) return [...defaultOrder];
  const defaultSet = new Set(defaultOrder);
  const merged = existingOrder.filter((k) => defaultSet.has(k));
  defaultOrder.forEach((k) => {
    if (!merged.includes(k)) merged.push(k);
  });
  return merged;
}

function applyItemOrderToDoc(doc) {
  if (!doc?.itemOrder?.length) return;
  const fieldMap = Object.fromEntries((doc.fields || []).map((f) => [f.name, f]));
  const colMaps = {};
  (doc.tables || []).forEach((table) => {
    colMaps[table.name] = Object.fromEntries((table.columns || []).map((c) => [c.name, c]));
  });
  const newFields = [];
  const newColOrder = {};
  doc.itemOrder.forEach((key) => {
    if (key.startsWith('field:')) {
      const field = fieldMap[key.slice(6)];
      if (field) newFields.push(field);
      return;
    }
    if (key.startsWith('column:')) {
      const rest = key.slice(7);
      const sep = rest.indexOf(':');
      if (sep < 0) return;
      const tableName = rest.slice(0, sep);
      const colName = rest.slice(sep + 1);
      if (!newColOrder[tableName]) newColOrder[tableName] = [];
      const col = colMaps[tableName]?.[colName];
      if (col) newColOrder[tableName].push(col);
    }
  });
  if (newFields.length) doc.fields = newFields;
  (doc.tables || []).forEach((table) => {
    if (newColOrder[table.name]?.length) table.columns = newColOrder[table.name];
  });
}

function buildOutputExportRows(doc) {
  if (!doc) return [];
  const fieldMap = Object.fromEntries((doc.fields || []).map((f) => [f.name, f]));
  const columnMap = {};
  (doc.tables || []).forEach((table) => {
    (table.columns || []).forEach((col) => {
      columnMap[`column:${table.name}:${col.name}`] = { col, table };
    });
  });
  const order = doc.itemOrder?.length
    ? doc.itemOrder
    : buildDefaultItemOrder(doc.fields, doc.tables);
  return order.map((key) => {
    if (key.startsWith('field:')) {
      const name = key.slice(6);
      const ref = fieldMap[name];
      if (!ref) return null;
      return {
        key,
        kind: 'field',
        label: name,
        ref,
      };
    }
    if (key.startsWith('column:')) {
      const entry = columnMap[key];
      if (!entry) return null;
      const { col, table } = entry;
      return {
        key,
        kind: 'column',
        label: formatTableColumnLabel(table.name, col.name),
        ref: col,
        tableRef: table,
      };
    }
    return null;
  }).filter(Boolean);
}

function getSharedFieldsAcrossDocs(docTypes) {
  const types = (docTypes || []).filter(Boolean);
  if (!types.length) return [];
  const fieldSets = types.map((t) => new Set(getDocSchema(t).fields || []));
  const shared = [...fieldSets[0]].filter((f) => fieldSets.every((set) => set.has(f)));
  if (shared.length) return shared;
  return getDocSchema(types[0]).fields || [];
}

function computeSceneLinkStats(documents, mainDocTypes, docFieldLinks) {
  const docTypes = (documents || []).map((d) => d.type);
  const mainSet = new Set((mainDocTypes || []).filter((t) => docTypes.includes(t)));
  const linkedToMain = new Set();
  (docFieldLinks || []).forEach((link) => {
    const srcIsMain = mainSet.has(link.sourceDocType);
    const tgtIsMain = mainSet.has(link.targetDocType);
    if (srcIsMain && link.targetDocType && !tgtIsMain) linkedToMain.add(link.targetDocType);
    if (tgtIsMain && link.sourceDocType && !srcIsMain) linkedToMain.add(link.sourceDocType);
  });
  const nonMainDocs = docTypes.filter((t) => !mainSet.has(t));
  const linkedCount = linkedToMain.size;
  const unlinkedDocs = nonMainDocs.filter((t) => !linkedToMain.has(t));
  return {
    mainDocCount: mainSet.size,
    linkedCount,
    unlinkedCount: unlinkedDocs.length,
    unlinkedDocs,
    total: docTypes.length,
  };
}

const WF_NET_LAYOUT = {
  PAD: 16,
  SAT_W: 172,
  MAIN_W: 204,
  COL_GAP: 64,
  NODE_GAP: 14,
  HEADER_H: 34,
  FIELD_H: 26,
  NODE_PAD: 8,
};

function buildNetEdgePath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const cx1 = x1 + dx * 0.42;
  const cx2 = x1 + dx * 0.58;
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}

function buildSceneSetupNetworkLayout(docs, mainDocType, links, getLabel, getFields) {
  if (!docs.length) {
    return { width: 720, height: 320, nodes: [], edges: [] };
  }

  const mainType = mainDocType || docs[0]?.type;
  const related = docs.filter((d) => d.type !== mainType);
  const leftTypes = related.slice(0, Math.ceil(related.length / 2)).map((d) => d.type);
  const rightTypes = related.slice(Math.ceil(related.length / 2)).map((d) => d.type);
  const L = WF_NET_LAYOUT;

  function nodeHeight(fieldCount) {
    return L.HEADER_H + fieldCount * L.FIELD_H + L.NODE_PAD * 2;
  }

  function buildNodeMeta(docType, side) {
    const fields = getFields(docType) || [];
    return {
      id: docType,
      docType,
      label: getLabel(docType),
      fields,
      side,
      isHub: docType === mainType,
      width: docType === mainType ? L.MAIN_W : L.SAT_W,
      height: nodeHeight(fields.length),
      linkedFields: [],
      isUnlinked: false,
    };
  }

  const mainMeta = buildNodeMeta(mainType, 'center');
  const leftMetas = leftTypes.map((t) => buildNodeMeta(t, 'left'));
  const rightMetas = rightTypes.map((t) => buildNodeMeta(t, 'right'));

  const leftX = L.PAD;
  const mainX = L.PAD + L.SAT_W + L.COL_GAP;
  const rightX = mainX + L.MAIN_W + L.COL_GAP;

  let leftY = L.PAD;
  leftMetas.forEach((n) => {
    n.left = leftX;
    n.top = leftY;
    leftY += n.height + L.NODE_GAP;
  });

  let rightY = L.PAD;
  rightMetas.forEach((n) => {
    n.left = rightX;
    n.top = rightY;
    rightY += n.height + L.NODE_GAP;
  });

  mainMeta.left = mainX;
  mainMeta.top = L.PAD;

  const allNodes = [...leftMetas, mainMeta, ...rightMetas];
  const canvasH = Math.max(leftY, rightY, mainMeta.top + mainMeta.height) + L.PAD;
  const canvasW = rightX + L.SAT_W + L.PAD;
  const nodeMap = Object.fromEntries(allNodes.map((n) => [n.id, n]));
  const linkedFieldMap = {};

  function fieldY(node, field) {
    const idx = node.fields.indexOf(field);
    if (idx < 0) return null;
    return node.top + L.NODE_PAD + L.HEADER_H + idx * L.FIELD_H + L.FIELD_H / 2;
  }

  function markLinked(docType, field) {
    if (!linkedFieldMap[docType]) linkedFieldMap[docType] = new Set();
    linkedFieldMap[docType].add(field);
  }

  const edges = (links || []).map((link, index) => {
    let satType;
    let satField;
    let mainField;
    if (link.sourceDocType === mainType) {
      mainField = link.sourceField;
      satType = link.targetDocType;
      satField = link.targetField;
    } else if (link.targetDocType === mainType) {
      mainField = link.targetField;
      satType = link.sourceDocType;
      satField = link.sourceField;
    } else {
      // 主帳票を介さない関連は描画しない（主帳票が唯一の起点）
      return null;
    }

    const satNode = nodeMap[satType];
    if (!satNode) return null;
    const satY = fieldY(satNode, satField);
    const mainYPos = fieldY(mainMeta, mainField);
    if (satY == null || mainYPos == null) return null;

    markLinked(satType, satField);
    markLinked(mainType, mainField);

    let x1;
    let y1;
    let x2;
    let y2;
    // 主帳票を起点に、関連帳票のフィールドへ矢印を向ける
    if (satNode.side === 'left') {
      x1 = mainMeta.left;
      y1 = mainYPos;
      x2 = satNode.left + satNode.width;
      y2 = satY;
    } else {
      x1 = mainMeta.left + mainMeta.width;
      y1 = mainYPos;
      x2 = satNode.left;
      y2 = satY;
    }

    return {
      id: link.id || `edge-${index}`,
      path: buildNetEdgePath(x1, y1, x2, y2),
      label: `${mainField} → ${satField}`,
    };
  }).filter(Boolean);

  allNodes.forEach((n) => {
    n.linkedFields = linkedFieldMap[n.docType] ? [...linkedFieldMap[n.docType]] : [];
    if (!n.isHub) {
      n.isUnlinked = !(links || []).some(
        (l) => (l.sourceDocType === n.docType && l.targetDocType === mainType)
          || (l.targetDocType === n.docType && l.sourceDocType === mainType),
      );
    }
  });

  return { width: canvasW, height: canvasH, nodes: allNodes, edges };
}

function getSceneLinkValidationError(documents, mainDocType, docFieldLinks, getDocDisplayLabel) {
  if (!documents?.length) return '関連帳票を1件以上追加してください';
  if (!mainDocType) return '主帳票を1件選択してください';
  if (documents.length <= 1) return '';
  const stats = computeSceneLinkStats(
    documents,
    [mainDocType],
    docFieldLinks,
  );
  if (stats.unlinkedCount > 0) {
    const names = stats.unlinkedDocs.map((t) => getDocDisplayLabel(t)).join('、');
    return `主帳票に未関連の帳票があります：${names}`;
  }
  return '';
}

function getSceneMainDocTypes(scene) {
  if (Array.isArray(scene?.mainDocTypes) && scene.mainDocTypes.length) {
    return [scene.mainDocTypes[0]];
  }
  if (scene?.aggregateDocType) return [scene.aggregateDocType];
  return [];
}

function getSceneMainDocType(scene) {
  return getSceneMainDocTypes(scene)[0] || '';
}

function normalizeSceneAggregate(scene, documents, legacyOutput) {
  const docTypes = (documents || []).map((d) => d.type);
  let mainDocType = '';
  if (Array.isArray(scene?.mainDocTypes) && scene.mainDocTypes.length) {
    mainDocType = scene.mainDocTypes[0];
  } else if (scene?.aggregateDocType) {
    mainDocType = scene.aggregateDocType;
  } else if (legacyOutput?.aggregateDocType) {
    mainDocType = legacyOutput.aggregateDocType;
  }
  if (!docTypes.includes(mainDocType)) mainDocType = '';
  if (!mainDocType && docTypes.length) mainDocType = docTypes[0];
  return {
    mainDocTypes: mainDocType ? [mainDocType] : [],
    aggregateDocType: mainDocType,
    primaryKey: '',
    secondaryKeys: [],
  };
}

function applySceneAggregate(scene, documents, legacyOutput) {
  const agg = normalizeSceneAggregate(scene, documents, legacyOutput);
  scene.mainDocTypes = agg.mainDocTypes;
  scene.aggregateDocType = agg.aggregateDocType;
  scene.primaryKey = agg.primaryKey;
  scene.secondaryKeys = [];
  scene.masterlessPolicy = SCENE_MATCHING_DEFAULTS.masterlessPolicy;
  delete scene.groupRules;
  scene.supplementPolicy = SCENE_MATCHING_DEFAULTS.supplementPolicy;
  delete scene.matchingPriority;
}

function normalizeDocFieldLinks(links, documents) {
  const docTypes = new Set((documents || []).map((d) => d.type));
  return (links || []).filter((link) => {
    if (!link?.sourceDocType || !link?.targetDocType) return false;
    if (!docTypes.has(link.sourceDocType) || !docTypes.has(link.targetDocType)) return false;
    const sourceFields = getDocSchema(link.sourceDocType).fields || [];
    const targetFields = getDocSchema(link.targetDocType).fields || [];
    return sourceFields.includes(link.sourceField) && targetFields.includes(link.targetField);
  }).map((link, index) => ({
    id: link.id || `link-${index}-${Date.now()}`,
    sourceDocType: link.sourceDocType,
    sourceField: link.sourceField,
    targetDocType: link.targetDocType,
    targetField: link.targetField,
  }));
}

function buildDefaultDocFieldLinks(documents, mainDocTypes) {
  const docTypes = (documents || []).map((d) => d.type);
  if (docTypes.length < 2) return [];
  const hubs = (Array.isArray(mainDocTypes) ? mainDocTypes : [mainDocTypes])
    .filter((t) => docTypes.includes(t));
  const hubList = hubs.length ? hubs : [docTypes[0]];
  const links = [];
  const seen = new Set();
  hubList.forEach((hub) => {
    const hubFields = getDocSchema(hub).fields || [];
    docTypes.forEach((other) => {
      if (other === hub) return;
      const otherFieldSet = new Set(getDocSchema(other).fields || []);
      hubFields.forEach((field) => {
        if (!otherFieldSet.has(field)) return;
        const key = `${hub}|${field}|${other}`;
        if (seen.has(key)) return;
        seen.add(key);
        links.push({
          id: `link-${hub}-${other}-${field}`,
          sourceDocType: hub,
          sourceField: field,
          targetDocType: other,
          targetField: field,
        });
      });
    });
  });
  return links;
}

function applySceneDocFieldLinks(scene, documents) {
  const normalized = normalizeDocFieldLinks(scene.docFieldLinks, documents);
  scene.docFieldLinks = normalized.length
    ? normalized
    : buildDefaultDocFieldLinks(documents, getSceneMainDocTypes(scene));
}

function normalizeOutputConfig(output, documents, masterMappings, knowledgeSource) {
  const base = { ...cloneJson(OUTPUT_DEFAULTS), ...(output || {}) };
  delete base.useDefault;
  delete base.aggregateDocType;
  delete base.primaryKey;
  delete base.secondaryKeys;
  delete base.granularity;
  base.naming = normalizeOutputNaming(base);
  base.fileNamePattern = base.naming.caseFilePattern;
  const builtDocs = buildOutputDocFields(documents, output?.fields || [], output?.docFields || []);
  base.docFields = attachDictFieldsToDocFields(
    builtDocs,
    masterMappings,
    knowledgeSource,
    output?.masterFields || []
  );
  delete base.masterFields;
  base.apiExportEnabled = base.apiExportEnabled === true;
  base.apiExportEndpoint = String(base.apiExportEndpoint || '');
  base.includeVerifyReport = base.includeVerifyReport !== false;
  base.sheetExportMode = normalizeSheetExportMode(base.sheetExportMode);
  if (!OUTPUT_SHEET_EXPORT_MODE_OPTIONS.some((o) => o.value === base.sheetExportMode)) {
    base.sheetExportMode = OUTPUT_DEFAULTS.sheetExportMode;
  }
  return base;
}

const DEFICIENCY_ACTION = '自動差し戻し通知';

function normalizeDeficiencyAction() {
  return DEFICIENCY_ACTION;
}

const SCENE_TEMPLATES = {
  invoice_multi: {
    scene: {
      name: '医療保険（通院給付）請求',
      businessType: '医療保険（通院給付）',
      description: '',
      deficiencyAction: DEFICIENCY_ACTION,
      replenishmentDays: 7,
      escalationDays: 14,
      groupRules: {},
      documents: [
        { type: '保険金請求書', submission: '必須', group: '' },
        { type: '診断書', submission: '必須', group: '' },
        { type: '診療明細書', submission: '任意', group: '' },
      ],
    },
    processing: processingBlock(),
    master: masterBlock([
      buildMasterRule('m1', '診断書', '傷病名', '傷病名称', ['ICD-10コード', '標準傷病名']),
      buildMasterRule('m2', '診断書', '医療機関名', '医療機関名', ['機関コード', '標準医療機関名']),
    ], {
      knowledgeSource: { type: 'dict', dictionaryId: 'icd10' },
    }),
    verify: {
      textEnabled: true,
      dataEnabled: true,
      completenessEnabled: true,
      sealEnabled: true,
      text: [
        buildTextRule(
          't1',
          '{{保険金請求書.備考}} は正規表現 /^(?!.*不備).*$/s に一致すること',
          DEFAULT_VERIFY_ACTION,
          '保険金請求書の備考に「不備」が含まれないこと'
        ),
      ],
      dataRules: [
        buildDataRule('c1', '保険金請求書と診断書の被保険者氏名は一致すること', '—', 'HITL審査'),
        buildDataRule('c2', '保険金請求書の請求金額は診療明細書の金額合計と一致すること', '¥100', 'HITL審査'),
        buildDataRule('c3', '保険金請求書、診断書、診療明細書の被保険者氏名は一致すること', '—', 'HITL審査'),
        buildDataRule('c4', '保険金請求書、診断書、診療明細書の医療機関名は一致すること', '—', 'HITL審査'),
      ],
      seal: sealFromDocs(['保険金請求書'], '署名'),
    },
    output: outputBlock([
      { name: '案件ID', checked: true },
      { name: '顧客氏名', checked: true },
      { name: '帳票種別', checked: true },
      { name: '請求金額', checked: true },
      { name: '検証結果', checked: true },
      { name: '証券番号', checked: false },
    ]),
  },
  application: {
    scene: {
      name: '医療保険（入院給付）請求',
      businessType: '医療保険（入院給付）',
      description: '入院給付金請求案件。診断書・領収書・入院証明書等を処理する。',
      deficiencyAction: DEFICIENCY_ACTION,
      replenishmentDays: 7,
      escalationDays: 14,
      groupRules: {},
      documents: [
        { type: '申込書', submission: '必須', group: '' },
        { type: '診断書', submission: '必須', group: '' },
        { type: '領収書', submission: '任意', group: '' },
        { type: '入院証明書', submission: '任意', group: '' },
        { type: '入院診断書', submission: '任意', group: '' },
        { type: '告知書', submission: '任意', group: '' },
        { type: '処方箋', submission: '任意', group: '' },
      ],
    },
    processing: processingBlock(),
    verify: {
      sealEnabled: true,
      dataRules: [
        buildDataRule('c1', '診断書・申込書・領収書の氏名は一致すること', '—', 'HITL審査'),
        buildDataRule('c2', '診断書と申込書の生年月日は一致すること', '—', 'HITL審査'),
        buildDataRule('c3', '領収書明細の金額合計は申込書の請求金額と一致すること', '¥100', 'HITL審査'),
        buildDataRule('c4', '診療明細書明細行の金額合計は申込書の請求金額以下であること', '¥100', 'HITL審査'),
        buildDataRule('c5', '診断書の発行日は申込書の申請日以前であること', '—', 'HITL審査'),
        buildDataRule('c6', '診断日 ≤ 申請日 ≤ 本日', '—', DEFAULT_VERIFY_ACTION),
        buildDataRule('c7', '申込書の請求金額は契約給付上限以下であること', '—', DEFAULT_VERIFY_ACTION),
        buildDataRule('c8', '商品コード IN [M01, M02] → 退院証明必須', '—', DEFAULT_VERIFY_ACTION),
      ],
      seal: sealFromDocs(['診断書', '申込書'], '両方', {
        signatureRequiredFields: ['氏名', '日付'],
        sealRequiredFields: ['医療機関名', '医師印'],
      }),
    },
    output: outputBlock([
      { name: '案件ID', checked: true },
      { name: '顧客氏名', checked: true },
      { name: '帳票種別', checked: true },
      { name: '請求金額', checked: true },
      { name: '検証結果', checked: true },
      { name: '証券番号', checked: false },
    ]),
  },
  invoice_simple: {
    scene: {
      name: '保険金請求（標準）',
      businessType: '保険金請求',
      description: '標準請求書シーン。請求書と診断書の整合を検証する。',
      deficiencyAction: DEFICIENCY_ACTION,
      replenishmentDays: 7,
      escalationDays: 14,
      groupRules: {},
      documents: [
        { type: '請求書', submission: '必須', group: '' },
        { type: '診断書', submission: '必須', group: '' },
        { type: '領収書', submission: '任意', group: '' },
      ],
    },
    processing: processingBlock(),
    verify: {
      sealEnabled: true,
      dataRules: [
        buildDataRule('c1', '請求書と診断書の氏名は一致すること', '—', 'HITL審査'),
      ],
      seal: sealFromDocs(['請求書'], '署名'),
    },
    output: outputBlock([
      { name: '案件ID', checked: true },
      { name: '顧客氏名', checked: true },
      { name: '帳票種別', checked: true },
      { name: '請求金額', checked: true },
      { name: '検証結果', checked: true },
    ]),
  },
  notice: {
    scene: {
      name: '新規契約・告知受領',
      businessType: '保険金請求',
      description: '告知書の受領・完全性チェック用シーン。',
      deficiencyAction: DEFICIENCY_ACTION,
      replenishmentDays: 14,
      escalationDays: 21,
      groupRules: {},
      documents: [
        { type: '告知書', submission: '必須', group: '' },
        { type: '申込書', submission: '任意', group: '' },
      ],
    },
    processing: processingBlock(),
    verify: {
      sealEnabled: true,
      dataRules: [
        buildDataRule('c1', '告知項目がすべて記載されていること', '—', 'HITL審査'),
      ],
      seal: sealFromDocs(['告知書'], '署名'),
    },
    output: outputBlock([
      { name: '案件ID', checked: true },
      { name: '顧客氏名', checked: true },
      { name: '帳票種別', checked: true },
      { name: '検証結果', checked: true },
    ], ['氏名']),
  },
  insurance_general: {
    scene: {
      name: '保険金・給付金請求',
      businessType: '保険金請求',
      description: '汎用保険金申請。給付金請求書と診断書を中心に処理する。',
      deficiencyAction: DEFICIENCY_ACTION,
      replenishmentDays: 7,
      escalationDays: 14,
      groupRules: {},
      documents: [
        { type: '保険金・給付金請求書', submission: '必須', group: '' },
        { type: '診断書', submission: '必須', group: '' },
        { type: '領収書', submission: '任意', group: '' },
        { type: '診療明細書', submission: '任意', group: '' },
      ],
    },
    processing: processingBlock(),
    verify: {
      sealEnabled: true,
      dataRules: [
        buildDataRule('c1', '保険金・給付金請求書と診断書の氏名は一致すること', '—', 'HITL審査'),
        buildDataRule('c2', '保険金・給付金請求書の申請金額は領収書の金額合計と一致すること', '¥100', 'HITL審査'),
        buildDataRule('c3', '診断日 ≤ 申請日 ≤ 本日', '—', '記録のみ'),
      ],
      seal: sealFromDocs(['保険金・給付金請求書'], '署名'),
    },
    output: outputBlock([
      { name: '案件ID', checked: true },
      { name: '顧客氏名', checked: true },
      { name: '帳票種別', checked: true },
      { name: '申請金額', checked: true },
      { name: '検証結果', checked: true },
      { name: '証券番号', checked: true },
    ]),
  },
};

function normalizeSceneDocuments(documents) {
  return (documents || []).map((doc) => ({
    ...doc,
    type: migrateDocTypeId(doc.type),
    submission: doc.submission === '代替可' ? '任意' : (doc.submission || '必須'),
    group: '',
    linkField: doc.linkField || '',
  }));
}

function sceneForm(sceneOrId) {
  const routeKey = SCENE_ROUTE[sceneOrId]
    || SCENE_ROUTE[SCENES.find((s) => s.id === sceneOrId || s.name === sceneOrId)?.id]
    || 'application';
  const data = cloneJson(SCENE_TEMPLATES[routeKey]);
  if (data.scene.deficiencyAction === '外部システムへイベント送信') {
    data.scene.deficiencyAction = DEFICIENCY_ACTION;
  }
  data.scene.deficiencyAction = normalizeDeficiencyAction();
  delete data.scene.notificationEmail;
  data.scene.documents = normalizeSceneDocuments(data.scene.documents);
  applySceneAggregate(data.scene, data.scene.documents, data.output);
  applySceneDocFieldLinks(data.scene, data.scene.documents);
  data.processing.image = normalizeImageConfig(data.processing?.image, data.scene.documents);
  data.processing.hitl = normalizeHitlConfig(data.processing?.hitl);
  data.master = normalizeMasterConfig(data.master, data.verify);
  data.verify = normalizeVerifyConfig(data.verify);
  data.output = normalizeOutputConfig(data.output, data.scene.documents, data.master.mappings, data.master.knowledgeSource);
  syncOcrExtractTypesOnForm(data);
  data.workflows = {
    case: buildDefaultCaseWorkflow(),
  };
  return data;
}

function sceneFormByScene(scene) {
  const routeKey = SCENE_ROUTE[scene.id] || 'application';
  const data = cloneJson(SCENE_TEMPLATES[routeKey]);
  data.scene.name = scene.name;
  if (scene.description != null) data.scene.description = scene.description;
  if (data.scene.deficiencyAction === '外部システムへイベント送信') {
    data.scene.deficiencyAction = DEFICIENCY_ACTION;
  }
  data.scene.deficiencyAction = normalizeDeficiencyAction();
  delete data.scene.notificationEmail;
  data.scene.documents = normalizeSceneDocuments(data.scene.documents);
  applySceneAggregate(data.scene, data.scene.documents, data.output);
  applySceneDocFieldLinks(data.scene, data.scene.documents);
  data.processing.image = normalizeImageConfig(data.processing?.image, data.scene.documents);
  data.processing.hitl = normalizeHitlConfig(data.processing?.hitl);
  data.master = normalizeMasterConfig(data.master, data.verify);
  data.verify = normalizeVerifyConfig(data.verify);
  data.output = normalizeOutputConfig(data.output, data.scene.documents, data.master.mappings, data.master.knowledgeSource);
  syncOcrExtractTypesOnForm(data);
  data.workflows = {
    case: buildDefaultCaseWorkflow(),
  };
  return data;
}

function normalizeLoadedForm(form) {
  if (!form) return null;
  form.scene = form.scene || {};
  form.scene.documents = normalizeSceneDocuments(form.scene.documents || []);
  if (form.scene.deficiencyAction === '外部システムへイベント送信') {
    form.scene.deficiencyAction = DEFICIENCY_ACTION;
  }
  form.scene.deficiencyAction = normalizeDeficiencyAction();
  delete form.scene.notificationEmail;
  applySceneAggregate(form.scene, form.scene.documents, form.output);
  applySceneDocFieldLinks(form.scene, form.scene.documents);
  form.processing = form.processing || {};
  form.processing.input = normalizeInputConfig(form.processing.input);
  form.processing.ocrExtract = { ...cloneJson(WORKFLOW_DEFAULTS.ocrExtract), ...(form.processing.ocrExtract || {}) };
  form.processing.fraudDetect = normalizeFraudDetectConfig(form.processing.fraudDetect);
  if (form.processing.rag && !form.processing.externalApi) {
    form.processing.externalApi = form.processing.rag;
    delete form.processing.rag;
  }
  form.processing.externalApi = normalizeExternalApiConfig(form.processing.externalApi);
  delete form.processing.rag;
  form.knowledgeSources = (form.knowledgeSources || []).map(normalizeKnowledgeSourceItem);
  form.mcpServers = (form.mcpServers || []).map(normalizeMcpServerItem);
  form.mcpToolParamProfiles = form.mcpToolParamProfiles || {};
  form.processing.image = normalizeImageConfig(form.processing?.image, form.scene.documents);
  form.processing.hitl = normalizeHitlConfig(form.processing?.hitl);
  form.master = normalizeMasterConfig(form.master, form.verify);
  form.verify = normalizeVerifyConfig(form.verify);
  form.output = normalizeOutputConfig(form.output, form.scene.documents, form.master.mappings, form.master.knowledgeSource);
  syncOcrExtractTypesOnForm(form);
  ensureFormWorkflows(form, { force: true });
  return form;
}


const SUBSTITUTE_GROUPS = ['A', 'B', 'C', 'D', 'E'];

const BUSINESS_TYPES = [
  '保険金請求',
  '医療保険（入院給付）',
  '医療保険（通院給付）',
  'がん保険',
  '死亡保険',
  '特約・附加給付',
  '保全（契約変更）',
  '保全（受取人変更）',
  '保全（解約）',
];

const AMOUNT_FIELD_PATTERN = /金額|合計|単価|点数|料金|申請額/;

function isAmountFieldName(name) {
  return AMOUNT_FIELD_PATTERN.test(name || '');
}

function parseDescriptionFieldRefs(text) {
  const refs = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m = re.exec(text || '');
  while (m) {
    const parts = m[1].split('.');
    if (parts.length >= 2) {
      refs.push({ doc: parts[0], field: parts[parts.length - 1], path: m[1] });
    }
    m = re.exec(text || '');
  }
  return refs;
}

function descriptionHasAmountFields(text) {
  const refs = parseDescriptionFieldRefs(text);
  if (refs.some((r) => isAmountFieldName(r.field))) return true;
  return /金額|合計|申請額|請求金額/.test(text || '');
}

const AMOUNT_TOLERANCE_OPTIONS = [
  { value: '¥100', label: '¥100（既定）' },
  { value: '¥500', label: '¥500' },
  { value: '¥1000', label: '¥1,000' },
  { value: '完全一致', label: '完全一致（誤差なし）' },
];

function newRuleId(prefix) {
  return `${prefix}_${Date.now().toString(36)}`;
}

const DATA_NATURAL_PLACEHOLDER =
  '例：診断書と申込書の氏名は一致すること / 申込書の請求金額は契約給付上限以下であること';
const TEXT_NATURAL_PLACEHOLDER =
  '例：保険金請求書の備考に「不備」が含まれないこと';
const TEXT_CONDITION_GUIDE =
  '自然言語で記述し、AI補助で実行式を生成します。入力欄の下にプレビューが表示されます。';
const DATA_CONDITION_GUIDE =
  '帳票間の整合性と業務ロジックを自然言語で記述し、AI補助で実行式をプレビュー表示します。';

function resolveTextDraftExpression(draft, docTypes, picker = {}) {
  if (draft.compiled?.trim()) return draft.compiled.trim();
  const input = (draft.input || '').trim();
  if (!input) return '';
  const auto = compileNaturalToTextRule(input, docTypes, picker);
  return isCompiledRuleResult(auto, input) ? auto : '';
}

function resolveDataDraftExpression(draft, docTypes) {
  if (draft.compiled?.trim()) return draft.compiled.trim();
  const input = (draft.input || '').trim();
  if (!input) return '';
  const auto = compileNaturalToExpression(input, docTypes);
  return isCompiledRuleResult(auto, input) ? auto : '';
}

const OP_NATURAL = {
  '<': 'より前',
  '≤': '以前',
  '<=': '以前',
  '>': 'より後',
  '≥': '以降',
  '>=': '以降',
  '=': 'と一致',
  '==': 'と一致',
  '≠': 'と不一致',
  '!=': 'と不一致',
};

function formatFieldToken(doc, field) {
  return `{{${doc}.${field}}}`;
}

function formatTableColumnToken(docType, tableName, columnName) {
  return `{{${docType}.${tableName}.${columnName}}}`;
}

function formatTableColumnLabel(tableName, columnName) {
  return `${tableName}.${columnName}`;
}

function mergeSchemaItemOrder(schemaNames, existingItems, mapItem) {
  const existingMap = Object.fromEntries((existingItems || []).map((item) => [item.name, item]));
  const keptOrder = (existingItems || []).map((item) => item.name).filter((name) => schemaNames.includes(name));
  const appended = schemaNames.filter((name) => !keptOrder.includes(name));
  return [...keptOrder, ...appended].map((name) => mapItem(name, existingMap[name]));
}

function formatRefPlaceholder(path) {
  return `{{${path}}}`;
}

function parseCrossRuleParts(text) {
  const parts = [];
  if (!text) return parts;
  const re = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let m = re.exec(text);
  while (m) {
    if (m.index > lastIndex) {
      const between = text.slice(lastIndex, m.index).trim();
      if (between) parts.push({ type: 'op', text: between });
    }
    parts.push({ type: 'field', path: m[1] });
    lastIndex = m.index + m[0].length;
    m = re.exec(text);
  }
  const tail = text.slice(lastIndex).trim();
  if (tail) parts.push({ type: 'op', text: tail });
  return parts;
}

function formatRefDisplay(path) {
  const parts = path.split('.');
  if (parts.length >= 2) {
    return `${parts[0]} · ${parts.slice(1).join('.')}`;
  }
  return path;
}

function findNextPhraseStart(text, from, phrases) {
  let min = -1;
  phrases.forEach((ph) => {
    const idx = text.indexOf(ph.text, from);
    if (idx !== -1 && (min === -1 || idx < min)) min = idx;
  });
  return min;
}

function mergeAdjacentTextParts(parts) {
  const out = [];
  parts.forEach((p) => {
    if (p.type === 'text' && out.length && out[out.length - 1].type === 'text') {
      out[out.length - 1].text += p.text;
    } else {
      out.push({ ...p });
    }
  });
  return out;
}

function parseNaturalRuleHighlights(text, docTypes) {
  const phrases = [];
  const seen = new Set();
  const fieldSuffixes = new Set();
  docTypes.forEach((doc) => {
    if (!seen.has(doc)) {
      phrases.push({ type: 'doc', text: doc });
      seen.add(doc);
    }
    getDocSchema(doc).fields.forEach((field) => {
      const phrase = `${doc}の${field}`;
      if (!seen.has(phrase)) {
        phrases.push({ type: 'field', text: phrase });
        seen.add(phrase);
      }
      const suffix = `の${field}`;
      if (!fieldSuffixes.has(suffix)) {
        phrases.push({ type: 'field', text: suffix });
        fieldSuffixes.add(suffix);
      }
    });
  });
  phrases.sort((a, b) => b.text.length - a.text.length);

  const parts = [];
  let i = 0;
  while (i < text.length) {
    let matched = null;
    for (const ph of phrases) {
      if (text.startsWith(ph.text, i)) {
        matched = ph;
        break;
      }
    }
    if (matched) {
      parts.push({ type: matched.type, text: matched.text });
      i += matched.text.length;
    } else {
      const next = findNextPhraseStart(text, i + 1, phrases);
      const end = next === -1 ? text.length : next;
      parts.push({ type: 'text', text: text.slice(i, end) });
      i = end;
    }
  }
  return mergeAdjacentTextParts(parts);
}

function parseRuleHighlightParts(text, docTypes = []) {
  if (!text) return [];
  if (/\{\{[^}]+\}\}/.test(text)) {
    return parseCrossRuleParts(text).map((p) =>
      p.type === 'field'
        ? { type: 'token', text: formatRefDisplay(p.path) }
        : { type: 'text', text: p.text }
    );
  }
  if (!docTypes.length) return [{ type: 'text', text }];
  return parseNaturalRuleHighlights(text, docTypes);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildContainRegex(word) {
  return `/.*${escapeRegex(word)}.*/s`;
}

function buildNotContainRegex(word) {
  return `/^(?!.*${escapeRegex(word)}).*$/s`;
}

function buildTextRegexRule(token, word, contain = false) {
  const pattern = contain ? buildContainRegex(word) : buildNotContainRegex(word);
  return `${token} は正規表現 ${pattern} に一致すること`;
}

function compileNaturalToTextRule(text, docTypes, picker = {}) {
  const t = (text || '').trim();
  if (!t) return '';
  if (/は正規表現\s+\//.test(t)) return t;

  const tryPickerAmount = () => {
    if (!picker.doc || !picker.field) return '';
    const token = formatFieldToken(picker.doc, picker.field);
    const cmp = t.match(/([≤≥<>＝=]+)\s*([\d,，]+)\s*(円|元|人民币)?\s*$/u);
    if (cmp) {
      const op = cmp[1].replace('＝', '=');
      return `${token} ${op} ${cmp[2].replace(/[,，]/g, '')}`;
    }
    return '';
  };

  const tryPickerContain = () => {
    if (!picker.doc || !picker.field) return '';
    const token = formatFieldToken(picker.doc, picker.field);
    const fieldEsc = escapeRegex(picker.field);
    const fieldPatterns = [
      new RegExp(`^${fieldEsc}に\\s*[「『"']([^」』""']+)[」』""']\\s*(?:が)?含まれない`, 'u'),
      new RegExp(`^${fieldEsc}に(.+?)(?:が|を)含まれない`, 'u'),
      new RegExp(`^${fieldEsc}に(.+?)を含まない`, 'u'),
      new RegExp(`^${fieldEsc}.*(?:不含|不包含)(.+)$`, 'u'),
      new RegExp(`^${fieldEsc}に(.+?)(?:が|を)含ま(?:れる|む)`, 'u'),
    ];
    for (const re of fieldPatterns) {
      const m = t.match(re);
      if (m) {
        const word = m[1].trim();
        const contain = /含ま(?:れる|む)|包含/.test(t) && !/含まれない|含まない|不含|不包含/.test(t);
        return buildTextRegexRule(token, word, contain);
      }
    }
    const shortPatterns = [
      { re: /^[「『"']([^」』""']+)[」』""']\s*(?:が)?含まれない/u, contain: false },
      { re: /^(.+?)(?:が|を)含まれない/u, contain: false },
      { re: /^(.+?)(?:を)?含まないこと?$/u, contain: false },
      { re: /^(?:不含|不包含)\s*(.+)$/u, contain: false },
      { re: /^[「『"']([^」』""']+)[」』""']\s*(?:が)?含ま(?:れる|む)/u, contain: true },
      { re: /^(.+?)(?:が|を)含むこと?$/u, contain: true },
    ];
    for (const { re, contain } of shortPatterns) {
      const m = t.match(re);
      if (m) return buildTextRegexRule(token, m[1].trim(), contain);
    }
    return '';
  };

  const pickerAmount = tryPickerAmount();
  if (pickerAmount) return pickerAmount;
  const pickerContain = tryPickerContain();
  if (pickerContain) return pickerContain;

  const tokenAmount = t.match(/^(\{\{[^}]+\}\})\s*(?:要|は)?\s*([≤≥<>＝=]+)\s*([\d,，]+)\s*(円|元|人民币)?$/u);
  if (tokenAmount) {
    const num = tokenAmount[3].replace(/[,，]/g, '');
    const op = tokenAmount[2].replace('＝', '=');
    return `${tokenAmount[1]} ${op} ${num}`;
  }

  const tokenNotContain = t.match(
    /^(\{\{[^}]+\}\})\s*に\s*[「『"']([^」』""']+)[」』""']\s*が\s*含まれないこと$/u
  );
  if (tokenNotContain) {
    return buildTextRegexRule(tokenNotContain[1], tokenNotContain[2], false);
  }

  const tokenContain = t.match(
    /^(\{\{[^}]+\}\})\s*に\s*[「『"']([^」』""']+)[」』""']\s*が\s*含ま(?:れる|む)こと$/u
  );
  if (tokenContain) {
    return buildTextRegexRule(tokenContain[1], tokenContain[2], true);
  }

  const sortedDocs = [...docTypes].sort((a, b) => b.length - a.length);
  for (const doc of sortedDocs) {
    const docEsc = escapeRegex(doc);
    const amountBelow = new RegExp(`^${docEsc}の(.+?)は([\\d,，]+)(?:円|元)?以下であること$`, 'u');
    const mBelow = t.match(amountBelow);
    if (mBelow) {
      const num = mBelow[2].replace(/[,，]/g, '');
      return `${formatFieldToken(doc, mBelow[1].trim())} ≤ ${num}`;
    }
    const amountAbove = new RegExp(`^${docEsc}の(.+?)は([\\d,，]+)(?:円|元)?以上であること$`, 'u');
    const mAbove = t.match(amountAbove);
    if (mAbove) {
      const num = mAbove[2].replace(/[,，]/g, '');
      return `${formatFieldToken(doc, mAbove[1].trim())} ≥ ${num}`;
    }
    const patterns = [
      {
        re: new RegExp(`^${docEsc}の(.+?)に\\s*[「『"']([^」』""']+)[」』""']\\s*が\\s*含まれないこと$`, 'u'),
        contain: false,
      },
      {
        re: new RegExp(`^${docEsc}の(.+?)に\\s*[「『"']([^」』""']+)[」』""']\\s*が\\s*含ま(?:れる|む)こと$`, 'u'),
        contain: true,
      },
      {
        re: new RegExp(`^${docEsc}の(.+?)に(.+?)が含まれないこと$`, 'u'),
        contain: false,
      },
      {
        re: new RegExp(`^${docEsc}の(.+?)に(.+?)を含まないこと$`, 'u'),
        contain: false,
      },
      {
        re: new RegExp(`^${docEsc}の(.+?)に(.+?)が含ま(?:れる|む)こと$`, 'u'),
        contain: true,
      },
      {
        re: new RegExp(`^${docEsc}の(.+?)に(.+?)を含むこと$`, 'u'),
        contain: true,
      },
    ];

    for (const { re, contain } of patterns) {
      const m = t.match(re);
      if (m) return buildTextRegexRule(formatFieldToken(doc, m[1].trim()), m[2].trim(), contain);
    }
  }

  return '';
}

function isCompiledRuleResult(compiled, input) {
  const c = (compiled || '').trim();
  const i = (input || '').trim();
  if (!c || c === i) return false;
  return /\{\{[^}]+\}\}/.test(c);
}

function ruleReadableText(text) {
  const t = (text || '').trim();
  if (!t) return '';
  if (!/\{\{/.test(t)) return replaceDocTypeIdsInText(t);

  const regexRule = t.match(/^(\{\{[^}]+\}\})\s*は正規表現\s+(\/[^/]+\/[gimsuy]*)\s*に一致すること$/u);
  if (regexRule) {
    const [, token, pattern] = regexRule;
    const label = labelFromToken(token);
    const inner = pattern.replace(/^\/(.+)\/[gimsuy]*$/s, '$1');
    const notContain = inner.match(/^\^\(\?!\.\*(.+)\)\.\*\$$/);
    if (notContain) {
      return `${label} に「${notContain[1].replace(/\\/g, '')}」が含まれないこと`;
    }
    const contain = inner.match(/^\.\*(.+)\.\*$/s);
    if (contain) {
      return `${label} に「${contain[1].replace(/\\/g, '')}」が含まれること`;
    }
    return `${label} は正規表現 ${pattern} に一致すること`;
  }

  const naturalContain = t.match(/^(\{\{[^}]+\}\})\s*に\s*[「『"']([^」』""']+)[」』""']\s*が\s*含まれないこと$/u);
  if (naturalContain) {
    return `${labelFromToken(naturalContain[1])} に「${naturalContain[2]}」が含まれないこと`;
  }

  const tokens = [...t.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
  const opsOnly = t.replace(/\{\{[^}]+\}\}/g, '').trim();
  if (tokens.length >= 2 && /^[=＝\s]+$/.test(opsOnly)) {
    const labels = tokens.map((path) => {
      const parts = path.split('.');
      const docLabel = getDocDisplayLabel(parts[0]);
      return parts.length > 1 ? `${docLabel}の${parts.slice(1).join('.')}` : docLabel;
    });
    if (labels.length === 2) return `${labels[0]}と${labels[1]}は一致すること`;
    return `${labels.join('、')}は一致すること`;
  }

  const compare = t.match(/^(\{\{[^}]+\}\}(?:\s*=\s*\{\{[^}]+\}\})*)\s*([≤≥<>＝=]+)\s*(.+)$/);
  if (compare) {
    const leftToken = compare[1].match(/\{\{([^}]+)\}\}/);
    if (leftToken) {
      const l = labelFromToken(`{{${leftToken[1]}}}`);
      const op = compare[2].replace('＝', '=');
      const rightRaw = compare[3].trim();
      const r = /^\{\{/.test(rightRaw) ? labelFromToken(rightRaw) : rightRaw.replace(/(円|日元|元)$/u, '').trim();
      const amountSuffix = /^\d/.test(r) || /^¥/.test(r) ? '円' : '';
      const rLabel = /^\{\{/.test(rightRaw) ? r : `${Number(r.replace(/[,，]/g, '')).toLocaleString('ja-JP')}${amountSuffix}`;
      if (op === '=') return `${l}は${rLabel}と一致すること`;
      if (['≤', '<=', '<'].includes(op)) return `${l}は${rLabel}以下であること`;
      if (['≥', '>=', '>'].includes(op)) return `${l}は${rLabel}以上であること`;
      const phrase = OP_NATURAL[op];
      if (phrase) return `${l}は${rLabel}${phrase}であること`;
    }
  }

  return replaceDocTypeIdsInText(optimizeRuleDescription(t));
}

function compileNaturalToExpression(text, docTypes) {
  let t = (text || '').trim();
  if (!t) return '';
  if (/\{\{[^}]+\}\}/.test(t)) return t;

  const normalized = t
    .replace(/小于等于|不大於/g, '≤')
    .replace(/小于|未満/g, '≤')
    .replace(/大于等于/g, '≥')
    .replace(/大于/g, '>')
    .replace(/等于/g, '=');

  const phrases = [];
  docTypes.forEach((doc) => {
    getDocSchema(doc).fields.forEach((field) => {
      phrases.push({ doc, field, text: `${doc}の${field}` });
    });
    Object.entries(getDocSchema(doc).tables || {}).forEach(([table, cols]) => {
      cols.forEach((col) => {
        phrases.push({ doc, field: `${table}.${col}`, text: `${doc}の${table}.${col}` });
      });
    });
  });
  phrases.sort((a, b) => b.text.length - a.text.length);

  for (const { doc, field, text: phrase } of phrases) {
    const numRe = new RegExp(
      `^${escapeRegex(phrase)}\\s*([≤≥<>＝=]+)?\\s*([\\d,，]+)\\s*(円|日元|元)?`,
      'u'
    );
    const m = normalized.match(numRe);
    if (m) {
      const op = (m[1] || '≤').trim() || '≤';
      const num = m[2].replace(/[,，]/g, '');
      return `{{${doc}.${field}}} ${op} ${num}`;
    }
  }

  const crossEq = normalized.match(/^(.+?)の(.+?)は(.+?)の(.+?)と一致すること?$/u);
  if (crossEq && docTypes.includes(crossEq[1]) && docTypes.includes(crossEq[3])) {
    return `${formatFieldToken(crossEq[1], crossEq[2].trim())} = ${formatFieldToken(crossEq[3], crossEq[4].trim())}`;
  }

  const crossCmp = normalized.match(/^(.+?)の(.+?)は(.+?)の(.+?)(以下|以上)であること$/u);
  if (crossCmp && docTypes.includes(crossCmp[1]) && docTypes.includes(crossCmp[3])) {
    const op = crossCmp[5] === '以下' ? '≤' : '≥';
    return `${formatFieldToken(crossCmp[1], crossCmp[2].trim())} ${op} ${formatFieldToken(crossCmp[3], crossCmp[4].trim())}`;
  }

  const eqList = normalized.match(/^(.+?)の([^は]+)は一致すること?$/u);
  if (eqList) {
    const field = eqList[2].trim();
    const docs = eqList[1].split(/[、・,，\s]+/).map((s) => s.trim()).filter(Boolean);
    const known = docs.filter((d) => docTypes.includes(d));
    if (known.length >= 2) {
      return known.map((d) => formatFieldToken(d, field)).join(' = ');
    }
  }

  const eqPair = normalized.match(/^(.+?)と(.+?)の([^は]+)は一致すること?$/u);
  if (eqPair && docTypes.includes(eqPair[1]) && docTypes.includes(eqPair[2])) {
    return `${formatFieldToken(eqPair[1], eqPair[3].trim())} = ${formatFieldToken(eqPair[2], eqPair[3].trim())}`;
  }

  const dateCmp = normalized.match(/^(.+?)の(.+?)は(.+?)の(.+?)(以前|以降|より前|より後)であること$/u);
  if (dateCmp) {
    const op = /以前|より前/.test(dateCmp[5]) ? '≤' : '≥';
    return `${formatFieldToken(dateCmp[1], dateCmp[2])} ${op} ${formatFieldToken(dateCmp[3], dateCmp[4])}`;
  }

  if (/偽造|不正|改ざん|フォージ|tamper|fraud/i.test(t)) {
    return '{{fraud.risk_score}} >= {{fraud.threshold}}';
  }
  if (/重複|再利用|同一画像/i.test(t)) {
    return '{{fraud.duplicate_score}} >= {{fraud.threshold}}';
  }
  if (/完全性.*NG|必須帳票.*欠落|資料.*不足/i.test(t)) {
    return '{{case.completeness}} = NG';
  }
  if (/前処理.*確認|画質.*NG|DPI/i.test(t)) {
    return '{{preprocess.status}} = REVIEW_REQUIRED';
  }
  if (/OCR.*確認|信頼度.*閾値|要確認フィールド/i.test(t)) {
    return 'ANY({{ocr.fields.confidence}}) < {{ocr.threshold}}';
  }
  if (/AI検証.*PASS|検証.*通過/i.test(t)) {
    return '{{verify.status}} = PASS AND {{verify.warning_count}} = 0';
  }
  if (/検証.*NG|Master.*未一致|WARNING/i.test(t)) {
    return '{{verify.status}} IN (NG, WARNING) OR {{master.match}} = UNMATCHED';
  }
  if (/不備通知|補件.*通知/i.test(t)) {
    return '{{case.has_deficiency}} = true';
  }
  if (/必要資料.*揃|案件.*就绪|readiness/i.test(t)) {
    return '{{case.readiness}} = OK';
  }

  const regexRule = t.match(/^(.+?)は正規表現\s+\/(.+)\/([a-z]*)?\s*に一致(?:すること)?$/u);
  if (regexRule) {
    const fieldRef = regexRule[1].trim();
    for (const doc of docTypes) {
      for (const field of getDocSchema(doc).fields || []) {
        if (fieldRef === `${doc}の${field}` || fieldRef === field) {
          const flags = regexRule[3] || '';
          return `REGEX_MATCH({{${doc}.${field}}}, /${regexRule[2]}/${flags})`;
        }
      }
    }
    return `REGEX_MATCH(${fieldRef}, /${regexRule[2]}/${regexRule[3] || ''})`;
  }

  return '';
}

function validateExecutableRule(text) {
  const t = (text || '').trim();
  if (!t) return '条件を入力してください';
  if (!/\{\{[^}]+\}\}/.test(t)) {
    return '実行式に変換されていません。「AIで実行式を生成」するか、フィールドを挿入してください';
  }
  if (!parseDescriptionFieldRefs(t).length) {
    return '有効なフィールド参照（{{帳票.フィールド}}）を含めてください';
  }
  const remainder = t.replace(/\{\{[^}]+\}\}/g, ' ').trim();
  if (!/[=≤≥<>≠!]/.test(remainder)) {
    return 'フィールド挿入後、=、≤、≥ などの比較演算子を記述してください';
  }
  return '';
}

function validateTextRule(expression) {
  const t = (expression || '').trim();
  if (!t) return '正規表現（実行式）を入力するか、自然言語から AI補助 で生成してください';
  if (!/\{\{[^}]+\}\}/.test(t)) {
    return '実行式に {{帳票.フィールド}} 参照を含めてください';
  }
  return '';
}

function isTextRegexExpression(text) {
  return /は正規表現\s+\//.test((text || '').trim());
}

function labelFromToken(token) {
  const trimmed = token.trim();
  const m = trimmed.match(/^\{\{(.+)\}\}$/);
  if (!m) return replaceDocTypeIdsInText(trimmed);
  const parts = m[1].split('.');
  if (parts.length === 1) return getDocDisplayLabel(parts[0]);
  return `${getDocDisplayLabel(parts[0])}の${parts.slice(1).join('.')}`;
}

function optimizeRuleDescription(text) {
  const t = text.trim();
  if (!t) return '診断書の発行日は申込書の申請日以前であること';
  const compare = t.match(/^(.+?)\s*(<=|>=|≠|!=|≤|≥|<|>|=)\s*(.+)$/);
  if (compare) {
    const [, left, op, right] = compare;
    const l = labelFromToken(left);
    const r = labelFromToken(right);
    const phrase = OP_NATURAL[op];
    if (phrase) {
      if (['=', '==', '≠', '!='].includes(op)) {
        return `${l}は${r}${phrase}すること`;
      }
      return `${l}は${r}${phrase}であること`;
    }
  }
  if (t.includes('{{')) {
    return t.replace(/\{\{([^}]+)\}\}/g, (_, inner) => {
      const parts = inner.split('.');
      return parts.length > 1
        ? `${getDocDisplayLabel(parts[0])}の${parts.slice(1).join('.')}`
        : getDocDisplayLabel(inner);
    });
  }
  return replaceDocTypeIdsInText(t.replace(/と/g, ' かつ ').replace(/または/g, ' または '));
}

const STORAGE_KEY = 'kisoku-nintei-v3';

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStorage(sceneId, formData) {
  try {
    const store = loadStorage() || {};
    store[sceneId] = JSON.parse(JSON.stringify(formData));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) { console.warn('localStorage save failed', e); }
}

function loadSceneFromStorage(sceneId) {
  const store = loadStorage();
  if (!store || !store[sceneId]) return null;
  return store[sceneId];
}

const appOptions = {
  setup() {
    // #region agent log
    fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:setup-start',message:'setup-start',data:{vueOk:typeof Vue!=='undefined',epOk:typeof ElementPlus!=='undefined'},timestamp:Date.now(),hypothesisId:'E',runId:'hang-debug'})}).catch(()=>{});
    // #endregion
    const sceneSearch = ref('');
    const currentSceneId = ref('2064639102406844416');
    const currentNode = ref('scene');
    const currentProduct = ref('kisoku');

    // Try loading from localStorage first, fall back to default
    const storedForm = loadSceneFromStorage('2064639102406844416');
    let initialForm;
    try {
      initialForm = normalizeLoadedForm(storedForm) || sceneForm('2064639102406844416');
    } catch (initErr) {
      initialForm = sceneForm('2064639102406844416');
    }
    const form = reactive(initialForm);
    // #region agent log
    fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:after-form-init',message:'after-form-init',data:{hasStored:!!storedForm,docCount:(initialForm?.scene?.documents||[]).length,nodeCount:(initialForm?.workflows?.case?.nodes||[]).length},timestamp:Date.now(),hypothesisId:'B',runId:'hang-debug'})}).catch(()=>{});
    // #endregion
    const savedSnapshot = ref(JSON.stringify(initialForm));

    const scenes = ref(SCENES);
    const nodes = NODES;
    const extractFields = EXTRACT_FIELDS;

    const docPickerVisible = ref(false);
    const docPickerSearch = ref('');
    const docPickerSelectedIds = ref([]);
    const docPickerMode = ref('setup');
    const sceneSetupVisible = ref(false);
    const workflowSetupStep = ref(2);
    const sceneSetupMode = ref('create');
    const sceneSetupDraft = reactive({
      sceneId: '',
      name: '新規シーン',
      description: '',
      documents: [],
      mainDocType: '',
      docFieldLinks: [],
    });

    const docTypeRegistryFiltered = computed(() => {
      const q = docPickerSearch.value.trim();
      if (!q) return DOC_TYPE_REGISTRY;
      return DOC_TYPE_REGISTRY.filter((item) => item.id.includes(q));
    });

    const docPickerAvailableCount = computed(() =>
      docTypeRegistryFiltered.value.filter((item) => !isDocTypeAdded(item.id)).length
    );

    function syncDocPickerSelection() {
      docPickerSelectedIds.value = docPickerSelectedIds.value.filter((id) => !isDocTypeAdded(id));
    }

    function onDocPickerOpened() {
      syncDocPickerSelection();
    }

    function toggleDocPickerItem(item) {
      if (isDocTypeAdded(item.id)) return;
      const ids = docPickerSelectedIds.value;
      const idx = ids.indexOf(item.id);
      if (idx >= 0) ids.splice(idx, 1);
      else ids.push(item.id);
    }

    function isDocPickerItemSelected(id) {
      return docPickerSelectedIds.value.includes(id);
    }

    watch(docPickerSearch, () => {
      if (docPickerVisible.value) syncDocPickerSelection();
    });
    const verifyActivePanels = ref(['completeness', 'text', 'data']);
    const outputFieldsActivePanel = ref('');
    const outputSelectedDocType = ref('');
    const exportPreviewExpanded = reactive({});
    const exportPreviewChecked = reactive({});
    const outputDragState = reactive({
      kind: '',
      docType: '',
      fromIndex: -1,
      overIndex: -1,
    });

    const dataEditingId = ref(null);
    const dataDraft = reactive({
      input: '',
      compiled: '',
    });
    const dataPickerDocs = ref([]);
    const dataPickerField = ref('');
    const dataAiLoading = ref(false);

    const sceneSidebarCollapsed = ref(false);
    const libraryPanelCollapsed = ref(false);
    const INSPECTOR_WIDTH_MIN = 320;
    const INSPECTOR_WIDTH_MAX = 720;
    const INSPECTOR_WIDTH_DEFAULT = 420;
    const INSPECTOR_WIDTH_STORAGE_KEY = 'kisoku-inspector-width-v1';
    const INSPECTOR_COLLAPSED_STORAGE_KEY = 'kisoku-inspector-collapsed-v1';

    function loadInspectorWidth() {
      try {
        const w = parseInt(localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY), 10);
        if (w >= INSPECTOR_WIDTH_MIN && w <= INSPECTOR_WIDTH_MAX) return w;
      } catch (e) { /* ignore */ }
      return INSPECTOR_WIDTH_DEFAULT;
    }

    function loadInspectorCollapsed() {
      try {
        const stored = localStorage.getItem(INSPECTOR_COLLAPSED_STORAGE_KEY);
        if (stored !== null) return stored === '1';
      } catch (e) { /* ignore */ }
      return true;
    }

    const inspectorPanelWidth = ref(loadInspectorWidth());
    const inspectorPanelCollapsed = ref(loadInspectorCollapsed());
    const inspectorResizing = ref(false);

    const inspectorWorkspaceStyle = computed(() => ({
      '--idp-inspector-width': inspectorPanelCollapsed.value
        ? '0px'
        : `${inspectorPanelWidth.value}px`,
    }));
    const selectedMasterRuleId = ref(null);
    const currentModule = ref('case-workflow');
    const fixedDocSettingsTarget = ref('');
    const appNavCollapsed = ref(false);
    const docSettingsMenuOpen = ref(true);
    const selectedWorkflowNodeId = ref(null);
    const inspectorMode = ref('overview');
    const wfLibraryDrag = reactive({ type: null });
    const wfNodeDrag = reactive({ id: null, startX: 0, startY: 0, originX: 0, originY: 0 });
    const wfConnectDrag = reactive({ fromId: null, branch: null, clientX: 0, clientY: 0, active: false });
    const wfConnectHoverTargetId = ref(null);
    let wfConnectSuppressClick = false;
    const wfConnectSourceId = ref(null);
    const wfLibrarySearch = ref('');
    const wfNodePicker = reactive({
      visible: false,
      fromNodeId: null,
      toNodeId: null,
      edgeKey: null,
      edgeBranch: null,
      side: 'after',
      tab: 'nodes',
      screenX: 0,
      screenY: 0,
      hoveredLogic: null,
    });
    const renamingSceneId = ref(null);
    const wfHistoryTimeline = ref([]);
    const wfHistoryIndex = ref(-1);
    const wfChangeHistoryVisible = ref(false);
    let wfHistoryRecording = true;
    const selectedWorkflowEdgeKey = ref(null);
    const hoveredWorkflowEdgeKey = ref(null);
    const wfCanvasViewportRef = ref(null);
    const wfViewport = reactive({ x: 0, y: 0, scale: 1 });
    const wfPanDrag = reactive({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

    function getFlowNodeKey() {
      return 'case';
    }

    function getActiveWf() {
      ensureFormWorkflows(form);
      return form.workflows.case;
    }

    const activeWorkflow = computed(() => getActiveWf());

    const isCaseWorkflowModule = computed(() => true);

    const modulePageMeta = computed(() => MODULE_PAGE_META[currentModule.value] || MODULE_PAGE_META['case-workflow']);
    const wfTemplateHintVisible = ref(false);
    let wfTemplateHintTimer = null;
    const mockUserRole = ref(localStorage.getItem(MOCK_USER_ROLE_STORAGE_KEY) || 'configurator');
    const workflowTopologyMode = ref(localStorage.getItem(WF_TOPOLOGY_MODE_STORAGE_KEY) || 'configure');
    const canSwitchWorkflowTopologyMode = computed(() =>
      MOCK_USER_ROLES.find((r) => r.value === mockUserRole.value)?.canEditTopology ?? false);
    const isWorkflowTopologyEditable = computed(() =>
      canSwitchWorkflowTopologyMode.value && workflowTopologyMode.value === 'edit');
    const workflowModeLabel = computed(() =>
      (isWorkflowTopologyEditable.value ? '編集モード' : '設定モード'));

    function flashWorkflowTemplateHint() {
      if (wfTemplateHintTimer) clearTimeout(wfTemplateHintTimer);
      wfTemplateHintVisible.value = false;
      if (!isWorkflowTopologyEditable.value || !isDefaultCaseWorkflowTemplate(getActiveWf())) return;
      wfTemplateHintVisible.value = true;
      wfTemplateHintTimer = setTimeout(() => {
        wfTemplateHintVisible.value = false;
      }, 3200);
    }

    watch(mockUserRole, (role) => {
      localStorage.setItem(MOCK_USER_ROLE_STORAGE_KEY, role);
      if (!MOCK_USER_ROLES.find((r) => r.value === role)?.canEditTopology) {
        workflowTopologyMode.value = 'configure';
        closeWfNodePicker();
      }
    });

    watch(workflowTopologyMode, (mode) => {
      localStorage.setItem(WF_TOPOLOGY_MODE_STORAGE_KEY, mode);
      if (mode === 'configure') {
        wfConnectSourceId.value = null;
        closeWfNodePicker();
        if (inspectorMode.value === 'edge') {
          selectedWorkflowEdgeKey.value = null;
          inspectorMode.value = selectedWorkflowNodeId.value ? 'node' : 'scene';
        }
      } else {
        nextTick(flashWorkflowTemplateHint);
      }
    });

    watch(currentSceneId, () => {
      nextTick(flashWorkflowTemplateHint);
    });

    function setWorkflowTopologyMode(mode) {
      if (mode === 'edit' && !canSwitchWorkflowTopologyMode.value) {
        ElementPlus.ElMessage.warning('このロールでは Workflow トポロジを編集できません');
        return;
      }
      workflowTopologyMode.value = mode;
    }

    function assertWorkflowTopologyEditable(silent = false) {
      if (isWorkflowTopologyEditable.value) return true;
      if (!silent) {
        const msg = canSwitchWorkflowTopologyMode.value
          ? '設定モードではトポロジを変更できません。編集モードに切り替えてください。'
          : '業務設定者ロールでは Workflow 構成の変更はできません。';
        ElementPlus.ElMessage.info(msg);
      }
      return false;
    }

    const processingForm = computed(() => form.processing);

    function switchModule(moduleId) {
      const navItem = APP_NAV_GROUPS.flatMap((g) => (g.children ? g.children : [g]))
        .find((item) => item.id === moduleId);
      if (navItem?.placeholder) {
        ElementPlus.ElMessage.info('この機能は準備中です');
        return;
      }
      if (!MODULE_PAGE_META[moduleId]) return;
      if (currentModule.value === moduleId) return;
      currentModule.value = moduleId;
      if (moduleId === 'mcp-servers') return;
      if (moduleId !== 'case-workflow') return;
      selectedWorkflowEdgeKey.value = null;
      inspectorMode.value = 'node';
      selectedWorkflowNodeId.value = null;
      inspectorPanelCollapsed.value = true;
      syncCurrentNodeFromWorkflow(null);
      initWorkflowHistory('案件フローを読み込み');
      nextTick(() => fitWorkflowToView());
    }

    function openFixedDocSettings(typeId) {
      if (typeId) fixedDocSettingsTarget.value = typeId;
      docSettingsMenuOpen.value = true;
      switchModule('fixed-doc');
    }

    function toggleDocSettingsMenu() {
      docSettingsMenuOpen.value = !docSettingsMenuOpen.value;
    }

    const textEditingId = ref(null);
    const textDraft = reactive({
      input: '',
      compiled: '',
    });
    const textPickerDocs = ref([]);
    const textPickerField = ref('');
    const textAiLoading = ref(false);
    const textPreviewFlash = ref(false);
    let textDraftSyncing = false;
    let dataDraftSyncing = false;
    const dataPreviewFlash = ref(false);

    const SEAL_FIELD_SUGGESTIONS = ['氏名', '日付', '医療機関名', '代表者印', '会社名', '担当者印', '医師印', '病院長印'];

    const filteredScenes = computed(() => {
      const q = sceneSearch.value.trim();
      return q ? scenes.value.filter((s) => s.name.includes(q)) : scenes.value;
    });

    function snapshotWorkflowState() {
      return cloneJson(getActiveWf() || { nodes: [], edges: [] });
    }

    function initWorkflowHistory(label = '初期状態') {
      wfHistoryTimeline.value = [{
        id: String(Date.now()),
        label,
        time: formatWorkflowHistoryTime(),
        workflow: snapshotWorkflowState(),
      }];
      wfHistoryIndex.value = 0;
    }

    function restoreWorkflowSnapshot(snapshot) {
      wfHistoryRecording = false;
      const normalized = normalizeWorkflow(cloneJson(snapshot));
      getActiveWf().nodes = normalized.nodes;
      getActiveWf().edges = normalized.edges;
      if (selectedWorkflowNodeId.value && !getActiveWf().nodes.some((n) => n.id === selectedWorkflowNodeId.value)) {
        selectedWorkflowNodeId.value = getActiveWf().nodes[0]?.id || null;
      }
      wfHistoryRecording = true;
    }

    function pushWorkflowHistory(label) {
      if (!wfHistoryRecording || !getActiveWf()) return;
      const trimmed = wfHistoryTimeline.value.slice(0, wfHistoryIndex.value + 1);
      trimmed.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        time: formatWorkflowHistoryTime(),
        workflow: snapshotWorkflowState(),
      });
      if (trimmed.length > 50) trimmed.shift();
      wfHistoryTimeline.value = trimmed;
      wfHistoryIndex.value = trimmed.length - 1;
    }

    function undoWorkflow() {
      if (wfHistoryIndex.value <= 0) return;
      wfHistoryIndex.value -= 1;
      restoreWorkflowSnapshot(wfHistoryTimeline.value[wfHistoryIndex.value].workflow);
      ElementPlus.ElMessage.info('元に戻しました');
    }

    function redoWorkflow() {
      if (wfHistoryIndex.value >= wfHistoryTimeline.value.length - 1) return;
      wfHistoryIndex.value += 1;
      restoreWorkflowSnapshot(wfHistoryTimeline.value[wfHistoryIndex.value].workflow);
      ElementPlus.ElMessage.info('やり直しました');
    }

    function restoreWorkflowHistoryEntry(index) {
      if (index < 0 || index >= wfHistoryTimeline.value.length) return;
      wfHistoryIndex.value = index;
      restoreWorkflowSnapshot(wfHistoryTimeline.value[index].workflow);
      wfChangeHistoryVisible.value = false;
      ElementPlus.ElMessage.success('履歴の状態に復元しました');
    }

    function swapSelectedWorkflowNode(direction) {
      const id = selectedWorkflowNodeId.value;
      if (!id || !getActiveWf()) return;
      const chain = getWorkflowMainChainIds(getActiveWf());
      const idx = chain.indexOf(id);
      if (idx < 0) return;
      const otherIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (otherIdx < 0 || otherIdx >= chain.length) return;
      const firstId = chain[Math.min(idx, otherIdx)];
      const secondId = chain[Math.max(idx, otherIdx)];
      const nodeA = getActiveWf().nodes.find((n) => n.id === firstId);
      const nodeB = getActiveWf().nodes.find((n) => n.id === secondId);
      if (!nodeA || !nodeB) return;
      const tx = nodeA.x;
      const ty = nodeA.y;
      nodeA.x = nodeB.x;
      nodeA.y = nodeB.y;
      nodeB.x = tx;
      nodeB.y = ty;
      if (!swapAdjacentMainChainEdges(getActiveWf(), firstId, secondId)) {
        nodeB.x = nodeA.x;
        nodeB.y = nodeA.y;
        nodeA.x = tx;
        nodeA.y = ty;
        ElementPlus.ElMessage.warning('メインフロー上の隣接ノードのみ入れ替えできます');
        return;
      }
      pushWorkflowHistory('ノード位置を入れ替え');
      ElementPlus.ElMessage.success('ノード位置を入れ替えました');
    }

    const canUndoWorkflow = computed(() => wfHistoryIndex.value > 0);
    const canRedoWorkflow = computed(() => wfHistoryIndex.value < wfHistoryTimeline.value.length - 1);
    const workflowHistoryEntries = computed(() =>
      [...wfHistoryTimeline.value].reverse().map((entry, reverseIdx) => ({
        ...entry,
        index: wfHistoryTimeline.value.length - 1 - reverseIdx,
      })));
    const canSwapWorkflowNodeLeft = computed(() => {
      const id = selectedWorkflowNodeId.value;
      if (!id) return false;
      const chain = getWorkflowMainChainIds(getActiveWf());
      const idx = chain.indexOf(id);
      return idx > 0;
    });
    const canSwapWorkflowNodeRight = computed(() => {
      const id = selectedWorkflowNodeId.value;
      if (!id) return false;
      const chain = getWorkflowMainChainIds(getActiveWf());
      const idx = chain.indexOf(id);
      return idx >= 0 && idx < chain.length - 1;
    });

    const treeProps = { children: 'children', label: 'label' };

    const currentScene = computed(() =>
      scenes.value.find((s) => s.id === currentSceneId.value) || scenes.value[0]
    );
    const sceneArchiveTree = computed(() => {
      const sceneName = (form.scene.name || currentScene.value?.name || '未命名シーン').trim();
      const docs = form.scene.documents || [];
      const docNodes = docs.map((doc, idx) => ({
        id: `doc-${idx}`,
        label: `${getDocDisplayLabel(doc.type)}（${doc.submission}）`,
      }));
      return [
        {
          id: 'scene-root',
          label: sceneName,
          children: [
            { id: 'scene-inbox', label: '入力ファイル', children: docNodes.length ? docNodes : [{ id: 'scene-empty', label: '帳票未設定' }] },
            { id: 'scene-rule', label: '案件Workflow設定', children: [
              { id: 'scene-match', label: 'マスタ照合（Workflow）' },
              { id: 'scene-text', label: `テキスト検証 ${form.verify.text.length} 件` },
              { id: 'scene-data', label: `データ検証 ${form.verify.dataRules.length} 件` },
            ] },
            { id: 'scene-output', label: `出力データセット（${form.output.format}）` },
          ],
        },
      ];
    });

    const nodeIndex = computed(() => NODE_ORDER.indexOf(currentNode.value));
    const isFirstNode = computed(() => nodeIndex.value === 0);
    const isLastNode = computed(() => nodeIndex.value === NODE_ORDER.length - 1);
    const saveButtonText = computed(() => (isLastNode.value ? '設定を完了' : '保存'));

    const sceneStats = computed(() => {
      const docs = form.scene.documents;
      return {
        total: docs.length,
        required: docs.filter((d) => d.submission === '必須').length,
        optional: docs.filter((d) => d.submission === '任意' || d.submission === '代替可').length,
      };
    });

    const outputFieldCount = computed(() => {
      let count = 0;
      (form.output.docFields || []).forEach((doc) => {
        count += (doc.fields || []).filter((f) => f.checked).length;
        (doc.dictFields || []).forEach((df) => {
          if (df.exportCodeChecked) count += 1;
          if (df.exportNameChecked) count += 1;
        });
      });
      return count;
    });
    const outputTableStats = computed(() => {
      let tables = 0;
      let columns = 0;
      (form.output.docFields || []).forEach((doc) => {
        (doc.tables || []).forEach((table) => {
          const checkedCols = (table.columns || []).filter((c) => c.checked).length;
          if (checkedCols) {
            tables += 1;
            columns += checkedCols;
          }
        });
      });
      return { tables, columns };
    });

    const activeOutputDocFields = computed(() => {
      const docs = form.output.docFields || [];
      if (!docs.length) return null;
      return docs.find((d) => d.docType === outputSelectedDocType.value) || docs[0];
    });

    const activeOutputExportRows = computed(() => buildOutputExportRows(activeOutputDocFields.value));

    const exportPreviewRoot = computed(() =>
      buildExportPreviewTree(form.output.docFields || [])
    );

    let exportPreviewWatchCount = 0;
    watch(
      exportPreviewRoot,
      (tree) => {
        exportPreviewWatchCount += 1;
        if (exportPreviewWatchCount <= 20 || exportPreviewWatchCount % 50 === 0) {
          // #region agent log
          fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:export-preview-watch',message:'export preview watch',data:{exportPreviewWatchCount,childCount:(tree?.children||[]).length},timestamp:Date.now(),hypothesisId:'D',runId:'hang-debug'})}).catch(()=>{});
          // #endregion
        }
        collectExportPreviewNodes(tree).forEach((node) => {
          if (exportPreviewChecked[node.id] === undefined) exportPreviewChecked[node.id] = true;
          if (exportPreviewExpanded[node.id] === undefined) exportPreviewExpanded[node.id] = true;
        });
      },
      { immediate: true, deep: true }
    );

    const exportPreviewRows = computed(() =>
      flattenExportPreviewTree(exportPreviewRoot.value, exportPreviewExpanded)
    );

    const exportPreviewSelectAllState = computed(() => {
      const nodes = collectExportPreviewNodes(exportPreviewRoot.value);
      if (!nodes.length) return { checked: false, indeterminate: false };
      const checkedCount = nodes.filter((node) => exportPreviewChecked[node.id]).length;
      return {
        checked: checkedCount === nodes.length,
        indeterminate: checkedCount > 0 && checkedCount < nodes.length,
      };
    });

    watch(
      () => (form.output.docFields || []).map((d) => d.docType).join('\u0001'),
      () => {
        const docs = form.output.docFields || [];
        if (!docs.length) {
          outputSelectedDocType.value = '';
          return;
        }
        if (!docs.some((d) => d.docType === outputSelectedDocType.value)) {
          outputSelectedDocType.value = docs[0].docType;
        }
      },
      { immediate: true }
    );
    const sceneSetupPageTitle = '業務シーン・案件集約';
    const sceneSetupSceneIdDisplay = computed(() =>
      (sceneSetupDraft.sceneId ? sceneSetupDraft.sceneId : '保存後に自動採番されます'));
    const sceneSetupConfirmLabel = computed(() =>
      (sceneSetupMode.value === 'edit' ? '保存して次へ' : '作成して次へ'));
    const sceneSetupDocTypeOptions = computed(() =>
      sceneSetupDraft.documents.map((d) => ({
        value: d.type,
        label: getDocDisplayLabel(d.type),
      })));
    const sceneSetupLinkCheckVisible = ref(false);
    let sceneSetupLinkCheckTimer = null;
    const SCENE_LINK_CHECK_DISPLAY_MS = 3500;

    function clearSceneSetupLinkCheckDisplay() {
      if (sceneSetupLinkCheckTimer) {
        clearTimeout(sceneSetupLinkCheckTimer);
        sceneSetupLinkCheckTimer = null;
      }
      sceneSetupLinkCheckVisible.value = false;
    }

    function flashSceneSetupLinkCheckResult() {
      clearSceneSetupLinkCheckDisplay();
      sceneSetupLinkCheckVisible.value = true;
      sceneSetupLinkCheckTimer = setTimeout(clearSceneSetupLinkCheckDisplay, SCENE_LINK_CHECK_DISPLAY_MS);
    }

    const sceneSetupLinkStats = computed(() =>
      computeSceneLinkStats(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        sceneSetupDraft.docFieldLinks,
      )
    );
    const sceneSetupUnlinkedDocLabels = computed(() =>
      sceneSetupLinkStats.value.unlinkedDocs.map((t) => getDocDisplayLabel(t)).join('、')
    );
    const sceneSetupLinkCheckSummary = computed(() => {
      const stats = sceneSetupLinkStats.value;
      if (stats.unlinkedCount > 0) {
        const names = stats.unlinkedDocs.map((t) => getDocDisplayLabel(t)).join('、');
        return { tone: 'warn', text: `${stats.unlinkedCount} 件が主帳票に未関連：${names}` };
      }
      if (stats.total <= stats.mainDocCount) {
        return { tone: 'ok', text: '主帳票のみの構成です' };
      }
      return { tone: 'ok', text: `${stats.linkedCount} 件の帳票が主帳票に関連付け済み` };
    });
    const sceneSetupNetworkLayout = computed(() =>
      buildSceneSetupNetworkLayout(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType,
        sceneSetupDraft.docFieldLinks,
        getDocDisplayLabel,
        (docType) => getDocSchema(docType).fields || [],
      )
    );

    const selectedHitlRoleHint = computed(() =>
      HITL_ROLE_OPTIONS.find((item) => item.value === processingForm.value?.hitl?.role)?.hint || '復核ロールを選択してください'
    );

    const selectedHitlGateRoleHint = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return '復核ロールを選択してください';
      return HITL_ROLE_OPTIONS.find((item) => item.value === node.role)?.hint || '復核ロールを選択してください';
    });

    function onHitlGateContextChange(contextValue) {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return;
      const meta = getHitlContextMeta(contextValue);
      if (!meta) return;
      node.hitlContext = meta.value;
      node.label = '人工確認';
      node.role = getHitlGateDefaultRole(meta.value);
      pushWorkflowHistory('人工確認コンテキストを変更');
    }

    function isHitlActionSelected(actionValue) {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return false;
      return normalizeHitlGateActions(node.actions).includes(actionValue);
    }

    function toggleHitlAction(actionValue) {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return;
      const current = normalizeHitlGateActions(node.actions);
      if (current.includes(actionValue)) {
        if (current.length <= 1) return;
        node.actions = current.filter((a) => a !== actionValue);
      } else {
        node.actions = [...current, actionValue];
      }
      pushWorkflowHistory('処理アクションを変更');
    }

    function applyJudgmentContextToNode(node, contextValue, force = false) {
      const wf = getActiveWf();
      const meta = JUDGMENT_CONTEXT_OPTIONS.find((o) => o.value === contextValue) || JUDGMENT_CONTEXT_OPTIONS[0];
      node.judgmentContext = meta.value;
      node.conditionType = meta.value;
      node.label = meta.label;
      node.elseLabel = JUDGMENT_ELSE_LABELS[meta.value] || 'ELSE';
      node.elseDescription = node.elseLabel;
      if (meta.value !== 'custom' || force) {
        node.cases = buildDecisionCasesFromPreset(meta.value, wf, node.id, form.verify);
      }
      if (wf) sanitizeDecisionEdges(wf);
    }

    function onJudgmentContextChange(contextValue) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      const prev = node.judgmentContext || inferJudgmentContext(node);
      if (prev === contextValue) return;
      const apply = () => {
        applyJudgmentContextToNode(node, contextValue, true);
        pushWorkflowHistory('判断コンテキストを変更');
      };
      if (prev === 'custom' || contextValue === 'custom') {
        apply();
        return;
      }
      ElementPlus.ElMessageBox.confirm(
        '判断コンテキストを変更すると、IF/ELIF 条件がプリセット既定で上書きされます。続行しますか？',
        '条件の上書き',
        { confirmButtonText: '上書きする', cancelButtonText: 'キャンセル', type: 'warning' },
      ).then(apply).catch(() => {});
    }

    function onDecisionElseLabelChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      node.elseDescription = node.elseLabel || '';
      const wf = getActiveWf();
      if (wf) sanitizeDecisionEdges(wf);
      pushWorkflowHistory('ELSE ラベルを変更');
    }

    function onNotifyTemplateChange(templateValue) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'notify') return;
      const prevTemplate = migrateNotifyTemplate(node.template);
      if (prevTemplate === templateValue) return;
      const apply = () => {
        const defaults = getNotifyTemplateDefaults(templateValue);
        node.template = templateValue;
        node.subject = defaults.subject;
        node.body = defaults.body;
        pushWorkflowHistory('通知プリセットを変更');
      };
      const prevDefaults = getNotifyTemplateDefaults(prevTemplate);
      const hasCustom = (node.subject && node.subject !== prevDefaults.subject)
        || (node.body && node.body !== prevDefaults.body);
      if (!hasCustom) {
        apply();
        return;
      }
      ElementPlus.ElMessageBox.confirm(
        'プリセットを変更すると、件名・本文が既定テンプレートで上書きされます。続行しますか？',
        '通知内容の上書き',
        { confirmButtonText: '上書きする', cancelButtonText: 'キャンセル', type: 'warning' },
      ).then(apply).catch(() => {});
    }

    function onNotifyRecipientsBlur() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'notify') return;
      const result = validateNotifyRecipients(node.channel, node.recipients);
      if (!result.ok && result.message) {
        ElementPlus.ElMessage.warning(result.message);
      }
    }

    function onStartTriggerChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'start') return;
      Object.assign(node, normalizeStartNode(node));
      pushWorkflowHistory('開始トリガーを変更');
    }

    function toggleStartCaseEvent(enabled) {
      const node = selectedWorkflowNode.value;
      if (!node?.triggerConfig) return;
      if (enabled) {
        if (!node.triggerConfig.caseEvents?.length) {
          node.triggerConfig.caseEvents = ['SUPPLEMENT'];
        }
      } else {
        node.triggerConfig.caseEvents = [];
      }
      onStartTriggerChange();
    }

    function toggleStartSchedule(enabled) {
      const node = selectedWorkflowNode.value;
      if (!node?.triggerConfig) return;
      node.triggerConfig.schedule = enabled ? {
        mode: 'fixed',
        fixedTime: '09:00',
        runOnWeekdays: true,
        intervalValue: 30,
        intervalUnit: 'minutes',
      } : null;
      onStartTriggerChange();
    }

    function onEndNamingChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'end') return;
      Object.assign(node, normalizeEndNode(node));
      pushWorkflowHistory('終了ノードの命名規則を変更');
    }

    function insertEndNamingToken(token) {
      const node = selectedWorkflowNode.value;
      if (!node?.namingConfig) return;
      node.namingConfig.pattern = `${node.namingConfig.pattern || ''}${token}`;
      onEndNamingChange();
    }

    const codeVariableOptions = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'code') return [];
      return buildCodeVariableOptions(getActiveWf(), node.id, form.verify);
    });

    const codeVariableOptionGroups = computed(() =>
      getDecisionVariableOptionGroups(codeVariableOptions.value));

    const codeParamDialogVisible = ref(false);
    const codeParamDialogMode = ref('input');
    const codeParamDialogDraft = ref(createCodeParamDialogDraft('input'));

    const codeParamDialogTitle = computed(() => {
      const editing = !!codeParamDialogDraft.value?.id;
      return editing ? 'パラメータを編集' : 'パラメータを追加';
    });

    const codeParamDialogConfirmLabel = computed(() =>
      (codeParamDialogDraft.value?.id ? '保存' : '追加'));

    const codeParamDialogSavable = computed(() => {
      const draft = codeParamDialogDraft.value;
      if (!draft?.name?.trim()) return false;
      if (draft.source === 'reference') return !!draft.variable;
      return !!(draft.customValue || '').trim();
    });

    function openCodeParamDialog(mode = 'input', row = null) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'code') return;
      codeParamDialogMode.value = 'input';
      if (row) {
        codeParamDialogDraft.value = {
          id: row.id,
          name: row.name,
          dataType: row.dataType || 'string',
          source: row.source || 'reference',
          required: row.required !== false,
          variable: row.variable || '',
          customValue: row.customValue || '',
        };
      } else {
        const draft = createCodeParamDialogDraft('input');
        const count = (node.inputs || []).length;
        draft.name = `input_${count + 1}`;
        codeParamDialogDraft.value = draft;
      }
      codeParamDialogVisible.value = true;
    }

    function closeCodeParamDialog() {
      codeParamDialogVisible.value = false;
    }

    function confirmCodeParamDialog() {
      const node = selectedWorkflowNode.value;
      const draft = codeParamDialogDraft.value;
      if (!node || node.type !== 'code' || !codeParamDialogSavable.value) return;
      if (!Array.isArray(node.inputs)) node.inputs = [];
      const payload = normalizeCodeInputRow({
        id: draft.id || newRuleId('cin'),
        name: draft.name.trim(),
        dataType: draft.dataType,
        source: draft.source,
        required: draft.required,
        variable: draft.source === 'reference' ? draft.variable : '',
        customValue: draft.source === 'custom' ? draft.customValue : '',
      }, node.inputs.length);
      const idx = node.inputs.findIndex((r) => r.id === draft.id);
      if (idx >= 0) node.inputs[idx] = payload;
      else node.inputs.push(payload);
      pushWorkflowHistory(draft.id ? '入参を更新' : '入参を追加');
      codeParamDialogVisible.value = false;
    }

    function addCodeInputRow() {
      openCodeParamDialog('input');
    }

    function removeCodeInputRow(rowId) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'code' || !node.inputs?.length) return;
      node.inputs = node.inputs.filter((r) => r.id !== rowId);
      pushWorkflowHistory('入参を削除');
    }

    function onCodeFieldChange() {
      pushWorkflowHistory('カスタム関数を変更');
    }

    const workflowConditionAiLoading = ref(false);
    const workflowConditionPreviewFlash = ref(false);

    function aiAssistWorkflowCondition() {
      const node = selectedWorkflowNode.value;
      if (!node || (node.type !== 'decision' && !isHitlGateNode(node))) return;
      const rule = (node.yesRule || '').trim();
      if (!rule) {
        ElementPlus.ElMessage.warning('条件を入力してください');
        return;
      }
      workflowConditionAiLoading.value = true;
      setTimeout(() => {
        const compiled = compileWorkflowYesExpression(rule, node.conditionType, sceneDocTypes.value, node);
        const isPresetFallback = !compileNaturalToExpression(rule, sceneDocTypes.value)
          && !/\{\{[^}]+\}\}/.test(rule)
          && compiled === (DECISION_PRESET_EXPRESSION[node.conditionType] || '');
        if (!compiled || compiled === rule) {
          ElementPlus.ElMessage.warning('実行式に変換できませんでした。帳票名・フィールド・判定基準を明確に記述してください');
          workflowConditionAiLoading.value = false;
          return;
        }
        node.yesExpression = compiled;
        syncDecisionYesRuleToCases(node);
        workflowConditionPreviewFlash.value = true;
        setTimeout(() => { workflowConditionPreviewFlash.value = false; }, 1600);
        workflowConditionAiLoading.value = false;
        pushWorkflowHistory('AI 補助で実行式を生成');
        ElementPlus.ElMessage.success(isPresetFallback ? 'プリセット既定の実行式を適用しました' : '実行式を生成しました');
      }, 400);
    }

    function ensureOcrExtractConfig() {
      const pf = processingForm.value;
      if (!pf.ocrExtract) {
        pf.ocrExtract = { enabledTypes: [] };
      }
    }

    function isOcrExtractEnabled(typeId) {
      ensureOcrExtractConfig();
      const pf = processingForm.value;
      const types = form.scene.documents.map((d) => d.type);
      if (!types.includes(typeId)) return false;
      const enabled = pf.ocrExtract.enabledTypes;
      if (!enabled.length) return true;
      return enabled.includes(typeId);
    }

    function toggleOcrExtract(typeId, enabled) {
      ensureOcrExtractConfig();
      const pf = processingForm.value;
      const allTypes = form.scene.documents.map((d) => d.type);
      let enabledTypes = [...pf.ocrExtract.enabledTypes];
      if (!enabledTypes.length) enabledTypes = [...allTypes];
      if (enabled) {
        if (!enabledTypes.includes(typeId)) enabledTypes.push(typeId);
      } else {
        enabledTypes = enabledTypes.filter((t) => t !== typeId);
      }
      pf.ocrExtract.enabledTypes = enabledTypes;
    }

    function syncOcrExtractTypes() {
      syncOcrExtractTypesOnForm(form);
    }

    const ocrExtractItems = computed(() => {
      const mainDocType = getSceneMainDocType(form.scene);
      return form.scene.documents.map((d) => ({
        type: d.type,
        isMainDoc: d.type === mainDocType,
        enabled: isOcrExtractEnabled(d.type),
      }));
    });

    const ocrExtractStats = computed(() => {
      const items = ocrExtractItems.value;
      const enabledItems = items.filter((i) => i.enabled);
      return {
        total: items.length,
        enabled: enabledItems.length,
        disabled: items.length - enabledItems.length,
      };
    });

    const sceneDocTypes = computed(() => form.scene.documents.map((d) => d.type));

    const selectedWorkflowNode = computed(() =>
      (getActiveWf()?.nodes || []).find((n) => n.id === selectedWorkflowNodeId.value) || null
    );

    const inspectorPanel = computed(() => {
      if (inspectorMode.value === 'edge') return 'edge';
      if (inspectorMode.value === 'scene') return 'scene';
      if (inspectorMode.value === 'overview') return 'overview';
      const node = selectedWorkflowNode.value;
      if (!node) return 'overview';
      return WORKFLOW_INSPECTOR_MAP[node.type] || 'overview';
    });

    const inspectorTitle = computed(() => {
      if (inspectorMode.value === 'edge') return '接続設定';
      if (inspectorPanel.value === 'overview') return 'ワークフロー概要';
      if (inspectorPanel.value === 'scene') return 'シーン設定';
      if (inspectorPanel.value === 'case_link') return '業務シーン';
      if (inspectorPanel.value === 'scene_aggregate') return '案件集約';
      if (inspectorPanel.value === 'scene_completeness') return '完全性検査';
      if (inspectorPanel.value === 'master_match') return 'マスタ照合';
      if (inspectorPanel.value === 'mcp') return 'MCP';
      if (inspectorPanel.value === 'ocr') return 'OCR抽出';
      if (inspectorPanel.value === 'decision') return 'IF/ELSE';
      if (inspectorPanel.value === 'hitl_gate') return '人工確認';
      if (inspectorPanel.value === 'notify') return '通知';
      if (inspectorPanel.value === 'code') return 'カスタム関数';
      if (inspectorPanel.value === 'start') return '開始';
      if (inspectorPanel.value === 'end') return '終了';
      const node = selectedWorkflowNode.value;
      if (node?.label) return node.label;
      const lib = FLOW_NODE_OPTIONS[getFlowNodeKey()]?.find((l) => l.type === node?.type);
      return lib?.label || getWorkflowNodeMeta(node?.type).title || 'ノード設定';
    });

    const inspectorHeadHint = computed(() => {
      if (inspectorMode.value === 'edge') {
        return isWorkflowTopologyEditable.value ? INSPECTOR_HINTS.edgeEdit : INSPECTOR_HINTS.edgeReadonly;
      }
      if (inspectorMode.value === 'overview' || inspectorPanel.value === 'overview') {
        return 'ノードをクリックすると設定パネルが表示されます。';
      }
      const hintKey = INSPECTOR_HEAD_HINT_KEYS[inspectorPanel.value];
      return hintKey ? (INSPECTOR_HINTS[hintKey] || '') : '';
    });

    const workflowNodeOutputVars = computed(() =>
      getWorkflowNodeOutputVarItems(selectedWorkflowNode.value, getActiveWf()),
    );

    const showWorkflowNodeOutputSection = computed(() => {
      if (inspectorMode.value !== 'node' || !selectedWorkflowNode.value) return false;
      if (['edge', 'overview', 'scene', 'decision', 'hitl_gate', 'notify', 'start', 'end'].includes(inspectorPanel.value)) return false;
      return workflowNodeOutputVars.value.length > 0;
    });

    const workflowNodeOutputHint = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node) return INSPECTOR_HINTS.nodeOutput;
      const key = WORKFLOW_NODE_OUTPUT_HINT_KEYS[node.type] || 'nodeOutput';
      return INSPECTOR_HINTS[key] || INSPECTOR_HINTS.nodeOutput;
    });

    const workflowOverviewSummary = computed(() => {
      const wf = getActiveWf();
      const nodes = wf?.nodes || [];
      const chainIds = getWorkflowMainChainIds(wf);
      const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const chainLabels = chainIds.map((id) => {
        const n = nodeMap[id];
        return n ? getWorkflowNodeDisplayLabel(n) : id;
      });
      return {
        nodeCount: nodes.length,
        edgeCount: (wf?.edges || []).length,
        chainLabels,
        startNode: getWorkflowStartNode(wf),
      };
    });

    const wfLibraryFilteredGroups = computed(() => {
      const q = wfLibrarySearch.value.trim().toLowerCase();
      return CASE_FLOW_NODE_GROUPS.map((group) => ({
        category: group.category,
        nodes: group.nodes.filter((n) => {
          if (!q) return true;
          const meta = getWorkflowNodeMeta(n.type);
          return [n.label, n.summary || '', meta.title, meta.desc || ''].some(
            (s) => String(s).toLowerCase().includes(q),
          );
        }),
      })).filter((g) => g.nodes.length);
    });

    const selectedWorkflowEdge = computed(() => {
      if (!selectedWorkflowEdgeKey.value) return null;
      return (getActiveWf()?.edges || []).find((e) => workflowEdgeKey(e) === selectedWorkflowEdgeKey.value) || null;
    });

    const workflowNodeOptions = computed(() => (excludeId) =>
      (getActiveWf()?.nodes || [])
        .filter((n) => n.id !== excludeId)
        .map((n) => ({
          value: n.id,
          label: getWorkflowNodeDisplayLabel(n),
        })));

    function workflowEdgeKey(edge) {
      return `${edge.from}|${edge.to}|${edge.branch || ''}`;
    }

    function getWorkflowEdgeSummary(edge) {
      if (!edge) return '';
      const nodes = getActiveWf()?.nodes || [];
      const from = nodes.find((n) => n.id === edge.from);
      const to = nodes.find((n) => n.id === edge.to);
      const fromLabel = from ? getWorkflowNodeDisplayLabel(from) : edge.from;
      const toLabel = to ? getWorkflowNodeDisplayLabel(to) : edge.to;
      const branch = edge.branch ? `（${edge.label || edge.branch.toUpperCase()}）` : '';
      return `${fromLabel} → ${toLabel}${branch}`;
    }

    function isDecisionConditionAuto(node) {
      return node?.type === 'decision' && node.conditionType !== 'custom';
    }

    function isDecisionConditionPreset(condition) {
      return !!condition?.preset && condition.preset !== 'custom';
    }

    function isDecisionCasePreset(decisionCase) {
      return (decisionCase?.conditions || []).some((c) => isDecisionConditionPreset(c));
    }

    let workflowEdgePathsEvalCount = 0;
    const workflowEdgePaths = computed(() => {
      workflowEdgePathsEvalCount += 1;
      if (workflowEdgePathsEvalCount <= 20 || workflowEdgePathsEvalCount % 100 === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:workflowEdgePaths',message:'workflowEdgePaths eval',data:{workflowEdgePathsEvalCount,edgeCount:(getActiveWf()?.edges||[]).length},timestamp:Date.now(),hypothesisId:'F',runId:'hang-debug'})}).catch(()=>{});
        // #endregion
      }
      const nodes = getActiveWf()?.nodes || [];
      const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const PORT = 6;

      return (getActiveWf()?.edges || []).map((edge) => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        if (from.type === 'decision' && !edge.branch) return null;
        const fromTasks = getWorkflowNodeActiveTasks(from);
        const toTasks = getWorkflowNodeActiveTasks(to);
        const fromSize = getWorkflowNodeSize(from, fromTasks.length, fromTasks);
        const toSize = getWorkflowNodeSize(to, toTasks.length, toTasks);
        const toCy = to.y + toSize.h / 2;

        let x1; let y1; let x2; let y2;
        if (from.type === 'decision' && edge.branch) {
          const start = getWorkflowPortPosition(from, edge.branch);
          x1 = start.x;
          y1 = start.y;
          x2 = to.x - PORT;
          y2 = toCy;
        } else {
          x1 = from.x + fromSize.w + PORT;
          y1 = from.y + fromSize.h / 2;
          x2 = to.x - PORT;
          y2 = toCy;
        }

        const d = wfBezierPath(x1, y1, x2, y2);
        const mid = wfBezierPoint(x1, y1, x2, y2, 0.5);
        const labelAnchor = wfBezierPoint(x1, y1, x2, y2, from.type === 'decision' && edge.branch ? 0.32 : 0.42);

        const branchLabel = from.type === 'decision' && edge.branch
          ? getDecisionBranchEdgeLabel(edge.branch, from)
          : (edge.label || '');
        const label = branchLabel;
        const labelClass = from.type === 'decision' && edge.branch === 'if'
          ? 'idp-edge-label--yes'
          : from.type === 'decision' && edge.branch === 'else'
            ? 'idp-edge-label--no'
            : '';

        return {
          d,
          label,
          labelClass,
          lx: labelAnchor.x,
          ly: labelAnchor.y - 14,
          mx: mid.x,
          my: mid.y,
          key: workflowEdgeKey(edge),
          edge,
        };
      }).filter(Boolean);
    });

    const wfCanvasStageStyle = computed(() => ({
      transform: `translate(${wfViewport.x}px, ${wfViewport.y}px) scale(${wfViewport.scale})`,
      transformOrigin: '0 0',
    }));

    const wfZoomPercent = computed(() => Math.round(wfViewport.scale * 100));

    const workflowStageSize = computed(() => {
      const bounds = getWorkflowBounds();
      return {
        width: Math.max(2400, bounds.maxX + 120),
        height: Math.max(900, bounds.maxY + 120),
      };
    });

    function getWorkflowBounds(padding = 48) {
      const nodes = getActiveWf()?.nodes || [];
      if (!nodes.length) {
        return { minX: 0, minY: 0, maxX: 1200, maxY: 600, width: 1200, height: 600 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      nodes.forEach((node) => {
        const tasks = getWorkflowNodeActiveTasks(node);
        const size = getWorkflowNodeSize(node, tasks.length, tasks);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + size.w + 20);
        maxY = Math.max(maxY, node.y + size.h + 20);
      });
      return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      };
    }

    function clampWorkflowZoom(scale) {
      return Math.min(WF_ZOOM_MAX, Math.max(WF_ZOOM_MIN, scale));
    }

    function screenToWorkflowCoords(clientX, clientY) {
      const el = wfCanvasViewportRef.value;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left - wfViewport.x) / wfViewport.scale,
        y: (clientY - rect.top - wfViewport.y) / wfViewport.scale,
      };
    }

    function fitWorkflowToView() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      const bounds = getWorkflowBounds(64);
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (!vw || !vh) return;
      const scale = clampWorkflowZoom(Math.min(vw / bounds.width, vh / bounds.height) * 0.92);
      wfViewport.scale = scale;
      wfViewport.x = (vw - bounds.width * scale) / 2 - bounds.minX * scale;
      wfViewport.y = (vh - bounds.height * scale) / 2 - bounds.minY * scale;
    }

    function zoomWorkflowAt(clientX, clientY, factor) {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const nextScale = clampWorkflowZoom(wfViewport.scale * factor);
      const ratio = nextScale / wfViewport.scale;
      wfViewport.x = px - (px - wfViewport.x) * ratio;
      wfViewport.y = py - (py - wfViewport.y) * ratio;
      wfViewport.scale = nextScale;
    }

    function zoomWorkflowIn() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      zoomWorkflowAt(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2, WF_ZOOM_STEP);
    }

    function zoomWorkflowOut() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      zoomWorkflowAt(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2, 1 / WF_ZOOM_STEP);
    }

    function resetWorkflowZoom() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      zoomWorkflowAt(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2, 1 / wfViewport.scale);
    }

    function onWfViewportWheel(event) {
      zoomWorkflowAt(event.clientX, event.clientY, event.deltaY > 0 ? 1 / WF_ZOOM_STEP : WF_ZOOM_STEP);
    }

    function openWorkflowInspector(mode = 'node') {
      inspectorPanelCollapsed.value = false;
      inspectorMode.value = mode;
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_STORAGE_KEY, '0');
      } catch (e) { /* ignore */ }
    }

    function closeWorkflowInspector() {
      inspectorPanelCollapsed.value = true;
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_STORAGE_KEY, '1');
      } catch (e) { /* ignore */ }
    }

    function onWfViewportPointerDown(event) {
      if (event.target.closest('.wf-node') || event.target.closest('.idp-edge-path') || event.target.closest('.wf-node-picker') || event.target.closest('.wf-canvas-toolbar')) return;
      closeWfNodePicker();
      wfConnectSourceId.value = null;
      if (wfConnectDrag.fromId) return;
      selectedWorkflowEdgeKey.value = null;
      selectedWorkflowNodeId.value = null;
      syncCurrentNodeFromWorkflow(null);
      closeWorkflowInspector();
      if (event.button !== 0) return;
      wfPanDrag.active = true;
      wfPanDrag.startX = event.clientX;
      wfPanDrag.startY = event.clientY;
      wfPanDrag.originX = wfViewport.x;
      wfPanDrag.originY = wfViewport.y;
      document.body.classList.add('wf-panning');
      const onMove = (ev) => {
        if (!wfPanDrag.active) return;
        wfViewport.x = wfPanDrag.originX + ev.clientX - wfPanDrag.startX;
        wfViewport.y = wfPanDrag.originY + ev.clientY - wfPanDrag.startY;
      };
      const onUp = () => {
        wfPanDrag.active = false;
        document.body.classList.remove('wf-panning');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function workflowTerminalTypeExists(type) {
      return (getActiveWf()?.nodes || []).some((n) => n.type === type);
    }

    function warnWorkflowTerminalLimit(type) {
      const label = type === 'start' ? '開始' : '終了';
      ElementPlus.ElMessage.warning(`${label}ノードは1つのみ追加できます`);
    }

    function createWorkflowNodeAt(type, x, y) {
      const meta = getWorkflowNodeMeta(type);
      const id = newRuleId('wf');
      const base = {
        id,
        type,
        x: Math.max(8, x),
        y: Math.max(8, y),
        label: meta?.title || type,
      };
      let node;
      if (type === 'start') {
        if (workflowTerminalTypeExists('start')) {
          warnWorkflowTerminalLimit('start');
          return null;
        }
        node = normalizeStartNode({ ...base, isStart: true });
      } else if (type === 'end') {
        if (workflowTerminalTypeExists('end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        node = normalizeEndNode({ ...base, isEnd: true });
      } else if (type === 'decision') {
        node = normalizeDecisionNode({ ...base, label: '条件判断', judgmentContext: 'custom' }, getActiveWf(), form.verify);
      } else if (type === 'hitl_gate') node = normalizeHitlGateNode(base);
      else if (type === 'notify') node = normalizeNotifyNode(base);
      else if (type === 'code') node = normalizeCodeNode(base, getActiveWf());
      else if (type === 'mcp') node = normalizeMcpNode(base, getActiveWf());
      else if (type === 'master_match') node = normalizeMasterMatchNode(base, getActiveWf());
      else node = ensureWorkflowNodeVarName(base, getActiveWf());
      getActiveWf().nodes.push(node);
      if (type === 'start') ensureWorkflowStartNode(getActiveWf());
      selectWorkflowNode(id);
      pushWorkflowHistory('ノードを追加');
      return id;
    }

    function addWorkflowNodeFromLibrary(type) {
      const last = getActiveWf()?.nodes?.slice(-1)[0];
      if (last) {
        insertWorkflowNodeAfter(last.id, { kind: 'process', type });
      } else {
        createWorkflowNodeAt(type, 40, 220);
      }
    }

    function showWfNodeAddBtn(node) {
      if (!isWorkflowTopologyEditable.value) return false;
      return node && !isWorkflowTerminalNode(node) && node.type !== 'decision';
    }

    function workflowCoordsToScreen(x, y) {
      const el = wfCanvasViewportRef.value;
      if (!el) return { x: 120, y: 120 };
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + wfViewport.x + x * wfViewport.scale,
        y: rect.top + wfViewport.y + y * wfViewport.scale,
      };
    }

    function openWfNodePickerAt(node, side = 'after') {
      if (!node) return;
      const tasks = getWorkflowNodeActiveTasks(node);
      const size = getWorkflowNodeSize(node, tasks.length, tasks);
      const wx = side === 'before' ? node.x - 8 : node.x + size.w + 8;
      const wy = node.y + size.h / 2;
      const screen = workflowCoordsToScreen(wx, wy);
      wfNodePicker.fromNodeId = node.id;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = null;
      wfNodePicker.side = side === 'before' ? 'before' : 'after';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      wfNodePicker.screenX = side === 'before'
        ? Math.max(8, screen.x - 280)
        : Math.min(window.innerWidth - 300, screen.x);
      wfNodePicker.screenY = Math.max(8, screen.y - 24);
      wfNodePicker.visible = true;
    }

    function openWfNodePickerFromShortcut() {
      if (!assertWorkflowTopologyEditable()) return;
      if (wfNodePicker.visible) {
        closeWfNodePicker();
        return;
      }
      const wf = getActiveWf();
      if (selectedWorkflowEdge.value) {
        const edge = selectedWorkflowEdge.value;
        wfNodePicker.fromNodeId = edge.from;
        wfNodePicker.toNodeId = edge.to;
        wfNodePicker.edgeBranch = edge.branch || null;
        wfNodePicker.edgeKey = workflowEdgeKey(edge);
        wfNodePicker.side = 'on-edge';
        wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
        wfNodePicker.hoveredLogic = null;
        const from = wf.nodes.find((n) => n.id === edge.from);
        const to = wf.nodes.find((n) => n.id === edge.to);
        const mid = from && to
          ? workflowCoordsToScreen((from.x + to.x) / 2, (from.y + to.y) / 2)
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        wfNodePicker.screenX = Math.min(window.innerWidth - 300, mid.x);
        wfNodePicker.screenY = Math.max(8, mid.y - 24);
        wfNodePicker.visible = true;
        return;
      }
      let node = selectedWorkflowNode.value;
      if (!node) {
        const chain = getWorkflowMainChainIds(wf);
        const id = chain[chain.length - 1] || wf.nodes[0]?.id;
        node = wf.nodes.find((n) => n.id === id);
      }
      if (!node) return;
      openWfNodePickerAt(node, 'after');
    }

    function resolveWfPickerAnchorRect(anchor) {
      if (!anchor) return null;
      if (typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
      if (anchor.currentTarget?.getBoundingClientRect) return anchor.currentTarget.getBoundingClientRect();
      return null;
    }

    function openWfNodePicker(node, anchor, side = 'after') {
      if (!assertWorkflowTopologyEditable()) return;
      wfNodePicker.fromNodeId = node.id;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = null;
      wfNodePicker.side = side === 'before' ? 'before' : 'after';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      const rect = resolveWfPickerAnchorRect(anchor);
      if (!rect) {
        openWfNodePickerAt(node, side);
        return;
      }
      if (side === 'before') {
        wfNodePicker.screenX = Math.max(8, rect.left - 280);
        wfNodePicker.screenY = Math.max(8, rect.top - 8);
      } else {
        wfNodePicker.screenX = rect.right + 8;
        wfNodePicker.screenY = Math.max(8, rect.top - 8);
      }
      wfNodePicker.visible = true;
    }

    function openWfNodePickerForDecisionBranch(node, branchKey, anchor) {
      if (!assertWorkflowTopologyEditable()) return;
      if (!node || node.type !== 'decision') return;
      const branches = getDecisionNodeBranches(node);
      const match = branches.find((b) => b.key === branchKey);
      const ratio = match?.ratio ?? 0.5;
      const size = getWorkflowNodeSize(node);
      const screen = workflowCoordsToScreen(node.x + size.w + 8, node.y + size.h * ratio);
      wfNodePicker.fromNodeId = node.id;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = branchKey;
      wfNodePicker.side = 'branch';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      const rect = resolveWfPickerAnchorRect(anchor);
      wfNodePicker.screenX = rect
        ? Math.min(window.innerWidth - 300, rect.right + 8)
        : Math.min(window.innerWidth - 300, screen.x);
      wfNodePicker.screenY = rect
        ? Math.max(8, rect.top - 8)
        : Math.max(8, screen.y - 24);
      wfNodePicker.visible = true;
    }

    function closeWfNodePicker() {
      wfNodePicker.visible = false;
      wfNodePicker.fromNodeId = null;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = null;
      wfNodePicker.hoveredLogic = null;
    }

    function openWfNodePickerOnEdge(edge, event) {
      if (!assertWorkflowTopologyEditable()) return;
      wfNodePicker.fromNodeId = edge.from;
      wfNodePicker.toNodeId = edge.to;
      wfNodePicker.edgeBranch = edge.branch || null;
      wfNodePicker.edgeKey = workflowEdgeKey(edge);
      wfNodePicker.side = 'on-edge';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      const rect = event.currentTarget.getBoundingClientRect();
      wfNodePicker.screenX = Math.min(window.innerWidth - 300, rect.right + 8);
      wfNodePicker.screenY = Math.max(8, rect.top - 8);
      wfNodePicker.visible = true;
      selectedWorkflowEdgeKey.value = workflowEdgeKey(edge);
      selectedWorkflowNodeId.value = null;
      inspectorMode.value = 'edge';
    }

    function onWorkflowEdgeMouseEnter(edgeKey) {
      hoveredWorkflowEdgeKey.value = edgeKey;
    }

    function onWorkflowEdgeMouseLeave(edgeKey) {
      if (hoveredWorkflowEdgeKey.value === edgeKey) hoveredWorkflowEdgeKey.value = null;
    }

    function isWorkflowEdgeInsertVisible(edgeKey) {
      return hoveredWorkflowEdgeKey.value === edgeKey || selectedWorkflowEdgeKey.value === edgeKey;
    }

    function buildWorkflowNodeFromPayload(payload, x, y, wf) {
      const newId = newRuleId('wf');
      if (payload.kind === 'terminal' || payload.type === 'start' || payload.type === 'end') {
        const terminalType = payload.type;
        if (terminalType === 'start') {
          if (wf?.nodes?.some((n) => n.type === 'start')) {
            warnWorkflowTerminalLimit('start');
            return null;
          }
          return normalizeStartNode({
            id: newId,
            type: 'start',
            x,
            y,
            label: payload.label || '開始',
            isStart: true,
          });
        }
        if (wf?.nodes?.some((n) => n.type === 'end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        return normalizeEndNode({
          id: newId,
          type: 'end',
          x,
          y,
          label: payload.label || '終了',
          isEnd: true,
        });
      }
      if (payload.kind === 'logic') {
        return normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x,
          y: y + 12,
          label: '条件判断',
          judgmentContext: 'custom',
          conditionType: 'custom',
        }, wf, form.verify);
      }
      if (payload.type === 'hitl_gate') {
        const preset = HITL_CONTEXT_OPTIONS.find((t) => t.value === payload.defaultPreset) || HITL_CONTEXT_OPTIONS[0];
        return normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x,
          y,
          hitlContext: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      }
      if (payload.type === 'notify') {
        return normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x,
          y,
          template: payload.defaultNotifyTemplate || 'supplement',
        });
      }
      if (payload.type === 'code') {
        return normalizeCodeNode({ id: newId, type: 'code', x, y, label: 'カスタム関数' }, wf);
      }
      if (payload.type === 'mcp') {
        return normalizeMcpNode({ id: newId, type: 'mcp', x, y, label: 'MCP' }, wf);
      }
      if (payload.type === 'master_match') {
        return normalizeMasterMatchNode({
          id: newId,
          type: 'master_match',
          x,
          y,
          label: 'マスタ照合',
          matchFieldIds: [],
          matchStrategy: 'code',
        }, wf);
      }
      const meta = getWorkflowNodeMeta(payload.type);
      return ensureWorkflowNodeVarName({
        id: newId,
        type: payload.type,
        x,
        y,
        label: meta.title,
      }, wf);
    }

    function insertWorkflowNodeOnEdge(edge, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const from = wf?.nodes?.find((n) => n.id === edge.from);
      const to = wf?.nodes?.find((n) => n.id === edge.to);
      if (!from || !to || !edge) return null;

      const edgeIdx = wf.edges.findIndex((e) => workflowEdgeKey(e) === workflowEdgeKey(edge));
      if (edgeIdx < 0) return null;

      const fromTasks = getWorkflowNodeActiveTasks(from);
      const fromSize = getWorkflowNodeSize(from, fromTasks.length, fromTasks);
      const toTasks = getWorkflowNodeActiveTasks(to);
      const toSize = getWorkflowNodeSize(to, toTasks.length, toTasks);

      const newNode = buildWorkflowNodeFromPayload(
        payload,
        from.x + fromSize.w + WF_NODE_GAP,
        Math.round((from.y + fromSize.h / 2 + to.y + toSize.h / 2) / 2 - 44),
        wf,
      );
      if (!newNode) return null;
      const newSize = getWorkflowNodeSize(newNode, getWorkflowNodeActiveTasks(newNode).length, getWorkflowNodeActiveTasks(newNode));
      const neededRight = from.x + fromSize.w + WF_NODE_GAP + newSize.w + WF_NODE_GAP;
      if (to.x < neededRight) {
        shiftWorkflowNodesRight(to.id, neededRight - to.x, wf);
      }
      newNode.x = from.x + fromSize.w + WF_NODE_GAP;
      newNode.y = Math.round((from.y + fromSize.h / 2 + to.y + toSize.h / 2) / 2 - newSize.h / 2);

      wf.edges.splice(edgeIdx, 1);
      if (from.type === 'decision' && edge.branch) {
        wf.edges.push({
          from: edge.from,
          to: newNode.id,
          branch: edge.branch,
          label: edge.label || getDecisionBranchEdgeLabel(edge.branch, from),
        });
      } else {
        wf.edges.push({ from: edge.from, to: newNode.id });
      }
      if (payload.kind === 'logic') {
        wf.edges.push({
          from: newNode.id,
          to: edge.to,
          branch: 'else',
          label: getDecisionBranchEdgeLabel('else', newNode),
        });
      } else {
        wf.edges.push({ from: newNode.id, to: edge.to });
      }

      wf.nodes.push(newNode);
      if (payload.kind === 'terminal' && payload.type === 'start') ensureWorkflowStartNode(wf);
      closeWfNodePicker();
      selectWorkflowNode(newNode.id);
      pushWorkflowHistory(payload.kind === 'logic' ? '接続線にロジックノードを挿入' : '接続線にノードを挿入');
      nextTick(() => fitWorkflowToView());
      return newNode.id;
    }

    function shiftWorkflowNodesRight(fromId, delta, workflow = getActiveWf()) {
      const wf = workflow;
      if (!wf || !delta) return;
      const visited = new Set();
      const queue = [fromId];
      while (queue.length) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const node = wf.nodes.find((n) => n.id === id);
        if (node) node.x += delta;
        wf.edges.filter((e) => e.from === id).forEach((e) => queue.push(e.to));
      }
    }

    function insertWorkflowNodeBefore(toId, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const to = wf?.nodes?.find((n) => n.id === toId);
      if (!to || !payload) return null;

      if (payload.kind === 'terminal' && payload.type === 'start') {
        if (workflowTerminalTypeExists('start')) {
          warnWorkflowTerminalLimit('start');
          return null;
        }
        const newId = newRuleId('wf');
        const newNode = normalizeStartNode({
          id: newId,
          type: 'start',
          x: to.x,
          y: to.y - WORKFLOW_NODE_SIZE.terminal.h - WF_NODE_GAP,
          label: payload.label || '開始',
          isStart: true,
        });
        const incomingEdges = wf.edges.filter((e) => e.to === toId);
        incomingEdges.forEach((edge) => { edge.to = newId; });
        wf.nodes.push(newNode);
        wf.edges.push({ from: newId, to: toId });
        ensureWorkflowStartNode(wf);
        closeWfNodePicker();
        selectWorkflowNode(newId);
        pushWorkflowHistory('開始ノードを挿入');
        nextTick(() => fitWorkflowToView());
        return newId;
      }

      const newId = newRuleId('wf');
      let newNode;

      if (payload.kind === 'terminal' && payload.type === 'end') {
        if (workflowTerminalTypeExists('end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        newNode = normalizeEndNode({
          id: newId,
          type: 'end',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          label: payload.label || '終了',
          isEnd: true,
        });
      } else if (payload.kind === 'logic') {
        newNode = normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x: to.x - WF_NODE_GAP,
          y: to.y + 12,
          label: '条件判断',
          judgmentContext: 'custom',
          conditionType: 'custom',
        }, wf, form.verify);
      } else if (payload.type === 'hitl_gate') {
        const preset = HITL_CONTEXT_OPTIONS.find((t) => t.value === payload.defaultPreset) || HITL_CONTEXT_OPTIONS[0];
        newNode = normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          hitlContext: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      } else if (payload.type === 'notify') {
        newNode = normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          template: payload.defaultNotifyTemplate || 'supplement',
        });
      } else if (payload.type === 'code') {
        newNode = normalizeCodeNode({
          id: newId,
          type: 'code',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          label: 'カスタム関数',
        }, wf);
      } else {
        const meta = getWorkflowNodeMeta(payload.type);
        newNode = ensureWorkflowNodeVarName({
          id: newId,
          type: payload.type,
          x: to.x - WF_NODE_GAP,
          y: to.y,
          label: meta.title,
        }, wf);
      }

      const newSize = getWorkflowNodeSize(newNode, getWorkflowNodeActiveTasks(newNode).length, getWorkflowNodeActiveTasks(newNode));
      shiftWorkflowNodesRight(toId, newSize.w + WF_NODE_GAP);
      newNode.x = to.x - newSize.w - WF_NODE_GAP;

      const incomingEdges = wf.edges.filter((e) => e.to === toId);
      incomingEdges.forEach((edge) => { edge.to = newId; });
      wf.nodes.push(newNode);
      if (payload.kind === 'logic') {
        wf.edges.push({
          from: newId,
          to: toId,
          branch: 'else',
          label: getDecisionBranchEdgeLabel('else', newNode),
        });
      } else {
        wf.edges.push({ from: newId, to: toId });
      }

      closeWfNodePicker();
      selectWorkflowNode(newId);
      pushWorkflowHistory(payload.kind === 'logic' ? 'ロジックノードを挿入' : 'ノードを挿入');
      nextTick(() => fitWorkflowToView());
      return newId;
    }

    function insertWorkflowNodeAfter(fromId, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const from = wf?.nodes?.find((n) => n.id === fromId);
      if (!from || !payload) return null;

      const fromTasks = getWorkflowNodeActiveTasks(from);
      const fromSize = getWorkflowNodeSize(from, fromTasks.length, fromTasks);

      if (payload.kind === 'terminal' && payload.type === 'end') {
        if (workflowTerminalTypeExists('end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        const newId = newRuleId('wf');
        const newNode = normalizeEndNode({
          id: newId,
          type: 'end',
          x: from.x,
          y: from.y + fromSize.h + WF_NODE_GAP,
          label: payload.label || '終了',
          isEnd: true,
        });
        const mainEdge = wf.edges.find((e) => e.from === fromId && !e.branch);
        const oldTargetId = mainEdge?.to || null;
        if (mainEdge) wf.edges = wf.edges.filter((e) => e !== mainEdge);
        wf.nodes.push(newNode);
        wf.edges.push({ from: fromId, to: newId });
        if (oldTargetId) wf.edges.push({ from: newId, to: oldTargetId });
        closeWfNodePicker();
        selectWorkflowNode(newId);
        pushWorkflowHistory('終了ノードを挿入');
        nextTick(() => fitWorkflowToView());
        return newId;
      }

      if (payload.kind === 'terminal' && payload.type === 'start') {
        if (workflowTerminalTypeExists('start')) {
          warnWorkflowTerminalLimit('start');
          return null;
        }
        const newId = newRuleId('wf');
        const newNode = normalizeStartNode({
          id: newId,
          type: 'start',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          label: payload.label || '開始',
          isStart: true,
        });
        const mainEdge = wf.edges.find((e) => e.from === fromId && !e.branch);
        const oldTargetId = mainEdge?.to || null;
        if (mainEdge) wf.edges = wf.edges.filter((e) => e !== mainEdge);
        wf.nodes.push(newNode);
        wf.edges.push({ from: fromId, to: newId });
        if (oldTargetId) wf.edges.push({ from: newId, to: oldTargetId });
        ensureWorkflowStartNode(wf);
        closeWfNodePicker();
        selectWorkflowNode(newId);
        pushWorkflowHistory('開始ノードを挿入');
        nextTick(() => fitWorkflowToView());
        return newId;
      }

      const newId = newRuleId('wf');
      let newNode;

      if (payload.kind === 'logic') {
        newNode = normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y + 12,
          label: '条件判断',
          judgmentContext: 'custom',
          conditionType: 'custom',
        }, wf, form.verify);
      } else if (payload.type === 'hitl_gate') {
        const preset = HITL_CONTEXT_OPTIONS.find((t) => t.value === payload.defaultPreset) || HITL_CONTEXT_OPTIONS[0];
        newNode = normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          hitlContext: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      } else if (payload.type === 'notify') {
        newNode = normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          template: payload.defaultNotifyTemplate || 'supplement',
        });
      } else if (payload.type === 'code') {
        newNode = normalizeCodeNode({
          id: newId,
          type: 'code',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          label: 'カスタム関数',
        }, wf);
      } else {
        const meta = getWorkflowNodeMeta(payload.type);
        newNode = ensureWorkflowNodeVarName({
          id: newId,
          type: payload.type,
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          label: meta.title,
        }, wf);
      }

      const newSize = getWorkflowNodeSize(newNode, getWorkflowNodeActiveTasks(newNode).length, getWorkflowNodeActiveTasks(newNode));
      const mainEdge = wf.edges.find((e) => e.from === fromId && !e.branch);
      const oldTargetId = mainEdge?.to || null;

      if (oldTargetId) {
        shiftWorkflowNodesRight(oldTargetId, newSize.w + WF_NODE_GAP);
        wf.edges = wf.edges.filter((e) => e !== mainEdge);
      }

      wf.nodes.push(newNode);
      wf.edges.push({ from: fromId, to: newId });

      if (payload.kind === 'logic' && oldTargetId) {
        wf.edges.push({
          from: newId,
          to: oldTargetId,
          branch: 'else',
          label: getDecisionBranchEdgeLabel('else', newNode),
        });
      } else if (oldTargetId) {
        wf.edges.push({ from: newId, to: oldTargetId });
      }

      closeWfNodePicker();
      selectWorkflowNode(newId);
      pushWorkflowHistory(payload.kind === 'logic' ? 'ロジックノードを挿入' : 'ノードを挿入');
      nextTick(() => fitWorkflowToView());
      return newId;
    }

    function insertWorkflowNodeOnDecisionBranch(fromId, branchKey, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const from = wf?.nodes?.find((n) => n.id === fromId);
      if (!from || from.type !== 'decision' || !branchKey) return null;

      const branches = getDecisionNodeBranches(from);
      const match = branches.find((b) => b.key === branchKey);
      const ratio = match?.ratio ?? 0.5;
      const fromSize = getWorkflowNodeSize(from);
      const newNode = buildWorkflowNodeFromPayload(
        payload,
        from.x + fromSize.w + WF_NODE_GAP,
        Math.round(from.y + fromSize.h * ratio - 22),
        wf,
      );
      const newSize = getWorkflowNodeSize(
        newNode,
        getWorkflowNodeActiveTasks(newNode).length,
        getWorkflowNodeActiveTasks(newNode),
      );
      const existingEdge = wf.edges.find((e) => e.from === fromId && e.branch === branchKey);

      if (existingEdge?.to) {
        shiftWorkflowNodesRight(existingEdge.to, newSize.w + WF_NODE_GAP);
        const oldTargetId = existingEdge.to;
        existingEdge.to = newNode.id;
        wf.nodes.push(newNode);
        if (payload.kind === 'logic') {
          wf.edges.push({
            from: newNode.id,
            to: oldTargetId,
            branch: 'else',
            label: getDecisionBranchEdgeLabel('else', newNode),
          });
        } else {
          wf.edges.push({ from: newNode.id, to: oldTargetId });
        }
      } else {
        wf.nodes.push(newNode);
        wf.edges.push({
          from: fromId,
          to: newNode.id,
          branch: branchKey,
          label: getDecisionBranchEdgeLabel(branchKey, from),
        });
      }

      closeWfNodePicker();
      selectWorkflowNode(newNode.id);
      pushWorkflowHistory(`${match?.label || '分岐'} にノードを接続`);
      nextTick(() => fitWorkflowToView());
      return newNode.id;
    }

    function pickWorkflowProcessNode(item) {
      if (!assertWorkflowTopologyEditable()) return;
      if (!wfNodePicker.fromNodeId && !wfNodePicker.edgeKey) return;
      const resolved = typeof item === 'string' ? { type: item } : item;
      const payload = resolved.type === 'start' || resolved.type === 'end'
        ? { kind: 'terminal', type: resolved.type, label: resolved.label }
        : resolved.type === 'decision'
          ? { kind: 'logic', conditionType: 'custom' }
          : {
            kind: 'process',
            type: resolved.type,
            defaultPreset: resolved.defaultHitlContext,
            defaultNotifyTemplate: resolved.defaultNotifyTemplate,
            label: resolved.label,
          };
      if (wfNodePicker.side === 'on-edge') {
        const edge = (getActiveWf()?.edges || []).find((e) => workflowEdgeKey(e) === wfNodePicker.edgeKey);
        if (edge) insertWorkflowNodeOnEdge(edge, payload);
        return;
      }
      if (wfNodePicker.side === 'branch') {
        insertWorkflowNodeOnDecisionBranch(wfNodePicker.fromNodeId, wfNodePicker.edgeBranch, payload);
        return;
      }
      if (wfNodePicker.side === 'before') {
        insertWorkflowNodeBefore(wfNodePicker.fromNodeId, payload);
      } else {
        insertWorkflowNodeAfter(wfNodePicker.fromNodeId, payload);
      }
    }

    function pickWorkflowLogicNode(conditionType) {
      if (!assertWorkflowTopologyEditable()) return;
      if (!wfNodePicker.fromNodeId && !wfNodePicker.edgeKey) return;
      const payload = { kind: 'logic', conditionType };
      if (wfNodePicker.side === 'on-edge') {
        const edge = (getActiveWf()?.edges || []).find((e) => workflowEdgeKey(e) === wfNodePicker.edgeKey);
        if (edge) insertWorkflowNodeOnEdge(edge, payload);
        return;
      }
      if (wfNodePicker.side === 'before') {
        insertWorkflowNodeBefore(wfNodePicker.fromNodeId, payload);
      } else {
        insertWorkflowNodeAfter(wfNodePicker.fromNodeId, payload);
      }
    }

    const wfNodePickerAvailableProcessGroups = computed(() => {
      const flowKey = getFlowNodeKey();
      const wf = getActiveWf();
      const hasStart = wf?.nodes?.some((n) => n.type === 'start');
      const hasEnd = wf?.nodes?.some((n) => n.type === 'end');

      if (flowKey === 'case') {
        return CASE_FLOW_NODE_GROUPS.map((group) => ({
          category: group.category,
          nodes: [...group.nodes]
            .filter((item) => {
              if (item.type === 'start' && hasStart) return false;
              if (item.type === 'end' && hasEnd) return false;
              return true;
            })
            .sort((a, b) => {
              const ao = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[a.type];
              const bo = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[b.type];
              if (ao == null && bo == null) return 0;
              if (ao == null) return 1;
              if (bo == null) return -1;
              return ao - bo;
            }),
        })).filter((group) => group.nodes.length > 0);
      }

      const nodes = FLOW_NODE_OPTIONS[flowKey] || [];
      if (!nodes.length) return [];
      const grouped = {};
      nodes.forEach((item) => {
        const key = item.category || '処理';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });
      return Object.entries(grouped).map(([category, groupNodes]) => ({ category, nodes: groupNodes }));
    });

    const wfNodePickerProcessGroups = wfNodePickerAvailableProcessGroups;

    const wfNodePickerLogicOptions = computed(() => [...JUDGMENT_CONTEXT_OPTIONS]);

    function exitWorkflowInspector() {
      selectedWorkflowNodeId.value = null;
      selectedWorkflowEdgeKey.value = null;
      syncCurrentNodeFromWorkflow(null);
      closeWorkflowInspector();
    }

    const wfNodePickerHoveredLogic = computed(() => {
      if (!wfNodePicker.hoveredLogic) return null;
      return JUDGMENT_CONTEXT_OPTIONS.find((t) => t.value === wfNodePicker.hoveredLogic) || null;
    });

    function resetSceneSetupDraft() {
      sceneSetupDraft.sceneId = '';
      sceneSetupDraft.name = '新規シーン';
      sceneSetupDraft.description = '';
      sceneSetupDraft.documents = [];
      sceneSetupDraft.mainDocType = '';
      sceneSetupDraft.docFieldLinks = [];
      clearSceneSetupLinkCheckDisplay();
    }

    function loadSceneSetupDraftFromData(data, sceneId = '', sceneName = '') {
      sceneSetupDraft.sceneId = sceneId;
      sceneSetupDraft.name = data.scene?.name || sceneName || '新規シーン';
      sceneSetupDraft.description = data.scene?.description || '';
      sceneSetupDraft.documents = normalizeSceneDocuments(cloneJson(data.scene?.documents || []));
      sceneSetupDraft.mainDocType = getSceneMainDocType(data.scene);
      applySceneSetupAggregate();
      sceneSetupDraft.docFieldLinks = normalizeDocFieldLinks(
        data.scene?.docFieldLinks,
        sceneSetupDraft.documents,
      );
      if (!sceneSetupDraft.docFieldLinks.length && sceneSetupDraft.documents.length >= 2) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        );
      }
      clearSceneSetupLinkCheckDisplay();
    }

    function applySceneSetupDraftToData(data) {
      const name = (sceneSetupDraft.name || '').trim() || '新規シーン';
      data.scene.name = name;
      data.scene.description = (sceneSetupDraft.description || '').trim();
      data.scene.documents = normalizeSceneDocuments(cloneJson(sceneSetupDraft.documents));
      data.scene.mainDocTypes = sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [];
      data.scene.aggregateDocType = sceneSetupDraft.mainDocType;
      data.scene.primaryKey = '';
      data.scene.masterlessPolicy = SCENE_MATCHING_DEFAULTS.masterlessPolicy;
      data.scene.supplementPolicy = SCENE_MATCHING_DEFAULTS.supplementPolicy;
      data.scene.docFieldLinks = normalizeDocFieldLinks(
        sceneSetupDraft.docFieldLinks,
        sceneSetupDraft.documents,
      );
      applySceneAggregate(data.scene, data.scene.documents, data.output);
      return name;
    }

    function enterSceneSetupStep(mode = 'edit') {
      sceneSetupMode.value = mode;
      workflowSetupStep.value = 1;
      sceneSetupVisible.value = true;
    }

    function cancelSceneSetup() {
      sceneSetupVisible.value = false;
      workflowSetupStep.value = 2;
    }

    function resetSceneSetup() {
      ElementPlus.ElMessageBox.confirm('すべての設定をリセットしますか？', '', {
        confirmButtonText: 'OK',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }).then(() => {
        if (sceneSetupMode.value === 'edit' && sceneSetupDraft.sceneId) {
          const scene = scenes.value.find((s) => s.id === sceneSetupDraft.sceneId);
          if (!scene) {
            resetSceneSetupDraft();
          } else if (scene.id === currentSceneId.value) {
            const saved = normalizeLoadedForm(JSON.parse(savedSnapshot.value)) || form;
            loadSceneSetupDraftFromData(saved, scene.id, scene.name);
          } else {
            const stored = normalizeLoadedForm(loadSceneFromStorage(scene.id)) || sceneFormByScene(scene);
            loadSceneSetupDraftFromData(stored, scene.id, scene.name);
          }
        } else {
          resetSceneSetupDraft();
        }
        ElementPlus.ElMessage.info('リセットしました');
      }).catch(() => {});
    }

    function goToWorkflowSetupStep(step) {
      if (step === 1) {
        if (workflowSetupStep.value === 1) return;
        const scene = currentScene.value;
        if (scene) {
          editSceneSettings(scene);
          return;
        }
        resetSceneSetupDraft();
        enterSceneSetupStep('create');
        return;
      }
      if (step === 2) {
        if (workflowSetupStep.value === 2) return;
        if (workflowSetupStep.value === 1) {
          proceedToWorkflowStep();
          return;
        }
        workflowSetupStep.value = 2;
        sceneSetupVisible.value = false;
        enterWorkflowCanvasView();
      }
    }

    function createNewScene() {
      if (renamingSceneId.value) {
        const prev = scenes.value.find((s) => s.id === renamingSceneId.value);
        if (prev) finishRenameScene(prev);
      }
      resetSceneSetupDraft();
      enterSceneSetupStep('create');
    }

    function editSceneSettings(scene) {
      if (!scene) return;
      if (scene.id === currentSceneId.value) {
        loadSceneSetupDraftFromData(form, scene.id, scene.name);
      } else {
        const stored = loadSceneFromStorage(scene.id);
        const data = normalizeLoadedForm(stored) || sceneFormByScene(scene);
        loadSceneSetupDraftFromData(data, scene.id, scene.name);
      }
      enterSceneSetupStep('edit');
    }

    function openEditCurrentSceneSettings() {
      const scene = currentScene.value;
      if (scene) editSceneSettings(scene);
    }

    function onSceneMenuCommand(command, scene) {
      if (command === 'edit') editSceneSettings(scene);
    }

    function applySceneSetupAggregate() {
      const agg = normalizeSceneAggregate(
        { mainDocTypes: sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [] },
        sceneSetupDraft.documents,
      );
      sceneSetupDraft.mainDocType = agg.mainDocTypes[0] || '';
    }

    function validateSceneAggregateDraft(draft) {
      if (!draft.mainDocType) return '主帳票を1件選択してください';
      return '';
    }

    function setSceneSetupMainDoc(docType) {
      if (!sceneSetupDraft.documents.some((d) => d.type === docType)) return;
      sceneSetupDraft.mainDocType = docType;
      clearSceneSetupLinkCheckDisplay();
      if (sceneSetupDraft.documents.length >= 2 && !(sceneSetupDraft.docFieldLinks || []).length) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          [docType],
        );
      }
    }

    function proceedToWorkflowStep() {
      if (!sceneSetupDraft.documents.length) {
        ElementPlus.ElMessage.warning('関連帳票を1件以上追加してください');
        return;
      }
      applySceneSetupAggregate();
      const err = validateSceneAggregateDraft(sceneSetupDraft);
      if (err) {
        ElementPlus.ElMessage.warning(err);
        return;
      }
      sceneSetupDraft.docFieldLinks = normalizeDocFieldLinks(
        sceneSetupDraft.docFieldLinks,
        sceneSetupDraft.documents,
      );
      const linkErr = getSceneLinkValidationError(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType,
        sceneSetupDraft.docFieldLinks,
        getDocDisplayLabel,
      );
      if (linkErr) {
        flashSceneSetupLinkCheckResult();
        ElementPlus.ElMessage.warning(linkErr);
        return;
      }
      if (sceneSetupMode.value === 'edit') {
        const scene = scenes.value.find((s) => s.id === sceneSetupDraft.sceneId);
        if (!scene) return;
        if (scene.id === currentSceneId.value) {
          const name = applySceneSetupDraftToData(form);
          scene.name = name;
          syncOcrExtractTypes();
          syncOutputDocFieldsBySceneDocs();
          saveStorage(scene.id, form);
          savedSnapshot.value = JSON.stringify(form);
        } else {
          const stored = normalizeLoadedForm(loadSceneFromStorage(scene.id)) || sceneFormByScene(scene);
          const name = applySceneSetupDraftToData(stored);
          scene.name = name;
          saveStorage(scene.id, stored);
          if (scene.id === currentSceneId.value) {
            Object.assign(form, stored);
          }
        }
        sceneSetupVisible.value = false;
        workflowSetupStep.value = 2;
        enterWorkflowCanvasView();
        nextTick(() => fitWorkflowToView());
        ElementPlus.ElMessage.success('業務シーン設定を保存しました');
        return;
      }
      const id = String(Date.now());
      const data = sceneForm('application');
      const name = applySceneSetupDraftToData(data);
      scenes.value.unshift({ id, name });
      saveStorage(id, data);
      selectScene(id, { skipFinishRename: true, focusScene: true });
      sceneSetupVisible.value = false;
      workflowSetupStep.value = 2;
      enterWorkflowCanvasView();
      ElementPlus.ElMessage.success('業務シーンを作成しました');
    }

    function confirmSceneSetup() {
      proceedToWorkflowStep();
    }

    function openSceneSetupDocPicker() {
      openDocPicker('setup');
    }

    function checkSceneDocLinks() {
      if (!sceneSetupDraft.documents.length) {
        ElementPlus.ElMessage.warning('関連帳票を1件以上追加してください');
        return;
      }
      if (!sceneSetupDraft.mainDocType) {
        ElementPlus.ElMessage.warning('主帳票を選択してください');
        return;
      }
      flashSceneSetupLinkCheckResult();
      const stats = sceneSetupLinkStats.value;
      if (stats.unlinkedCount > 0) {
        const names = stats.unlinkedDocs.map((t) => getDocDisplayLabel(t)).join('、');
        ElementPlus.ElMessage.warning(`${stats.unlinkedCount} 件の帳票が主帳票に未関連です：${names}`);
      } else if (stats.total <= stats.mainDocCount) {
        ElementPlus.ElMessage.success('主帳票のみの構成です');
      } else {
        ElementPlus.ElMessage.success('すべての帳票が主帳票に関連付けされています');
      }
    }

    function removeSceneSetupDoc(index) {
      const removed = sceneSetupDraft.documents[index];
      sceneSetupDraft.documents.splice(index, 1);
      if (removed?.type === sceneSetupDraft.mainDocType) {
        sceneSetupDraft.mainDocType = sceneSetupDraft.documents[0]?.type || '';
      }
      applySceneSetupAggregate();
      sceneSetupDraft.docFieldLinks = normalizeDocFieldLinks(
        sceneSetupDraft.docFieldLinks,
        sceneSetupDraft.documents,
      );
    }

    function getSceneSetupFieldOptions(docType) {
      return getDocSchema(docType).fields || [];
    }

    function addDocFieldLink() {
      const docs = sceneSetupDraft.documents;
      if (docs.length < 2) {
        ElementPlus.ElMessage.warning('関連帳票を2件以上追加してください');
        return;
      }
      const sourceDocType = sceneSetupDraft.mainDocType || docs[0].type;
      const targetDoc = docs.find((d) => d.type !== sourceDocType) || docs[1];
      const sourceField = getDocSchema(sourceDocType).fields?.[0] || '';
      const targetField = getDocSchema(targetDoc.type).fields?.[0] || '';
      sceneSetupDraft.docFieldLinks.push({
        id: `link-${Date.now()}`,
        sourceDocType,
        sourceField,
        targetDocType: targetDoc.type,
        targetField,
      });
    }

    function removeDocFieldLink(index) {
      sceneSetupDraft.docFieldLinks.splice(index, 1);
    }

    function autoMatchDocFieldLinks() {
      if (sceneSetupDraft.documents.length < 2) {
        ElementPlus.ElMessage.warning('関連帳票を2件以上追加してください');
        return;
      }
      applySceneSetupAggregate();
      sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
      );
      ElementPlus.ElMessage.success('同名フィールドを自動関連付けしました');
    }

    function getSceneMatchingLabel(value, options) {
      return options.find((opt) => opt.value === value)?.label || '—';
    }

    function startRenameScene(scene) {
      renamingSceneId.value = scene.id;
    }

    function finishRenameScene(scene) {
      if (!scene) return;
      const trimmed = (scene.name || '').trim() || '新規シーン';
      scene.name = trimmed;
      if (currentSceneId.value === scene.id) {
        form.scene.name = trimmed;
        saveStorage(scene.id, form);
      } else {
        const stored = loadSceneFromStorage(scene.id);
        if (stored) {
          stored.scene.name = trimmed;
          saveStorage(scene.id, stored);
        }
      }
      if (renamingSceneId.value === scene.id) {
        renamingSceneId.value = null;
      }
    }

    function confirmRemoveSelectedWorkflowNode() {
      if (!assertWorkflowTopologyEditable()) return;
      const id = selectedWorkflowNodeId.value;
      if (!id) return;
      const node = getActiveWf()?.nodes?.find((n) => n.id === id);
      if (!node) return;
      if (node.type === 'start' || node.type === 'end' || node.isStart) {
        ElementPlus.ElMessage.warning('開始 / 終了ノードは削除できません。Workflow の端点として固定されています。');
        return;
      }
      const name = `${getWorkflowNodeMeta(node.type).title} · ${formatWfNodeLabel(node.label)}`;
      ElementPlus.ElMessageBox.confirm(
        `「${name}」を削除しますか？関連する接続も削除されます。`,
        'ノード削除',
        { confirmButtonText: '削除', cancelButtonText: 'キャンセル', type: 'warning' },
      ).then(() => {
        removeWorkflowNode(id);
        pushWorkflowHistory('ノードを削除');
        ElementPlus.ElMessage.success('ノードを削除しました');
      }).catch(() => {});
    }

    function onWfKeyDown(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target?.isContentEditable) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoWorkflow();
        else undoWorkflow();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedWorkflowNodeId.value) {
          event.preventDefault();
          confirmRemoveSelectedWorkflowNode();
        } else if (selectedWorkflowEdgeKey.value) {
          if (!assertWorkflowTopologyEditable()) return;
          event.preventDefault();
          removeSelectedWorkflowEdge();
        }
        return;
      }
      if (!mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openWfNodePickerFromShortcut();
      }
    }

    function getWorkflowPortPosition(node, branch) {
      const tasks = getWorkflowNodeActiveTasks(node);
      const size = getWorkflowNodeSize(node, tasks.length);
      const PORT = 6;
      if (node?.type === 'decision' && branch) {
        const branches = getDecisionNodeBranches(node);
        const match = branches.find((b) => b.key === branch);
        const ratio = match?.ratio ?? 0.5;
        return { x: node.x + size.w + PORT, y: node.y + size.h * ratio };
      }
      return { x: node.x + size.w + PORT, y: node.y + size.h / 2 };
    }

    function getDecisionPortStyle(node, branch) {
      const branches = getDecisionNodeBranches(node);
      const match = branches.find((b) => b.key === branch);
      const ratio = match?.ratio ?? 0.5;
      return {
        top: `${Math.round(ratio * 1000) / 10}%`,
        transform: 'translateY(-50%)',
      };
    }

    function getDecisionPortLabelStyle(node, branch) {
      const branches = getDecisionNodeBranches(node);
      const match = branches.find((b) => b.key === branch);
      const ratio = match?.ratio ?? 0.5;
      return {
        top: `calc(${Math.round(ratio * 1000) / 10}% - 8px)`,
      };
    }

    const wfConnectPreviewPath = computed(() => {
      if (!wfConnectDrag.active || !wfConnectDrag.fromId) return '';
      const from = (getActiveWf()?.nodes || []).find((n) => n.id === wfConnectDrag.fromId);
      if (!from) return '';
      const start = getWorkflowPortPosition(from, wfConnectDrag.branch);
      let end = screenToWorkflowCoords(wfConnectDrag.clientX, wfConnectDrag.clientY);
      const hoverId = wfConnectHoverTargetId.value;
      if (hoverId && hoverId !== wfConnectDrag.fromId) {
        const target = (getActiveWf()?.nodes || []).find((n) => n.id === hoverId);
        if (target) {
          const tasks = getWorkflowNodeActiveTasks(target);
          const size = getWorkflowNodeSize(target, tasks.length, tasks);
          end = { x: target.x - 6, y: target.y + size.h / 2 };
        }
      }
      return wfBezierPath(start.x, start.y, end.x, end.y);
    });

    function syncCurrentNodeFromWorkflow(node) {
      const map = {
        input: 'input',
        preprocess: 'image',
        ocr: 'ocr',
        hitl_gate: 'hitl_gate',
        ocr_confirm: 'hitl_gate',
        confirm: 'hitl_gate',
        verify_confirm: 'hitl_gate',
        ai_verify: 'verify',
        fraud_detect: 'fraud_detect',
        master_match: 'master',
        output: 'output',
      };
      if (node && map[node.type]) currentNode.value = map[node.type];
    }

    function toggleSceneSidebar() {
      sceneSidebarCollapsed.value = !sceneSidebarCollapsed.value;
    }

    function toggleLibraryPanel() {
      libraryPanelCollapsed.value = !libraryPanelCollapsed.value;
    }

    function enterWorkflowCanvasView() {
      appNavCollapsed.value = true;
      sceneSidebarCollapsed.value = true;
    }

    function toggleInspectorPanel() {
      inspectorPanelCollapsed.value = !inspectorPanelCollapsed.value;
      if (!inspectorPanelCollapsed.value) {
        if (!selectedWorkflowNodeId.value && !selectedWorkflowEdgeKey.value) {
          inspectorMode.value = 'overview';
        }
      }
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_STORAGE_KEY, inspectorPanelCollapsed.value ? '1' : '0');
      } catch (e) { /* ignore */ }
    }

    function onInspectorResizeStart(event) {
      if (inspectorPanelCollapsed.value) return;
      event.preventDefault();
      inspectorResizing.value = true;
      document.body.classList.add('idp-inspector-resizing');
      const startX = event.clientX;
      const startWidth = inspectorPanelWidth.value;

      function onMove(e) {
        const next = Math.min(
          INSPECTOR_WIDTH_MAX,
          Math.max(INSPECTOR_WIDTH_MIN, startWidth + (startX - e.clientX)),
        );
        inspectorPanelWidth.value = next;
      }

      function onUp() {
        inspectorResizing.value = false;
        document.body.classList.remove('idp-inspector-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        try {
          localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(inspectorPanelWidth.value));
        } catch (e) { /* ignore */ }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function selectWorkflowNode(id) {
      selectedWorkflowEdgeKey.value = null;
      wfConnectSourceId.value = null;
      const pickedNode = getActiveWf()?.nodes?.find((n) => n.id === id);
      selectedWorkflowNodeId.value = id;
      openWorkflowInspector('node');
      if (pickedNode?.type === 'end') {
        Object.assign(pickedNode, normalizeEndNode(pickedNode));
      } else if (pickedNode?.type === 'start') {
        Object.assign(pickedNode, normalizeStartNode(pickedNode));
      } else if (pickedNode?.type === 'decision') Object.assign(pickedNode, normalizeDecisionNode(pickedNode, getActiveWf()));
      else if (pickedNode?.type === 'notify') Object.assign(pickedNode, normalizeNotifyNode(pickedNode));
      else if (pickedNode?.type === 'code') Object.assign(pickedNode, normalizeCodeNode(pickedNode, getActiveWf()));
      else if (pickedNode && isHitlGateNode(pickedNode)) Object.assign(pickedNode, normalizeHitlGateNode(pickedNode));
      if (pickedNode && (pickedNode.type === 'decision' || isHitlGateNode(pickedNode))) {
        syncWorkflowYesExpression(pickedNode, sceneDocTypes.value);
      }
      syncCurrentNodeFromWorkflow(pickedNode);
    }

    function getNodeMainOutTargetId(nodeId) {
      const edge = (getActiveWf()?.edges || []).find((e) => e.from === nodeId && !e.branch);
      return edge?.to || '';
    }

    function setNodeMainOutTarget(nodeId, targetNodeId) {
      if (!assertWorkflowTopologyEditable()) return;
      const wf = getActiveWf();
      if (!wf || !nodeId) return;
      wf.edges = wf.edges.filter((e) => !(e.from === nodeId && !e.branch));
      if (targetNodeId) {
        wf.edges.push({ from: nodeId, to: targetNodeId });
      }
      pushWorkflowHistory('接続先を変更');
    }

    function isConnectModeSource(nodeId) {
      return isWorkflowTopologyEditable.value && wfConnectSourceId.value === nodeId;
    }

    function selectWorkflowEdge(edge) {
      if (!edge) return;
      closeWfNodePicker();
      wfConnectSourceId.value = null;
      selectedWorkflowEdgeKey.value = workflowEdgeKey(edge);
      selectedWorkflowNodeId.value = null;
      syncCurrentNodeFromWorkflow(null);
      openWorkflowInspector('edge');
    }

    function removeSelectedWorkflowEdge() {
      if (!assertWorkflowTopologyEditable()) return;
      if (!selectedWorkflowEdgeKey.value) return;
      getActiveWf().edges = (getActiveWf().edges || []).filter(
        (e) => workflowEdgeKey(e) !== selectedWorkflowEdgeKey.value,
      );
      selectedWorkflowEdgeKey.value = null;
      closeWorkflowInspector();
      syncCurrentNodeFromWorkflow(null);
      pushWorkflowHistory('接続を削除');
      ElementPlus.ElMessage.info('接続を削除しました');
    }

    function connectWorkflowEdge(fromId, toId, branch) {
      const wf = getActiveWf();
      const from = wf.nodes.find((n) => n.id === fromId);
      const to = wf.nodes.find((n) => n.id === toId);
      if (!from || !to || fromId === toId) return false;
      if (from.type === 'decision') {
        if (!branch) return false;
        wf.edges = wf.edges.filter((e) => !(e.from === fromId && e.branch === branch));
        wf.edges.push({
          from: fromId,
          to: toId,
          branch,
          label: getDecisionBranchEdgeLabel(branch, from),
        });
      } else {
        wf.edges = wf.edges.filter((e) => !(e.from === fromId && !e.branch));
        wf.edges.push({ from: fromId, to: toId });
      }
      return true;
    }

    function onWfNodeAddOutClick(node, event) {
      if (wfConnectSuppressClick) return;
      openWfNodePicker(node, event, 'after');
    }

    function onWfNodeAddInClick(node, event) {
      if (wfConnectSuppressClick) return;
      openWfNodePicker(node, event, 'before');
    }

    function onWfConnectHandleDown(event, node, branch, role = 'out') {
      if (!assertWorkflowTopologyEditable()) return;
      if (role === 'in') return;
      event.stopPropagation();

      const anchorEl = event.currentTarget;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;

      wfConnectDrag.fromId = node.id;
      wfConnectDrag.branch = branch;
      wfConnectDrag.clientX = startX;
      wfConnectDrag.clientY = startY;
      wfConnectDrag.active = false;
      wfConnectHoverTargetId.value = null;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          dragging = true;
          wfConnectDrag.active = true;
          document.body.classList.add('wf-connecting');
        }
        if (!dragging) return;
        wfConnectDrag.clientX = ev.clientX;
        wfConnectDrag.clientY = ev.clientY;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const inPort = hit?.closest?.('[data-wf-port="in"]');
        const targetId = inPort?.getAttribute('data-node-id');
        wfConnectHoverTargetId.value = targetId && targetId !== node.id ? targetId : null;
      };

      const onUp = (ev) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.classList.remove('wf-connecting');
        wfConnectDrag.active = false;

        if (!dragging) {
          if (role === 'branch') openWfNodePickerForDecisionBranch(node, branch, anchorEl);
          else if (role === 'out') openWfNodePicker(node, anchorEl, 'after');
          wfConnectSuppressClick = true;
          setTimeout(() => { wfConnectSuppressClick = false; }, 0);
          wfConnectDrag.fromId = null;
          wfConnectDrag.branch = null;
          wfConnectHoverTargetId.value = null;
          return;
        }

        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const inPort = hit?.closest?.('[data-wf-port="in"]');
        const targetId = inPort?.getAttribute('data-node-id');
        if (targetId && wfConnectDrag.fromId && connectWorkflowEdge(wfConnectDrag.fromId, targetId, wfConnectDrag.branch)) {
          pushWorkflowHistory('接続を追加');
          ElementPlus.ElMessage.success('接続しました');
          wfConnectSuppressClick = true;
          setTimeout(() => { wfConnectSuppressClick = false; }, 0);
        }
        wfConnectDrag.fromId = null;
        wfConnectDrag.branch = null;
        wfConnectHoverTargetId.value = null;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function removeWorkflowNode(id) {
      const wf = getActiveWf();
      if (!wf) return;
      wf.nodes = wf.nodes.filter((n) => n.id !== id);
      wf.edges = wf.edges.filter((e) => e.from !== id && e.to !== id);
      if (selectedWorkflowNodeId.value === id) {
        selectedWorkflowNodeId.value = wf.nodes[0]?.id || null;
        if (selectedWorkflowNodeId.value) {
          syncCurrentNodeFromWorkflow(wf.nodes.find((n) => n.id === selectedWorkflowNodeId.value));
        } else {
          inspectorMode.value = 'scene';
        }
      }
      selectedWorkflowEdgeKey.value = null;
    }

    function openSceneInspector() {
      inspectorMode.value = 'scene';
      selectedWorkflowNodeId.value = null;
      selectedWorkflowEdgeKey.value = null;
      currentNode.value = 'scene';
    }

    function onWfLibraryDragStart(event, type) {
      wfLibraryDrag.type = type;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', type);
    }

    function onWfCanvasDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = wfLibraryDrag.type ? 'copy' : 'none';
    }

    function onWfCanvasDrop(event) {
      event.preventDefault();
      if (!assertWorkflowTopologyEditable()) return;
      if (!wfLibraryDrag.type) return;
      const pos = screenToWorkflowCoords(event.clientX, event.clientY);
      createWorkflowNodeAt(wfLibraryDrag.type, pos.x - 120, pos.y - 36);
      wfLibraryDrag.type = null;
    }

    function onWfNodePointerDown(event, node) {
      if (event.button !== 0) return;
      if (!isWorkflowTopologyEditable.value) return;
      event.preventDefault();
      wfNodeDrag.id = node.id;
      wfNodeDrag.startX = event.clientX;
      wfNodeDrag.startY = event.clientY;
      wfNodeDrag.originX = node.x;
      wfNodeDrag.originY = node.y;
      const onMove = (ev) => {
        const target = getActiveWf().nodes.find((n) => n.id === wfNodeDrag.id);
        if (!target) return;
        target.x = Math.max(8, wfNodeDrag.originX + (ev.clientX - wfNodeDrag.startX) / wfViewport.scale);
        target.y = Math.max(8, wfNodeDrag.originY + (ev.clientY - wfNodeDrag.startY) / wfViewport.scale);
      };
      const onUp = () => {
        const target = getActiveWf().nodes.find((n) => n.id === wfNodeDrag.id);
        const moved = target && (
          Math.abs(target.x - wfNodeDrag.originX) > 1
          || Math.abs(target.y - wfNodeDrag.originY) > 1
        );
        wfNodeDrag.id = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (moved) pushWorkflowHistory('ノード位置を移動');
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function onDecisionConditionTypeChange(typeValue) {
      onJudgmentContextChange(typeValue);
    }

    function onDecisionCustomExpressionChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision' || node.conditionType !== 'custom') return;
      node.yesRule = node.yesExpression || '';
      syncDecisionYesRuleToCases(node);
      pushWorkflowHistory('IF 条件を変更');
    }

    function onDecisionGatewayTypeChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      if (node.gatewayType === 'pass') {
        node.yesRule = node.yesRule || '評価のみ記録し、常に次工程へ進む';
        node.noRule = node.noRule || '—';
      }
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('判断タイプを変更');
    }

    function onDecisionThresholdChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('閾値を変更');
    }

    function syncDecisionYesRuleToCases(node) {
      if (!node?.cases?.length) return;
      const cond = node.cases[0]?.conditions?.[0];
      if (cond) {
        cond.value = node.yesRule || '';
        cond.expression = node.yesExpression || '';
      }
    }

    function onDecisionYesRuleChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      syncDecisionYesRuleToCases(node);
      pushWorkflowHistory('YES 判断条件を変更');
    }

    function onDecisionNoRuleChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      node.elseDescription = node.noRule || '';
      pushWorkflowHistory('NO 結果を変更');
    }

    function onHitlGateYesRuleChange() {
      syncWorkflowYesExpression(selectedWorkflowNode.value, sceneDocTypes.value);
      pushWorkflowHistory('発生条件を変更');
    }

    function onHitlGateNoRuleChange() {
      pushWorkflowHistory('スキップ結果を変更');
    }

    function onDecisionConditionLogicChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('条件ロジックを変更');
    }

    function onDecisionGatewayPolicyChange() {
      pushWorkflowHistory('ゲートウェイ方針を変更');
    }

    function decisionReturnTargetOptions(nodeId) {
      const wf = getActiveWf();
      if (!wf || !nodeId) return [];
      const self = wf.nodes.find((n) => n.id === nodeId);
      if (!self) return [];
      return wf.nodes
        .filter((n) => n.id !== nodeId && n.x <= self.x + 20)
        .map((n) => ({
          value: n.id,
          label: `${getWorkflowNodeMeta(n.type).title} · ${formatWfNodeLabel(n.label)}`,
        }));
    }

    function getDecisionThresholdLabel(node) {
      if (node?.conditionType === 'ocr_hitl') return '信頼度閾値 (%)';
      if (node?.conditionType === 'preprocess_hitl') return '最小解像度 (DPI)';
      return '閾値';
    }

    function getDecisionThresholdRange(node) {
      if (node?.conditionType === 'ocr_hitl') return { min: 0, max: 100 };
      if (node?.conditionType === 'preprocess_hitl') return { min: 72, max: 600 };
      return { min: 0, max: 100 };
    }

    function workflowYesExpressionNote(node) {
      if (!node) return '';
      const rule = (node.yesRule || '').trim();
      if (!rule || /\{\{[^}]+\}\}/.test(rule)) return '';
      if (compileNaturalToExpression(rule, sceneDocTypes.value)) return '';
      if (DECISION_PRESET_EXPRESSION[node.conditionType]) {
        return '自然言語を実行式に自動変換できません。✦ AI補助 を実行するか、プリセット既定のエンジン判定を使用します';
      }
      return '自然言語を実行式に自動変換できません。✦ AI補助 を実行するか、帳票名・フィールドを明確に記述してください';
    }

    function addDecisionElifCase(node) {
      if (!node?.cases) return;
      node.cases.push(createDecisionCase('elif'));
      pushWorkflowHistory('ELIF を追加');
    }

    function removeDecisionCase(node, caseId) {
      if (!node?.cases || caseId === 'if') return;
      node.cases = node.cases.filter((c) => c.id !== caseId);
      const wf = getActiveWf();
      if (wf) {
        wf.edges = wf.edges.filter((e) => !(e.from === node.id && e.branch === caseId));
      }
      pushWorkflowHistory('分岐 CASE を削除');
    }

    const decisionVariableOptions = computed(() => {
      const wf = getActiveWf();
      const nodeId = selectedWorkflowNodeId.value;
      if (!wf || !nodeId) return [];
      return getDecisionVariableOptions(wf, nodeId, form.verify);
    });

    const decisionVariableOptionGroups = computed(() =>
      getDecisionVariableOptionGroups(decisionVariableOptions.value));

    function judgmentAllowsElif(node) {
      return !!node && node.type === 'decision';
    }

    function previewDecisionCase(node, decisionCase) {
      return getDecisionCaseCanvasPreview(node, decisionCase);
    }

    function previewDecisionNode(node) {
      if (!node) return '条件未設定';
      const options = getDecisionVariableOptions(getActiveWf(), node.id);
      return getDecisionConditionDisplay(node, sceneDocTypes.value, options);
    }

    function onDecisionConditionFieldChange() {
      pushWorkflowHistory('IF/ELSE 条件を変更');
    }

    function addDecisionCondition(node, caseId) {
      const decisionCase = node?.cases?.find((c) => c.id === caseId);
      if (!decisionCase) return;
      decisionCase.conditions.push(createDecisionCondition());
      pushWorkflowHistory('条件を追加');
    }

    function removeDecisionCondition(node, caseId, conditionId) {
      const decisionCase = node?.cases?.find((c) => c.id === caseId);
      if (!decisionCase || decisionCase.conditions.length <= 1) return;
      decisionCase.conditions = decisionCase.conditions.filter((c) => c.id !== conditionId);
      pushWorkflowHistory('条件を削除');
    }

    function getDecisionCaseKindLabel(decisionCase, index) {
      if (decisionCase?.label) return decisionCase.label;
      if (decisionCase?.kind === 'if' || index === 0) return 'IF';
      return 'ELIF';
    }

    function formatHitlActionsLabel(actions) {
      const list = normalizeHitlGateActions(actions);
      return list.map((v) => HITL_ACTION_OPTIONS.find((o) => o.value === v)?.label || v).join('/');
    }

    function getDecisionBranchTarget(nodeId, branch) {
      const edge = (getActiveWf()?.edges || []).find((e) => e.from === nodeId && e.branch === branch);
      if (!edge) return '—';
      const target = (getActiveWf()?.nodes || []).find((n) => n.id === edge.to);
      return target?.label?.replace(/\n/g, ' ') || edge.to;
    }

    function getDecisionBranchTargetId(nodeId, branch) {
      const edge = (getActiveWf()?.edges || []).find((e) => e.from === nodeId && e.branch === branch);
      return edge?.to || '';
    }

    function setDecisionBranchTarget(nodeId, branch, targetNodeId) {
      if (!assertWorkflowTopologyEditable()) return;
      const wf = getActiveWf();
      if (!wf || !nodeId || !branch) return;
      wf.edges = wf.edges.filter((e) => !(e.from === nodeId && e.branch === branch));
      if (targetNodeId) {
        wf.edges.push({
          from: nodeId,
          to: targetNodeId,
          branch,
          label: getDecisionBranchEdgeLabel(branch, wf.nodes.find((n) => n.id === nodeId)),
        });
      }
      pushWorkflowHistory('分岐接続先を変更');
    }

    function getWorkflowNodeActiveTasks(node) {
      if (!node || isWorkflowTerminalNode(node)) return [];
      switch (node.type) {
        case 'preprocess': {
          const img = processingForm.value?.image || {};
          const docCount = (key) => {
            const types = img[key];
            return Array.isArray(types) && types.length ? types.length : 0;
          };
          const tasks = [];
          if (img.rotate) {
            const n = docCount('rotateDocTypes');
            tasks.push(n ? `回転 ${n}件` : '画像回転');
          }
          if (img.perspective) {
            const n = docCount('perspectiveDocTypes');
            tasks.push(n ? `補正 ${n}件` : '画像補正');
          }
          if (img.split) {
            const n = docCount('splitDocTypes');
            tasks.push(n ? `分割 ${n}件` : '帳票分割');
          }
          if (img.sort) {
            const n = docCount('sortDocTypes');
            tasks.push(n ? `排序 ${n}件` : '画像排序');
          }
          return tasks.length ? tasks : ['前処理'];
        }
        case 'input': {
          const channels = form.processing?.input?.channels || [];
          return channels.map((c) => getInputChannelLabel(c));
        }
        case 'ocr': {
          const docs = form.scene?.documents || [];
          const enabled = (form.processing?.ocrExtract?.enabledTypes || [])
            .filter((t) => docs.some((d) => d.type === t));
          if (!enabled.length) return ['OCR抽出'];
          return enabled.map((t) => getDocDisplayLabel(t));
        }
        case 'hitl_gate':
        case 'confirm':
        case 'ocr_confirm':
        case 'verify_confirm': {
          const meta = getHitlGatePreset(node);
          const tags = [];
          if (meta) tags.push(meta.label);
          if (node.role) tags.push(node.role);
          return tags.length ? tags : ['人工確認'];
        }
        case 'notify': {
          const normalized = normalizeNotifyNode(node);
          const tpl = NOTIFY_TEMPLATES.find((t) => t.value === normalized.template);
          const ch = NOTIFY_CHANNELS.find((c) => c.value === normalized.channel);
          const tags = [tpl?.label || '通知'];
          if (ch) tags.push(ch.label);
          const dest = truncateWorkflowPreview(normalized.recipients, 24);
          if (dest) tags.push(dest);
          return tags;
        }
        case 'code': {
          const normalized = normalizeCodeNode(node, getActiveWf());
          const tags = ['Python'];
          const inCount = normalized.inputs?.filter((r) => r.variable)?.length || 0;
          if (inCount) tags.push(`入参 ${inCount}`);
          const lines = String(normalized.pythonCode || '').split('\n').length;
          tags.push(`${lines}行`);
          return tags;
        }
        case 'decision': {
          const tags = [];
          (node.cases || []).forEach((c, i) => {
            if (c.label) {
              tags.push(c.label);
              return;
            }
            const preview = getDecisionCaseCanvasPreview(node, c);
            tags.push(preview && preview !== '条件未設定' ? preview : (i === 0 ? 'IF' : 'ELIF'));
          });
          if (node.elseLabel) tags.push(`ELSE:${node.elseLabel}`);
          return tags.length ? tags : ['条件分岐'];
        }
        case 'master_match': {
          const tags = [];
          const wf = getActiveWf();
          const mcp = getMasterMatchUpstreamMcp(wf, node.id);
          if (mcp) {
            const summary = getMcpNodeCanvasSummary(mcp);
            if (summary) tags.push(`${summary.serverLabel} » ${summary.toolLabel}`);
          } else {
            tags.push('MCP 未接続');
          }
          const fieldCount = node.matchFieldIds?.length || 0;
          if (fieldCount) tags.push(`照合 ${fieldCount}項目`);
          const outCount = node.outputFieldIds?.length || 0;
          if (outCount) tags.push(`出力 ${outCount}項目`);
          const strategy = MASTER_MATCH_STRATEGIES.find((s) => s.value === node.matchStrategy);
          if (strategy) tags.push(strategy.label);
          const fmt = MASTER_MATCH_OUTPUT_FORMATS.find((f) => f.value === node.outputFormat);
          if (fmt) tags.push(fmt.label);
          return tags;
        }
        case 'mcp': {
          const summary = getMcpNodeCanvasSummary(node);
          const server = getMcpServerDef(node.mcpServerId || node.mcpServer, mcpServerCatalog.value);
          if (!summary || !(node.mcpServerId || node.mcpServer)) return ['MCP 未設定'];
          const tags = [`${server?.label || summary.serverLabel} » ${summary.toolLabel}`];
          const inputCount = (node.mcpInputs || []).filter((r) => r.value).length;
          if (inputCount) tags.push(`パラメータ ${inputCount}件`);
          if (node.mcpTimeout != null) tags.push(`${node.mcpTimeout}s`);
          const errMap = { skip: 'skip', retry: 'retry', stop: 'stop' };
          if (node.mcpErrorAction) tags.push(errMap[node.mcpErrorAction] || node.mcpErrorAction);
          return tags;
        }
        case 'ai_verify': {
          const tags = [];
          if (form.verify?.textEnabled && form.verify?.text?.length) tags.push('テキスト');
          if (form.verify?.dataEnabled && form.verify?.dataRules?.length) tags.push('データ');
          if (form.verify?.completenessEnabled) tags.push('完全性');
          if (form.verify?.sealEnabled) tags.push('印鑑');
          return tags.length ? tags : ['AI検証'];
        }
        case 'fraud_detect': {
          const cfg = normalizeFraudDetectConfig(form.processing?.fraudDetect);
          const docs = cfg.targetDocTypes?.length
            ? cfg.targetDocTypes.map((t) => getDocDisplayLabel(t)).slice(0, 2)
            : ['全帳票'];
          return [...docs, FRAUD_DETECT_PS_CATEGORY.label, `閾値 ${cfg.riskThreshold}`];
        }
        case 'output': {
          const fmt = form.output?.format || 'JSON';
          return [`${fmt} 出力`];
        }
        case 'scene_aggregate': {
          const mainDoc = getSceneMainDocType(form.scene);
          const tags = [];
          if (mainDoc) tags.push(`主帳票: ${getDocDisplayLabel(mainDoc)}`);
          const docs = form.scene?.documents || [];
          if (docs.length) tags.push(`帳票 ${docs.length}件`);
          return tags;
        }
        case 'scene_completeness': {
          const docs = form.scene?.documents || [];
          if (!docs.length) return ['帳票未設定'];
          return docs.map((d) => `${getDocDisplayLabel(d.type)}(${d.submission})`);
        }
        default:
          return getWorkflowNodeMeta(node.type).tasks || [];
      }
    }


    function isPreprocessSettingOn(item) {
      if (item.alwaysOn) return true;
      if (!item.switchKey) return false;
      return !!processingForm.value?.image?.[item.switchKey];
    }

    function showPreprocessSettingDetail(item) {
      if (item.alwaysOn) return true;
      if (!item.detailType) return false;
      return isPreprocessSettingOn(item);
    }

    function formatWfNodeLabel(label) {
      return String(label || '').replace(/\n/g, ' ');
    }

    function getWorkflowNodeDisplayLabel(node) {
      if (!node) return '';
      const title = getWorkflowNodeMeta(node.type).title;
      const sub = formatWfNodeLabel(node.label).trim();
      if (!sub || sub === title) return title;
      if (node.type === 'decision' && (sub === 'IF/ELSE' || sub === '条件分岐')) return title;
      return `${title} · ${sub}`;
    }

    function getWorkflowNodeStyle(node) {
      const tasks = getWorkflowNodeActiveTasks(node);
      const size = getWorkflowNodeSize(node, tasks.length, tasks);
      return {
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${size.w}px`,
        minHeight: `${size.h}px`,
      };
    }

    const verifyStatsText = computed(() => {
      const v = form.verify;
      const sealOn = v.sealEnabled && v.seal?.targetDocs?.length;
      return `テキスト ${v.text.length} 件 · データ ${v.dataRules.length} 件 · 署名・印鑑 ${sealOn ? 'ON' : 'OFF'}`;
    });

    const masterStatsText = computed(() => {
      const m = form.master;
      const dict = getMasterDictionary(m.knowledgeSource?.dictionaryId);
      return `辞書 ${dict?.label || '未選択'} · 照合ルール ${m.mappings.length} 件`;
    });

    const knowledgeCatalog = computed(() => mergeKnowledgeCatalog(KNOWLEDGE_SOURCE_SEEDS, form.knowledgeSources || []));

    const externalApiConfig = computed(() => normalizeExternalApiConfig(form.processing.externalApi));

    const knowledgeQueryVariableOptions = computed(() => {
      const ocrOptions = (form.scene.documents || []).flatMap((doc) =>
        (getDocSchema(doc.type).fields || []).map((f) => ({
          value: `{{${doc.type}.${f}}}`,
          label: `${getDocDisplayLabel(doc.type)} · ${f}`,
        })));
      return [
        { value: '{{ocr.fields}}', label: 'OCR抽出フィールド（全体）' },
        { value: '{{case.primaryKey}}', label: '主キー値' },
        { value: '{{case.policyNo}}', label: '証券番号' },
        ...ocrOptions,
      ];
    });

    const knowledgeRetrievalStatsText = computed(() => {
      const cfg = externalApiConfig.value;
      const count = cfg.selectedSourceIds?.length || 0;
      return `ナレッジ ${count} 件 · Top ${cfg.topK} · 閾値 ${cfg.scoreThreshold}`;
    });

    const masterMatchPanelStatsText = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'master_match') return '';
      const mcpPart = masterMatchMcpInputSummary.value?.label || 'MCP 未接続';
      const matchCount = node.matchFieldIds?.length || 0;
      const outCount = node.outputFieldIds?.length || 0;
      const fmt = MASTER_MATCH_OUTPUT_FORMATS.find((f) => f.value === node.outputFormat);
      return `${mcpPart} · 照合 ${matchCount} · 出力 ${outCount} · ${fmt?.label || '正規化フィールド'}`;
    });

    const masterMatchMcpInputSummary = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'master_match') return null;
      const wf = getActiveWf();
      const mcp = getMasterMatchUpstreamMcp(wf, node.id);
      if (!mcp) {
        return {
          status: 'none',
          label: '上流 MCP ノード未接続',
        };
      }
      const summary = getMcpNodeCanvasSummary(mcp);
      const varName = getWorkflowNodeVarName(mcp, wf);
      return {
        status: 'ok',
        label: summary ? `${summary.serverLabel} » ${summary.toolLabel}` : getWorkflowNodeDisplayLabel(mcp),
        varName,
        token: `{${varName}.result}`,
      };
    });

    const masterMatchOcrInputSummary = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'master_match') return '';
      const count = node.matchFieldIds?.length || 0;
      if (!count) return '未選択';
      return `${count} フィールド`;
    });

    const masterMatchFieldOptions = computed(() =>
      (form.scene.documents || []).flatMap((doc) =>
        (getDocSchema(doc.type).fields || []).map((f) => ({
          value: `${doc.type}.${f}`,
          label: `${getDocDisplayLabel(doc.type)} · ${f}`,
        }))));

    const masterMatchOutputFieldOptions = computed(() => masterMatchFieldOptions.value);

    const mcpServerCatalog = computed(() => mergeMcpServerCatalog(MCP_SERVER_SEEDS, form.mcpServers || []));

    const selectedMcpToolSchema = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp') return null;
      return getMcpToolDef(node.mcpServerId, node.mcpToolId, mcpServerCatalog.value);
    });

    const mcpSelectedServer = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node?.mcpServerId) return null;
      return getMcpServerDef(node.mcpServerId, mcpServerCatalog.value);
    });

    const mcpVariableOptions = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node) return [];
      return buildMcpVariableOptions(getActiveWf(), node.id, form.scene.documents, getDocDisplayLabel);
    });

    function getMcpToolsForServer(serverId) {
      return getMcpServerDef(serverId, mcpServerCatalog.value)?.tools || [];
    }

    function getMcpServerStatusMeta(status) {
      return MCP_SERVER_STATUS_META[status] || MCP_SERVER_STATUS_META.connected;
    }

    function selectMcpServer(server) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp' || !server) return;
      if (!isMcpServerSelectable(server)) {
        ElementPlus.ElMessage.warning(`「${server.label}」は ${getMcpServerStatusMeta(server.status).label} のため選択できません`);
        return;
      }
      node.mcpServerId = server.id;
      node.mcpToolId = '';
      node.mcpInputs = [];
    }

    function selectMcpTool(toolId) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp' || !toolId) return;
      node.mcpToolId = toolId;
      node.mcpInputs = buildDefaultMcpInputs(node.mcpServerId, toolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
    }

    function onMcpServerChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp') return;
      const server = getMcpServerDef(node.mcpServerId, mcpServerCatalog.value);
      if (server && !isMcpServerSelectable(server)) {
        ElementPlus.ElMessage.warning(`「${server.label}」は ${getMcpServerStatusMeta(server.status).label} のため選択できません`);
        node.mcpServerId = '';
      }
      node.mcpToolId = '';
      node.mcpInputs = [];
    }

    function onMcpToolChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp') return;
      node.mcpInputs = buildDefaultMcpInputs(node.mcpServerId, node.mcpToolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
    }

    const mcpNodeParamSummary = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp' || !node.mcpToolId) return [];
      const tool = selectedMcpToolSchema.value;
      if (!tool?.params?.length) return [];
      const rows = node.mcpInputs?.length
        ? node.mcpInputs
        : buildDefaultMcpInputs(node.mcpServerId, node.mcpToolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
      return rows.map((row) => {
        const meta = tool.params.find((p) => p.key === row.key);
        const label = meta?.label || row.key;
        let display = row.value || '—';
        if (row.mode === 'variable') {
          const opt = mcpVariableOptions.value.find((o) => o.value === row.value);
          display = opt?.label || row.value || '—';
        }
        return { key: row.key, label, display, mode: row.mode };
      });
    });

    const mcpAdminReturnContext = ref(null);
    const mcpAdminSelectedServerId = ref('');
    const mcpAdminExpandedToolId = ref('');
    const mcpAdminDraftParams = reactive([]);

    const mcpAdminSelectedServer = computed(() => {
      if (!mcpAdminSelectedServerId.value) return null;
      return getMcpServerDef(mcpAdminSelectedServerId.value, mcpServerCatalog.value);
    });

    const mcpAdminTools = computed(() => mcpAdminSelectedServer.value?.tools || []);

    function openMcpServerManagement(serverId = '', toolId = '', fromWorkflow = false) {
      if (fromWorkflow) {
        mcpAdminReturnContext.value = {
          nodeId: selectedWorkflowNodeId.value,
        };
      } else {
        mcpAdminReturnContext.value = null;
      }
      const fallbackId = serverId || selectedWorkflowNode.value?.mcpServerId || mcpServerCatalog.value[0]?.id || '';
      mcpAdminSelectedServerId.value = fallbackId;
      mcpAdminExpandedToolId.value = toolId || selectedWorkflowNode.value?.mcpToolId || '';
      if (mcpAdminExpandedToolId.value) loadMcpAdminToolDraft();
      switchModule('mcp-servers');
    }

    function returnFromMcpAdmin() {
      const ctx = mcpAdminReturnContext.value;
      switchModule('case-workflow');
      if (ctx?.nodeId) {
        selectedWorkflowNodeId.value = ctx.nodeId;
        const node = getActiveWf()?.nodes?.find((n) => n.id === ctx.nodeId);
        syncCurrentNodeFromWorkflow(node);
        openWorkflowInspector('node');
      }
      mcpAdminReturnContext.value = null;
    }

    function selectMcpAdminServer(serverId) {
      mcpAdminSelectedServerId.value = serverId;
      mcpAdminExpandedToolId.value = '';
      mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length);
    }

    function loadMcpAdminToolDraft() {
      const serverId = mcpAdminSelectedServerId.value;
      const toolId = mcpAdminExpandedToolId.value;
      if (!serverId || !toolId) {
        mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length);
        return;
      }
      const rows = resolveMcpToolParamRows(serverId, toolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
      mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length, ...rows.map((r) => ({ ...r })));
    }

    function expandMcpAdminTool(toolId) {
      mcpAdminExpandedToolId.value = mcpAdminExpandedToolId.value === toolId ? '' : toolId;
      if (mcpAdminExpandedToolId.value) loadMcpAdminToolDraft();
      else mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length);
    }

    function setMcpAdminDraftParamMode(paramKey, mode) {
      const row = mcpAdminDraftParams.find((r) => r.key === paramKey);
      if (!row) return;
      row.mode = mode;
      if (mode === 'variable' && !String(row.value).startsWith('{{')) {
        row.value = mcpVariableOptions.value[0]?.value || '';
      }
      if (mode === 'fixed' && String(row.value).startsWith('{{')) {
        row.value = '';
      }
    }

    function applyMcpToolProfileToWorkflowNodes(serverId, toolId, rows) {
      const wf = getActiveWf();
      if (!wf?.nodes) return;
      wf.nodes.forEach((n) => {
        if (n.type === 'mcp' && n.mcpServerId === serverId && n.mcpToolId === toolId) {
          n.mcpInputs = cloneJson(rows);
        }
      });
    }

    function saveMcpAdminToolParams() {
      const serverId = mcpAdminSelectedServerId.value;
      const toolId = mcpAdminExpandedToolId.value;
      if (!serverId || !toolId) return;
      const rows = mcpAdminDraftParams.map((r) => ({ key: r.key, mode: r.mode || 'fixed', value: r.value ?? '' }));
      if (!form.mcpToolParamProfiles) form.mcpToolParamProfiles = {};
      if (!form.mcpToolParamProfiles[serverId]) form.mcpToolParamProfiles[serverId] = {};
      form.mcpToolParamProfiles[serverId][toolId] = rows;
      applyMcpToolProfileToWorkflowNodes(serverId, toolId, rows);
      const node = selectedWorkflowNode.value;
      if (node?.type === 'mcp' && node.mcpServerId === serverId && node.mcpToolId === toolId) {
        node.mcpInputs = cloneJson(rows);
      }
      ElementPlus.ElMessage.success('Tool パラメータを保存しました');
    }

    function getMcpAdminParamMeta(paramKey) {
      const tool = mcpAdminTools.value.find((t) => t.id === mcpAdminExpandedToolId.value);
      return tool?.params?.find((p) => p.key === paramKey);
    }

    function getWorkflowNodeIoFooter(node) {
      return getWorkflowNodeIo(node);
    }

    function ensureMcpInputRow(node, paramKey) {
      if (!node?.mcpInputs) node.mcpInputs = [];
      let row = node.mcpInputs.find((r) => r.key === paramKey);
      if (!row) {
        row = { key: paramKey, value: '', mode: 'fixed' };
        node.mcpInputs.push(row);
      }
      return row;
    }

    function getMcpInputMode(node, paramKey) {
      return ensureMcpInputRow(node, paramKey).mode || 'fixed';
    }

    function setMcpInputMode(node, paramKey, mode) {
      const row = ensureMcpInputRow(node, paramKey);
      row.mode = mode;
      if (mode === 'variable' && !String(row.value).startsWith('{{')) {
        row.value = mcpVariableOptions.value[0]?.value || '';
      }
      if (mode === 'fixed' && String(row.value).startsWith('{{')) {
        row.value = '';
      }
    }

    function getMcpInputValue(node, paramKey) {
      return ensureMcpInputRow(node, paramKey).value ?? '';
    }

    function setMcpInputValue(node, paramKey, value) {
      ensureMcpInputRow(node, paramKey).value = value;
    }

    const mcpServerCreateVisible = ref(false);
    const mcpServerCreateDraft = reactive({
      name: '',
      description: '',
      serverType: MCP_SERVER_TYPES[0].value,
      endpoint: '',
    });

    function openMcpServerCreateDialog() {
      Object.assign(mcpServerCreateDraft, {
        name: '',
        description: '',
        serverType: MCP_SERVER_TYPES[0].value,
        endpoint: '',
      });
      mcpServerCreateVisible.value = true;
    }

    function saveMcpServerFromDraft() {
      if (!mcpServerCreateDraft.name.trim()) {
        ElementPlus.ElMessage.warning('サーバー名を入力してください');
        return;
      }
      const id = `mcp-custom-${Date.now()}`;
      const item = normalizeMcpServerItem({
        id,
        label: mcpServerCreateDraft.name.trim(),
        description: mcpServerCreateDraft.description.trim() || `${MCP_SERVER_TYPES.find((t) => t.value === mcpServerCreateDraft.serverType)?.label || 'HTTP'} 接続（mock）`,
        status: 'connected',
        serverType: mcpServerCreateDraft.serverType,
        endpoint: mcpServerCreateDraft.endpoint.trim(),
        tools: [{
          id: 'invoke',
          label: 'カスタム呼び出し',
          description: '登録したエンドポイントを呼び出します',
          params: [
            { key: 'payload', label: 'Payload', type: 'string', required: false, placeholder: '{{ocr.fields}}' },
          ],
        }],
      });
      if (!form.mcpServers) form.mcpServers = [];
      form.mcpServers.push(item);
      mcpServerCreateVisible.value = false;
      ElementPlus.ElMessage.success('MCP サーバーを登録しました');
      if (currentModule.value === 'mcp-servers') {
        selectMcpAdminServer(item.id);
        mcpAdminExpandedToolId.value = item.tools[0]?.id || '';
        loadMcpAdminToolDraft();
      } else {
        const node = selectedWorkflowNode.value;
        if (node?.type === 'mcp') selectMcpServer(item);
      }
    }

    const knowledgeCreateVisible = ref(false);
    const knowledgeCreateDraft = reactive({
      name: '',
      description: '',
      embeddingModel: KNOWLEDGE_EMBEDDING_MODELS[0].value,
      type: 'document',
      webRootUrl: '',
      selector: 'body',
      apiEndpoint: '',
      apiKey: '',
    });

    function openKnowledgeCreateDialog() {
      Object.assign(knowledgeCreateDraft, {
        name: '',
        description: '',
        embeddingModel: KNOWLEDGE_EMBEDDING_MODELS[0].value,
        type: 'document',
        webRootUrl: '',
        selector: 'body',
        apiEndpoint: '',
        apiKey: '',
      });
      knowledgeCreateVisible.value = true;
    }

    function saveKnowledgeSource() {
      if (!knowledgeCreateDraft.name.trim()) {
        ElementPlus.ElMessage.warning('ナレッジ名を入力してください');
        return;
      }
      if (knowledgeCreateDraft.type === 'website' && !knowledgeCreateDraft.webRootUrl.trim()) {
        ElementPlus.ElMessage.warning('Web Root URL を入力してください');
        return;
      }
      const item = normalizeKnowledgeSourceItem({
        ...knowledgeCreateDraft,
        id: newRuleId('kb'),
        name: knowledgeCreateDraft.name.trim(),
        description: knowledgeCreateDraft.description.trim(),
        fileCount: knowledgeCreateDraft.type === 'document' ? 0 : undefined,
      });
      if (!form.knowledgeSources) form.knowledgeSources = [];
      form.knowledgeSources.push(item);
      const cfg = normalizeExternalApiConfig(form.processing.externalApi);
      if (!cfg.selectedSourceIds.includes(item.id)) {
        cfg.selectedSourceIds.push(item.id);
        form.processing.externalApi = cfg;
      }
      knowledgeCreateVisible.value = false;
      ElementPlus.ElMessage.success('ナレッジ数据源を作成しました');
    }

    function getKnowledgeSourceLabel(id) {
      return getKnowledgeCatalog(knowledgeCatalog.value, id)?.name || id;
    }

    function getKnowledgeSourceMeta(id) {
      return getKnowledgeCatalog(knowledgeCatalog.value, id);
    }

    function isKnowledgeSourceSelected(id) {
      return (form.processing.externalApi?.selectedSourceIds || []).includes(id);
    }

    function toggleKnowledgeSourceSelection(id) {
      const cfg = normalizeExternalApiConfig(form.processing.externalApi);
      const idx = cfg.selectedSourceIds.indexOf(id);
      if (idx >= 0) {
        if (cfg.selectedSourceIds.length <= 1) {
          ElementPlus.ElMessage.warning('少なくとも1件のナレッジを選択してください');
          return;
        }
        cfg.selectedSourceIds.splice(idx, 1);
      } else {
        cfg.selectedSourceIds.push(id);
      }
      form.processing.externalApi = cfg;
    }

    const masterKnowledgeSource = computed(() => normalizeKnowledgeSource(form.master.knowledgeSource));

    const masterRuleDraft = reactive({
      docType: '',
      field: '',
      lookupField: '',
      outputFields: [],
    });
    const editingMasterRuleId = ref(null);

    const masterDraftFieldOptions = computed(() =>
      (masterRuleDraft.docType ? getDocSchema(masterRuleDraft.docType).fields : []));

    const masterDraftLookupOptions = computed(() => {
      if (masterKnowledgeSource.value.type !== 'dict') return [];
      return getMasterDictFieldOptions(form.master.knowledgeSource.dictionaryId);
    });

    const masterDraftOutputOptions = computed(() => {
      const selected = new Set(masterRuleDraft.outputFields || []);
      return getMasterOutputFieldOptions(form.master.knowledgeSource)
        .filter((opt) => !selected.has(opt.value));
    });

    const isMasterDictSource = computed(() => true);
    const isMasterRemoteSource = computed(() => false);

    function resetMasterRuleDraft() {
      editingMasterRuleId.value = null;
      Object.assign(masterRuleDraft, {
        docType: sceneDocTypes.value[0] || '',
        field: '',
        lookupField: '',
        outputFields: [],
      });
    }

    function onMasterKnowledgeSourceTypeChange(type) {
      form.master.knowledgeSource = normalizeKnowledgeSource(createMasterPipelineTool(type, { id: 'master-source' }));
    }

    function onMasterKnowledgeSourceDictChange() {
      const src = form.master.knowledgeSource;
      const dict = getMasterDictionary(src.dictionaryId);
      if (dict && !masterRuleDraft.lookupField) {
        masterRuleDraft.lookupField = dict.lookupField || '';
      }
    }

    function masterRuleSummary(rule) {
      const r = enrichMasterRule(rule, form.master.knowledgeSource);
      const out = (r.outputFields || []).join('、') || '—';
      const lookupPart = r.sourceType === 'dict' && r.lookupField ? `[${r.lookupField}]` : '';
      return `${getDocDisplayLabel(r.docType)} · ${r.field} → ${r.sourceLabel}${lookupPart} → ${out}`;
    }

    function editMasterRule(rule) {
      editingMasterRuleId.value = rule.id;
      selectedMasterRuleId.value = rule.id;
      Object.assign(masterRuleDraft, {
        docType: rule.docType,
        field: rule.field,
        lookupField: rule.lookupField || rule.dictLookupField || '',
        outputFields: [...(rule.outputFields || [])],
      });
    }

    function addMasterDraftOutputField(field) {
      if (!field || masterRuleDraft.outputFields.includes(field)) return;
      masterRuleDraft.outputFields.push(field);
    }

    function removeMasterDraftOutputField(index) {
      masterRuleDraft.outputFields.splice(index, 1);
    }

    function moveMasterDraftOutputField(index, delta) {
      const next = index + delta;
      if (next < 0 || next >= masterRuleDraft.outputFields.length) return;
      const arr = masterRuleDraft.outputFields;
      [arr[index], arr[next]] = [arr[next], arr[index]];
    }

    function saveMasterRuleFromDraft() {
      if (!masterRuleDraft.docType || !masterRuleDraft.field) {
        ElementPlus.ElMessage.warning('帳票タイプと OCR 項目を入力してください');
        return;
      }
      if (isMasterDictSource.value && !masterRuleDraft.lookupField) {
        ElementPlus.ElMessage.warning('照合先（辞書フィールド）を選択してください');
        return;
      }
      if (!masterRuleDraft.outputFields.length) {
        ElementPlus.ElMessage.warning('出力フィールドを1件以上選択してください');
        return;
      }
      const payload = enrichMasterRule({
        id: editingMasterRuleId.value || newRuleId('m'),
        docType: masterRuleDraft.docType,
        field: masterRuleDraft.field,
        lookupField: isMasterDictSource.value ? masterRuleDraft.lookupField : '',
        outputFields: [...masterRuleDraft.outputFields],
      }, form.master.knowledgeSource);
      if (editingMasterRuleId.value) {
        const idx = form.master.mappings.findIndex((r) => r.id === editingMasterRuleId.value);
        if (idx >= 0) form.master.mappings[idx] = payload;
      } else {
        form.master.mappings.push(payload);
      }
      ElementPlus.ElMessage.success('照合ルールを保存しました');
      resetMasterRuleDraft();
    }

    function addMasterRule() {
      resetMasterRuleDraft();
    }

    function removeMasterRule(id) {
      form.master.mappings = form.master.mappings.filter((r) => r.id !== id);
      if (editingMasterRuleId.value === id) resetMasterRuleDraft();
      if (selectedMasterRuleId.value === id) selectedMasterRuleId.value = null;
    }

    function getMasterKnowledgeIcon(type) {
      const icons = { dict: '📚', web_search: '🔍', web_crawl: '🌐', external_api: '🔗', llm: '✦' };
      return icons[type] || '📎';
    }

    const outputNamingPreview = computed(() => {
      const naming = form.output.naming || OUTPUT_NAMING_DEFAULTS;
      const ctx = {
        sceneName: form.scene.name || currentScene.value?.name,
        docType: getDocDisplayLabel(form.scene.documents?.[0]?.type || '診断書'),
      };
      const caseFile = resolveNamingPattern(naming.caseFilePattern, ctx);
      const docFile = resolveNamingPattern(
        naming.usePerDocFilePattern ? naming.docFilePattern : naming.caseFilePattern,
        ctx
      );
      return {
        caseFile: caseFile ? `${caseFile}.json` : '',
        docFile: docFile ? `${docFile}.json` : '',
        apiObjectKey: resolveNamingPattern(naming.apiObjectKey, ctx),
        apiPayloadName: resolveNamingPattern(naming.apiPayloadName, ctx),
        excelSheet: resolveNamingPattern(naming.excelSheetPattern, ctx),
      };
    });

    function insertNamingToken(targetKey, token) {
      if (!form.output.naming) {
        form.output.naming = normalizeOutputNaming(form.output);
      }
      const naming = form.output.naming;
      if (!naming) return;
      const current = String(naming[targetKey] || '');
      naming[targetKey] = current + token;
      if (targetKey === 'caseFilePattern') {
        form.output.fileNamePattern = naming.caseFilePattern;
      }
    }

    function onMasterTemplateChange(templateId) {
      form.master.templateId = templateId;
      const normalized = normalizeMasterConfig(form.master);
      form.master.toolChain = normalized.toolChain;
    }

    let syncDictFieldsCallCount = 0;
    function syncDictFieldsOnOutput() {
      syncDictFieldsCallCount += 1;
      if (syncDictFieldsCallCount <= 5 || syncDictFieldsCallCount % 50 === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:syncDictFieldsOnOutput',message:'sync dict fields on output',data:{syncDictFieldsCallCount},timestamp:Date.now(),hypothesisId:'C',runId:'hang-debug'})}).catch(()=>{});
        // #endregion
      }
      form.output.docFields = attachDictFieldsToDocFields(
        form.output.docFields,
        form.master.mappings,
        form.master.knowledgeSource,
      );
    }

    watch(
      () => {
        const src = form.master.knowledgeSource;
        return `${src?.type}:${src?.dictionaryId}:${src?.endpoint}:${src?.queryTemplate}`;
      },
      () => syncDictFieldsOnOutput(),
      { immediate: true, deep: true },
    );

    watch(
      () => form.master.mappings.map((r) =>
        `${r.id}:${r.docType}:${r.field}:${r.lookupField}:${(r.outputFields || []).join(',')}`
      ).join('\u0001'),
      () => syncDictFieldsOnOutput(),
      { immediate: true, deep: true },
    );

    const dataRuleCount = computed(() => form.verify.dataRules.length);

    function textRuleDisplayText(rule) {
      const raw = rule.natural || rule.label || ruleReadableText(rule.text || '');
      return replaceDocTypeIdsInText(raw);
    }

    function textRuleExpressionText(rule) {
      const expr = (rule.text || '').trim();
      if (!expr) return '';
      const display = textRuleDisplayText(rule);
      if (expr === display || ruleReadableText(expr) === display) return '';
      return expr;
    }

    function formatFieldRef(fieldRef) {
      if (!fieldRef || !fieldRef.doc) return '';
      const docLabel = getDocDisplayLabel(fieldRef.doc);
      if (fieldRef.table && fieldRef.column) {
        return `${docLabel} · ${fieldRef.table}.${fieldRef.column}${fieldRef.sum ? ' 合計' : ''}`;
      }
      if (fieldRef.sum) return `${docLabel} · 合計`;
      return `${docLabel} · ${fieldRef.field}`;
    }

    function legacyCrossRuleText(rule) {
      if (rule.mode === 'natural') return rule.description || '';
      if (rule.mode === 'expression') {
        const op = rule.operator || '=';
        if (rule.operator === '正規表現') {
          return `${formatFieldRef(rule.left)} は正規表現 ${rule.rightRegex || rule.rightLiteral || '…'} に一致すること`;
        }
        if (rule.rightKind === 'literal' || rule.right?.literal) {
          return `${formatFieldRef(rule.left)} ${op} ${rule.rightLiteral || '…'}`;
        }
        return `${formatFieldRef(rule.left)} ${op} ${formatFieldRef(rule.right)}`;
      }
      if (rule.chips?.length) {
        return `${rule.chips.map((c) => formatFieldRef(c)).join('、')}は一致すること`;
      }
      return '';
    }

    function dataRuleNaturalText(rule) {
      return rule.description || rule.natural || rule.text || rule.label || '';
    }

    function dataRuleText(rule) {
      if (rule.expression?.trim()) return rule.expression.trim();
      const text = rule.text?.trim() || '';
      if (/\{\{[^}]+\}\}/.test(text)) return text;
      const desc = rule.description?.trim() || '';
      if (/\{\{[^}]+\}\}/.test(desc)) return desc;
      return legacyCrossRuleText(rule);
    }

    function dataRuleDisplayText(rule) {
      const natural = dataRuleNaturalText(rule);
      if (natural) return replaceDocTypeIdsInText(natural);
      return ruleReadableText(dataRuleText(rule));
    }

    function dataRuleExpressionText(rule) {
      let expr = rule.expression?.trim() || '';
      if (!expr) {
        const natural = dataRuleNaturalText(rule);
        if (natural && !/\{\{[^}]+\}\}/.test(natural)) {
          const compiled = compileNaturalToExpression(natural, sceneDocTypes.value);
          if (compiled && compiled !== natural && /\{\{/.test(compiled)) expr = compiled;
        }
      }
      if (!expr) expr = dataRuleText(rule);
      if (!expr) return '';
      const display = dataRuleDisplayText(rule);
      if (expr === display || ruleReadableText(expr) === display) return '';
      return expr;
    }

    const dataFieldOptions = computed(() => {
      const docs = dataPickerDocs.value || [];
      if (!docs.length) return [];
      const fieldSets = docs.map((doc) => new Set(getDocSchema(doc).fields || []));
      const shared = [...fieldSets[0]].filter((f) => fieldSets.every((set) => set.has(f)));
      if (shared.length) return shared;
      const union = new Set();
      docs.forEach((doc) => (getDocSchema(doc).fields || []).forEach((f) => union.add(f)));
      return [...union];
    });
    const textFieldOptions = computed(() => {
      const docs = textPickerDocs.value || [];
      if (!docs.length) return [];
      const fieldSets = docs.map((doc) => new Set(getDocSchema(doc).fields || []));
      const shared = [...fieldSets[0]].filter((f) => fieldSets.every((set) => set.has(f)));
      if (shared.length) return shared;
      const union = new Set();
      docs.forEach((doc) => (getDocSchema(doc).fields || []).forEach((f) => union.add(f)));
      return [...union];
    });

    const textDraftPreview = computed(() =>
      resolveTextDraftExpression(textDraft, sceneDocTypes.value, {
        doc: textPickerDocs.value[0] || '',
        field: textPickerField.value,
      })
    );
    const dataDraftPreview = computed(() =>
      resolveDataDraftExpression(dataDraft, sceneDocTypes.value)
    );

    const dataRuleSaveError = computed(() => validateExecutableRule(dataDraftPreview.value));
    const textRuleSaveError = computed(() => validateTextRule(textDraftPreview.value));
    const dataDraftSavable = computed(() => !dataRuleSaveError.value);
    const textDraftSavable = computed(() => !textRuleSaveError.value);
    const textExpressionExpanded = ref({});
    const dataExpressionExpanded = ref({});

    function isExpressionExpanded(type, ruleId) {
      const store = type === 'text' ? textExpressionExpanded.value : dataExpressionExpanded.value;
      return !!store[ruleId];
    }

    function toggleExpressionExpanded(type, ruleId) {
      const store = type === 'text' ? textExpressionExpanded.value : dataExpressionExpanded.value;
      store[ruleId] = !store[ruleId];
    }

    function resetRulePickers() {
      const docs = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      dataPickerDocs.value = [...docs];
      dataPickerField.value = '';
      textPickerDocs.value = [...docs];
      textPickerField.value = '';
    }

    function resetTextDraft() {
      textDraft.input = '';
      textDraft.compiled = '';
      textEditingId.value = null;
      textPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      textPickerField.value = '';
    }

    function resetDataDraft() {
      dataDraft.input = '';
      dataDraft.compiled = '';
      dataEditingId.value = null;
      dataPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      dataPickerField.value = '';
    }

    function editDataRule(rule) {
      dataEditingId.value = rule.id;
      const natural = dataRuleNaturalText(rule) || ruleReadableText(dataRuleText(rule));
      dataDraftSyncing = true;
      dataDraft.input = natural;
      dataDraft.compiled = dataRuleText(rule) || '';
      dataDraftSyncing = false;
      dataPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      dataPickerField.value = '';
    }

    function cancelDataEdit() {
      resetDataDraft();
    }

    function insertDataFromPicker() {
      if (!dataPickerDocs.value.length || !dataPickerField.value) {
        ElementPlus.ElMessage.warning('帳票タイプとフィールドを選択してください');
        return;
      }
      const tokens = dataPickerDocs.value.map((doc) => formatFieldToken(doc, dataPickerField.value));
      dataDraft.input += (dataDraft.input ? ' ' : '') + tokens.join(' ');
    }

    function clearDataDraft() {
      dataDraft.input = '';
      dataDraft.compiled = '';
    }

    function dataDraftTolerance() {
      return descriptionHasAmountFields(dataDraftPreview.value) ? '¥100' : '—';
    }

    function saveDataRule() {
      const expression = dataDraftPreview.value;
      const natural = dataDraft.input.trim();
      const err = validateExecutableRule(expression);
      if (err) {
        ElementPlus.ElMessage.warning(err);
        return;
      }
      const payload = {
        mode: 'natural',
        description: natural || ruleReadableText(expression),
        natural: natural || ruleReadableText(expression),
        expression,
        label: natural || ruleReadableText(expression),
        tolerance: dataDraftTolerance(),
        action: DEFAULT_VERIFY_ACTION,
        invalid: false,
      };
      if (dataEditingId.value) {
        const idx = form.verify.dataRules.findIndex((r) => r.id === dataEditingId.value);
        if (idx >= 0) Object.assign(form.verify.dataRules[idx], payload);
        ElementPlus.ElMessage.success('検証ルールを更新しました');
      } else {
        form.verify.dataRules.push({ id: newRuleId('c'), ...payload });
        ElementPlus.ElMessage.success('検証ルールを追加しました');
      }
      resetDataDraft();
    }

    function removeDataRule(id) {
      form.verify.dataRules = form.verify.dataRules.filter((r) => r.id !== id);
      if (dataEditingId.value === id) resetDataDraft();
    }

    function aiAssistDataRule() {
      if (!dataDraft.input.trim()) {
        ElementPlus.ElMessage.warning('条件を入力してください');
        return;
      }
      dataAiLoading.value = true;
      setTimeout(() => {
        const compiled = compileNaturalToExpression(dataDraft.input, sceneDocTypes.value);
        if (!isCompiledRuleResult(compiled, dataDraft.input)) {
          ElementPlus.ElMessage.warning('実行式に変換できませんでした。帳票名・フィールドを明確に記述するか、左側で帳票/フィールドを選択してください');
          dataAiLoading.value = false;
          return;
        }
        dataDraft.compiled = compiled;
        dataPreviewFlash.value = true;
        setTimeout(() => { dataPreviewFlash.value = false; }, 1600);
        dataAiLoading.value = false;
        ElementPlus.ElMessage.success('実行式を生成しました');
      }, 400);
    }

    function insertTextFromPicker() {
      if (!textPickerDocs.value.length || !textPickerField.value) {
        ElementPlus.ElMessage.warning('帳票タイプとフィールドを選択してください');
        return;
      }
      const tokens = textPickerDocs.value.map((doc) => formatFieldToken(doc, textPickerField.value));
      textDraft.input += (textDraft.input ? ' ' : '') + tokens.join(' ');
    }

    function clearTextDraft() {
      textDraft.input = '';
      textDraft.compiled = '';
    }

    function editTextRule(rule) {
      textEditingId.value = rule.id;
      textDraftSyncing = true;
      textDraft.input = rule.natural || ruleReadableText(rule.text || '');
      textDraft.compiled = rule.text || '';
      textDraftSyncing = false;
      textPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      textPickerField.value = '';
    }

    function cancelTextEdit() {
      resetTextDraft();
    }

    function saveTextRule() {
      const expression = textDraftPreview.value;
      const natural = textDraft.input.trim();
      const err = validateTextRule(expression);
      if (err) {
        ElementPlus.ElMessage.warning(err);
        return;
      }
      const payload = {
        mode: 'natural',
        text: expression,
        natural: natural || ruleReadableText(expression),
        label: natural || ruleReadableText(expression),
        action: DEFAULT_VERIFY_ACTION,
      };
      if (textEditingId.value) {
        const idx = form.verify.text.findIndex((r) => r.id === textEditingId.value);
        if (idx >= 0) Object.assign(form.verify.text[idx], payload);
        ElementPlus.ElMessage.success('テキスト検証ルールを更新しました');
      } else {
        form.verify.text.push({ id: newRuleId('t'), ...payload });
        ElementPlus.ElMessage.success('テキスト検証ルールを追加しました');
      }
      resetTextDraft();
    }

    function removeTextRule(id) {
      form.verify.text = form.verify.text.filter((r) => r.id !== id);
      if (textEditingId.value === id) resetTextDraft();
    }

    function aiAssistTextRule() {
      if (!textDraft.input.trim()) {
        ElementPlus.ElMessage.warning('条件を入力してください');
        return;
      }
      textAiLoading.value = true;
      setTimeout(() => {
        const picker = { doc: textPickerDocs.value[0] || '', field: textPickerField.value };
        const compiled = compileNaturalToTextRule(textDraft.input, sceneDocTypes.value, picker);
        if (!isCompiledRuleResult(compiled, textDraft.input)) {
          const hint = textPickerDocs.value.length && textPickerField.value
            ? '記述形式を確認してください。例：備考に「不備」が含まれない / 请求金额要≤1000元'
            : '帳票名・フィールドを記述するか、左側で帳票/フィールドを選択してください';
          ElementPlus.ElMessage.warning(`正規表現に変換できませんでした。${hint}`);
          textAiLoading.value = false;
          return;
        }
        textDraft.compiled = compiled;
        textPreviewFlash.value = true;
        setTimeout(() => { textPreviewFlash.value = false; }, 1600);
        textAiLoading.value = false;
        ElementPlus.ElMessage.success('正規表現を生成しました');
      }, 400);
    }

    watch(dataPickerDocs, () => { dataPickerField.value = ''; }, { deep: true });
    watch(
      () => masterRuleDraft.docType,
      (docType, prev) => {
        if (docType === prev) return;
        masterRuleDraft.field = '';
      },
    );
    watch(textPickerDocs, () => { textPickerField.value = ''; }, { deep: true });
    watch(() => textDraft.input, () => {
      if (!textDraftSyncing) textDraft.compiled = '';
    });
    watch(() => dataDraft.input, () => {
      if (!dataDraftSyncing) dataDraft.compiled = '';
    });
    watch(workflowSetupStep, (step) => {
      if (step === 2) enterWorkflowCanvasView();
    });

    watch(() => sceneSetupDraft.mainDocType, () => {
      clearSceneSetupLinkCheckDisplay();
      if (sceneSetupDraft.documents.length >= 2 && !(sceneSetupDraft.docFieldLinks || []).length) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        );
      }
    });
    watch(
      () => [
        sceneSetupDraft.documents.map((d) => d.type).join('\u0001'),
        (sceneSetupDraft.docFieldLinks || []).length,
      ].join('\u0002'),
      () => { clearSceneSetupLinkCheckDisplay(); },
    );
    let sceneSyncEffectCount = 0;
    watch(
      () => form.scene.documents.map((d) => d.type).join('\u0001'),
      () => {
        sceneSyncEffectCount += 1;
        if (sceneSyncEffectCount <= 5 || sceneSyncEffectCount % 50 === 0) {
          // #region agent log
          fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:scene-sync-effect',message:'scene sync effect run',data:{sceneSyncEffectCount,docTypeCount:form.scene.documents.length},timestamp:Date.now(),hypothesisId:'A',runId:'hang-debug'})}).catch(()=>{});
          // #endregion
        }
        const allowed = form.scene.documents.map((d) => d.type);
        const img = form.processing.image;
        const nextRotate = filterImageDocTypes(img.rotateDocTypes, allowed);
        const nextPerspective = filterImageDocTypes(img.perspectiveDocTypes, allowed);
        const nextSplit = filterImageDocTypes(img.splitDocTypes, allowed);
        if (JSON.stringify(nextRotate) !== JSON.stringify(img.rotateDocTypes || [])) img.rotateDocTypes = nextRotate;
        if (JSON.stringify(nextPerspective) !== JSON.stringify(img.perspectiveDocTypes || [])) img.perspectiveDocTypes = nextPerspective;
        if (JSON.stringify(nextSplit) !== JSON.stringify(img.splitDocTypes || [])) img.splitDocTypes = nextSplit;
        applySceneAggregate(form.scene, form.scene.documents);
        syncOutputDocFieldsBySceneDocs();
      },
      { immediate: true },
    );
    syncOcrExtractTypes();
    resetTextDraft();
    resetDataDraft();
    syncCurrentNodeFromWorkflow(getActiveWf()?.nodes?.find((n) => n.id === selectedWorkflowNodeId.value));

    const addedDocTypes = computed(() =>
      new Set(sceneSetupDraft.documents.map((d) => d.type))
    );

    function isDocTypeAdded(typeId) {
      return addedDocTypes.value.has(typeId);
    }

    function openDocPicker() {
      if (sceneSetupDraft.documents.length >= MAX_DOCS) {
        ElementPlus.ElMessage.warning(`帳票は最大 ${MAX_DOCS} 件までです`);
        return;
      }
      docPickerMode.value = 'setup';
      docPickerSearch.value = '';
      syncDocPickerSelection();
      docPickerVisible.value = true;
    }

    function confirmAddDoc() {
      const targetDocs = sceneSetupDraft.documents;
      const ids = docPickerSelectedIds.value.filter((id) => DOC_TYPE_MAP[id] && !isDocTypeAdded(id));
      if (!ids.length) {
        ElementPlus.ElMessage.warning('追加する帳票を選択してください');
        return;
      }
      const remaining = MAX_DOCS - targetDocs.length;
      const toAdd = ids.slice(0, remaining);
      if (toAdd.length < ids.length) {
        ElementPlus.ElMessage.warning(`帳票は最大 ${MAX_DOCS} 件までです。${toAdd.length} 件を追加しました`);
      }
      toAdd.forEach((typeId) => {
        targetDocs.push({ type: typeId, submission: '必須', group: '', linkField: '' });
      });
      applySceneSetupAggregate();
      docPickerSelectedIds.value = [];
      docPickerVisible.value = false;
      if (!sceneSetupDraft.docFieldLinks.length && sceneSetupDraft.documents.length >= 2) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        );
      }
      if (toAdd.length) ElementPlus.ElMessage.success(`${toAdd.length} 件の帳票を追加しました`);
    }

    function removeDoc(index) {
      form.scene.documents.splice(index, 1);
      syncOcrExtractTypes();
      syncOutputDocFieldsBySceneDocs();
    }

    function onSubmissionChange(doc) {
      if (doc.submission === '代替可') doc.submission = '任意';
      doc.group = '';
    }

    function isChannelEnabled(channelId) {
      return form.processing.input.channels.includes(channelId);
    }

    function toggleChannel(channelId, enabled) {
      const channels = form.processing.input.channels;
      if (enabled) {
        if (!channels.includes(channelId)) channels.push(channelId);
      } else {
        const i = channels.indexOf(channelId);
        if (i >= 0) channels.splice(i, 1);
      }
    }

    function reorderOutputExportRow(docType, fromIndex, toIndex) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc) return;
      if (!doc.itemOrder?.length) {
        doc.itemOrder = buildDefaultItemOrder(doc.fields, doc.tables);
      }
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= doc.itemOrder.length) return;
      const clampedTo = Math.min(toIndex, doc.itemOrder.length - 1);
      if (fromIndex === clampedTo) return;
      const [moved] = doc.itemOrder.splice(fromIndex, 1);
      doc.itemOrder.splice(clampedTo, 0, moved);
      applyItemOrderToDoc(doc);
    }

    function resetOutputDragState() {
      outputDragState.kind = '';
      outputDragState.docType = '';
      outputDragState.fromIndex = -1;
      outputDragState.overIndex = -1;
    }

    function onOutputExportRowDragStart(docType, index, event) {
      outputDragState.kind = 'export-row';
      outputDragState.docType = docType;
      outputDragState.fromIndex = index;
      outputDragState.overIndex = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${docType}:export-row:${index}`);
    }

    function onOutputExportRowDragOver(docType, index, event) {
      event.preventDefault();
      if (outputDragState.kind !== 'export-row' || outputDragState.docType !== docType) return;
      outputDragState.overIndex = index;
      event.dataTransfer.dropEffect = 'move';
    }

    function onOutputExportRowDrop(docType, index, event) {
      event.preventDefault();
      if (outputDragState.kind !== 'export-row' || outputDragState.docType !== docType || outputDragState.fromIndex < 0) return;
      reorderOutputExportRow(docType, outputDragState.fromIndex, index);
      resetOutputDragState();
    }

    function onOutputExportRowDragEnd() {
      resetOutputDragState();
    }

    function isOutputExportRowDragOver(docType, index) {
      return outputDragState.kind === 'export-row'
        && outputDragState.docType === docType
        && outputDragState.fromIndex >= 0
        && outputDragState.overIndex === index
        && outputDragState.fromIndex !== index;
    }

    function isOutputExportRowDragging(docType, index) {
      return outputDragState.kind === 'export-row'
        && outputDragState.docType === docType
        && outputDragState.fromIndex === index;
    }

    function moveOutputDocField(docType, fromIndex, direction) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc?.itemOrder?.length) return;
      const fieldKeys = doc.itemOrder.filter((k) => k.startsWith('field:'));
      const key = `field:${doc.fields[fromIndex]?.name}`;
      const orderIndex = doc.itemOrder.indexOf(key);
      if (orderIndex < 0) return;
      const targetFieldIndex = fromIndex + direction;
      if (targetFieldIndex < 0 || targetFieldIndex >= doc.fields.length) return;
      const targetKey = `field:${doc.fields[targetFieldIndex]?.name}`;
      const targetOrderIndex = doc.itemOrder.indexOf(targetKey);
      if (targetOrderIndex < 0) return;
      reorderOutputExportRow(docType, orderIndex, targetOrderIndex);
    }

    function reorderOutputDocField(docType, fromIndex, toIndex) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc?.itemOrder?.length) return;
      const key = `field:${doc.fields[fromIndex]?.name}`;
      const orderIndex = doc.itemOrder.indexOf(key);
      const targetKey = `field:${doc.fields[toIndex]?.name}`;
      const targetOrderIndex = doc.itemOrder.indexOf(targetKey);
      if (orderIndex < 0 || targetOrderIndex < 0) return;
      reorderOutputExportRow(docType, orderIndex, targetOrderIndex);
    }

    function outputTableColumnLabel(tableName, columnName) {
      return formatTableColumnLabel(tableName, columnName);
    }

    function outputFieldPath(docType, fieldName) {
      return formatFieldToken(docType, fieldName);
    }

    function toggleExportPreviewExpand(nodeId, event) {
      event?.stopPropagation?.();
      exportPreviewExpanded[nodeId] = !exportPreviewExpanded[nodeId];
    }

    function setExportPreviewSubtreeChecked(node, checked) {
      exportPreviewChecked[node.id] = checked;
      (node.children || []).forEach((child) => setExportPreviewSubtreeChecked(child, checked));
    }

    function onExportPreviewCheckboxChange(node, checked) {
      setExportPreviewSubtreeChecked(node, checked);
    }

    function toggleExportPreviewSelectAll(checked) {
      collectExportPreviewNodes(exportPreviewRoot.value).forEach((node) => {
        exportPreviewChecked[node.id] = checked;
      });
    }

    function onExportPreviewRowClick(node) {
      if (node.docType) outputSelectedDocType.value = node.docType;
    }

    function isExportPreviewRowActive(node) {
      return !!node.docType && node.docType === outputSelectedDocType.value;
    }

    function setOutputFormat(format) {
      form.output.format = format;
    }

    function setAllOutputDocFieldsChecked(docType, checked) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc) return;
      (doc.fields || []).forEach((f) => { f.checked = checked; });
      (doc.tables || []).forEach((table) => {
        table.checked = checked;
        (table.columns || []).forEach((col) => { col.checked = checked; });
      });
    }

    function setActiveOutputDocFieldsChecked(checked) {
      const doc = activeOutputDocFields.value;
      if (!doc) return;
      setAllOutputDocFieldsChecked(doc.docType, checked);
    }

    function outputDocCheckedCount(docFields) {
      let count = (docFields.fields || []).filter((f) => f.checked).length;
      (docFields.tables || []).forEach((table) => {
        count += (table.columns || []).filter((c) => c.checked).length;
      });
      return count;
    }

    function outputDocTotalCount(docFields) {
      let count = (docFields.fields || []).length;
      (docFields.tables || []).forEach((table) => {
        count += (table.columns || []).length;
      });
      return count;
    }

    function outputTableColumnPath(docType, tableName, columnName) {
      return formatTableColumnToken(docType, tableName, columnName);
    }

    function canMoveOutputFieldUp(index) {
      return index > 0;
    }

    function canMoveOutputFieldDown(docType, index) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      return !!doc && index < doc.fields.length - 1;
    }

    function outputDocFieldSummary(docFields) {
      const parts = [];
      const fTotal = (docFields.fields || []).length;
      if (fTotal) {
        const fChecked = docFields.fields.filter((f) => f.checked).length;
        parts.push(`フィールド ${fChecked}/${fTotal}`);
      }
      const tables = docFields.tables || [];
      if (tables.length) {
        const tChecked = tables.filter((t) => t.checked).length;
        const colChecked = tables.reduce(
          (n, t) => n + (t.checked ? t.columns.filter((c) => c.checked).length : 0),
          0
        );
        const colTotal = tables.reduce((n, t) => n + (t.columns || []).length, 0);
        parts.push(`テーブル ${tChecked}/${tables.length}（列 ${colChecked}/${colTotal}）`);
      }
      return parts.join(' · ') || '出力項目なし';
    }

    function selectScene(id, options = {}) {
      if (!options.skipFinishRename && renamingSceneId.value && renamingSceneId.value !== id) {
        const renaming = scenes.value.find((s) => s.id === renamingSceneId.value);
        if (renaming) finishRenameScene(renaming);
      }
      currentSceneId.value = id;
      const scene = scenes.value.find((s) => s.id === id);
      if (!scene) return;
      const stored = loadSceneFromStorage(id);
      const next = normalizeLoadedForm(stored) || sceneFormByScene(scene);
      Object.keys(form).forEach((k) => delete form[k]);
      Object.assign(form, next);
      ensureFormWorkflows(form);
      savedSnapshot.value = JSON.stringify(form);
      if (options.focusScene) {
        selectedWorkflowNodeId.value = null;
        selectedWorkflowEdgeKey.value = null;
        inspectorMode.value = 'scene';
      } else {
        selectedWorkflowNodeId.value = form.workflows?.case?.nodes?.[0]?.id || 'wf-in';
        inspectorMode.value = 'node';
        syncCurrentNodeFromWorkflow(form.workflows.case?.nodes?.find((n) => n.id === selectedWorkflowNodeId.value));
      }
      initWorkflowHistory('案件フローを読み込み');
      workflowSetupStep.value = 2;
      sceneSetupVisible.value = false;
      sceneSetupMode.value = 'edit';
      sceneSetupDraft.sceneId = id;
      enterWorkflowCanvasView();
      nextTick(() => fitWorkflowToView());
    }

    function prevNode() {
      const i = nodeIndex.value;
      if (i > 0) currentNode.value = NODE_ORDER[i - 1];
    }

    function nextNode() {
      const i = nodeIndex.value;
      if (i < NODE_ORDER.length - 1) currentNode.value = NODE_ORDER[i + 1];
    }

    function validateSceneAggregate() {
      if (!getSceneMainDocType(form.scene)) return '主帳票を選択してください';
      return '';
    }

    function handleSave() {
      if (currentNode.value === 'scene') {
        const err = validateSceneAggregate();
        if (err) {
          ElementPlus.ElMessage.warning(err);
          return;
        }
      }
      savedSnapshot.value = JSON.stringify(form);
      saveStorage(currentSceneId.value, form);
      ElementPlus.ElMessage.success(isLastNode.value ? '設定を保存しました' : '保存しました');
    }

    function resetNode() {
      ElementPlus.ElMessageBox.confirm('このステップの変更を破棄してリセットしますか？', '', {
        confirmButtonText: 'OK',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }).then(() => {
        const saved = JSON.parse(savedSnapshot.value);
        const node = currentNode.value;
        if (node === 'scene') form.scene = saved.scene;
        else if (['input', 'image', 'hitl'].includes(node)) form.processing[node] = saved.processing[node];
        else if (node === 'ocr') form.processing.ocrExtract = cloneJson(saved.processing.ocrExtract || WORKFLOW_DEFAULTS.ocrExtract);
        else if (node === 'master') {
          form.processing.externalApi = cloneJson(saved.processing.externalApi || saved.processing.rag || KNOWLEDGE_RETRIEVAL_DEFAULTS);
          form.knowledgeSources = (saved.knowledgeSources || []).map(normalizeKnowledgeSourceItem);
          form.mcpServers = (saved.mcpServers || []).map(normalizeMcpServerItem);
          delete form.processing.rag;
        }
        else if (node === 'verify') {
          form.verify = saved.verify;
          form.master = cloneJson(saved.master);
        }
        else if (node === 'output') form.output = saved.output;
        ElementPlus.ElMessage.info('リセットしました');
      }).catch(() => {});
    }

    function syncOutputDocFieldsBySceneDocs() {
      form.output = normalizeOutputConfig(form.output, form.scene.documents, form.master.mappings, form.master.knowledgeSource);
    }

    function applyCommonHitlRoleToAll() {
      const role = form.processing.hitl.role;
      if (!role) {
        ElementPlus.ElMessage.warning('先に共通復核ロールを選択してください');
        return;
      }
      form.processing.hitl.imageRole = role;
      form.processing.hitl.ocrRole = role;
      form.processing.hitl.masterRole = role;
      form.processing.hitl.verifyRole = role;
      form.processing.hitl.exportRole = role;
      ElementPlus.ElMessage.success('共通ロールを各ノードへ適用しました');
    }

    function onHitlSpecificRolesToggle(enabled) {
      if (enabled) applyCommonHitlRoleToAll();
    }

    onMounted(() => {
      // #region agent log
      fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:onMounted-start',message:'onMounted-start',data:{workflowSetupStep:workflowSetupStep.value},timestamp:Date.now(),hypothesisId:'E',runId:'hang-debug'})}).catch(()=>{});
      // #endregion
      if (!form.master.knowledgeSource) {
        form.master.knowledgeSource = normalizeKnowledgeSource(null);
      }
      resetMasterRuleDraft();
      // #region agent log
      fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:onMounted-after-resetMaster',message:'onMounted-after-resetMaster',data:{},timestamp:Date.now(),hypothesisId:'E',runId:'hang-debug'})}).catch(()=>{});
      // #endregion
      initWorkflowHistory('初期状態');
      // #region agent log
      fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:onMounted-after-initHistory',message:'onMounted-after-initHistory',data:{historyLen:wfHistoryTimeline.value.length},timestamp:Date.now(),hypothesisId:'E',runId:'hang-debug'})}).catch(()=>{});
      // #endregion
      // 确保 workflow layout 只在 mount 时执行一次（不能在 computed 内执行写操作）
      const _wfCase = form.workflows?.case;
      if (_wfCase && (!_wfCase.layoutVersion || _wfCase.layoutVersion < 3)) {
        layoutWorkflowGraph(_wfCase);
      }
      if (workflowSetupStep.value === 2) enterWorkflowCanvasView();
      // #region agent log
      fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:onMounted-before-nextTick',message:'onMounted-before-nextTick',data:{},timestamp:Date.now(),hypothesisId:'E',runId:'hang-debug'})}).catch(()=>{});
      // #endregion
      nextTick(() => {
        fitWorkflowToView();
        flashWorkflowTemplateHint();
        // #region agent log
        fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:onMounted-nextTick',message:'onMounted-nextTick-done',data:{hasHeader:!!document.querySelector('.top-header')},timestamp:Date.now(),hypothesisId:'E',runId:'hang-debug'})}).catch(()=>{});
        // #endregion
      });
      document.addEventListener('keydown', onWfKeyDown);
    });
    onBeforeUnmount(() => {
      if (wfTemplateHintTimer) clearTimeout(wfTemplateHintTimer);
      clearSceneSetupLinkCheckDisplay();
      document.removeEventListener('keydown', onWfKeyDown);
    });

    // #region agent log
    fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:setup-end',message:'setup-end-before-return',data:{},timestamp:Date.now(),hypothesisId:'E',runId:'hang-debug'})}).catch(()=>{});
    // #endregion
    return {
      sceneSearch,
      currentSceneId,
      currentNode,
      currentProduct,
      form,
      scenes,
      nodes,
      extractFields,
      ocrExtractItems,
      ocrExtractStats,
      toggleOcrExtract,
      filteredScenes,
      treeProps,
      currentScene,
      sceneArchiveTree,
      isFirstNode,
      isLastNode,
      saveButtonText,
      sceneStats,
      outputFieldCount,
      outputTableStats,
      getSceneMainDocTypes,
      getSceneMainDocType,
      selectedHitlRoleHint,
      selectedHitlGateRoleHint,
      onHitlGateContextChange,
      onHitlGateConditionTypeChange: onHitlGateContextChange,
      onJudgmentContextChange,
      onDecisionElseLabelChange,
      getNotifyRecipientsLabel,
      getNotifyRecipientsPlaceholder,
      validateNotifyRecipients,
      onNotifyRecipientsBlur,
      CASE_WORKFLOW_TRIGGER_EVENTS,
      WORKFLOW_SCHEDULE_MODES,
      WORKFLOW_INTERVAL_UNITS,
      isStartCaseEventEnabled,
      onStartTriggerChange,
      toggleStartCaseEvent,
      toggleStartSchedule,
      END_NAMING_TOKENS,
      onEndNamingChange,
      insertEndNamingToken,
      CODE_PARAM_DATA_TYPES,
      CODE_PARAM_SOURCES,
      CODE_OUTPUT_TYPES,
      DEFAULT_CODE_PYTHON,
      codeVariableOptions,
      codeVariableOptionGroups,
      codeParamDialogVisible,
      codeParamDialogMode,
      codeParamDialogDraft,
      codeParamDialogTitle,
      codeParamDialogConfirmLabel,
      codeParamDialogSavable,
      openCodeParamDialog,
      closeCodeParamDialog,
      confirmCodeParamDialog,
      getCodeParamDataTypeLabel,
      getCodeParamSourceLabel,
      formatCodeInputRowDisplay,
      addCodeInputRow,
      removeCodeInputRow,
      onCodeFieldChange,
      formatCodeInputVariableToken,
      normalizeCodeNode,
      formatHitlActionsLabel,
      isHitlActionSelected,
      toggleHitlAction,
      judgmentAllowsElif,
      decisionVariableOptionGroups,
      getDecisionVariableOptionGroups,
      JUDGMENT_CONTEXT_OPTIONS,
      HITL_ACTION_OPTIONS,
      HITL_CONTEXT_OPTIONS,
      HITL_PRESET_OPTIONS,
      inferHitlContext,
      getHitlContextMeta,
      getHitlGatePreset,
      isHitlGateNode,
      HITL_GATE_PRESETS,
      CONDITION_NODE_PRESETS,
      GATEWAY_JUDGMENT_TYPES,
      GATEWAY_CONDITION_LOGIC,
      GATEWAY_TIMEOUT_STRATEGIES,
      GATEWAY_RERUN_POLICIES,
      decisionUsesThreshold,
      getGatewayTypeMeta,
      getDecisionThresholdLabel,
      getDecisionThresholdRange,
      decisionReturnTargetOptions,
      NOTIFY_CHANNELS,
      NOTIFY_TEMPLATES,
      onNotifyTemplateChange,
      getDecisionYesRule,
      getDecisionNoRule,
      getDecisionElseDisplayText,
      getDecisionCaseDisplayText,
      getDecisionIfCondition,
      getDecisionElseConditionPreview,
      getDecisionElseCanvasPreview,
      formatDecisionConditionToken,
      getNotifyNodeSubject,
      getNotifyNodeBodyPreview,
      getNotifyNodeBodyText,
      ocrModeTagType,
      outputConflictResolutions: OUTPUT_CONFLICT_RESOLUTIONS,
      outputMaskingLevels: OUTPUT_MASKING_LEVELS,
      outputFormats: OUTPUT_FORMATS,
      outputEncodings: OUTPUT_ENCODINGS,
      outputSheetExportModeOptions: OUTPUT_SHEET_EXPORT_MODE_OPTIONS,
      hitlRoleOptions: HITL_ROLE_OPTIONS,
      docPickerVisible,
      docPickerMode,
      sceneSetupVisible,
      workflowSetupStep,
      sceneSetupMode,
      sceneSetupDraft,
      sceneSetupPageTitle,
      sceneSetupSceneIdDisplay,
      sceneSetupConfirmLabel,
      sceneSetupDocTypeOptions,
      sceneSetupLinkStats,
      sceneSetupUnlinkedDocLabels,
      sceneSetupLinkCheckSummary,
      sceneSetupLinkCheckVisible,
      checkSceneDocLinks,
      sceneSetupNetworkLayout,
      confirmSceneSetup,
      proceedToWorkflowStep,
      resetSceneSetup,
      enterWorkflowCanvasView,
      cancelSceneSetup,
      goToWorkflowSetupStep,
      openSceneSetupDocPicker,
      removeSceneSetupDoc,
      setSceneSetupMainDoc,
      addDocFieldLink,
      removeDocFieldLink,
      autoMatchDocFieldLinks,
      getSceneSetupFieldOptions,
      editSceneSettings,
      openEditCurrentSceneSettings,
      onSceneMenuCommand,
      getSceneMatchingLabel,
      docPickerSearch,
      docPickerSelectedIds,
      docTypeRegistryFiltered,
      DOC_TYPE_REGISTRY,
      docPickerAvailableCount,
      isDocTypeAdded,
      onDocPickerOpened,
      toggleDocPickerItem,
      isDocPickerItemSelected,
      openDocPicker,
      confirmAddDoc,
      removeDoc,
      onSubmissionChange,
      getInputChannelLabel,
      inputChannels: INPUT_CHANNELS,
      isChannelEnabled,
      toggleChannel,
      moveOutputDocField,
      reorderOutputDocField,
      reorderOutputExportRow,
      onOutputExportRowDragStart,
      onOutputExportRowDragOver,
      onOutputExportRowDrop,
      onOutputExportRowDragEnd,
      isOutputExportRowDragOver,
      isOutputExportRowDragging,
      activeOutputExportRows,
      outputTableColumnLabel,
      outputTableColumnPath,
      outputFieldPath,
      canMoveOutputFieldUp,
      canMoveOutputFieldDown,
      outputFieldsActivePanel,
      outputSelectedDocType,
      exportPreviewRows,
      exportPreviewExpanded,
      exportPreviewChecked,
      exportPreviewSelectAllState,
      toggleExportPreviewExpand,
      onExportPreviewCheckboxChange,
      toggleExportPreviewSelectAll,
      onExportPreviewRowClick,
      isExportPreviewRowActive,
      activeOutputDocFields,
      setOutputFormat,
      setAllOutputDocFieldsChecked,
      setActiveOutputDocFieldsChecked,
      outputDocCheckedCount,
      outputDocTotalCount,
      getDocExportLabel,
      getDocDisplayLabel,
      submissionDisplayLabel,
      submissionTagType,
      outputDocFieldSummary,
      selectScene,
      prevNode,
      nextNode,
      handleSave,
      resetNode,
      applyCommonHitlRoleToAll,
      onHitlSpecificRolesToggle,
      verifyActivePanels,
      dataEditingId,
      dataDraft,
      dataPickerDocs,
      dataPickerField,
      dataFieldOptions,
      dataAiLoading,
      dataPreviewFlash,
      dataRuleDisplayText,
      dataRuleExpressionText,
      ruleReadableText,
      dataDraftPreview,
      DATA_NATURAL_PLACEHOLDER,
      DATA_CONDITION_GUIDE,
      dataDraftSavable,
      dataRuleSaveError,
      dataRuleText,
      editDataRule,
      cancelDataEdit,
      insertDataFromPicker,
      clearDataDraft,
      saveDataRule,
      removeDataRule,
      aiAssistDataRule,
      sceneDocTypes,
      verifyStatsText,
      masterStatsText,
      dataRuleCount,
      APP_NAV_GROUPS,
      currentModule,
      fixedDocSettingsTarget,
      isCaseWorkflowModule,
      modulePageMeta,
      INSPECTOR_HINTS,
      wfTemplateHintVisible,
      flashWorkflowTemplateHint,
      MOCK_USER_ROLES,
      mockUserRole,
      workflowTopologyMode,
      canSwitchWorkflowTopologyMode,
      isWorkflowTopologyEditable,
      workflowModeLabel,
      setWorkflowTopologyMode,
      wfConnectSourceId,
      isConnectModeSource,
      getNodeMainOutTargetId,
      setNodeMainOutTarget,
      getDecisionPreset,
      getDecisionYesRule,
      getDecisionNoRule,
      getDecisionYesExpression,
      getDecisionConditionDisplay,
      DECISION_PRESET_EXPRESSION,
      getHitlGateYesRule,
      getHitlGateNoRule,
      getWorkflowYesExpression,
      workflowYesExpressionNote,
      INPUT_FORMAT_OPTIONS,
      INPUT_MAX_FILE_SIZE_MB,
      CASE_MATCHING_PRIORITY_OPTIONS,
      CASE_MASTERLESS_OPTIONS,
      CASE_SUPPLEMENT_OPTIONS,
      switchModule,
      openFixedDocSettings,
      activeWorkflow,
      appNavCollapsed,
      docSettingsMenuOpen,
      toggleDocSettingsMenu,
      processingForm,
      FLOW_NODE_OPTIONS,
      wfNodePicker,
      wfNodePickerAvailableProcessGroups,
      wfNodePickerProcessGroups,
      wfNodePickerLogicOptions,
      wfNodePickerHoveredLogic,
      exitWorkflowInspector,
      openWfNodePicker,
      openWfNodePickerForDecisionBranch,
      closeWfNodePicker,
      pickWorkflowProcessNode,
      pickWorkflowLogicNode,
      showWfNodeAddBtn,
      renamingSceneId,
      createNewScene,
      startRenameScene,
      finishRenameScene,
      canUndoWorkflow,
      canRedoWorkflow,
      undoWorkflow,
      redoWorkflow,
      wfChangeHistoryVisible,
      workflowHistoryEntries,
      wfHistoryIndex,
      restoreWorkflowHistoryEntry,
      canSwapWorkflowNodeLeft,
      canSwapWorkflowNodeRight,
      swapSelectedWorkflowNode,
      wfConnectPreviewPath,
      selectedWorkflowNodeId,
      selectedWorkflowNode,
      inspectorPanel,
      inspectorTitle,
      inspectorHeadHint,
      workflowNodeOutputVars,
      showWorkflowNodeOutputSection,
      workflowNodeOutputHint,
      getWorkflowNodeOutputVarItems,
      formatWorkflowOutputVarToken,
      WORKFLOW_NODE_OUTPUT_VAR_DEFS,
      inspectorMode,
      workflowEdgePaths,
      selectWorkflowNode,
      removeWorkflowNode,
      confirmRemoveSelectedWorkflowNode,
      addWorkflowNodeFromLibrary,
      createWorkflowNodeAt,
      wfCanvasViewportRef,
      wfCanvasStageStyle,
      wfZoomPercent,
      workflowStageSize,
      fitWorkflowToView,
      zoomWorkflowIn,
      zoomWorkflowOut,
      resetWorkflowZoom,
      onWfViewportWheel,
      onWfViewportPointerDown,
      openSceneInspector,
      onWfLibraryDragStart,
      onWfCanvasDragOver,
      onWfCanvasDrop,
      onWfNodePointerDown,
      getWorkflowNodeMeta,
      getWorkflowNodeIoFooter,
      workflowOverviewSummary,
      WORKFLOW_WORKSHOP_CHECKLIST,
      MCP_SERVER_SEEDS,
      MCP_REGISTRY,
      MCP_OUTPUT_VARS,
      MCP_SERVER_STATUS_META,
      MCP_SERVER_TYPES,
      MCP_PARAM_MODES,
      mcpServerCatalog,
      mcpSelectedServer,
      mcpVariableOptions,
      getMcpServerStatusMeta,
      selectMcpServer,
      selectMcpTool,
      getMcpToolsForServer,
      onMcpServerChange,
      onMcpToolChange,
      selectedMcpToolSchema,
      getMcpInputMode,
      setMcpInputMode,
      getMcpInputValue,
      setMcpInputValue,
      formatMcpOutputVarToken,
      mcpServerCreateVisible,
      mcpServerCreateDraft,
      openMcpServerCreateDialog,
      openMcpServerManagement,
      returnFromMcpAdmin,
      mcpAdminReturnContext,
      mcpAdminSelectedServerId,
      mcpAdminExpandedToolId,
      mcpAdminSelectedServer,
      mcpAdminTools,
      mcpAdminDraftParams,
      selectMcpAdminServer,
      expandMcpAdminTool,
      loadMcpAdminToolDraft,
      saveMcpAdminToolParams,
      setMcpAdminDraftParamMode,
      getMcpAdminParamMeta,
      isMcpCustomServer,
      mcpNodeParamSummary,
      saveMcpServerFromDraft,
      isMcpServerSelectable,
      MASTER_MATCH_STRATEGIES,
      MASTER_MATCH_OUTPUT_FORMATS,
      masterMatchFieldOptions,
      masterMatchOutputFieldOptions,
      masterMatchMcpInputSummary,
      masterMatchOcrInputSummary,
      masterMatchPanelStatsText,
      sceneSidebarCollapsed,
      toggleSceneSidebar,
      libraryPanelCollapsed,
      inspectorPanelCollapsed,
      inspectorPanelWidth,
      inspectorWorkspaceStyle,
      inspectorResizing,
      toggleLibraryPanel,
      toggleInspectorPanel,
      onInspectorResizeStart,
      getWorkflowNodeStyle,
      formatWfNodeLabel,
      getWorkflowNodeActiveTasks,
      PREPROCESS_SETTING_ITEMS,
      isPreprocessSettingOn,
      showPreprocessSettingDetail,
      DECISION_CONDITION_TYPES,
      DECISION_RESULT_VALUES,
      DECISION_OPERATORS,
      decisionVariableOptions,
      getDecisionVariableOptions,
      previewDecisionCase,
      previewDecisionNode,
      decisionConditionPreview,
      decisionUsesValueField,
      decisionUsesResultValue,
      onDecisionConditionFieldChange,
      onDecisionConditionTypeChange,
      onDecisionCustomExpressionChange,
      onDecisionYesRuleChange,
      onDecisionNoRuleChange,
      onDecisionThresholdChange,
      onHitlGateYesRuleChange,
      onHitlGateNoRuleChange,
      workflowConditionAiLoading,
      workflowConditionPreviewFlash,
      aiAssistWorkflowCondition,
      FRAUD_DETECT_METHOD_OPTIONS,
      FRAUD_DETECT_PS_CATEGORY,
      WORKFLOW_MAIN_CHAIN_ORDER,
      getWorkflowStartNode,
      getWorkflowMainChainOrderLabel,
      openWfNodePickerFromShortcut,
      addDecisionElifCase,
      removeDecisionCase,
      addDecisionCondition,
      removeDecisionCondition,
      getDecisionCaseKindLabel,
      getDecisionNodeBranches,
      getDecisionPortStyle,
      getDecisionPortLabelStyle,
      getDecisionBranchTarget,
      getDecisionBranchTargetId,
      setDecisionBranchTarget,
      isDecisionConditionAuto,
      isDecisionConditionPreset,
      isDecisionCasePreset,
      getWorkflowNodeDisplayLabel,
      workflowEdgeKey,
      selectedWorkflowEdgeKey,
      selectedWorkflowEdge,
      hoveredWorkflowEdgeKey,
      onWorkflowEdgeMouseEnter,
      onWorkflowEdgeMouseLeave,
      isWorkflowEdgeInsertVisible,
      openWfNodePickerOnEdge,
      workflowNodeOptions,
      getWorkflowEdgeSummary,
      selectWorkflowEdge,
      removeSelectedWorkflowEdge,
      onWfConnectHandleDown,
      onWfNodeAddInClick,
      onWfNodeAddOutClick,
      wfConnectDrag,
      wfConnectHoverTargetId,
      wfLibraryDrag,
      masterRuleSummary,
      masterKnowledgeSource,
      EXTERNAL_API_IO,
      KNOWLEDGE_SOURCE_TYPES,
      KNOWLEDGE_EMBEDDING_MODELS,
      KNOWLEDGE_RETRIEVAL_MODES,
      KNOWLEDGE_OUTPUT_VARS,
      knowledgeCatalog,
      externalApiConfig,
      knowledgeQueryVariableOptions,
      knowledgeRetrievalStatsText,
      knowledgeCreateVisible,
      knowledgeCreateDraft,
      openKnowledgeCreateDialog,
      saveKnowledgeSource,
      getKnowledgeSourceLabel,
      getKnowledgeSourceMeta,
      isKnowledgeSourceSelected,
      toggleKnowledgeSourceSelection,
      getWorkflowNodeVarName,
      getWorkflowNodeDefaultVarName,
      isWorkflowProcessingNode,
      getKnowledgeSourceTypeLabel,
      MASTER_KNOWLEDGE_SOURCE_TYPES,
      masterRuleDraft,
      editingMasterRuleId,
      masterDraftFieldOptions,
      masterDraftLookupOptions,
      masterDraftOutputOptions,
      isMasterDictSource,
      onMasterKnowledgeSourceTypeChange,
      onMasterKnowledgeSourceDictChange,
      resetMasterRuleDraft,
      editMasterRule,
      saveMasterRuleFromDraft,
      addMasterDraftOutputField,
      removeMasterDraftOutputField,
      moveMasterDraftOutputField,
      addMasterRule,
      getMasterDictFieldOptions,
      getMasterOutputFieldOptions,
      isMasterRemoteSource,
      getMasterKnowledgeIcon,
      MASTER_DICTIONARIES,
      getMasterPipelineToolMeta,
      removeMasterRule,
      MASTER_TOOL_TEMPLATES,
      onMasterTemplateChange,
      outputNamingTokens: OUTPUT_NAMING_TOKENS,
      outputNamingPreview,
      insertNamingToken,
      textRuleDisplayText,
      textEditingId,
      textDraft,
      textPickerDocs,
      textPickerField,
      textFieldOptions,
      textAiLoading,
      textPreviewFlash,
      textDraftPreview,
      textDraftSavable,
      textRuleSaveError,
      TEXT_NATURAL_PLACEHOLDER,
      TEXT_CONDITION_GUIDE,
      insertTextFromPicker,
      clearTextDraft,
      editTextRule,
      cancelTextEdit,
      saveTextRule,
      removeTextRule,
      aiAssistTextRule,
      SEAL_FIELD_SUGGESTIONS,
      textRuleExpressionText,
      isExpressionExpanded,
      toggleExpressionExpanded,
    };
  },
};

const InspectorFieldLabel = {
  name: 'InspectorFieldLabel',
  props: {
    label: { type: String, required: true },
    hint: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const { h, resolveComponent } = Vue;
      if (!props.hint) {
        return h('label', { class: 'inspector-field-label' }, props.label);
      }
      const ElTooltip = resolveComponent('ElTooltip');
      return h('label', { class: 'inspector-field-label inspector-field-label--with-tip' }, [
        h('span', null, props.label),
        h(
          ElTooltip,
          { content: props.hint, placement: 'top', showAfter: 200 },
          {
            default: () =>
              h(
                'button',
                { type: 'button', class: 'inspector-field-tip', 'aria-label': '説明' },
                '?',
              ),
          },
        ),
      ]);
    };
  },
};

const InspectorTitle = {
  name: 'InspectorTitle',
  props: {
    title: { type: String, required: true },
    hint: { type: String, default: '' },
    extraClass: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const { h, resolveComponent } = Vue;
      const children = [h('span', null, props.title)];
      if (props.hint) {
        const ElTooltip = resolveComponent('ElTooltip');
        children.push(
          h(
            ElTooltip,
            { content: props.hint, placement: 'top', showAfter: 200 },
            {
              default: () =>
                h(
                  'button',
                  { type: 'button', class: 'inspector-field-tip', 'aria-label': '説明' },
                  '?',
                ),
            },
          ),
        );
      }
      const classes = ['inspector-section-title', 'inspector-section-title--with-tip'];
      if (props.extraClass) classes.push(props.extraClass);
      return h('div', { class: classes }, children);
    };
  },
};

// #region agent log
fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:pre-mount',message:'pre-mount',data:{build:PROTOTYPE_BUILD,vueOk:typeof Vue!=='undefined',epOk:typeof ElementPlus!=='undefined'},timestamp:Date.now(),hypothesisId:'E',runId:'post-fix'})}).catch(()=>{});
// #endregion
const app = createApp(appOptions);
app.component('InspectorFieldLabel', InspectorFieldLabel);
app.component('InspectorTitle', InspectorTitle);
app.use(ElementPlus);
try {
  app.mount('#app');
  // #region agent log
  fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:mount-ok',message:'mount-success',data:{build:PROTOTYPE_BUILD,hasHeader:!!document.querySelector('.top-header'),appInnerLen:document.getElementById('app')?.innerHTML?.length||0},timestamp:Date.now(),hypothesisId:'E',runId:'post-fix'})}).catch(()=>{});
  setTimeout(function(){fetch('http://127.0.0.1:7876/ingest/60bfb8a0-da44-4072-992e-0772074959d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6c1f19'},body:JSON.stringify({sessionId:'6c1f19',location:'main.js:event-loop-tick',message:'event-loop-alive',data:{build:PROTOTYPE_BUILD},timestamp:Date.now(),hypothesisId:'E',runId:'post-fix'})}).catch(function(){});},0);
  // #endregion
} catch (mountErr) {
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#b42318;background:#fef3f2;border:1px solid #fecdca;border-radius:8px;margin:16px;">'
      + '<strong>アプリの起動に失敗しました</strong><pre style="white-space:pre-wrap;margin-top:12px;font-size:13px;">'
      + String(mountErr?.message || mountErr).replace(/</g, '&lt;')
      + '</pre></div>';
  }
  throw mountErr;
}
