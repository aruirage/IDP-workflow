const { createApp, ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } = Vue;

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
    connectHint: '出力ポートをドラッグするか、2 ノードを順にクリック、または Inspector で接続先を指定できます。',
    flowKey: 'case',
  },
};

/** Inspector セクションタイトル横 ? ツールチップ用（本文は編集欄に表示しない） */
const INSPECTOR_HINTS = {
  edgeEdit: '接続線をクリックで選択（ハイライト）。線上の + でノードを挿入できます。Backspace / Delete で削除後、出力ポートからドラッグまたはクリックで再接続できます。',
  edgeReadonly: '設定モードでは接続の変更はできません。',
  connect: '出力ポートをドラッグするか、2 ノードを順にクリックして接続します。接続線上の + で途中にノードを挿入できます。',
  connectReadonly: '設定モードでは接続の変更はできません。',
  scene: '業務シーン作成時、またはステップ1で関連帳票・案件集約・帳票間関連を設定します。',
  inputSetting: '画面上アップロードまたは APIアップロードでファイルを受け付けます。APIアップロードを有効にした場合はエンドポイント URL を指定します。',
  inputLimits: 'ファイル形式・最大ファイルサイズ（上限 20MB・それ以下のみ）を指定します。',
  preprocess: '画質・回転・補正・分割・分類の各設定です。DPI 未満の画像は HITL へ送付します。対象帳票を未指定の場合はシーン内の全帳票タイプが対象です。',
  ocrSetting: 'LLM-OCR と信頼度閾値を設定します。閾値未満フィールドは要確認として扱います。',
  ocrExtract: 'シーンに登録した帳票タイプごとに OCR 抽出の実行有無を設定します。テンプレート・フィールド詳細は定型帳票設定から連携します。',
  masterMatch: 'Workflow 内で参照する外部ナレッジ数据源を登録・選択します。結果は AI検証の MASTER照合 で引用されます。',
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
  aiVerify: 'テキスト・データ・完全性の3種類の検証ルールを設定します。不備検出時は HITL キューへ送ります。',
  completeness: '必須・任意帳票の収集状態を検証します。帳票タイプは業務シーン設定で登録し、ここで必須/任意を指定します。',
  textVerify: '自然言語で記述し、AI補助で実行式を生成します。入力欄の下にプレビューが表示されます。',
  dataVerify: '帳票間の整合性と業務ロジックを自然言語で記述し、AI補助で実行式をプレビュー表示します。',
  seal: '署名・印鑑が存在するかを検出します。類似度閾値未満は不備として扱います。',
  hitlGate: 'プリセットまたはカスタム条件を指定します。自然言語は ✦ AI補助 で実行式（正規表現・エンジン判定式）に変換できます。',
  decision: 'プリセットを選ぶと IF / ELSE の判定変数が自動設定されます。IF = 変数が 1（命中）、ELSE = 0（不命中）。変数は上流処理ノードの出力変数から下拉で選択します。',
  fraudDetect: '画像の PS 痕跡・改ざんの有無を判定します。画像リスクスコアが閾値以上の場合、条件分岐または人工確認へ送ります。',
  notify: '不備・補件・エスカレーション等の通知を送信します。テンプレート選択後も件名・本文を編集できます。',
  hitlLegacy: '前処理・OCR抽出・外部API連携・AI検証・出力の各ノードで HITL が発生した場合の復核ロールを設定します。',
  output: '自動エクスポート設定です。命名規則・ファイル形式・出力フィールドを指定します。',
  outputFields: 'OCR 抽出フィールドの出力有無と順序を設定します。辞書照合結果は AI検証の MASTER照合設定に従い自動で出力されます（ここでの再設定は不要です）。',
  outputNaming: '貴社命名規則の詳細（チューリッヒ様提供予定）に合わせてテンプレートを調整します。下記は Phase 1 想定のプレースホルダーです。',
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

const DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS = [
  'wf-in', 'wf-pp', 'wf-d-pp', 'wf-hu-pp', 'wf-n-pp',
  'wf-oc', 'wf-d-oc', 'wf-hu-oc', 'wf-n-oc',
  'wf-mm', 'wf-ai', 'wf-d-ai', 'wf-hu-ai', 'wf-n-ai', 'wf-ex',
];

/** 主処理チェーンの推奨順序（Dify Start → 処理ノード） */
const WORKFLOW_MAIN_CHAIN_ORDER = [
  { type: 'input', label: '入力', step: 1 },
  { type: 'preprocess', label: '前処理', step: 2 },
  { type: 'ocr', label: 'OCR抽出', step: 3 },
  { type: 'master_match', label: '外部API連携', step: 4 },
  { type: 'ai_verify', label: 'AI検証', step: 5 },
  { type: 'output', label: '出力', step: 6 },
];

const WORKFLOW_MAIN_CHAIN_TYPE_ORDER = Object.fromEntries(
  WORKFLOW_MAIN_CHAIN_ORDER.map((item, idx) => [item.type, idx]),
);

/** 処理ノード（制御・ナレッジ以外） */
const WORKFLOW_PROCESSING_NODE_TYPES = new Set([
  'input', 'preprocess', 'ocr', 'ai_verify', 'output', 'fraud_detect',
]);

/** ノード出力変数の既定名（IF/ELSE で {varName}.result として参照） */
const WORKFLOW_NODE_DEFAULT_VAR = {
  input: 'input',
  preprocess: 'preprocess',
  ocr: 'ocr',
  master_match: 'external_api',
  ai_verify: 'verify',
  output: 'output',
  fraud_detect: 'fraud_detect',
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
  return node && (WORKFLOW_PROCESSING_NODE_TYPES.has(node.type) || node.type === 'master_match');
}

/** 案件フロー：ノードライブラリ分组 */
const CASE_FLOW_NODE_GROUPS = [
  {
    category: '処理ノード',
    nodes: [
      { type: 'input', label: '入力', summary: 'UI/API ファイル受付' },
      { type: 'preprocess', label: '前処理', summary: '回転・分割・補正・分類' },
      { type: 'ocr', label: 'OCR抽出', summary: 'テンプレート・フィールド抽出' },
      { type: 'ai_verify', label: 'AI検証', summary: 'テキスト・データ・完全性' },
      { type: 'output', label: '出力', summary: 'CSV/JSON/API 連携' },
      { type: 'fraud_detect', label: '画像不正検出', summary: 'PS痕跡・画像改ざんの検知' },
    ],
  },
  {
    category: '外部API連携',
    nodes: [
      { type: 'master_match', label: '外部API連携', summary: 'ナレッジ检索 · 参照登録' },
    ],
  },
  {
    category: '条件分岐',
    nodes: [
      { type: 'decision', label: '条件分岐', summary: 'IF/ELSE · プリセット条件', defaultCondition: 'case_ready' },
    ],
  },
  {
    category: '人工確認',
    nodes: [
      { type: 'hitl_gate', label: '人工確認', summary: 'プリセットまたはカスタム条件で審査', defaultPreset: 'verify_hitl' },
    ],
  },
  {
    category: '通知',
    nodes: [
      { type: 'notify', label: '通知', summary: '不備・補件・エスカレーション' },
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
]);

const WORKFLOW_INSPECTOR_MAP = {
  case_link: 'case_link',
  hitl_gate: 'hitl_gate',
  ocr_confirm: 'hitl_gate',
  verify_confirm: 'hitl_gate',
  scene_aggregate: 'case_link',
  scene_completeness: 'case_link',
  input: 'input',
  preprocess: 'image',
  ocr: 'ocr',
  confirm: 'hitl_gate',
  master_match: 'master_match',
  ai_verify: 'ai_verify',
  fraud_detect: 'fraud_detect',
  output: 'output',
  decision: 'decision',
  notify: 'notify',
};

const WORKFLOW_NODE_META = {
  case_link: {
    icon: '案',
    title: '案件関連',
    desc: '主帳票と関連帳票の関係',
    tasks: [],
    input: 'Document',
    output: 'Case Context',
  },
  hitl_gate: {
    icon: '人',
    title: '人工確認',
    desc: '要確認時の審査タスク',
    tasks: [],
    input: 'Process Result',
    output: 'Confirmed',
  },
  verify_confirm: {
    icon: '人',
    title: '人工確認',
    desc: '要確認時の審査タスク',
    tasks: [],
    input: 'Validation Result',
    output: 'Confirmed',
  },
  ocr_confirm: {
    icon: '人',
    title: '人工確認',
    desc: '要確認時の審査タスク',
    tasks: [],
    input: 'Extracted Fields',
    output: 'Confirmed Fields',
  },
  master_match: {
    icon: 'API',
    title: '外部API連携',
    desc: 'ナレッジ检索 · 参照登録',
    tasks: ['ナレッジ检索'],
    input: 'Case · OCR Fields',
    output: 'Reference Data',
  },
  scene_aggregate: {
    icon: '集',
    title: '案件集約',
    desc: '帳票タイプ・主副キー',
    tasks: [],
    input: '',
    output: 'Case Group',
  },
  scene_completeness: {
    icon: '完',
    title: '完全性検査',
    desc: '関連帳票・必須/任意',
    tasks: [],
    input: 'Case Group',
    output: 'Validated Case',
  },
  input: {
    icon: 'IN',
    title: '入力',
    desc: 'ファイル取込',
    tasks: ['ファイル取込', '帳票登録'],
    input: 'Document',
    output: 'Document',
  },
  preprocess: {
    icon: 'PP',
    title: '前処理',
    desc: '回転・分割・補正',
    tasks: ['画像回転', '帳票分割', '補正・分類'],
    input: 'Document',
    output: 'Processed Doc',
  },
  ocr: {
    icon: 'OC',
    title: 'OCR抽出',
    desc: 'テンプレート・フィールド',
    tasks: ['OCR', 'LLM-OCR', 'フィールド抽出'],
    input: 'Logical Document',
    output: 'Extracted Fields',
  },
  confirm: {
    icon: '人',
    title: '人工確認',
    desc: '要確認時の審査タスク',
    tasks: ['手動確認タスク生成'],
    input: 'Fields',
    output: 'Confirmed',
  },
  ai_verify: {
    icon: 'AI',
    title: 'AI検証',
    desc: 'ルール・完全性検査',
    tasks: ['テキスト検証', 'データ検証', '完全性検査'],
    input: 'Case Data Pool',
    output: 'Validation Result',
  },
  fraud_detect: {
    icon: '偽',
    title: '画像不正検出',
    desc: 'PS痕跡・画像改ざん',
    tasks: ['PS痕跡検知', '画像リスクスコア'],
    input: 'Document Image',
    output: 'Image Risk Score',
  },
  output: {
    icon: 'EX',
    title: '出力',
    desc: 'CSV / JSON / API',
    tasks: ['API', 'CSV / JSON', '画面表示'],
    input: 'Final Case Data',
    output: 'Export',
  },
  decision: {
    icon: 'IF',
    title: 'IF/ELSE',
    desc: '判定結果で分岐',
    tasks: [],
    input: 'Node Result',
    output: 'Branch / Wait / Return',
  },
  notify: {
    icon: '通',
    title: '通知',
    desc: '不備・補件・エスカレーション',
    tasks: [],
    input: 'Case Event',
    output: 'Notified',
  },
};

const NOTIFY_CHANNELS = [
  { value: 'email', label: 'メール' },
  { value: 'slack', label: 'Slack' },
  { value: 'webhook', label: 'Webhook' },
];

const NOTIFY_TEMPLATES = [
  {
    value: 'deficiency',
    label: '不備通知',
    defaultSubject: '【不備通知】{{case.claimNo}} 書類不備のお知らせ',
    defaultBody: 'お客様各位\n\nご提出いただいた書類に不備が確認されました。下記内容をご確認のうえ、再提出をお願いいたします。\n\n■ 不備内容\n{{verify.deficiency_list}}\n\n■ 案件番号\n{{case.claimNo}}',
  },
  {
    value: 'supplement',
    label: '補件依頼',
    defaultSubject: '【補件依頼】{{case.claimNo}} 追加書類のご提出のお願い',
    defaultBody: 'お客様各位\n\n審査の結果、以下の書類の追加提出が必要です。\n\n■ 必要書類\n{{verify.missing_docs}}\n\n■ 提出期限\n{{case.deadline}}\n\nご不明点は担当者までお問い合わせください。',
  },
  {
    value: 'escalation',
    label: 'エスカレーション',
    defaultSubject: '【エスカレーション】{{case.claimNo}} 要確認案件',
    defaultBody: '担当者各位\n\n以下の案件は自動処理で解決できず、上位確認が必要です。\n\n■ 案件番号\n{{case.claimNo}}\n\n■ エスカレーション理由\n{{workflow.escalation_reason}}\n\n■ 現在ステータス\n{{case.status}}',
  },
  {
    value: 'completion',
    label: '処理完了',
    defaultSubject: '【処理完了】{{case.claimNo}} 審査完了のお知らせ',
    defaultBody: 'お客様各位\n\nご提出いただいた書類の審査が完了しました。\n\n■ 案件番号\n{{case.claimNo}}\n\n■ 処理結果\n{{case.result}}\n\n今後ともよろしくお願いいたします。',
  },
];

function getNotifyTemplateDefaults(templateValue) {
  const tpl = NOTIFY_TEMPLATES.find((t) => t.value === templateValue) || NOTIFY_TEMPLATES[0];
  return {
    subject: tpl.defaultSubject || '',
    body: tpl.defaultBody || '',
  };
}

const WORKFLOW_NODE_SIZE = {
  default: { w: 280, h: 88 },
  decision: { w: 240, h: 56 },
};

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

const PREPROCESS_SETTING_ITEMS = [
  { key: 'quality', label: '画質チェック', detailType: 'quality', alwaysOn: true },
  { key: 'rotate', label: '画像回転', switchKey: 'rotate', detailType: 'rotate' },
  { key: 'perspective', label: '画像補正', switchKey: 'perspective', detailType: 'perspective' },
  { key: 'split', label: '帳票分割', switchKey: 'split', detailType: 'split' },
  { key: 'classify', label: '帳票分類', switchKey: 'classify', detailType: 'classify' },
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
  return WORKFLOW_NODE_META[type] || WORKFLOW_NODE_META.input;
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
    yesRule: '画質 NG・分割/補正の要確認',
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
    value: 'fraud_detect',
    label: '画像不正検出結果',
    defaultLabel: 'PS痕跡あり？',
    yesRule: '画像に PS 痕跡・改ざんの疑いあり（リスクスコアが閾値以上）',
    noRule: 'PS 痕跡なし（次工程へ）',
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

const HITL_GATE_PRESET_VALUES = ['preprocess_hitl', 'ocr_hitl', 'verify_hitl', 'deficiency_hitl', 'custom'];
const CONDITION_NODE_PRESET_VALUES = [
  'preprocess_hitl', 'ocr_hitl', 'verify_pass', 'verify_hitl', 'fraud_detect', 'case_ready', 'custom',
];

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

const HITL_GATE_PRESETS = DECISION_CONDITION_TYPES.filter((t) => HITL_GATE_PRESET_VALUES.includes(t.value));
const CONDITION_NODE_PRESETS = DECISION_CONDITION_TYPES.filter((t) => CONDITION_NODE_PRESET_VALUES.includes(t.value));

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

function getHitlGateDefaultRole(conditionType) {
  const map = {
    preprocess_hitl: '一般審査',
    ocr_hitl: '医療審査',
    verify_hitl: '給付審査',
    deficiency_hitl: '一般審査',
    custom: '一般審査',
  };
  return map[conditionType] || '一般審査';
}

function isHitlGateNode(node) {
  return node?.type === 'hitl_gate'
    || ['ocr_confirm', 'verify_confirm', 'confirm'].includes(node?.type);
}

function getHitlGatePreset(node) {
  if (!node) return null;
  const conditionType = inferHitlGateConditionType(node);
  return HITL_GATE_PRESETS.find((t) => t.value === conditionType) || HITL_GATE_PRESETS[HITL_GATE_PRESETS.length - 1];
}

function normalizeHitlGateNode(node) {
  if (!isHitlGateNode(node)) return node;
  const conditionType = inferHitlGateConditionType(node);
  const preset = getHitlGatePreset({ conditionType });
  return {
    ...node,
    type: 'hitl_gate',
    conditionType,
    label: node.label || preset?.label || '人工確認',
    role: node.role || getHitlGateDefaultRole(conditionType),
    description: node.description || '',
    yesRule: node.yesRule != null && node.yesRule !== '' ? node.yesRule : (preset?.yesRule || ''),
    noRule: node.noRule != null && node.noRule !== '' ? node.noRule : (preset?.noRule || ''),
    yesExpression: node.yesExpression || compileWorkflowYesExpression(
      node.yesRule != null && node.yesRule !== '' ? node.yesRule : preset?.yesRule,
      conditionType,
    ),
  };
}

function normalizeNotifyNode(node) {
  if (node?.type !== 'notify') return node;
  const template = node.template || 'deficiency';
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

function getDecisionVariableOptions(workflow, nodeId) {
  const nodeMap = Object.fromEntries((workflow?.nodes || []).map((n) => [n.id, n]));
  const options = getDecisionUpstreamNodeIds(workflow, nodeId)
    .map((id) => nodeMap[id])
    .filter((n) => n && !['decision', 'output', 'notify', 'hitl_gate'].includes(n.type))
    .map((n) => {
      const varName = getWorkflowNodeVarName(n);
      const meta = getWorkflowNodeMeta(n.type);
      return {
        value: `${varName}.result`,
        label: `${n.label || meta.title} · {${varName}.result}`,
        hint: `{${varName}.result}`,
        nodeType: n.type,
        nodeId: n.id,
        varName,
      };
    });
  if (options.length) return options;
  return [
    { value: 'preprocess.result', label: '前処理 · 判定結果', hint: '{preprocess.result}', nodeType: 'preprocess', varName: 'preprocess' },
    { value: 'ocr.result', label: 'OCR抽出 · 判定結果', hint: '{ocr.result}', nodeType: 'ocr', varName: 'ocr' },
    { value: 'verify.result', label: 'AI検証 · 判定結果', hint: '{verify.result}', nodeType: 'ai_verify', varName: 'verify' },
  ];
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
  fraud_detect: 'fraud_detect.imageRiskScore',
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
  fraud_detect: '{{fraud_detect.imageRiskScore}} >= {{fraud_detect.threshold}}',
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

function buildDecisionCasesFromPreset(presetValue, workflow, nodeId) {
  const variable = resolveDecisionPresetVariable(workflow, nodeId, presetValue);
  const value = DECISION_PRESET_IF_RESULT[presetValue] || '1';
  return [createDecisionCase('if', {
    id: 'if',
    conditions: [createDecisionCondition({
      variable,
      operator: 'is',
      value,
      preset: presetValue === 'custom' ? '' : presetValue,
    })],
  })];
}

function inferDecisionConditionType(node) {
  if (node?.conditionType && CONDITION_NODE_PRESET_VALUES.includes(node.conditionType)) {
    return node.conditionType;
  }
  if (node?.conditionType === 'custom') return 'custom';
  const label = node?.label || '';
  if (/就绪|就緒/i.test(label)) return 'case_ready';
  if (/不備通知|通知必要/i.test(label)) return 'notify_required';
  if (/不備|完全/i.test(label)) return 'deficiency_hitl';
  if (/OCR|ocr/i.test(label)) return 'ocr_hitl';
  if (/前処理|画質/i.test(label)) return 'preprocess_hitl';
  if (/通過|PASS/i.test(label)) return 'verify_pass';
  return 'case_ready';
}

function buildDecisionCasesFromLegacy(node, preset, workflow = null) {
  const conditionType = node?.conditionType && CONDITION_NODE_PRESET_VALUES.includes(node.conditionType)
    ? node.conditionType
    : inferDecisionConditionType(node);
  if (Array.isArray(node?.cases) && node.cases.length) {
    return node.cases.map((c, i) => normalizeDecisionCase(c, i));
  }
  if (workflow && node?.id) {
    return buildDecisionCasesFromPreset(conditionType, workflow, node.id);
  }
  return buildDecisionCasesFromPreset(conditionType, null, node?.id || '');
}

function normalizeDecisionNode(node, workflow = null) {
  if (node?.type !== 'decision') return node;
  const conditionType = node?.conditionType && CONDITION_NODE_PRESET_VALUES.includes(node.conditionType)
    ? node.conditionType
    : inferDecisionConditionType(node);
  const preset = DECISION_CONDITION_TYPES.find((t) => t.value === conditionType)
    || DECISION_CONDITION_TYPES.find((t) => t.value === 'case_ready');
  let cases = buildDecisionCasesFromLegacy(node, preset, workflow);
  if (workflow && node.id) {
    cases = cases.map((c) => ({
      ...c,
      conditions: c.conditions.map((cond) => ({
        ...cond,
        variable: cond.variable || resolveDecisionPresetVariable(workflow, node.id, cond.preset || conditionType),
        value: cond.value ?? DECISION_PRESET_IF_RESULT[cond.preset || conditionType] ?? '1',
      })),
    }));
  }
  return {
    ...node,
    label: node.label || 'IF/ELSE',
    description: node.description || '',
    conditionType,
    gatewayType: 'branch',
    conditionLogic: node.conditionLogic || 'and',
    threshold: node.threshold ?? (GATEWAY_THRESHOLD_PRESETS.has(conditionType) ? getDecisionDefaultThreshold({ conditionType }) : null),
    waitCondition: '',
    timeoutMinutes: 0,
    timeoutStrategy: 'continue',
    returnTargetId: '',
    rerunPolicy: 'none',
    rerunTargetId: '',
    cases,
    elseDescription: node.elseDescription || node.noRule || preset.noRule || '条件に該当しない場合の処理',
    yesRule: node.yesRule != null && String(node.yesRule).trim() !== ''
      ? node.yesRule
      : (preset.yesRule || ''),
    noRule: node.noRule != null && String(node.noRule).trim() !== ''
      ? node.noRule
      : (preset.noRule || ''),
    yesExpression: node.yesExpression || '',
  };
}

function getDecisionPreset(node) {
  if (!node || node.type !== 'decision') return null;
  const conditionType = inferDecisionConditionType(node);
  return DECISION_CONDITION_TYPES.find((t) => t.value === conditionType)
    || DECISION_CONDITION_TYPES.find((t) => t.value === 'case_ready');
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
  return getDecisionPreset(node)?.noRule || '不命中（0）→ 次工程へ';
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
  if (branch === 'else') return 'ELSE';
  const cases = node?.cases || [];
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
  const yMain = 200;
  const yBranch = 420;
  const w = WORKFLOW_NODE_SIZE.default.w;
  const dW = WORKFLOW_NODE_SIZE.decision.w;
  const g = WF_NODE_GAP;
  const branchStep = dW + g + 120;

  function place(spec) {
    const {
      id, type, label, x, y = yMain, conditionType, role, template, isStart,
    } = spec;
    let node;
    if (type === 'hitl_gate') {
      node = normalizeHitlGateNode({
        id,
        type,
        label: label || '人工確認',
        x,
        y,
        conditionType: conditionType || 'verify_hitl',
        role: role || '一般審査',
      });
    } else if (type === 'decision') {
      node = normalizeDecisionNode({
        id,
        type,
        label: label || 'IF/ELSE',
        x,
        y,
        conditionType: conditionType || 'custom',
      }, wf);
    } else if (type === 'notify') {
      node = normalizeNotifyNode({ id, type, x, y, template: template || 'deficiency' });
    } else {
      node = ensureWorkflowNodeVarName({
        id,
        type,
        label: label || getWorkflowNodeMeta(type).title,
        x,
        y,
        ...(isStart ? { isStart: true } : {}),
      }, wf);
    }
    nodes.push(node);
    return node;
  }

  let x = 40;
  place({ id: 'wf-in', type: 'input', label: '入力', x, isStart: true }); x += w + g;
  place({ id: 'wf-pp', type: 'preprocess', label: '前処理', x }); x += w + g;
  place({ id: 'wf-d-pp', type: 'decision', label: '前処理要確認？', conditionType: 'preprocess_hitl', x });
  const xDpp = x; x += dW + g;
  place({ id: 'wf-oc', type: 'ocr', label: 'OCR抽出', x }); x += w + g;
  place({ id: 'wf-d-oc', type: 'decision', label: 'OCR要確認？', conditionType: 'ocr_hitl', x });
  const xDoc = x; x += dW + g;
  place({ id: 'wf-mm', type: 'master_match', label: '外部API連携', x }); x += w + g;
  place({ id: 'wf-ai', type: 'ai_verify', label: 'AI検証', x }); x += w + g;
  place({ id: 'wf-d-ai', type: 'decision', label: 'AI検証通過？', conditionType: 'verify_pass', x });
  const xDai = x; x += dW + g;
  place({ id: 'wf-ex', type: 'output', label: '出力', x });

  place({ id: 'wf-hu-pp', type: 'hitl_gate', label: '前処理確認', conditionType: 'preprocess_hitl', x: xDpp, y: yBranch });
  place({ id: 'wf-n-pp', type: 'notify', template: 'deficiency', x: xDpp + branchStep, y: yBranch });
  place({ id: 'wf-hu-oc', type: 'hitl_gate', label: 'OCR確認', conditionType: 'ocr_hitl', x: xDoc, y: yBranch });
  place({ id: 'wf-n-oc', type: 'notify', template: 'supplement', x: xDoc + branchStep, y: yBranch });
  place({ id: 'wf-hu-ai', type: 'hitl_gate', label: 'AI検証確認', conditionType: 'verify_hitl', x: xDai, y: yBranch });
  place({ id: 'wf-n-ai', type: 'notify', template: 'deficiency', x: xDai + branchStep, y: yBranch });

  edges.push(
    { from: 'wf-in', to: 'wf-pp' },
    { from: 'wf-pp', to: 'wf-d-pp' },
    { from: 'wf-d-pp', to: 'wf-oc', branch: 'else' },
    { from: 'wf-d-pp', to: 'wf-hu-pp', branch: 'if' },
    { from: 'wf-hu-pp', to: 'wf-n-pp' },
    { from: 'wf-oc', to: 'wf-d-oc' },
    { from: 'wf-d-oc', to: 'wf-mm', branch: 'else' },
    { from: 'wf-d-oc', to: 'wf-hu-oc', branch: 'if' },
    { from: 'wf-hu-oc', to: 'wf-n-oc' },
    { from: 'wf-mm', to: 'wf-ai' },
    { from: 'wf-ai', to: 'wf-d-ai' },
    { from: 'wf-d-ai', to: 'wf-ex', branch: 'if' },
    { from: 'wf-d-ai', to: 'wf-hu-ai', branch: 'else' },
    { from: 'wf-hu-ai', to: 'wf-n-ai' },
  );

  wf.nodes = wf.nodes.map((n) => (n.type === 'decision' ? normalizeDecisionNode(n, wf) : n));
  migrateDecisionEdges(wf);
  sanitizeDecisionEdges(wf);
  ensureWorkflowStartNode(wf);

  return { nodes, edges, isTemplate: true, startNodeId: wf.startNodeId };
}

function isDefaultCaseWorkflowTemplate(workflow) {
  const nodes = workflow?.nodes || [];
  if (!nodes.length) return false;
  const ids = new Set(nodes.map((n) => n.id));
  return DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS.every((id) => ids.has(id));
}

function ensureFormWorkflows(form) {
  if (form.workflows?.case) return;
  const legacy = form.workflow;
  form.workflows = {
    case: normalizeWorkflow(legacy, 'case'),
  };
  delete form.workflow;
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
  migrateRemoveCaseLinkNodes(w);
  if (w.nodes.some((n) => REMOVED_WORKFLOW_NODE_TYPES.has(n.type))) {
    w.nodes = w.nodes.filter((n) => !REMOVED_WORKFLOW_NODE_TYPES.has(n.type));
    const ids = new Set(w.nodes.map((n) => n.id));
    w.edges = w.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }
  migrateHitlDecisionsInWorkflow(w);
  w.nodes = w.nodes.map((n) => {
    if (isHitlGateNode(n)) return normalizeHitlGateNode(n);
    if (n.type === 'decision') return normalizeDecisionNode(n, w);
    if (n.type === 'notify') return normalizeNotifyNode(n);
    if (isWorkflowProcessingNode(n) || n.type === 'master_match') return ensureWorkflowNodeVarName(n, w);
    return n;
  });
  syncDecisionVariablesInWorkflow(w);
  migrateDecisionEdges(w);
  migrateDecisionFlowEdges(w);
  sanitizeDecisionEdges(w);
  ensureWorkflowStartNode(w);
  return w;
}

function getWorkflowStartNode(workflow) {
  const nodes = workflow?.nodes || [];
  if (!nodes.length) return null;
  const edges = workflow?.edges || [];
  const mainIn = new Set(edges.filter((e) => !e.branch).map((e) => e.to));
  return nodes.find((n) => n.isStart)
    || nodes.find((n) => n.id === workflow?.startNodeId)
    || nodes.find((n) => n.type === 'input')
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
  if (node?.type === 'decision') {
    const caseCount = node.cases?.length || 1;
    return { w: 280, h: 52 + (caseCount + 1) * 42 + 8 };
  }

  const nodeW = WORKFLOW_NODE_SIZE.default.w;
  const tagTexts = tasks?.length ? tasks : (taskCount ? Array.from({ length: taskCount }, () => 'tag') : []);
  const HEADER_H = 52;
  const BODY_TOP_PAD = 0;
  const BODY_BOTTOM_PAD = 14;
  const contentWidth = (node?.type === 'case_link' || node?.type === 'scene_aggregate' || node?.type === 'scene_completeness' ? 240 : nodeW) - 28;

  if (node?.type === 'case_link' || node?.type === 'scene_aggregate' || node?.type === 'scene_completeness') {
    if (!tagTexts.length) return { w: 240, h: 76 };
    const bodyHeight = measureWorkflowNodeBodyHeight(tagTexts, contentWidth);
    const h = HEADER_H + BODY_TOP_PAD + bodyHeight + BODY_BOTTOM_PAD;
    return { w: 240, h: Math.max(76, h) };
  }

  if (!tagTexts.length) return { w: nodeW, h: 76 };

  const bodyHeight = measureWorkflowNodeBodyHeight(tagTexts, contentWidth);
  let h = HEADER_H + BODY_TOP_PAD + bodyHeight + BODY_BOTTOM_PAD;
  if (node?.type === 'notify') {
    const bodyText = getNotifyNodeBodyText(node);
    if (bodyText) {
      const lines = Math.min(3, Math.ceil(bodyText.length / 28));
      h += lines * 18 + 4;
    }
  }
  if (node?.isStart) h += 6;
  return { w: nodeW, h: Math.max(76, h) };
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
    minDpi: 200,
    rotate: true,
    rotateDocTypes: [],
    perspective: true,
    perspectiveDocTypes: [],
    split: true,
    splitDocTypes: [],
    classify: true,
    classifyDocTypes: [],
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

const KNOWLEDGE_OUTPUT_VARS = [
  { id: 'paragraph_list', label: '检索结果的分段列表', token: '{paragraph_list}' },
  { id: 'is_hit_handling_method_list', label: '满足直接回答的分段列表', token: '{is_hit_handling_method_list}' },
  { id: 'data', label: '检索结果', token: '{data}' },
  { id: 'directly_return', label: '满足直接回答的分段内容', token: '{directly_return}' },
];

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
  const classify = image?.classify !== false;
  return {
    minDpi: [150, 200, 300].includes(image?.minDpi) ? image.minDpi : 200,
    rotate,
    rotateDocTypes: defaultImageDocTypes(rotate, image?.rotateDocTypes, allowedTypes),
    perspective,
    perspectiveDocTypes: defaultImageDocTypes(perspective, image?.perspectiveDocTypes, allowedTypes),
    split,
    splitDocTypes: filterImageDocTypes(image?.splitDocTypes, allowedTypes),
    classify,
    classifyDocTypes: defaultImageDocTypes(classify, image?.classifyDocTypes, allowedTypes),
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
  form.processing.image = normalizeImageConfig(form.processing?.image, form.scene.documents);
  form.processing.hitl = normalizeHitlConfig(form.processing?.hitl);
  form.master = normalizeMasterConfig(form.master, form.verify);
  form.verify = normalizeVerifyConfig(form.verify);
  form.output = normalizeOutputConfig(form.output, form.scene.documents, form.master.mappings, form.master.knowledgeSource);
  syncOcrExtractTypesOnForm(form);
  ensureFormWorkflows(form);
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
    const sceneSearch = ref('');
    const currentSceneId = ref('2064639102406844416');
    const currentNode = ref('scene');
    const currentProduct = ref('kisoku');

    // Try loading from localStorage first, fall back to default
    const storedForm = loadSceneFromStorage('2064639102406844416');
    const initialForm = normalizeLoadedForm(storedForm) || sceneForm('2064639102406844416');
    const form = reactive(initialForm);
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
    const verifyActivePanels = ref(['completeness', 'master', 'text', 'data']);
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
        return localStorage.getItem(INSPECTOR_COLLAPSED_STORAGE_KEY) === '1';
      } catch (e) { /* ignore */ }
      return false;
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
    const selectedWorkflowNodeId = ref(initialForm.workflows?.case?.nodes?.[0]?.id || 'wf-in');
    const inspectorMode = ref('node');
    const wfLibraryDrag = reactive({ type: null });
    const wfNodeDrag = reactive({ id: null, startX: 0, startY: 0, originX: 0, originY: 0 });
    const wfConnectDrag = reactive({ fromId: null, branch: null, clientX: 0, clientY: 0, active: false });
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
      if (moduleId !== 'case-workflow') return;
      selectedWorkflowEdgeKey.value = null;
      inspectorMode.value = 'node';
      selectedWorkflowNodeId.value = form.workflows?.case?.nodes?.[0]?.id || null;
      syncCurrentNodeFromWorkflow(getActiveWf()?.nodes?.find((n) => n.id === selectedWorkflowNodeId.value));
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
              { id: 'scene-master', label: `MASTER照合 ${form.master.mappings.length} 行` },
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

    watch(
      exportPreviewRoot,
      (tree) => {
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

    function onHitlGateConditionTypeChange(typeValue) {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return;
      const preset = HITL_GATE_PRESETS.find((t) => t.value === typeValue)
        || HITL_GATE_PRESETS.find((t) => t.value === node.conditionType)
        || HITL_GATE_PRESETS[0];
      if (!preset) return;
      node.conditionType = preset.value;
      node.label = '人工確認';
      if (preset.value !== 'custom') {
        node.yesRule = preset.yesRule || '';
        node.noRule = preset.noRule || '';
      }
      if (!node.role) node.role = getHitlGateDefaultRole(preset.value);
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('人工確認プリセットを変更');
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

    function onNotifyTemplateChange(template) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'notify') return;
      const defaults = getNotifyTemplateDefaults(template);
      node.subject = defaults.subject;
      node.body = defaults.body;
      pushWorkflowHistory('通知テンプレートを変更');
    }

    function resetNotifyContentToPreset() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'notify') return;
      const defaults = getNotifyTemplateDefaults(node.template);
      node.subject = defaults.subject;
      node.body = defaults.body;
      pushWorkflowHistory('通知内容をテンプレート既定に戻す');
      ElementPlus.ElMessage.success('テンプレート既定の内容に戻しました');
    }

    function resetDecisionContentToPreset() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      const preset = getDecisionPreset(node);
      if (!preset) return;
      node.yesRule = preset.yesRule || '';
      node.noRule = preset.noRule || '';
      node.elseDescription = preset.noRule || '条件に該当しない場合の処理';
      if (preset.value !== 'custom') {
        const wf = getActiveWf();
        node.cases = buildDecisionCasesFromPreset(preset.value, wf, node.id);
      }
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('IF/ELSE 条件をプリセット既定に戻す');
      ElementPlus.ElMessage.success('プリセット既定の条件に戻しました');
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

    const ocrExtractItems = computed(() =>
      form.scene.documents.map((d) => ({
        type: d.type,
        submission: d.submission,
        enabled: isOcrExtractEnabled(d.type),
      })));

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
      const node = selectedWorkflowNode.value;
      if (!node) return 'scene';
      return WORKFLOW_INSPECTOR_MAP[node.type] || 'scene';
    });

    const inspectorTitle = computed(() => {
      if (inspectorMode.value === 'edge') return '接続設定';
      if (inspectorPanel.value === 'scene') return 'シーン設定';
      if (inspectorPanel.value === 'case_link') return '業務シーン';
      if (inspectorPanel.value === 'scene_aggregate') return '案件集約';
      if (inspectorPanel.value === 'scene_completeness') return '完全性検査';
      if (inspectorPanel.value === 'master_match') return '外部API連携';
      if (inspectorPanel.value === 'decision') return 'IF/ELSE';
      if (inspectorPanel.value === 'hitl_gate') return '人工確認';
      if (inspectorPanel.value === 'fraud_detect') return '画像不正検出';
      if (inspectorPanel.value === 'notify') return '通知';
      const node = selectedWorkflowNode.value;
      if (node?.label) return node.label;
      const lib = FLOW_NODE_OPTIONS[getFlowNodeKey()]?.find((l) => l.type === node?.type);
      return lib?.label || getWorkflowNodeMeta(node?.type).title || 'ノード設定';
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

    const workflowEdgePaths = computed(() => {
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

    function onWfViewportPointerDown(event) {
      if (event.target.closest('.wf-node') || event.target.closest('.idp-edge-path') || event.target.closest('.wf-node-picker') || event.target.closest('.wf-canvas-toolbar')) return;
      closeWfNodePicker();
      if (isWorkflowTopologyEditable.value) wfConnectSourceId.value = null;
      if (wfConnectDrag.fromId) return;
      selectedWorkflowEdgeKey.value = null;
      if (inspectorMode.value === 'edge') {
        inspectorMode.value = selectedWorkflowNodeId.value ? 'node' : 'scene';
      }
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
      if (type === 'decision') node = normalizeDecisionNode({ ...base, label: 'IF/ELSE', conditionType: 'verify_pass' }, getActiveWf());
      else if (type === 'hitl_gate') node = normalizeHitlGateNode(base);
      else if (type === 'notify') node = normalizeNotifyNode(base);
      else node = ensureWorkflowNodeVarName(base, getActiveWf());
      getActiveWf().nodes.push(node);
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
      const terminal = ['output'];
      return node && node.type !== 'decision' && !terminal.includes(node.type);
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

    function openWfNodePicker(node, event, side = 'after') {
      if (!assertWorkflowTopologyEditable()) return;
      wfNodePicker.fromNodeId = node.id;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = null;
      wfNodePicker.side = side === 'before' ? 'before' : 'after';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      const rect = event.currentTarget.getBoundingClientRect();
      if (side === 'before') {
        wfNodePicker.screenX = Math.max(8, rect.left - 280);
        wfNodePicker.screenY = Math.max(8, rect.top - 8);
      } else {
        wfNodePicker.screenX = rect.right + 8;
        wfNodePicker.screenY = Math.max(8, rect.top - 8);
      }
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
      if (payload.kind === 'logic') {
        return normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x,
          y: y + 12,
          label: 'IF/ELSE',
          conditionType: payload.conditionType || 'verify_pass',
        }, wf);
      }
      if (payload.type === 'hitl_gate') {
        const preset = HITL_GATE_PRESETS.find((t) => t.value === payload.defaultPreset) || HITL_GATE_PRESETS[0];
        return normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x,
          y,
          conditionType: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      }
      if (payload.type === 'notify') {
        return normalizeNotifyNode({ id: newId, type: 'notify', x, y });
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

      const newId = newRuleId('wf');
      let newNode;

      if (payload.kind === 'logic') {
        const preset = DECISION_CONDITION_TYPES.find((t) => t.value === payload.conditionType)
          || DECISION_CONDITION_TYPES[DECISION_CONDITION_TYPES.length - 1];
        newNode = normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x: to.x - WF_NODE_GAP,
          y: to.y + 12,
          label: 'IF/ELSE',
          conditionType: payload.conditionType || 'verify_pass',
        }, wf);
      } else if (payload.type === 'hitl_gate') {
        const preset = HITL_GATE_PRESETS.find((t) => t.value === payload.defaultPreset) || HITL_GATE_PRESETS[0];
        newNode = normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          conditionType: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      } else if (payload.type === 'notify') {
        newNode = normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x: to.x - WF_NODE_GAP,
          y: to.y,
        });
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
      const newId = newRuleId('wf');
      let newNode;

      if (payload.kind === 'logic') {
        const preset = DECISION_CONDITION_TYPES.find((t) => t.value === payload.conditionType)
          || DECISION_CONDITION_TYPES[DECISION_CONDITION_TYPES.length - 1];
        newNode = normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y + 12,
          label: 'IF/ELSE',
          conditionType: payload.conditionType || 'verify_pass',
        }, wf);
      } else if (payload.type === 'hitl_gate') {
        const preset = HITL_GATE_PRESETS.find((t) => t.value === payload.defaultPreset) || HITL_GATE_PRESETS[0];
        newNode = normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          conditionType: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      } else if (payload.type === 'notify') {
        newNode = normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
        });
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

    function pickWorkflowProcessNode(item) {
      if (!assertWorkflowTopologyEditable()) return;
      if (!wfNodePicker.fromNodeId && !wfNodePicker.edgeKey) return;
      const resolved = typeof item === 'string' ? { type: item } : item;
      const payload = resolved.type === 'decision'
        ? { kind: 'logic', conditionType: resolved.defaultCondition || 'case_ready' }
        : {
          kind: 'process',
          type: resolved.type,
          defaultPreset: resolved.defaultPreset,
          label: resolved.label,
        };
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

      if (flowKey === 'case') {
        return CASE_FLOW_NODE_GROUPS.map((group) => ({
          category: group.category,
          nodes: [...group.nodes].sort((a, b) => {
            const ao = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[a.type];
            const bo = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[b.type];
            if (ao == null && bo == null) return 0;
            if (ao == null) return 1;
            if (bo == null) return -1;
            return ao - bo;
          }),
        }));
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

    const wfNodePickerLogicOptions = computed(() =>
      CONDITION_NODE_PRESET_VALUES
        .map((value) => DECISION_CONDITION_TYPES.find((t) => t.value === value))
        .filter(Boolean));

    function exitWorkflowInspector() {
      selectedWorkflowNodeId.value = null;
      selectedWorkflowEdgeKey.value = null;
      inspectorMode.value = 'scene';
    }

    const wfNodePickerHoveredLogic = computed(() => {
      if (!wfNodePicker.hoveredLogic) return null;
      return DECISION_CONDITION_TYPES.find((t) => t.value === wfNodePicker.hoveredLogic) || null;
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
      if (node.isStart || (node.type === 'input' && getWorkflowStartNode(getActiveWf())?.id === id)) {
        ElementPlus.ElMessage.warning('起始ノード（入力）は削除できません。Workflow の開始点として固定されています。');
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
      const end = screenToWorkflowCoords(wfConnectDrag.clientX, wfConnectDrag.clientY);
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

    function toggleInspectorPanel() {
      inspectorPanelCollapsed.value = !inspectorPanelCollapsed.value;
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

      if (isWorkflowTopologyEditable.value) {
        if (wfConnectSourceId.value) {
          if (wfConnectSourceId.value === id) {
            wfConnectSourceId.value = null;
          } else {
            const from = getActiveWf()?.nodes?.find((n) => n.id === wfConnectSourceId.value);
            const branch = from?.type === 'decision' ? 'if' : null;
            if (connectWorkflowEdge(wfConnectSourceId.value, id, branch)) {
              pushWorkflowHistory('接続を追加');
            }
            wfConnectSourceId.value = id;
          }
        } else {
          wfConnectSourceId.value = id;
        }
      }

      selectedWorkflowNodeId.value = id;
      inspectorMode.value = 'node';
      const pickedNode = getActiveWf()?.nodes?.find((n) => n.id === id);
      if (pickedNode?.type === 'decision') Object.assign(pickedNode, normalizeDecisionNode(pickedNode, getActiveWf()));
      else if (pickedNode?.type === 'notify') Object.assign(pickedNode, normalizeNotifyNode(pickedNode));
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
      inspectorMode.value = 'edge';
    }

    function removeSelectedWorkflowEdge() {
      if (!assertWorkflowTopologyEditable()) return;
      if (!selectedWorkflowEdgeKey.value) return;
      getActiveWf().edges = (getActiveWf().edges || []).filter(
        (e) => workflowEdgeKey(e) !== selectedWorkflowEdgeKey.value,
      );
      selectedWorkflowEdgeKey.value = null;
      inspectorMode.value = 'scene';
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

    function onWfPortPointerDown(event, node, branch) {
      if (!assertWorkflowTopologyEditable()) return;
      event.stopPropagation();
      wfConnectDrag.fromId = node.id;
      wfConnectDrag.branch = branch;
      wfConnectDrag.clientX = event.clientX;
      wfConnectDrag.clientY = event.clientY;
      wfConnectDrag.active = true;
      document.body.classList.add('wf-connecting');
      const onMove = (ev) => {
        wfConnectDrag.clientX = ev.clientX;
        wfConnectDrag.clientY = ev.clientY;
      };
      const onUp = (ev) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.classList.remove('wf-connecting');
        wfConnectDrag.active = false;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const inPort = hit?.closest?.('[data-wf-port="in"]');
        const targetId = inPort?.getAttribute('data-node-id');
        if (targetId && wfConnectDrag.fromId && connectWorkflowEdge(wfConnectDrag.fromId, targetId, wfConnectDrag.branch)) {
          pushWorkflowHistory('接続を追加');
          ElementPlus.ElMessage.success('接続しました');
        }
        wfConnectDrag.fromId = null;
        wfConnectDrag.branch = null;
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
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      const preset = DECISION_CONDITION_TYPES.find((t) => t.value === typeValue)
        || DECISION_CONDITION_TYPES.find((t) => t.value === 'case_ready');
      if (!preset) return;
      const wf = getActiveWf();
      node.conditionType = preset.value;
      node.gatewayType = 'branch';
      node.cases = buildDecisionCasesFromPreset(preset.value, wf, node.id);
      node.yesRule = preset.yesRule || '';
      node.noRule = preset.noRule || '';
      node.elseDescription = preset.noRule || '条件に該当しない場合の処理';
      if (GATEWAY_THRESHOLD_PRESETS.has(preset.value) && node.threshold == null) {
        node.threshold = getDecisionDefaultThreshold({ conditionType: preset.value });
      }
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      if (wf) sanitizeDecisionEdges(wf);
      pushWorkflowHistory('IF/ELSE プリセットを変更');
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
      return getDecisionVariableOptions(wf, nodeId);
    });

    function previewDecisionCase(decisionCase, nodeId) {
      const wf = getActiveWf();
      const options = wf && nodeId ? getDecisionVariableOptions(wf, nodeId) : [];
      return decisionConditionPreview(decisionCase, options);
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
      if (decisionCase?.kind === 'if' || index === 0) return 'IF';
      return 'ELIF';
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
      if (!node) return [];
      switch (node.type) {
        case 'preprocess': {
          const img = processingForm.value?.image || {};
          const tasks = [];
          if (img.minDpi) tasks.push(`画質チェック ≥${img.minDpi}DPI`);
          if (img.rotate) tasks.push('画像回転');
          if (img.perspective) tasks.push('画像補正');
          if (img.split) tasks.push('帳票分割');
          if (img.classify) tasks.push('帳票分類');
          return tasks;
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
          const preset = getHitlGatePreset(node);
          const tags = [];
          if (preset) tags.push(preset.label);
          if (node.role) tags.push(node.role);
          return tags.length ? tags : ['人工確認'];
        }
        case 'notify': {
          const normalized = normalizeNotifyNode(node);
          const tpl = NOTIFY_TEMPLATES.find((t) => t.value === normalized.template);
          const ch = NOTIFY_CHANNELS.find((c) => c.value === normalized.channel);
          const tags = [];
          const subject = truncateWorkflowPreview(normalized.subject, 36);
          if (subject) tags.push(subject);
          if (tpl) tags.push(tpl.label);
          if (ch) tags.push(ch.label);
          return tags.length ? tags : ['通知'];
        }
        case 'decision': {
          const preset = getDecisionPreset(node);
          const gateway = getGatewayTypeMeta(node.gatewayType);
          const tags = [];
          if (gateway?.value !== 'branch') tags.push(gateway.label);
          if (preset) tags.push(preset.label);
          if (decisionUsesThreshold(node) && node.threshold != null) {
            tags.push(node.conditionType === 'ocr_hitl' ? `<${node.threshold}%` : `<${node.threshold}DPI`);
          }
          return tags.length ? tags : ['条件分岐'];
        }
        case 'master_match': {
          const cfg = normalizeExternalApiConfig(form.processing?.externalApi);
          const count = cfg.selectedSourceIds?.length || 0;
          return count ? [`ナレッジ ${count}件`, `Top ${cfg.topK}`] : ['ナレッジ未選択'];
        }
        case 'ai_verify': {
          const tags = [];
          if (form.master?.enabled !== false && form.master?.mappings?.length) {
            tags.push(`MASTER ${form.master.mappings.length}件`);
          }
          if (form.verify?.textEnabled && form.verify?.text?.length) tags.push('テキスト');
          if (form.verify?.dataEnabled && form.verify?.dataRules?.length) tags.push('データ');
          if (form.verify?.completenessEnabled) tags.push('完全性');
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
      const masterCount = form.master?.enabled !== false ? (form.master?.mappings?.length || 0) : 0;
      return `MASTER ${masterCount} 件 · テキスト ${v.text.length} 件 · データ ${v.dataRules.length} 件 · 署名・印鑑 ${sealOn ? 'ON' : 'OFF'}`;
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

    function syncDictFieldsOnOutput() {
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
    watch(
      () => {
        const types = new Set(form.scene.documents.map((d) => d.type));
        const allowed = [...types];
        const img = form.processing.image;
        img.rotateDocTypes = filterImageDocTypes(img.rotateDocTypes, allowed);
        img.perspectiveDocTypes = filterImageDocTypes(img.perspectiveDocTypes, allowed);
        img.splitDocTypes = filterImageDocTypes(img.splitDocTypes, allowed);
        applySceneAggregate(form.scene, form.scene.documents);
        syncOutputDocFieldsBySceneDocs();
      }
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
      if (!form.master.knowledgeSource) {
        form.master.knowledgeSource = normalizeKnowledgeSource(null);
      }
      resetMasterRuleDraft();
      initWorkflowHistory('初期状態');
      nextTick(() => {
        fitWorkflowToView();
        flashWorkflowTemplateHint();
      });
      document.addEventListener('keydown', onWfKeyDown);
    });
    onBeforeUnmount(() => {
      if (wfTemplateHintTimer) clearTimeout(wfTemplateHintTimer);
      clearSceneSetupLinkCheckDisplay();
      document.removeEventListener('keydown', onWfKeyDown);
    });

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
      onHitlGateConditionTypeChange,
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
      resetNotifyContentToPreset,
      getDecisionYesRule,
      getDecisionNoRule,
      getDecisionElseDisplayText,
      getDecisionCaseDisplayText,
      getDecisionIfCondition,
      getDecisionElseConditionPreview,
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
      imageDpiOptions: [150, 200, 300],
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
      resetDecisionContentToPreset,
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
      onWfPortPointerDown,
      wfConnectDrag,
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

const app = createApp(appOptions);
app.component('InspectorTitle', InspectorTitle);
app.use(ElementPlus).mount('#app');
