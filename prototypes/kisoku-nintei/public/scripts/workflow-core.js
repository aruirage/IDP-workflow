const { createApp, ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } = Vue;

const PROTOTYPE_BUILD = '618-hitl-layout';

const WF_ZOOM_MIN = 0.25;
const WF_ZOOM_MAX = 2;
const WF_ZOOM_STEP = 1.12;

const NODE_ORDER = ['scene', 'input', 'image', 'ocr', 'master', 'verify', 'hitl', 'output'];

const WF_NODE_GAP = 72;

const MODULE_PAGE_META = {
  'fixed-doc': {
    title: '帳票タイプ設定',
    subtitle: '帳票タイプごとの OCR テンプレート・抽出フィールド',
  },
  'data-mapping-config': {
    title: 'データマッピング設定',
    subtitle: '全案件共通の標準フィールド・OCR フィールド対応・競合処理を管理',
  },
  'master-match-config': {
    title: 'マスタデータ設定',
    subtitle: 'マスタデータ・列・インポート・ベクトル化状態を管理',
  },
  'ai-verify-config': {
    title: 'AI検証設定',
    subtitle: '必須フィールド・必要書類・テキスト・データ・署名押印を業務シーン単位で管理',
  },
  'case-workflow': {
    title: '案件シーン設定',
    subtitleConfigure: '設定モード：Workflow 固定・ノード内パラメータのみ変更',
    subtitleEdit: '編集モード：ノード追加・削除・接続を自由に変更',
    templateNote: '起始ノード（入力）から 前処理 → OCR → 外部API → AI検証 → 出力 の順を推奨。編集モードで N キーまたはツールバー + でノード追加。',
    connectHint: '出力ポートをドラッグして任意ノードへ接続します。上流への回流も可能です。ノード前後または連線上の + でノードを追加・挿入できます。',
    flowKey: 'case',
  },
  'mcp-servers': {
    title: 'MCP サーバー管理',
    subtitle: 'Server 接続・Tool 定義・入力パラメータを集中管理します。',
  },
};

/** Inspector セクションタイトル横 ? ツールチップ用（本文は編集欄に表示しない） */
const INSPECTOR_HINTS = {
  edgeEdit: '接続線をクリックで選択（ハイライト）。Backspace / Delete で削除できます。出力ポートをドラッグして再接続できます。',
  connect: '出力ポートをドラッグして任意ノードの入力ポートへ接続します。上流ノードへの回流も可能です。連線上の + で途中にノードを挿入できます。',
  scene: '業務シーン作成時、またはステップ1で関連帳票・案件集約・帳票間関連を設定します。',
  inputSetting: '画面上アップロードまたは APIアップロードでファイルを受け付けます。APIアップロードを有効にした場合はエンドポイント URL を指定します。',
  inputLimits: 'ファイル形式・最大ファイルサイズ（上限 20MB・それ以下のみ）を指定します。',
  preprocess: 'OCR 前に画像補正、画像回転、画像分割を実行します。\n\n・画像補正：歪み・傾きの補正。対象帳票未指定時は全帳票タイプが対象。\n・画像回転：スキャン方向の自動補正。対象帳票未指定時は全帳票タイプが対象。\n・画像分割：同一ページ内に複数帳票がある場合も画像単位で分割し、ファイル流を生成。\n・画像並び替え：同一帳票タイプ内の画像を整列。',
  ocrSetting: '抽出フィールド・Prompt・信頼度閾値などの詳細は帳票 template またはシステムモデル設定で管理します。',
  ocrExtract: '業務シーン設定で登録した関連帳票を参照します。帳票タイプごとに OCR 抽出の ON/OFF を設定します。テンプレート詳細は OCR抽出テンプレート から編集します。',
  dataMapping: 'データマッピング設定で定義した全局ルールをこの Workflow で呼び出します。ノード内ではルール摘要、適用性チェック、設定ページへの導線のみ扱います。',
  dataMappingRules: '入力フィールド、標準フィールド、変換ルールを定義します。後続ノードは標準フィールド名で参照できます。',
  dataMappingStandard: '標準データモデルで利用する項目です。案件データセット、照合、検証、エクスポートの共通キーになります。',
  mcpAdminOverview: 'MCP サーバー接続・Tool 一覧・各 Tool の入力パラメータをここで集中管理します。OAuth 等の認証設定も本画面（または接続ウィザード）で行います。',
  mcpAdminTools: 'Tool ごとにパラメータ schema と既定値（定数 / 上流変数参照）を設定します。',
  nodeOutput: '後続ノード・IF/ELSE 条件・MCP 変数参照で使える出力変数です。{ノード変数名.項目} 形式で指定します。',
  nodeOutputPreprocess: '前処理総状態・全ファイル对象配列（files[]）。各文件含 status/url。人工分岐は条件ノードで preprocessStatus 等を参照。',
  nodeOutputOcr: 'OCR 総状態・低信頼件数・files[]（含 files[].ocrFields）。人工分岐は条件ノードで lowConfidenceFieldCount 等を参照。',
  nodeOutputVerify: 'AI検証総状態・6 類検証結果・全ファイル对象配列（files[]）・不足書類/項目明細。',
  nodeOutputStart: 'Step1 案件变量 + docTypes[]（账票类型清单）+ files[]。账票字段仅在条件选择时从 Step1 模板加载。',
  nodeOutputEnd: '案件状態提案・最終処理結果・未完了事項・成果ファイル状態・終了時刻。',
  nodeOutputHitl: '確認状態・確認アクション（完成/補件/案件終止）+ files[]（含 manualEdits）。分岐は画布三出口で直接接続。',
  nodeOutputNotify: '通知送信状態・送信日時・送信失敗理由。',
  dataMappingOutput: 'case.standardFields + files[] + ステータス。条件选标准字段时三级展开：映射节点 → 標準フィールド → 字段名。',
  externalApiIo: '前工程から自動連携される入力です。',
  knowledgeSelect: 'ナレッジ数据源を選択します。+ ボタンから新規作成（文档上传 / Web Site API）ができます。',
  knowledgeRetrieval: 'Vector Search の類似度・Top N・参照文字数上限を設定します（Dify Knowledge Retrieval 相当）。',
  knowledgeOutput: '检索結果として後続ノードへ渡される出力変数です。',
  externalApiConfig: '检索パラメータを設定します。',
  externalApiOutput: '检索結果として後続ノードへ渡される出力変数です。',
  masterKnowledge: '照合に使用する内部マスタ辞書を選択します。辞書の項目定義は辞書設定で管理します。',
  masterApi: 'リトライ回数・キャッシュ TTL・例外時の動作を指定します。',
  masterRules: '登録済み照合ルールの一覧です。下のフォームから追加・編集できます。',
  masterRuleAdd: '帳票タイプ・照合元 OCR 項目・照合先・出力フィールドを指定してルールを追加します。',
  aiVerify: 'AI検証設定で定義した検証ルールをこの Workflow で呼び出します。検証結果は変数として出力し、補件・人工確認・異常分岐は後続ノードで判断します。',
  completeness: '必須・任意帳票の収集状態と、帳票ごとの必須項目を検証します。帳票タイプは業務シーン設定で登録し、ここで必須/任意と必須項目を指定します。',
  textVerify: '自然言語で記述し、AI補助で実行式を生成します。入力欄の下にプレビューが表示されます。',
  dataVerify: '帳票間の整合性と業務ロジックを自然言語で記述し、AI補助で実行式をプレビュー表示します。',
  seal: '署名・印鑑が存在するかを検出します。帳票タイプごとに検出目標と類似度閾値を設定できます。閾値未満は不備として扱います。',
  hitlGate: '案件レベルの人工確認タスクを生成します。審査ロールを指定し、必要な出口だけ下流へ接続してください（未接続の出口は自動的に不要扱い）。確認対象は上流ノードから自動判定されます。',
  hitlContext: '前処理・OCR 抽出・AI 検証の直後に接続すると、確認対象が自動判定されます。',
  decision: 'IF / ELIF / ELSE を変数・演算子で自由に設定します。上流ノードの出力変数を選択して分岐条件を組み立てます。',
  decisionContext: '案件就緒・検証結果・処理完了など、分岐の業務意味を選びます。変更時は既定条件で上書きされます。',
  decisionElseLabel: '接続線ラベルや実行ログに表示される名称です。',
  decisionOutputVar: '分岐名は後続ノードの条件式で参照できます。',
  fraudDetect: '画像の PS 痕跡・改ざんの有無を判定します。画像リスクスコアが閾値以上の場合、条件分岐または人工確認へ送ります。',
  notify: '件名・本文に変数を挿入して通知を送信します。通知ノードは案件状態を更新せず、停止も制御しません。',
  startTriggers: 'Workflow 入口。案件集約結果に応じてインスタンスを新規起動または続行します（読み取り専用）。',
  startTriggerCaseEvent: 'ファイルアップロード自体は Workflow を開始しません。案件集約完了後、または補件後に開始・続行します。',
  startTriggerSchedule: 'スケジュール起動は現在バージョンでは未対応です。',
  notifyRecipients: 'システム通知の場合は通知先ロールを選択します。メールの場合は宛先アドレスを指定します。',
  notifyMessage: '件名・本文に {ノード変数名.case.xxx} 形式で変数を挿入できます。挿入候補は上流ノードの出力変数から選択します。実行時に案件データへ置換されます。',
  code: 'Python スクリプトで上流変数を加工し、後続ノードへ結果を渡します。入力変数・出力変数の定義は本パネルで設定します。',
  codeInput: 'スクリプト内で参照する引数名と、上流ノードの出力変数またはカスタム値の対応を定義します。「+ 追加」から変数を登録できます。',
  codePython: 'def main(inputs: dict) -> dict 形式で記述します。戻り値は {ノード変数名.result} へ格納されます。',
  codeReturn: 'OFF の場合、ユーザー定義の戻り値は後続ノードへ公開されません。ステータスとエラーメッセージは常に出力されます。',
  codeOutput: 'スクリプト戻り値の各項目名とデータ型を定義します。後続ノードでは {ノード変数名.項目名} 形式で参照できます。',
  codeParamName: 'スクリプト内で参照する引数の名前です。64 文字以内で指定します。',
  codeParamDataType: '引数または出力値のデータ型を選択します。',
  codeParamSource: '参照パラメータは上流変数プール JSON を実行時に自動注入します。カスタムは固定値を直接入力します。',
  codeParamReference: '上流変数プール JSON を実行時に自動注入します。',
  codeParamCustom: '固定値としてスクリプトへ渡す値を入力します。',
  codeParamRequired: '必須にすると、値が未設定の場合は実行時にエラーとして扱われます。',
  hitlLegacy: '前処理・OCR抽出・外部API連携・AI検証・出力の各ノードで HITL が発生した場合の復核ロールを設定します。',
  output: '自動エクスポート設定です。命名規則・ファイル形式・出力フィールドを指定します。',
  outputFields: 'OCR 抽出フィールドの出力有無と順序を設定します。',
  outputNaming: '貴社命名規則の詳細（チューリッヒ様提供予定）に合わせてテンプレートを調整します。',
  outputExport: '文字エンコーディング・Excel 出力形式などエクスポートファイルの設定です。',
  outputApi: 'エクスポート完了後、抽出結果を外部 API へ送信します。',
  caseLinkDocs: '主帳票を1件選択し、その他の帳票を関連帳票として扱います。',
  caseLinkAggregate: '主帳票と関連帳票の紐付けを管理します。',
  docFieldLinks: '任意の帳票間でフィールド関連を設定します。主帳票を介さない副帳票同士の関連も可能です。',
  docFieldNetwork: '主帳票を中央に配置し、主帳票のフィールドから関連帳票へ矢印を表示します。',
  sceneMatching: 'マッチング優先度を指定します。',
  sceneMatchingDefaults: '既定動作：補件ファイルは既存案件に紐付け、マスタなしファイルは保留プールへ送ります（本画面では変更できません）。',
};

const CASE_WORKFLOW_TEMPLATE_VERSION = 21;
const CANONICAL_CASE_WORKFLOW_LAYOUT_VERSION = 16;
const WF_LAYOUT_PAD = { x: 48, y: 160 };
const WF_BRANCH_LANE_GAP = 88;
const STRAIGHT_CASE_WORKFLOW_NODE_IDS = [
  'wf-start', 'wf-pp', 'wf-d-pre', 'wf-hu-pre', 'wf-oc', 'wf-d-ocr', 'wf-hu-ocr',
  'wf-map', 'wf-ai', 'wf-d-final', 'wf-hu-final',
  'wf-n-supp', 'wf-n-error', 'wf-n-ok', 'wf-end',
];

const DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS = [
  'wf-pp', 'wf-d-pre', 'wf-hu-pre', 'wf-oc', 'wf-d-ocr', 'wf-hu-ocr',
  'wf-map', 'wf-ai', 'wf-d-final', 'wf-hu-final',
  'wf-n-supp', 'wf-n-error', 'wf-n-ok',
];

const PREVIOUS_CASE_WORKFLOW_TEMPLATE_NODE_IDS = [
  'wf-intake', 'wf-d-quality', 'wf-d-ocr', 'wf-logic', 'wf-auto', 'wf-d-audit',
  'wf-hu-quality', 'wf-hu-audit', 'wf-hu-prelim',
];

const PREVIOUS_V6_CASE_WORKFLOW_TEMPLATE_NODE_IDS = [
  'wf-pp', 'wf-hu-pre', 'wf-oc', 'wf-hu-ocr', 'wf-map', 'wf-ai',
  'wf-d-final', 'wf-n-ok', 'wf-hu-final',
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
  { type: 'data_mapping', label: 'データマッピング', step: 3 },
  { type: 'ai_verify', label: 'AI検証', step: 4 },
];

const WORKFLOW_MAIN_CHAIN_TYPE_ORDER = Object.fromEntries(
  WORKFLOW_MAIN_CHAIN_ORDER.map((item, idx) => [item.type, idx]),
);

/** 処理ノード（制御・ナレッジ以外） */
const WORKFLOW_PROCESSING_NODE_TYPES = new Set([
  'preprocess', 'ocr', 'ai_verify', 'data_mapping', 'code',
]);

/** ノード出力変数の既定名（IF/ELSE で {varName}.result として参照） */
const WORKFLOW_NODE_DEFAULT_VAR = {
  preprocess: 'preprocess',
  ocr: 'ocr',
  data_mapping: 'data_mapping',
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
  if (!node || !WORKFLOW_PROCESSING_NODE_TYPES.has(node.type)) return node;
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
    category: '業務 Agent',
    nodes: [
      { type: 'preprocess', label: '前処理' },
      { type: 'ocr', label: 'OCR抽出' },
      { type: 'data_mapping', label: 'データマッピング' },
      { type: 'ai_verify', label: 'AI検証' },
    ],
  },
  {
    category: '制御 Node',
    nodes: [
      { type: 'decision', label: '条件判断' },
      { type: 'hitl_gate', label: '人工確認', defaultHitlContext: 'ocr' },
      { type: 'notify', label: '通知', defaultNotifyTemplate: 'deficiency' },
    ],
  },
  {
    category: '拡張 Node',
    nodes: [
      { type: 'code', label: 'カスタム関数' },
    ],
  },
  {
    category: '端点',
    nodes: [
      { type: 'start', label: '開始' },
      { type: 'end', label: '終了' },
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
  'input', 'output', 'fraud_detect', 'master_match', 'mcp',
]);

const WORKFLOW_INSPECTOR_MAP = {
  start: 'start',
  end: 'end',
  preprocess: 'image',
  ocr: 'ocr',
  ai_verify: 'ai_verify',
  data_mapping: 'data_mapping',
  decision: 'decision',
  hitl_gate: 'hitl_gate',
  notify: 'notify',
  code: 'code',
};

const CASE_WORKFLOW_START_TRIGGERS = [
  {
    id: 'e1',
    eventId: 'E1',
    category: '案件集約',
    label: '集約完了・初回起動',
    detail: 'caseStatus が待機中、ファイルが紐付け完了し書類が揃ったとき、新規インスタンスを起動',
    actionLabel: '新規起動',
    triggerType: '新規起動',
  },
  {
    id: 'e2',
    eventId: 'E2',
    category: '案件集約',
    label: '集約完了・既存案件へ帰属',
    detail: '集約完了後、本批ファイルが既存案件へ帰属したとき、インスタンスを続行または起動',
    actionLabel: '続行',
    triggerType: '続行',
  },
  {
    id: 'e3',
    eventId: 'E3',
    category: '補件・帰属',
    label: '補件・ファイル帰属',
    detail: 'caseStatus が補件、補件ファイルがアップロードされ本案へ帰属したとき、既存インスタンスを続行',
    actionLabel: '続行',
    triggerType: '続行',
  },
  {
    id: 'e4',
    eventId: 'E4',
    category: '処理中止',
    label: '再実行',
    detail: 'caseStatus が処理中止、ユーザー確認後（集約は変更なし）、新規インスタンスを再実行',
    actionLabel: '再実行',
    triggerType: '再実行',
  },
];

const CASE_WORKFLOW_START_TRIGGER_IDS = new Set(
  CASE_WORKFLOW_START_TRIGGERS.map((trigger) => trigger.id),
);

const CASE_WORKFLOW_LEGACY_TRIGGER_ID_MAP = {
  initial_upload: 'e1',
  cross_batch_upload: 'e2',
  auto_supplement_bind: 'e3',
  manual_supplement_link: 'e3',
  new_case_start: 'e1',
  resume: 'e3',
  reexecute: 'e4',
};

const CASE_WORKFLOW_LEGACY_ROUTING_EVENT_TO_TRIGGER_IDS = {
  CASE_AGGREGATED: ['e1', 'e2'],
  SUPPLEMENT_LINKED: ['e3'],
};

/** @deprecated migrated to acceptedTriggers */
const CASE_WORKFLOW_LEGACY_STATUS_TO_TRIGGER_IDS = {
  AWAITING_SUPPLEMENT: ['e3'],
  SUPPLEMENT_RECEIVED: ['e3'],
  SUPPLEMENT: ['e3'],
  NEW: ['e1'],
  NEW_CASE: ['e1'],
};

const WORKFLOW_END_OUTCOMES = [
  { key: 'branchStatus', label: '分岐ステータス', value: '完了', hint: 'この Workflow 分岐の終了結果' },
  { key: 'caseStatus', label: '案件状態', value: '処理完了', hint: '案件状態机への提案値' },
  { key: 'finalResult', label: '最終処理結果', value: '正常完了', hint: '正常完了 / 補件待ち / 異常 / 中止' },
  { key: 'hasOpenItems', label: '未完了事項あり', value: 'いいえ', hint: '未完了事項の有無（open 待办・待确认文件/字段・补件待上传・跨批次 pending 未汇总・成果文件未生成等）' },
];

const START_SUPPLEMENT_REPLAY_MODES = [
  { value: 'restart_to_verify', label: '前処理からAI検証まで再実行' },
  { value: 'verify_only', label: 'AI検証のみ再実行' },
];

const START_DUPLICATE_POLICIES = [
  { value: 'ignore_running', label: '処理中は起動しない' },
  { value: 'queue', label: '順番に実行' },
];

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
    acceptedTriggers: [...CASE_WORKFLOW_START_TRIGGER_IDS],
    supplementReplayMode: 'restart_to_verify',
    duplicatePolicy: 'ignore_running',
    schedule: null,
  };
}

function migrateAcceptedTriggersFromRaw(raw) {
  if (Array.isArray(raw?.acceptedTriggers)) {
    return [...new Set(raw.acceptedTriggers
      .map((id) => CASE_WORKFLOW_LEGACY_TRIGGER_ID_MAP[id] || id)
      .filter((id) => CASE_WORKFLOW_START_TRIGGER_IDS.has(id)))];
  }
  const legacyStatuses = Array.isArray(raw?.caseStatuses) ? raw.caseStatuses : [];
  const legacyEvents = Array.isArray(raw?.caseEvents) ? raw.caseEvents : [];
  const merged = [
    ...legacyEvents.flatMap((event) => CASE_WORKFLOW_LEGACY_ROUTING_EVENT_TO_TRIGGER_IDS[event] || []),
    ...legacyStatuses.flatMap((status) => CASE_WORKFLOW_LEGACY_STATUS_TO_TRIGGER_IDS[status] || []),
  ];
  return [...new Set(merged.filter((id) => CASE_WORKFLOW_START_TRIGGER_IDS.has(id)))];
}

function normalizeStartTriggerConfig(raw) {
  if (!raw || typeof raw !== 'object') return getDefaultStartTriggerConfig();
  const acceptedTriggers = migrateAcceptedTriggersFromRaw(raw);
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
  const cfg = { acceptedTriggers, schedule };
  cfg.supplementReplayMode = START_SUPPLEMENT_REPLAY_MODES.some((m) => m.value === raw.supplementReplayMode)
    ? raw.supplementReplayMode
    : 'restart_to_verify';
  cfg.duplicatePolicy = START_DUPLICATE_POLICIES.some((p) => p.value === raw.duplicatePolicy)
    ? raw.duplicatePolicy
    : 'ignore_running';
  if (!cfg.acceptedTriggers.length && !cfg.schedule) {
    cfg.acceptedTriggers = [...CASE_WORKFLOW_START_TRIGGER_IDS];
  }
  return cfg;
}

function migrateLegacyStartTriggers(triggers) {
  const cfg = {
    acceptedTriggers: [],
    supplementReplayMode: 'restart_to_verify',
    duplicatePolicy: 'ignore_running',
    schedule: null,
  };
  if (!Array.isArray(triggers) || !triggers.length) return getDefaultStartTriggerConfig();
  triggers.forEach((t) => {
    if (t.enabled === false) return;
    if (t.type === 'intake') {
      if (!cfg.acceptedTriggers.includes('e1')) cfg.acceptedTriggers.push('e1');
    }
    if (t.type === 'case_status' && t.caseStatus) {
      const mapped = CASE_WORKFLOW_LEGACY_STATUS_TO_TRIGGER_IDS[t.caseStatus] || [];
      mapped.forEach((id) => {
        if (!cfg.acceptedTriggers.includes(id)) cfg.acceptedTriggers.push(id);
      });
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
  if (!cfg.acceptedTriggers.length && !cfg.schedule) {
    cfg.acceptedTriggers = [...CASE_WORKFLOW_START_TRIGGER_IDS];
  }
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
  const mappedId = CASE_WORKFLOW_LEGACY_TRIGGER_ID_MAP[event] || event;
  return CASE_WORKFLOW_START_TRIGGERS.find((trigger) =>
    trigger.actionLabel === event
    || trigger.label === event
    || trigger.eventId === event
    || trigger.id === mappedId)?.label || event;
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
  return normalizeStartTriggerConfig(node?.triggerConfig).acceptedTriggers.length > 0;
}

function normalizeEndNode(node) {
  if (!node || node.type !== 'end') return node;
  const { caseStatus, namingConfig, ...rest } = node;
  return {
    ...rest,
    isEnd: true,
  };
}

const WORKFLOW_NODE_META = {
  start: {
    icon: '▶',
    title: '開始',
    desc: '集約完了による初回起動・既存案件への帰属、補件ファイル帰属後の続行、処理中止後の再実行',
    tasks: [],
    accent: '#067647',
  },
  end: {
    icon: '■',
    title: '終了',
    desc: 'この分岐を終了します',
    tasks: [],
    accent: '#667085',
  },
  preprocess: {
    icon: 'PP',
    title: '前処理',
    desc: '画像補正・回転・画像分割・並び替え',
    tasks: ['画像補正', '画像回転', '画像分割', '画像並び替え'],
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
  data_mapping: {
    icon: 'MAP',
    title: 'データマッピング',
    desc: '異構造フィールドを標準項目へ変換',
    tasks: ['標準フィールド', '競合検出', '適用性チェック'],
    input: 'Case · OCR Fields',
    output: 'Standard Fields',
    accent: '#175cd3',
  },
  ai_verify: {
    icon: 'AI',
    title: 'AI検証',
    desc: '必須フィールド・必要書類・各種検証',
    tasks: ['必須フィールド', '必要書類', 'テキスト検証', 'データ検証', 'データマッピング競合検証', '署名・印鑑検証'],
    input: 'Case Data Pool',
    output: 'Validation Result',
    accent: '#7c3aed',
  },
  decision: {
    icon: 'IF',
    title: '条件判断',
    desc: 'IF / ELIF / ELSE・変数で分岐',
    tasks: [],
    input: 'Node Result',
    output: 'Branch',
    accent: '#9333ea',
  },
  hitl_gate: {
    icon: '人',
    title: '人工確認',
    desc: '完成・補件・案件終止',
    tasks: [],
    input: 'Process Result',
    output: 'Confirmed',
    accent: '#dc6803',
  },
  notify: {
    icon: 'NT',
    title: '通知',
    desc: 'システム通知・メール送信',
    tasks: [],
    input: 'Case Event',
    output: 'Notified',
    accent: '#d92d20',
  },
  code: {
    icon: 'fx',
    title: 'カスタム関数',
    desc: 'Python・データ加工・API 呼び出し',
    tasks: [],
    input: 'Upstream Variables',
    output: 'Result',
    accent: '#079455',
  },
};

function getWorkflowNodeAccent(type) {
  return WORKFLOW_NODE_META[type]?.accent || '#175cd3';
}

function getWorkflowNodeAccentStyle(type) {
  return { '--wf-node-accent': getWorkflowNodeAccent(type) };
}

const WORKFLOW_FLOW_PREVIEW_ACCENT_TYPES = new Set(['decision', 'hitl_gate', 'notify']);

function getWorkflowFlowPreviewNodeStyle(type) {
  if (!WORKFLOW_FLOW_PREVIEW_ACCENT_TYPES.has(type)) return null;
  return getWorkflowNodeAccentStyle(type);
}

const DATA_MAPPING_STANDARD_FIELDS = [
  { value: 'claimNo', label: '案件元請求番号', dataType: 'string', category: 'claim' },
  { value: 'policyNo', label: '証券番号', dataType: 'string', category: 'contract' },
  { value: 'contractorName', label: '契約者氏名', dataType: 'string', category: 'customer' },
  { value: 'insuredName', label: '被保険者氏名', dataType: 'string', category: 'customer' },
  { value: 'insuredBirthDate', label: '被保険者生年月日', dataType: 'date', category: 'customer' },
  { value: 'claimType', label: '請求区分', dataType: 'string', category: 'claim' },
  { value: 'admissionDate', label: '入院日', dataType: 'date', category: 'medical' },
  { value: 'dischargeDate', label: '退院日', dataType: 'date', category: 'medical' },
  { value: 'claimAmount', label: '請求金額', dataType: 'number', category: 'claim' },
  { value: 'medicalInstitutionName', label: '医療機関名', dataType: 'string', category: 'medical' },
  { value: 'diagnosisName', label: '傷病名・診断名', dataType: 'string', category: 'medical' },
];

const DATA_MAPPING_FIELD_CATEGORIES = [
  { value: 'customer', label: '顧客情報' },
  { value: 'contract', label: '契約情報' },
  { value: 'claim', label: '請求情報' },
  { value: 'medical', label: '医療情報' },
  { value: 'document', label: '書類情報' },
  { value: 'other', label: 'その他' },
];

const DATA_MAPPING_TRANSFORM_RULES = [
  { value: 'as_is', label: 'そのまま' },
  { value: 'trim', label: '空白除去' },
  { value: 'date_normalize', label: '日付正規化' },
  { value: 'amount_normalize', label: '金額正規化' },
  { value: 'kana_normalize', label: 'カナ正規化' },
  { value: 'master_code', label: 'コード変換' },
];

const DATA_MAPPING_DATA_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
];

const DATA_MAPPING_CONFLICT_COMPARE_MODES = [
  { value: 'exact', label: '完全一致' },
  { value: 'normalized', label: '正規化後一致' },
];

const DATA_MAPPING_OUTPUT_MODES = [
  { value: 'unified', label: '統一フィールド構造' },
  { value: 'per_document', label: '帳票別結果も保持' },
];

const DATA_MAPPING_EXECUTION_SCOPES = [
  { value: 'case', label: '案件単位' },
  { value: 'doc_type', label: '帳票タイプ単位' },
];

const HITL_WAIT_MINUTES = 30;

const AI_VERIFY_MODULE_OPTIONS = [
  { key: 'required_fields', label: '必須フィールド' },
  { key: 'required_documents', label: '必要書類' },
  { key: 'text', label: 'テキスト検証' },
  { key: 'data', label: 'データ検証' },
  { key: 'mapping_conflict', label: 'データマッピング競合検証' },
  { key: 'signature_seal', label: '署名・印鑑検証' },
];

/** AI 检证六模块 → 案件级 status 输出（关模块运行时写 skipped） */
const AI_VERIFY_MODULE_STATUS_FIELDS = [
  { moduleKey: 'required_fields', id: 'case.requiredFieldStatus', label: '必須フィールド状態' },
  { moduleKey: 'required_documents', id: 'case.requiredDocumentStatus', label: '必要書類状態' },
  { moduleKey: 'text', id: 'case.textValidationStatus', label: 'テキスト検証状態' },
  { moduleKey: 'data', id: 'case.dataValidationStatus', label: 'データ検証状態' },
  { moduleKey: 'mapping_conflict', id: 'case.mappingConflictStatus', label: 'マッピング競合検証状態' },
  { moduleKey: 'signature_seal', id: 'case.signatureSealStatus', label: '署名・印鑑検証状態' },
];

function aiVerifyModuleStatusOutputFields() {
  return AI_VERIFY_MODULE_STATUS_FIELDS.map((item) => ({
    id: item.id,
    label: item.label,
    scope: '案件',
    type: 'Enum',
    valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.verifyModuleStatus,
    description: '画布で当該モジュール OFF の場合 skipped；ON 時のみ success / failed / missing',
    moduleKey: item.moduleKey,
  }));
}

const WORKFLOW_OUTPUT_VALUE_SPECS = {
  nodeStatus: 'success / failed / skipped',
  triggerType: '新規起動 / 続行 / 再実行',
  caseStatus: '新規 / 処理中 / 人工確認 / 補件待ち / 処理完了 / 処理中止 / 異常 / 保留',
  finalResult: '正常完了 / 補件待ち / 異常 / 中止',
  boolean: 'true / false',
  runtimeCount: '运行时写入，非负整数，无固定上限',
  runtimeString: '运行时写入，无固定取值',
  runtimeDateTime: '运行时写入，ISO 8601 日期时间',
  resultFileStatus: '対象外 / 待機 / 生成中 / 完了 / 失敗',
  verifyModuleStatus: 'success / failed / skipped / missing',
  confirmStatus: 'created / completed / failed / timeout',
  confirmAction: 'approve（完成）/ request_supplement（補件）/ reject（案件終止）',
  notifySendStatus: 'success / failed / skipped',
  codeStatus: 'success / failed',
  dynamicObjectKeys: '键集合运行时生成，无固定枚举',
  dynamicArrayItems: '元素结构由运行时结果决定',
  fileEntryStatus: 'Processed / Processing / Pending / Failed',
};

const WORKFLOW_STEP1_CASE_FIELDS = [
  { id: 'case.caseId', label: '案件ID', scope: '案件', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: 'Step1 案件唯一标识' },
  { id: 'case.caseNo', label: '案件番号', scope: '案件', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: 'Workflow 対象の案件番号' },
  { id: 'case.businessScene', label: '業務シーン', scope: '案件', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: 'Step1 で設定した業務シーン名' },
  { id: 'case.caseStatus', label: '案件状態', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.caseStatus, description: 'Step1 案件列表聚合状态' },
  { id: 'case.triggerType', label: 'トリガー種別', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.triggerType, description: '起動トリガー種別' },
];

const WORKFLOW_DOCTYPE_OUTPUT_NODES = new Set(['start']);

/** 账票类型清单（仅开始节点输出；不含各字段运行时值） */
const WORKFLOW_STEP1_DOCTYPE_DEF = [
  { id: 'docTypes[]', label: '帳票タイプ一覧', scope: '帳票タイプ', type: 'Array', valueSpec: 'Step1 登録帳票タイプ ID の配列', description: 'Step1 关联账票类型列表/定义；不含各字段值' },
];

/** 条件节点级联 L1：Step1 账票模板 OCR 字段分组 */
const STEP1_DOCTYPE_FIELD_CASCADER_GROUP = '帳票フィールド';

/** 消费路径（PRD 6.02.10.1）：condition / todo / notify / todo_notify / runtime */
const WORKFLOW_VAR_CONSUMPTION = {
  CONDITION: 'condition',
  TODO: 'todo',
  NOTIFY: 'notify',
  TODO_NOTIFY: 'todo_notify',
  RUNTIME: 'runtime',
};

/** 消费路径 → 出力変数面板 / tooltip 文案（PRD 6.02.10.1） */
const WORKFLOW_VAR_CONSUMPTION_LABELS = {
  [WORKFLOW_VAR_CONSUMPTION.CONDITION]: '条件',
  [WORKFLOW_VAR_CONSUMPTION.TODO]: '待办',
  [WORKFLOW_VAR_CONSUMPTION.NOTIFY]: '通知',
  [WORKFLOW_VAR_CONSUMPTION.TODO_NOTIFY]: '待办·通知',
  [WORKFLOW_VAR_CONSUMPTION.RUNTIME]: '运行时',
};

function formatWorkflowVarConsumptionLabels(paths = []) {
  const list = Array.isArray(paths) ? paths : [];
  const labels = list
    .map((path) => WORKFLOW_VAR_CONSUMPTION_LABELS[path] || path)
    .filter(Boolean);
  return labels.length ? labels.join(' / ') : '';
}

/** 案件级变量键 → 消费路径（出力変数面板列全量；条件/通知选择器按路径过滤） */
const WORKFLOW_VAR_CONSUMPTION_PATHS_BY_ID = {
  'case.caseId': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'case.caseNo': [WORKFLOW_VAR_CONSUMPTION.NOTIFY],
  'case.businessScene': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'case.caseStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.triggerType': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'docTypes[]': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'case.finalResult': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.hasOpenItems': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.resultFileStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.endedAt': [WORKFLOW_VAR_CONSUMPTION.NOTIFY],
  'case.preprocessStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.lastFailureReason': [WORKFLOW_VAR_CONSUMPTION.NOTIFY],
  'case.ocrStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.lowConfidenceFieldCount': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.mappingStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.standardFields': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.mappingConflicts': [WORKFLOW_VAR_CONSUMPTION.TODO],
  'case.mappingErrors': [WORKFLOW_VAR_CONSUMPTION.TODO],
  'case.verifyStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.isException': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.requiredFieldStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.requiredDocumentStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.textValidationStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.dataValidationStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.mappingConflictStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.signatureSealStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.missingDocuments': [WORKFLOW_VAR_CONSUMPTION.TODO_NOTIFY],
  'case.missingFields': [WORKFLOW_VAR_CONSUMPTION.TODO_NOTIFY],
  'case.aiVerifyResultJson': [WORKFLOW_VAR_CONSUMPTION.TODO],
  'case.confirmStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.confirmAction': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.branchName': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'case.branchResult': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'case.matchedFileCount': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'case.notifySendStatus': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.notifiedAt': [WORKFLOW_VAR_CONSUMPTION.NOTIFY],
  'case.notifyFailureReason': [WORKFLOW_VAR_CONSUMPTION.NOTIFY],
  'case.status': [WORKFLOW_VAR_CONSUMPTION.CONDITION],
  'case.errorMessage': [WORKFLOW_VAR_CONSUMPTION.NOTIFY],
  'case.result': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'case.latencyMs': [WORKFLOW_VAR_CONSUMPTION.RUNTIME],
  'files[]': [WORKFLOW_VAR_CONSUMPTION.TODO],
};

/** 节点输出目录中排除的键（改由 Step1 / 二级选择器提供；files[] 为数组不可直接比较） */
const DECISION_CATALOG_SKIP_IDS = new Set([
  'case.ocrFields',
  'case.standardFields',
  'docTypes[]',
  'files[]',
  'case.mappingConflicts',
  'case.mappingErrors',
  'case.missingDocuments',
  'case.missingFields',
  'case.aiVerifyResultJson',
]);

function getWorkflowVarConsumptionPaths(item) {
  if (!item) return [];
  if (item.consumptionPaths?.length) return item.consumptionPaths;
  const key = item.localId || item.id || '';
  if (WORKFLOW_VAR_CONSUMPTION_PATHS_BY_ID[key]) {
    return WORKFLOW_VAR_CONSUMPTION_PATHS_BY_ID[key];
  }
  if (item.pickerGroup === 'step1_doc' || item.pickerGroup === 'standard_field') {
    return [WORKFLOW_VAR_CONSUMPTION.CONDITION];
  }
  if (item.nodeType === 'code' && item.localId && !['case.status', 'case.errorMessage'].includes(item.localId)) {
    return [WORKFLOW_VAR_CONSUMPTION.CONDITION];
  }
  return [];
}

function isWorkflowVarForCatalog(item, catalogMode) {
  const paths = getWorkflowVarConsumptionPaths(item);
  if (catalogMode === 'condition') return paths.includes(WORKFLOW_VAR_CONSUMPTION.CONDITION);
  if (catalogMode === 'notify') {
    return paths.includes(WORKFLOW_VAR_CONSUMPTION.NOTIFY)
      || paths.includes(WORKFLOW_VAR_CONSUMPTION.TODO_NOTIFY);
  }
  return true;
}

function isDecisionCatalogFileScopeVar(item) {
  if (!item) return false;
  if (item.scope === 'ファイル') return true;
  const id = String(item.id || '');
  return id === 'files[]' || id.startsWith('files[].');
}

/** files[] 数组元素字段定义（供 PRD / 文档；配置端出力変数面板不逐条展示） */
const WORKFLOW_FILE_ENTRY_FIELD_SCHEMA = [
  { id: 'files[].id', label: 'ファイルID', scope: 'ファイル', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: 'ファイル一意識別子' },
  { id: 'files[].name', label: 'ファイル名', scope: 'ファイル', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: '元ファイル名' },
  { id: 'files[].type', label: 'ファイルタイプ', scope: 'ファイル', type: 'String', valueSpec: 'pdf / jpg / png / tiff 等', description: 'MIME または拡張子種別' },
  { id: 'files[].extension', label: '拡張子', scope: 'ファイル', type: 'String', valueSpec: '.pdf / .jpg 等', description: 'ファイル拡張子' },
  { id: 'files[].url', label: 'ファイルURL', scope: 'ファイル', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: '本ノード時点のストレージ参照 URL（前処理後は変わる場合あり）' },
  { id: 'files[].size', label: 'ファイルサイズ', scope: 'ファイル', type: 'Number', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeCount, description: 'バイト単位のファイルサイズ' },
  { id: 'files[].caseId', label: '案件ID', scope: 'ファイル', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: '所属案件 ID' },
  { id: 'files[].classificationResult', label: '分類結果', scope: 'ファイル', type: 'String', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString, description: '帳票タイプ分類ラベル' },
  { id: 'files[].status', label: 'ファイル状態', scope: 'ファイル', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.fileEntryStatus, description: '本ノード時点のファイル処理状態' },
  { id: 'files[].uploadedAt', label: 'アップロード日時', scope: 'ファイル', type: 'DateTime', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeDateTime, description: 'アップロード日時' },
  { id: 'files[].updatedAt', label: '更新日時', scope: 'ファイル', type: 'DateTime', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeDateTime, description: '本ノード処理後の最終更新日時' },
];

const WORKFLOW_FILE_NODE_EXTRA_SCHEMA = {
  ocr: [
    { id: 'files[].ocrFields', label: 'OCRフィールド', scope: 'ファイル', type: 'Object', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicObjectKeys, description: 'ファイル単位の OCR 抽出結果' },
  ],
  ai_verify: [
    { id: 'files[].failedRules', label: '失敗ルール', scope: 'ファイル', type: 'Array', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicArrayItems, description: 'ファイル単位で違反した検証ルール' },
  ],
  hitl_gate: [
    { id: 'files[].manualEdits', label: '修正摘要', scope: 'ファイル', type: 'Array', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicArrayItems, description: 'ファイル単位の人工修正摘要' },
  ],
};

/** @deprecated 兼容旧引用；元素结构见 WORKFLOW_FILE_ENTRY_FIELD_SCHEMA */
const WORKFLOW_FILE_BASE_FIELDS = [
  { id: 'files[]', label: 'ファイル一覧', scope: 'ファイル', type: 'Array', valueSpec: '本ノード処理後の全ファイル对象配列', description: '本ノード実行後の案件内全ファイル（状態・URL 等を含む）' },
  ...WORKFLOW_FILE_ENTRY_FIELD_SCHEMA,
];

const WORKFLOW_FILE_NODE_EXTRA_FIELDS = WORKFLOW_FILE_NODE_EXTRA_SCHEMA;

const WORKFLOW_FILE_ARRAY_OUTPUT_NOTES = {
  preprocess: '各元素含 id / name / url / status / classificationResult 等',
  ocr: '各元素含 ocrFields（OCR 抽出結果）',
  data_mapping: '透传上游文件对象（含 ocrFields）',
  ai_verify: '各元素含 failedRules',
  hitl_gate: '各元素含 manualEdits',
  start: '各元素含 classificationResult 等基础字段',
};

function workflowNodeFileOutputFields(nodeType) {
  const note = WORKFLOW_FILE_ARRAY_OUTPUT_NOTES[nodeType];
  return [{
    id: 'files[]',
    label: 'ファイル一覧',
    scope: 'ファイル',
    type: 'Array',
    valueSpec: '本ノード処理後の全ファイル对象配列',
    description: note
      ? `案件内全ファイル配列。${note}`
      : '本ノード実行後の案件内全ファイル（状態・URL 等を含む）',
  }];
}

const WORKFLOW_NODE_OUTPUT_VAR_DEFS = {
  start: [
    ...WORKFLOW_STEP1_CASE_FIELDS,
    ...WORKFLOW_STEP1_DOCTYPE_DEF,
    ...workflowNodeFileOutputFields('start'),
  ],
  end: [
    { id: 'case.caseStatus', label: '案件状態', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.caseStatus, description: '案件状態机への最終提案' },
    { id: 'case.finalResult', label: '最終処理結果', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.finalResult, description: '分岐の業務終了区分' },
    { id: 'case.hasOpenItems', label: '未完了事項あり', scope: '案件', type: 'Boolean', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.boolean, description: '结束时刻是否存在未完了事項（open 待办、待确认文件/字段、补件待上传、跨批次 pending 未汇总、成果文件未生成、处理未完结文件等）；true=有' },
    { id: 'case.resultFileStatus', label: '成果ファイル状態', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.resultFileStatus, description: 'Step3 出力ファイルの生成状態' },
    { id: 'case.endedAt', label: '終了時刻', scope: '案件', type: 'DateTime', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeDateTime, description: '分岐が終了した時刻' },
  ],
  preprocess: [
    { id: 'case.preprocessStatus', label: '前処理ステータス', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.nodeStatus, description: '前処理全体の集約状態' },
    { id: 'case.lastFailureReason', label: '最終失敗原因', scope: '案件', type: 'String', valueSpec: '失敗時のみ写入；无固定取值', description: '直近の前処理失敗理由' },
    ...workflowNodeFileOutputFields('preprocess'),
  ],
  ocr: [
    { id: 'case.ocrStatus', label: 'OCRステータス', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.nodeStatus, description: 'OCR 全体の処理状態' },
    { id: 'case.lowConfidenceFieldCount', label: '低信頼フィールド件数', scope: '案件', type: 'Number', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeCount, description: '閾値未満の OCR フィールド件数（条件分岐用）' },
    ...workflowNodeFileOutputFields('ocr'),
  ],
  data_mapping: [
    { id: 'case.mappingStatus', label: 'マッピングステータス', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.nodeStatus, description: 'マッピング全体の集約状態' },
    { id: 'case.standardFields', label: '標準フィールド', scope: '案件', type: 'Object', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicObjectKeys, description: '案件級标准字段（条件选择：映射节点 → 標準フィールド → 字段名）' },
    { id: 'case.mappingConflicts', label: '競合一覧', scope: '案件', type: 'Array', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicArrayItems, description: '案件級に集約したフィールド競合' },
    { id: 'case.mappingErrors', label: 'マッピングエラー', scope: '案件', type: 'Array', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicArrayItems, description: 'ルール不適用、字段缺失、変換失敗の明細' },
    ...workflowNodeFileOutputFields('data_mapping'),
  ],
  decision: [
    { id: 'case.branchName', label: '分岐名', scope: '案件', type: 'String', valueSpec: '画布 IF/ELIF/ELSE 分支名；运行时写入', description: '命中した IF / ELIF / ELSE 分岐名' },
    { id: 'case.branchResult', label: '分岐結果', scope: '案件', type: 'Boolean', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.boolean, description: '条件が成立したか' },
    { id: 'case.matchedFileCount', label: '命中ファイル件数', scope: '案件', type: 'Number', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeCount, description: 'ファイル級条件で命中した件数' },
  ],
  ai_verify: [
    { id: 'case.verifyStatus', label: 'AI検証ステータス', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.nodeStatus, description: '已开启模块的聚合状态；全关→skipped' },
    { id: 'case.isException', label: '異常', scope: '案件', type: 'Boolean', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.boolean, description: '異常処理分岐に使う案件級判定' },
    ...aiVerifyModuleStatusOutputFields(),
    { id: 'case.missingDocuments', label: '不足書類一覧', scope: '案件', type: 'Array', valueSpec: '账票类型名称字符串数组；无不足时为空数组', description: '必要書類モジュールの不足明細' },
    { id: 'case.missingFields', label: '不足項目一覧', scope: '案件', type: 'Array', valueSpec: '标准字段或 OCR 字段名数组；无不足时为空数组', description: '必須フィールドモジュールの不足明細' },
    { id: 'case.aiVerifyResultJson', label: '検証結果JSON', scope: '案件', type: 'Object', valueSpec: '各模块 enabled/status/violations；仅已开启模块写键', description: 'AI検証の詳細結果（模块级明细）' },
    ...workflowNodeFileOutputFields('ai_verify'),
  ],
  hitl_gate: [
    { id: 'case.confirmStatus', label: '確認状態', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.confirmStatus, description: '人工確認タスクの処理状態' },
    { id: 'case.confirmAction', label: '確認アクション', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.confirmAction, description: '審査者が選択した出口（画布三分岐と同一：完成/補件/案件終止）' },
    ...workflowNodeFileOutputFields('hitl_gate'),
  ],
  notify: [
    { id: 'case.notifySendStatus', label: '送信状態', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.notifySendStatus, description: '通知送信の成否' },
    { id: 'case.notifiedAt', label: '送信日時', scope: '案件', type: 'DateTime', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeDateTime, description: '通知送信時刻' },
    { id: 'case.notifyFailureReason', label: '送信失敗理由', scope: '案件', type: 'String', valueSpec: '送信失敗時のみ写入；无固定取值', description: '送信失敗時のエラー詳細' },
  ],
  code: [
    { id: 'case.result', label: 'result', scope: '案件', type: 'Object', optional: true, valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicObjectKeys, description: 'Python 関数の戻り値' },
    { id: 'case.status', label: 'ステータス', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.codeStatus, description: 'スクリプト実行の成否' },
    { id: 'case.errorMessage', label: 'エラーメッセージ', scope: '案件', type: 'String', valueSpec: '失敗時のみ写入；无固定取值', description: '実行失敗時の詳細' },
  ],
};

const WORKFLOW_NODE_OUTPUT_HINT_KEYS = {
  start: 'nodeOutputStart',
  end: 'nodeOutputEnd',
  preprocess: 'nodeOutputPreprocess',
  ocr: 'nodeOutputOcr',
  data_mapping: 'dataMappingOutput',
  ai_verify: 'nodeOutputVerify',
  hitl_gate: 'nodeOutputHitl',
  notify: 'nodeOutputNotify',
  code: 'codeOutput',
};

function getCodeNodeOutputVarDefs(node) {
  const systemDefs = [
    { id: 'case.status', label: 'ステータス', scope: '案件', type: 'Enum', valueSpec: WORKFLOW_OUTPUT_VALUE_SPECS.codeStatus, description: 'スクリプト実行の成否', consumptionPaths: [WORKFLOW_VAR_CONSUMPTION.CONDITION] },
    { id: 'case.errorMessage', label: 'エラーメッセージ', scope: '案件', type: 'String', valueSpec: '失敗時のみ写入；无固定取值', description: '実行失敗時の詳細', consumptionPaths: [WORKFLOW_VAR_CONSUMPTION.NOTIFY] },
  ];
  if (!node?.returnContent) return systemDefs;
  const params = Array.isArray(node.outputParams) && node.outputParams.length
    ? node.outputParams
    : [{ name: 'result', dataType: 'dict' }];
  const userDefs = params.map((row) => {
    const name = (row?.name || 'result').trim() || 'result';
    const typeMap = { string: 'String', int: 'Number', float: 'Number', dict: 'Object', array: 'Array' };
    const mappedType = typeMap[row?.dataType] || 'Object';
    const valueSpecByType = {
      String: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeString,
      Number: WORKFLOW_OUTPUT_VALUE_SPECS.runtimeCount,
      Object: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicObjectKeys,
      Array: WORKFLOW_OUTPUT_VALUE_SPECS.dynamicArrayItems,
    };
    return {
      id: `case.${name}`,
      label: name,
      scope: '案件',
      type: mappedType,
      valueSpec: valueSpecByType[mappedType] || WORKFLOW_OUTPUT_VALUE_SPECS.dynamicObjectKeys,
      description: 'Python 関数の戻り値',
      consumptionPaths: [WORKFLOW_VAR_CONSUMPTION.CONDITION],
    };
  });
  return [...userDefs, ...systemDefs];
}

function formatWorkflowOutputVarToken(node, workflow, varId) {
  return `{${getWorkflowNodeVarName(node, workflow)}.${varId}}`;
}

function getWorkflowNodeOutputVarItems(node, workflow = null) {
  if (!node?.type) return [];
  const defs = node.type === 'code'
    ? getCodeNodeOutputVarDefs(node)
    : WORKFLOW_NODE_OUTPUT_VAR_DEFS[node.type];
  if (!defs?.length) return [];
  const visibleDefs = defs.filter((item) => !item.optional);
  return visibleDefs.map((item) => {
    const consumptionPaths = getWorkflowVarConsumptionPaths(item);
    return {
      ...item,
      localId: item.id,
      path: `${getWorkflowNodeVarName(node, workflow)}.${item.id}`,
      token: formatWorkflowOutputVarToken(node, workflow, item.id),
      consumptionPaths,
      consumptionPathLabel: formatWorkflowVarConsumptionLabels(consumptionPaths),
    };
  });
}

function appendNodeOutputVarCatalog(node, workflow, options, catalogMode = 'condition') {
  if (!node?.type) return;
  const items = getWorkflowNodeOutputVarItems(node, workflow);
  if (!items.length) return;
  const meta = getWorkflowNodeMeta(node.type);
  const title = meta.title;
  items.forEach((item) => {
    if (DECISION_CATALOG_SKIP_IDS.has(item.id)) return;
    if (!isWorkflowVarForCatalog(item, catalogMode)) return;
    if (catalogMode === 'condition' && isDecisionCatalogFileScopeVar(item)) return;
    appendDecisionVarOption(options, {
      value: `${getWorkflowNodeVarName(node, workflow)}.${item.id}`,
      label: item.label,
      displayName: String(item.id || '').split('.').pop() || item.id,
      group: title,
      scope: item.scope || '案件',
      dataType: item.type || '',
      description: item.description || item.label,
      nodeType: node.type,
      nodeId: node.id,
      varName: getWorkflowNodeVarName(node, workflow),
      pickerGroup: 'node',
      localId: item.id,
      consumptionPaths: getWorkflowVarConsumptionPaths(item),
    });
  });
}

function appendDocTypeFieldTemplateCatalog(docTypes, getDocSchemaFn, options) {
  if (!Array.isArray(docTypes) || !docTypes.length) return;
  const schemaFn = typeof getDocSchemaFn === 'function' ? getDocSchemaFn : () => ({ fields: [] });
  docTypes.forEach((docType) => {
    const fields = schemaFn(docType)?.fields || [];
    fields.forEach((field) => {
      appendDecisionVarOption(options, {
        value: `docTypes.${docType}.${field}`,
        label: `${docType} · ${field}`,
        displayName: field,
        group: STEP1_DOCTYPE_FIELD_CASCADER_GROUP,
        scope: '帳票タイプ',
        dataType: 'String',
        description: '条件用字段选择（非节点输出变量）；运行时按 files[].classificationResult + files[].ocrFields 取值',
        nodeType: 'step1_template',
        nodeId: 'step1',
        varName: '',
        pickerGroup: 'step1_doc',
        pickerDocType: docType,
        pickerField: field,
      });
    });
  });
}

function appendDataMappingStandardFieldCatalog(node, workflow, options) {
  if (!node || node.type !== 'data_mapping') return;
  const varName = getWorkflowNodeVarName(node, workflow);
  const meta = getWorkflowNodeMeta(node.type);
  DATA_MAPPING_STANDARD_FIELDS.forEach((field) => {
    appendDecisionVarOption(options, {
      value: `${varName}.case.standardFields.${field.value}`,
      label: field.label,
      displayName: field.label,
      group: meta.title,
      scope: '案件',
      dataType: field.dataType || 'String',
      description: 'データマッピング標準フィールド',
      nodeType: node.type,
      nodeId: node.id,
      varName,
      pickerGroup: 'standard_field',
      pickerStandardFieldId: field.value,
      pickerStandardFieldLabel: field.label,
      consumptionPaths: [WORKFLOW_VAR_CONSUMPTION.CONDITION],
    });
  });
}

function buildDecisionVariableCascaderTree(options) {
  const nodeMap = new Map();
  const step1DocMap = new Map();

  (options || []).forEach((opt) => {
    if (opt.pickerGroup === 'step1_doc') {
      const docType = opt.pickerDocType || '帳票';
      if (!step1DocMap.has(docType)) {
        step1DocMap.set(docType, { id: `step1:${docType}`, text: docType, title: docType, items: [] });
      }
      step1DocMap.get(docType).items.push({
        id: opt.value,
        text: opt.pickerField || opt.displayName,
        title: opt.pickerField || opt.displayName,
        scope: opt.scope,
        dataType: opt.dataType,
      });
      return;
    }

    const nodeKey = opt.nodeId || opt.group || 'unknown';
    if (!nodeMap.has(nodeKey)) {
      nodeMap.set(nodeKey, {
        id: `node:${nodeKey}`,
        text: opt.group || '上流ノード',
        title: opt.group || '上流ノード',
        items: [],
      });
    }
    const nodeEntry = nodeMap.get(nodeKey);

    if (opt.pickerGroup === 'standard_field') {
      const bucketId = `std-fields:${nodeKey}`;
      let bucket = nodeEntry.items.find((item) => item.id === bucketId);
      if (!bucket) {
        bucket = {
          id: bucketId,
          text: '標準フィールド',
          title: '標準フィールド',
          items: [],
        };
        nodeEntry.items.push(bucket);
      }
      bucket.items.push({
        id: opt.value,
        text: opt.pickerStandardFieldLabel || opt.displayName,
        title: opt.pickerStandardFieldLabel || opt.displayName,
        scope: opt.scope,
        dataType: opt.dataType,
      });
      return;
    }

    nodeEntry.items.push({
      id: opt.value,
      text: opt.displayName || opt.label,
      title: opt.displayName || opt.label,
      scope: opt.scope,
      dataType: opt.dataType,
    });
  });

  const tree = [];
  if (step1DocMap.size) {
    tree.push({
      id: 'group:step1',
      text: STEP1_DOCTYPE_FIELD_CASCADER_GROUP,
      title: STEP1_DOCTYPE_FIELD_CASCADER_GROUP,
      items: [...step1DocMap.values()],
    });
  }
  nodeMap.forEach((group) => tree.push(group));
  return tree;
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
  { id: 'k3', topic: 'マスタ照合', question: '低置信度时：自动 HITL 还是条件判断？' },
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

function guessDataMappingSourceForStandard(standardFieldId) {
  const guesses = {
    claimNo: 'case.claimNo',
    policyNo: '保険金請求書.証券番号',
    contractorName: '保険金請求書.ご契約者氏名',
    insuredName: '保険金請求書.被保険者氏名',
    insuredBirthDate: '保険金請求書.被保険者生年月日',
    claimType: '保険金請求書.請求区分',
    admissionDate: '保険金請求書.入院日',
    dischargeDate: '保険金請求書.退院日',
    claimAmount: '保険金請求書.請求金額',
    medicalInstitutionName: '診断書.医療機関名',
    diagnosisName: '診断書.診断名',
  };
  return guesses[standardFieldId] || '';
}

function defaultDataMappingSourcesForStandard(standardFieldId) {
  const sources = {
    claimNo: ['case.claimNo', '保険金請求書.請求番号'],
    policyNo: ['保険金請求書.証券番号', '診断書.証券番号', '領収書・診療明細書.証券番号'],
    contractorName: ['保険金請求書.ご契約者氏名'],
    insuredName: ['保険金請求書.被保険者氏名', '診断書.患者氏名', '領収書・診療明細書.氏名'],
    insuredBirthDate: ['保険金請求書.被保険者生年月日', '診断書.患者生年月日'],
    claimType: ['保険金請求書.請求区分', '保険金請求書.給付金種類'],
    admissionDate: ['診断書.入院日', '入院診断書.入院日'],
    dischargeDate: ['診断書.退院日', '入院証明書.退院日'],
    claimAmount: ['保険金請求書.請求金額', '領収書・診療明細書.金額', '領収書・診療明細書.合計金額'],
    medicalInstitutionName: ['診断書.医療機関名', '領収書・診療明細書.医療機関名'],
    diagnosisName: ['診断書.診断名', '診断書.傷病名'],
  };
  return sources[standardFieldId] || [guessDataMappingSourceForStandard(standardFieldId)].filter(Boolean);
}

function defaultDataMappingRuleText(standardFieldId) {
  const rules = {
    claimNo: '案件番号は {{case.claimNo}} を優先して保持する。{{保険金請求書.請求番号}} がある場合は同一の請求参照番号として扱い、正規表現: /\\s+/g -> "" で空白を除去して比較する。',
    policyNo: '{{保険金請求書.証券番号}}、{{診断書.証券番号}}、{{領収書・診療明細書.証券番号}} を同一の証券番号として扱う。競合検出前に正規表現: /[\\s　-]/g -> "" で空白とハイフンを除去する。',
    contractorName: '{{保険金請求書.ご契約者氏名}} を契約者氏名として保持する。全角・半角を正規化し、正規表現: /[\\s　]+/g -> "" で余分な空白を除去する。欠損時も他帳票の氏名では補完しない。',
    insuredName: '{{保険金請求書.被保険者氏名}}、{{診断書.患者氏名}}、{{領収書・診療明細書.氏名}} を同一の被保険者氏名として扱う。競合検出前に正規表現: /[\\s　]+/g -> "" で空白を除去する。',
    insuredBirthDate: '{{保険金請求書.被保険者生年月日}} と {{診断書.患者生年月日}} を同一の生年月日として扱う。正規表現: /(明治|大正|昭和|平成|令和)?\\s*([0-9０-９]{1,4})[年\\/.-]([0-9０-９]{1,2})[月\\/.-]([0-9０-９]{1,2})日?/ で年月日を抽出し、yyyy-MM-dd に正規化する。',
    claimType: '{{保険金請求書.請求区分}} と {{保険金請求書.給付金種類}} を請求区分候補として扱う。正規表現: /(入院|通院|手術|死亡|診断|給付金)/g で区分を抽出し、複数値はカンマ区切りで保持する。',
    admissionDate: '{{診断書.入院日}} と {{入院診断書.入院日}} を入院日として扱う。正規表現: /(入院日|入院開始日)?[:：]?\\s*(.+)/ でラベル後の日付を抽出し、ファイル別の値は sourceFields に保持する。',
    dischargeDate: '{{診断書.退院日}} と {{入院証明書.退院日}} を退院日として扱う。正規表現: /(退院日|退院予定日)?[:：]?\\s*(.+)/ でラベル後の日付を抽出する。値がない場合は空値のまま保持する。',
    claimAmount: '{{保険金請求書.請求金額}}、{{領収書・診療明細書.金額}}、{{領収書・診療明細書.合計金額}} を請求金額の候補として扱う。正規表現: /[^0-9０-９.-]/g -> "" で通貨表記を除去し、Number に変換して複数の領収書・明細は合計する。',
    medicalInstitutionName: '{{診断書.医療機関名}} と {{領収書・診療明細書.医療機関名}} を医療機関名として扱う。正規表現: /[\\r\\n\\t]+/g -> " " で改行を空白に置換し、正規化後の値をマスタ照合へ渡す。',
    diagnosisName: '{{診断書.診断名}} と {{診断書.傷病名}} を傷病名・診断名として扱う。正規表現: /[\\r\\n]+/g -> "、" で改行を読点に置換し、ファイル別に異なる値は単一値へ強制統合せず sourceFields に保持する。',
  };
  return rules[standardFieldId] || '選択した OCR フィールドを標準変数の入力元として使用する。正規化が必要な場合は、抽出条件または置換ルールを /pattern/flags -> "replacement" の形式で記述する。';
}

function defaultDataMappingRules() {
  return DATA_MAPPING_STANDARD_FIELDS.map((field) => ({
    id: newRuleId('map'),
    sourceFieldIds: defaultDataMappingSourcesForStandard(field.value),
    standardFieldId: field.value,
    standardLabel: field.label,
    dataType: field.dataType,
    valueGenerationRule: defaultDataMappingRuleText(field.value),
    structuredRulePreview: '',
    conflictCheckEnabled: ['policyNo', 'insuredName', 'insuredBirthDate', 'claimAmount'].includes(field.value),
    conflictCompareMode: 'normalized',
  }));
}

function normalizeDataMappingRule(rule) {
  const fallbackStandard = DATA_MAPPING_STANDARD_FIELDS[0];
  const rawStandardFieldId = String(rule?.standardFieldId || '').trim();
  const standard = DATA_MAPPING_STANDARD_FIELDS.find((f) => f.value === rawStandardFieldId);
  const standardFieldId = rawStandardFieldId || fallbackStandard?.value || '';
  const sourceFieldIds = Array.isArray(rule?.sourceFieldIds)
    ? rule.sourceFieldIds
    : [rule?.sourceFieldId].filter(Boolean);
  const dataType = DATA_MAPPING_DATA_TYPES.some((t) => t.value === rule?.dataType)
    ? rule.dataType
    : (standard?.dataType || fallbackStandard?.dataType || 'string');
  const legacyTransform = DATA_MAPPING_TRANSFORM_RULES.find((r) => r.value === rule?.transformRule);
  const rawValueGenerationRule = rule?.valueGenerationRule
    || rule?.normalizationRule
    || (legacyTransform && legacyTransform.value !== 'as_is' ? legacyTransform.label : '');
  const legacyShortRules = new Set([
    'Use {{case.claimNo}} as the case reference. If {{保険金請求書.請求番号}} is present, treat it as the same claim reference after removing spaces with /\\s+/g -> "".',
    'Treat {{保険金請求書.証券番号}}, {{診断書.証券番号}}, and {{領収書・診療明細書.証券番号}} as the same policy number. Remove spaces and hyphens with /[\\s　-]/g -> "" before conflict checking.',
    'Use {{保険金請求書.ご契約者氏名}} as contractorName. Normalize full-width/half-width characters and remove extra spaces with /[\\s　]+/g -> ""; do not fill missing values from other document names.',
    'Treat {{保険金請求書.被保険者氏名}}, {{診断書.患者氏名}}, and {{領収書・診療明細書.氏名}} as the same insured person name. Remove spaces with /[\\s　]+/g -> "" before conflict checking.',
    'Treat {{保険金請求書.被保険者生年月日}} and {{診断書.患者生年月日}} as the same birth date. Extract date parts with /(明治|大正|昭和|平成|令和)?\\s*([0-9０-９]{1,4})[年\\/.-]([0-9０-９]{1,2})[月\\/.-]([0-9０-９]{1,2})日?/ and normalize to yyyy-MM-dd.',
    'Use {{保険金請求書.請求区分}} and {{保険金請求書.給付金種類}} as claim type candidates. Extract categories with /(入院|通院|手術|死亡|診断|給付金)/g and keep multiple values as a comma-separated list.',
    'Use {{診断書.入院日}} and {{入院診断書.入院日}} as admission date values. Extract the date after optional labels using /(入院日|入院開始日)?[:：]?\\s*(.+)/ and keep file-level values in sourceFields.',
    'Use {{診断書.退院日}} and {{入院証明書.退院日}} as discharge date values. Extract the date after optional labels using /(退院日|退院予定日)?[:：]?\\s*(.+)/; keep blank if no value is present.',
    'Use {{保険金請求書.請求金額}}, {{領収書・診療明細書.金額}}, and {{領収書・診療明細書.合計金額}} as claim amount sources. Remove currency text with /[^0-9０-９.-]/g -> "", convert to Number, and sum multiple receipt/detail files.',
    'Use {{診断書.医療機関名}} and {{領収書・診療明細書.医療機関名}} as medical institution name sources. Replace line breaks with spaces using /[\\r\\n\\t]+/g -> " " and pass the normalized value to Master照合.',
    'Use {{診断書.診断名}} and {{診断書.傷病名}} as diagnosis name sources. Replace line breaks with "、" using /[\\r\\n]+/g -> "、"; keep different file-level diagnoses as sourceFields rather than forcing one value.',
    'Use the selected OCR fields as the source for this standard variable. Add extraction or replacement rules in the form /pattern/flags -> "replacement" when normalization is required.',
    '空白除去',
    '日付正規化',
    '金額正規化',
    'カナ正規化',
    'コード変換',
    '前後の空白を除去する。',
    '西暦 yyyy-MM-dd 形式に正規化する。',
    '通貨記号・カンマを除去し、数値に変換する。',
    '案件番号または請求書の請求番号を標準変数 claimNo として保持する。複数値がある場合は同一番号か確認し、不一致は競合として出力する。',
    '証券番号はハイフン・空白・全半角の差を除去して同一形式に正規化する。複数帳票で値が異なる場合は自動補正せず、競合として出力する。',
    '契約者氏名は前後の空白、姓名間の余分なスペース、全半角差を除去して保持する。欠損していても他帳票の氏名では補完しない。',
    '保険金請求書の被保険者氏名、診断書の患者氏名、領収書の氏名を同一人物の氏名候補として扱う。空白・全半角を正規化した上で比較し、不一致は競合として出力する。',
    '生年月日は和暦・西暦・年月日表記を yyyy-MM-dd に統一する。請求書と診断書で日付が異なる場合は競合として出力する。',
    '請求区分または給付金種類の表記を標準変数 claimType に保持する。複数区分が記載される場合はカンマ区切りのリストとして保持し、Master照合によるコード化は行わない。',
    '入院日は和暦・西暦・年月日表記を yyyy-MM-dd に統一する。同一帳票種別が複数ファイルある場合は各ファイルの入院日を sourceFields に保持する。',
    '退院日は和暦・西暦・年月日表記を yyyy-MM-dd に統一する。退院日が未記載の場合は空値のまま保持し、他帳票から自動補完しない。',
    '複数の領収書・診療明細書の金額は「円」「税込」「,」などを除去して数値化する。明細金額が複数ある場合は合計値を claimAmount とし、各ファイル別の金額は sourceFields に保持する。',
    '医療機関名は前後空白、改行、全半角差を除去して保持する。略称・別名の近似照合や正式名称への変換はここでは行わず、Master照合に渡す。',
    '傷病名・診断名は複数行の場合、改行を「、」に置換して保持する。複数ファイルで異なる傷病名がある場合はリストとして保持し、競合ではなく確認対象として sourceFields に残す。',
    '案件番号または請求書の請求番号を claimNo として保持する。\n正規表現: /^[A-Z]{2,5}-?\\d{4}-?\\d{4,8}$/ で番号形式を確認し、空白は /\\s+/g -> "" で除去する。複数値がある場合は同一番号か確認し、不一致は競合として出力する。',
    '証券番号はハイフン・空白・全半角差を除去して同一形式に正規化する。\n正規表現: /[\\s　-]/g -> "" を適用し、複数帳票で値が異なる場合は自動補正せず競合として出力する。',
    '契約者氏名は前後の空白、姓名間の余分なスペース、全半角差を除去して保持する。\n正規表現: /^[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー\\s　]+$/u で氏名候補を確認し、/[\\s　]+/g -> "" で比較用値を作成する。欠損していても他帳票の氏名では補完しない。',
    '保険金請求書の被保険者氏名、診断書の患者氏名、領収書の氏名を同一人物の氏名候補として扱う。\n正規表現: /[\\s　]+/g -> "" で空白を除去し、全半角正規化後に比較する。不一致は競合として出力する。',
    '生年月日は和暦・西暦・年月日表記を yyyy-MM-dd に統一する。\n正規表現: /(明治|大正|昭和|平成|令和)?\\s*([0-9０-９]{1,4})[年\\/.-]([0-9０-９]{1,2})[月\\/.-]([0-9０-９]{1,2})日?/ で年月日を抽出する。請求書と診断書で日付が異なる場合は競合として出力する。',
    '請求区分または給付金種類の表記を claimType に保持する。\n正規表現: /(入院|通院|手術|死亡|診断|給付金)/g で区分候補を抽出し、複数区分はカンマ区切りリストとして保持する。Master照合によるコード化は行わない。',
    '入院日は和暦・西暦・年月日表記を yyyy-MM-dd に統一する。\n正規表現: /(入院日|入院開始日)?[:：]?\\s*(.+)/ で日付候補を抽出し、同一帳票種別が複数ファイルある場合は各ファイルの入院日を sourceFields に保持する。',
    '退院日は和暦・西暦・年月日表記を yyyy-MM-dd に統一する。\n正規表現: /(退院日|退院予定日)?[:：]?\\s*(.+)/ で日付候補を抽出する。退院日が未記載の場合は空値のまま保持し、他帳票から自動補完しない。',
    '複数の領収書・診療明細書の金額は数値化して合計する。\n正規表現: /[^0-9０-９.-]/g -> "" で「円」「税込」「,」などを除去し、全角数字を半角化して Number に変換する。明細金額が複数ある場合は合計値を claimAmount とし、各ファイル別の金額は sourceFields に保持する。',
    '医療機関名は前後空白、改行、全半角差を除去して保持する。\n正規表現: /[\\r\\n\\t]+/g -> " "、/^\\s+|\\s+$/g -> "" を適用する。略称・別名の近似照合や正式名称への変換はここでは行わず、Master照合に渡す。',
    '傷病名・診断名は複数行の場合、改行を「、」に置換して保持する。\n正規表現: /[\\r\\n]+/g -> "、"、/\\s{2,}/g -> " " を適用する。複数ファイルで異なる傷病名がある場合はリストとして保持し、競合ではなく確認対象として sourceFields に残す。',
  ]);
  const valueGenerationRule = legacyShortRules.has(rawValueGenerationRule)
    ? defaultDataMappingRuleText(standard?.value)
    : rawValueGenerationRule;
  return {
    id: rule?.id || newRuleId('map'),
    sourceFieldIds: sourceFieldIds.length ? sourceFieldIds : defaultDataMappingSourcesForStandard(standardFieldId),
    standardFieldId,
    standardLabel: rule?.standardLabel || standard?.label || standardFieldId,
    dataType,
    valueGenerationRule,
    structuredRulePreview: rule?.structuredRulePreview || '',
    conflictCheckEnabled: rule?.conflictCheckEnabled === true,
    conflictCompareMode: DATA_MAPPING_CONFLICT_COMPARE_MODES.some((m) => m.value === rule?.conflictCompareMode)
      ? rule.conflictCompareMode
      : 'normalized',
  };
}

function normalizeDataMappingNode(node, workflow = null) {
  const base = ensureWorkflowNodeVarName({
    ...node,
    type: 'data_mapping',
    label: node?.label && node.label !== 'MCP' ? node.label : 'データマッピング',
  }, workflow);
  const rules = Array.isArray(base.mappingRules) && base.mappingRules.length
    ? base.mappingRules
    : defaultDataMappingRules();
  return {
    ...base,
    configRef: base.configRef || 'current_scene',
    targetDocTypes: Array.isArray(base.targetDocTypes) ? base.targetDocTypes.filter(Boolean) : [],
    executionScope: DATA_MAPPING_EXECUTION_SCOPES.some((opt) => opt.value === base.executionScope)
      ? base.executionScope
      : 'case',
    outputMode: DATA_MAPPING_OUTPUT_MODES.some((opt) => opt.value === base.outputMode)
      ? base.outputMode
      : 'unified',
    mappingMode: base.mappingMode || 'field_to_standard',
    mappingRules: rules.map(normalizeDataMappingRule),
  };
}

function normalizeHitlWaitConfig(node) {
  if (!node || !isHitlGateNode(node)) return node;
  return {
    ...node,
    hitlWaitEnabled: node.hitlWaitEnabled === true,
    hitlWaitMinutes: HITL_WAIT_MINUTES,
  };
}

function isHitlVerificationContext(node) {
  return isHitlGateNode(node) && inferHitlContext(node) === 'verification';
}

function normalizeAiVerifyNode(node, workflow = null) {
  const base = ensureWorkflowNodeVarName({
    ...node,
    type: 'ai_verify',
    label: node?.label || 'AI検証',
  }, workflow);
  const moduleEnabled = {};
  const legacyModuleEnabled = base.moduleEnabled || {};
  AI_VERIFY_MODULE_OPTIONS.forEach((opt) => {
    let enabled = legacyModuleEnabled[opt.key];
    if (enabled == null && (opt.key === 'required_fields' || opt.key === 'required_documents')) {
      enabled = legacyModuleEnabled.completeness;
    }
    if (enabled == null && opt.key === 'signature_seal') {
      enabled = legacyModuleEnabled.seal;
    }
    moduleEnabled[opt.key] = enabled !== false;
  });
  return {
    ...base,
    configRef: base.configRef || 'current_scene',
    targetDocTypes: Array.isArray(base.targetDocTypes) ? base.targetDocTypes.filter(Boolean) : [],
    moduleEnabled,
  };
}

function countNotifyTemplateVarRefs(subject = '', body = '') {
  const matches = String(`${subject}\n${body}`).match(/\{\{[^}]+\}\}/g);
  return matches ? new Set(matches).size : 0;
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
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const curve = Math.max(28, Math.min(120, dx * 0.45, dx * 0.35 + dy * 0.08));
  return {
    c1x: x1 + curve,
    c1y: y1,
    c2x: x2 - curve,
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
  data_mapping: 'dataMapping',
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
    label: '画像分割',
    switchKey: 'split',
    detailType: 'split',
    docTypesKey: 'splitDocTypes',
  },
  {
    key: 'sort',
    label: '画像並び替え',
    switchKey: 'sort',
    detailType: 'sort',
    docTypesKey: 'sortDocTypes',
  },
];

/** 画布节点摘要：统一分隔符与未配置占位 */
const WORKFLOW_CANVAS_SUMMARY_SEP = ' · ';
const WORKFLOW_CANVAS_SUMMARY_EMPTY = '未設定';
const WORKFLOW_CANVAS_SUMMARY_LINE_H = 22;

const PREPROCESS_CANVAS_SHORT_LABELS = {
  rotate: '回転',
  perspective: '補正',
  split: '分割',
  sort: '並替',
};

const AI_VERIFY_CANVAS_SHORT_LABELS = {
  required_fields: '必須項目',
  required_documents: '必要書類',
  text: 'テキスト',
  data: 'データ',
  mapping_conflict: '競合',
  signature_seal: '署名',
};

function joinWorkflowCanvasSummary(...parts) {
  return parts
    .filter((part) => part != null && String(part).trim())
    .join(WORKFLOW_CANVAS_SUMMARY_SEP);
}

function buildPreprocessCanvasSummaryChips(imageConfig = {}) {
  return PREPROCESS_SETTING_ITEMS
    .filter((item) => imageConfig[item.switchKey])
    .map((item) => {
      const types = imageConfig[item.docTypesKey];
      const count = Array.isArray(types) && types.length ? types.length : 0;
      const short = PREPROCESS_CANVAS_SHORT_LABELS[item.key] || item.label;
      return count > 0 ? `${short} ${count}件` : item.label;
    });
}

function buildAiVerifyCanvasSummaryChips(node, getModuleRuleCount) {
  const countFn = typeof getModuleRuleCount === 'function' ? getModuleRuleCount : () => 0;
  return AI_VERIFY_MODULE_OPTIONS
    .filter((opt) => node?.moduleEnabled?.[opt.key] !== false)
    .map((opt) => {
      const count = countFn(opt.key) || 0;
      const short = AI_VERIFY_CANVAS_SHORT_LABELS[opt.key] || opt.label;
      return count > 0 ? `${short} ${count}件` : short;
    });
}

function splitWorkflowCanvasSummaryParts(summary) {
  if (!summary) return [];
  return String(summary)
    .split(WORKFLOW_CANVAS_SUMMARY_SEP)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getWorkflowNodeReuseSummaryPrefix(node) {
  if (!node?.reuseReview) return '';
  const statusLabel = node.reuseStatus === 'ready' ? 'コピー済' : '要確認';
  const sourceName = node.reuseSourceSceneName || node.reuseReview?.sourceSceneName || '';
  const clipped = truncateWorkflowPreview(sourceName, 10);
  return clipped ? `${statusLabel}: ${clipped}` : statusLabel;
}

const HITL_GATE_CANVAS_ROLE_FALLBACK = '案件担当者';

function formatHitlGateCanvasRoleLabel(role) {
  const raw = String(role || '').trim();
  if (!raw) return HITL_GATE_CANVAS_ROLE_FALLBACK;
  const options = typeof HITL_ROLE_OPTIONS !== 'undefined' ? HITL_ROLE_OPTIONS : [];
  const match = options.find((item) => item.value === raw);
  return match?.label || raw;
}

function buildHitlGateCanvasSummary(node, workflow = null) {
  const targetLabel = getHitlGatePreset(node, workflow)?.label || '人工確認';
  const roleLabel = formatHitlGateCanvasRoleLabel(node?.role);
  return joinWorkflowCanvasSummary(targetLabel, roleLabel);
}

/** 画布节点单行摘要（统一 ` · ` 分隔；未配置 `未設定`） */
function buildWorkflowNodeCanvasSummary(node, ctx = {}) {
  if (!node || isWorkflowTerminalNode(node)) return '';
  const reusePrefix = getWorkflowNodeReuseSummaryPrefix(node);
  const workflow = typeof ctx.getWf === 'function' ? ctx.getWf() : null;
  const verifyConfig = ctx.verify || null;
  const sceneContext = ctx.sceneContext || null;

  switch (node.type) {
    case 'preprocess': {
      const chips = buildPreprocessCanvasSummaryChips(ctx.image || {});
      if (!chips.length) {
        return reusePrefix
          ? joinWorkflowCanvasSummary(reusePrefix, WORKFLOW_CANVAS_SUMMARY_EMPTY)
          : WORKFLOW_CANVAS_SUMMARY_EMPTY;
      }
      return joinWorkflowCanvasSummary(reusePrefix, `${chips.length}件有効`, ...chips.slice(0, 2));
    }
    case 'ocr': {
      const stats = ctx.ocrStats || { total: 0, enabled: 0 };
      if (!stats.total) {
        return reusePrefix
          ? joinWorkflowCanvasSummary(reusePrefix, WORKFLOW_CANVAS_SUMMARY_EMPTY)
          : WORKFLOW_CANVAS_SUMMARY_EMPTY;
      }
      return joinWorkflowCanvasSummary(
        reusePrefix,
        `関連帳票 ${stats.total} 件`,
        `有効 ${stats.enabled} 件`,
      );
    }
    case 'data_mapping': {
      const ruleCount = Number(ctx.dataMappingRuleCount) || 0;
      return joinWorkflowCanvasSummary(reusePrefix, ruleCount ? `ルール ${ruleCount}件` : '設定参照');
    }
    case 'ai_verify': {
      const chips = buildAiVerifyCanvasSummaryChips(node, ctx.getAiVerifyModuleRuleCount);
      if (!chips.length) {
        return reusePrefix
          ? joinWorkflowCanvasSummary(reusePrefix, WORKFLOW_CANVAS_SUMMARY_EMPTY)
          : WORKFLOW_CANVAS_SUMMARY_EMPTY;
      }
      return joinWorkflowCanvasSummary(reusePrefix, `${chips.length}件有効`, ...chips.slice(0, 2));
    }
    case 'decision': {
      const opts = workflow && node?.id
        ? getDecisionVariableOptions(workflow, node.id, verifyConfig, sceneContext)
        : [];
      const preview = getDecisionNodeCanvasSummary(node, opts);
      return joinWorkflowCanvasSummary(reusePrefix, preview || WORKFLOW_CANVAS_SUMMARY_EMPTY);
    }
    case 'hitl_gate':
    case 'confirm':
    case 'ocr_confirm':
    case 'verify_confirm':
      return joinWorkflowCanvasSummary(reusePrefix, buildHitlGateCanvasSummary(node, workflow));
    case 'notify': {
      const normalized = normalizeNotifyNode(node, workflow);
      const ch = NOTIFY_CHANNELS.find((c) => c.value === normalized.channel);
      const channelLabel = ch?.label || WORKFLOW_CANVAS_SUMMARY_EMPTY;
      const varCount = countNotifyTemplateVarRefs(normalized.subject, normalized.body);
      const parts = [channelLabel];
      if (varCount > 0) parts.push(`${varCount}項目`);
      return joinWorkflowCanvasSummary(reusePrefix, ...parts);
    }
    case 'code': {
      const normalized = normalizeCodeNode(node, workflow);
      const inCount = normalized.inputs?.length || 0;
      const outCount = normalized.returnContent ? (normalized.outputParams?.length || 0) : 0;
      const parts = [];
      if (inCount) parts.push(`入力 ${inCount}件`);
      if (outCount) parts.push(`出力 ${outCount}件`);
      const summary = joinWorkflowCanvasSummary(reusePrefix, ...parts);
      return summary || (reusePrefix
        ? joinWorkflowCanvasSummary(reusePrefix, WORKFLOW_CANVAS_SUMMARY_EMPTY)
        : WORKFLOW_CANVAS_SUMMARY_EMPTY);
    }
    default:
      return reusePrefix || '';
  }
}

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

function getWorkflowNodePickerSummary(type) {
  return getWorkflowNodeMeta(type).desc || '';
}

const WORKFLOW_NODE_ICON_SVG = {
  start: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5 14 10l-7 4.5v-9Z" fill="currentColor"/></svg>',
  end: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="6" width="8" height="8" rx="1.8" fill="currentColor"/></svg>',
  preprocess: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h7M14 6h2M4 14h2M9 14h7M11 4v4M7 12v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  ocr: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 8h6M7 11h4M4 2.8V6M16 2.8V6M4 14v3.2M16 14v3.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  data_mapping: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h4M12 5h4M4 15h4M12 15h4M8 5c2.2 0 2.8 2 4 5 1.2 3 1.8 5 4 5M8 15c2.2 0 2.8-2 4-5 1.2-3 1.8-5 4-5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>',
  ai_verify: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5 15.5 6v4.2c0 3.2-2.1 5.3-5.5 6.3-3.4-1-5.5-3.1-5.5-6.3V6L10 3.5Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><path d="m7.5 10.2 1.7 1.7 3.5-3.8" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  decision: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4v4.2a3 3 0 0 0 3 3h1M5 8.2a3 3 0 0 1 3-3h1M12 5h4M12 11.2h4M12 16h4M9 11.2a3 3 0 0 1-3 3H5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>',
  hitl_gate: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.8 16c.7-2.4 2.5-3.7 5.2-3.7 1 0 1.8.2 2.5.5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/><path d="m13 15 1.5 1.5 3-3.4" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  notify: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 8.5a4 4 0 1 1 8 0c0 4 1.6 4.4 1.6 5.6H4.4C4.4 12.9 6 12.5 6 8.5Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><path d="M8.4 16a1.8 1.8 0 0 0 3.2 0" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>',
  code: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.2 6-3.5 4 3.5 4M12.8 6l3.5 4-3.5 4M11 4.8 9 15.2" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function getWorkflowNodeIconSvg(type) {
  return WORKFLOW_NODE_ICON_SVG[type] || WORKFLOW_NODE_ICON_SVG.preprocess;
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
    yesRule: '分類/補正の要確認',
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
    yesRule: '検証ルール違反・Master未一致',
    noRule: '検証 PASS（自動確定）',
  },
  {
    value: 'verify_pass',
    label: 'AI検証通過判断',
    defaultLabel: 'AI検証通過？',
    yesRule: '検証ルール ALL PASS',
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
  { value: 'preprocess', label: '前処理確認' },
  { value: 'ocr', label: 'OCR結果確認' },
  { value: 'verification', label: 'AI検証確認' },
];

const HITL_PRESET_OPTIONS = HITL_CONTEXT_OPTIONS;

const HITL_ACTION_OPTIONS = [
  { value: 'approve', label: '完成' },
  { value: 'request_supplement', label: '補件' },
  { value: 'reject', label: '案件終止' },
];

const HITL_DEFAULT_ACTIONS = HITL_ACTION_OPTIONS.map((o) => o.value);

const HITL_LEGACY_ACTION_MAP = {
  request_fix: 'approve',
  pass: 'approve',
  supplement: 'request_supplement',
  exception: 'reject',
};

const HITL_CONTEXT_DEFAULT_ROLE = {
  preprocess: '案件担当者',
  ocr: '案件担当者',
  verification: '給付審査',
};

const HITL_LEGACY_CONTEXT_MAP = {
  preprocess_hitl: 'preprocess',
  ocr_hitl: 'ocr',
  verify_hitl: 'verification',
  deficiency_hitl: 'deficiency',
  custom: 'custom',
};

const NOTIFY_CHANNELS = [
  { value: 'system', label: 'システム通知' },
  { value: 'email', label: 'メール' },
];

const NOTIFY_RECIPIENT_OPTIONS = [
  { value: 'case_owner', label: '案件担当者' },
  { value: 'other_role', label: 'その他ロール' },
];

const NOTIFY_TEMPLATE_VAR_REFS = {
  caseNo: { nodeType: 'start', varId: 'case.caseNo', legacyLabel: '案件番号' },
  missingDocuments: { nodeType: 'ai_verify', varId: 'case.missingDocuments', legacyLabel: '不足書類一覧' },
  missingFields: { nodeType: 'ai_verify', varId: 'case.missingFields', legacyLabel: '不足項目一覧' },
  endedAt: { nodeType: 'end', varId: 'case.endedAt', legacyLabel: '処理完了日時', workflowScope: true },
  lastFailureReason: {
    nodeType: 'preprocess',
    varId: 'case.lastFailureReason',
    legacyLabel: '最終失敗原因',
    fallbackNodeTypes: ['code'],
    fallbackVarId: 'case.errorMessage',
  },
  errorMessage: {
    nodeType: 'code',
    varId: 'case.errorMessage',
    legacyLabel: '異常内容',
    fallbackNodeTypes: ['preprocess'],
    fallbackVarId: 'case.lastFailureReason',
  },
  notifiedAt: { nodeType: 'notify', varId: 'case.notifiedAt', legacyLabel: '送信日時' },
  notifyFailureReason: { nodeType: 'notify', varId: 'case.notifyFailureReason', legacyLabel: '送信失敗理由' },
};

const NOTIFY_TEMPLATES = [
  {
    value: 'deficiency',
    label: '不備通知',
    defaultSubject: '【不備通知】案件番号：{{caseNo}}',
    defaultBody: '案件番号：{{caseNo}}\n不足書類または不足項目があります。追加資料をアップロードしてください。\n不足書類：{{missingDocuments}}\n不足項目：{{missingFields}}',
    varRefs: ['caseNo', 'missingDocuments', 'missingFields'],
  },
  {
    value: 'completed',
    label: '処理完了通知',
    defaultSubject: '【処理完了】案件番号：{{caseNo}}',
    defaultBody: '案件番号：{{caseNo}}\n処理が完了しました。\n完了日時：{{endedAt}}',
    varRefs: ['caseNo', 'endedAt'],
  },
  {
    value: 'exception',
    label: '異常通知',
    defaultSubject: '【異常通知】案件番号：{{caseNo}}',
    defaultBody: '案件番号：{{caseNo}}\n処理中に異常が発生しました。確認してください。\n異常内容：{{errorMessage}}',
    varRefs: ['caseNo', 'errorMessage'],
  },
];

const NOTIFY_TEMPLATE_LEGACY_MAP = {
  supplement: 'deficiency',
  deficiency: 'deficiency',
  custom: 'completed',
  approval: 'completed',
  completed: 'completed',
  exception: 'exception',
};

function migrateNotifyTemplate(value) {
  const raw = String(value || '').trim();
  if (NOTIFY_TEMPLATES.some((t) => t.value === raw)) return raw;
  return NOTIFY_TEMPLATE_LEGACY_MAP[raw] || 'deficiency';
}

function getNotifyTemplateVarRefKeys(templateValue) {
  const tpl = NOTIFY_TEMPLATES.find((t) => t.value === migrateNotifyTemplate(templateValue));
  return tpl?.varRefs ? [...tpl.varRefs] : [];
}

function getNotifyVarFallbackPath(ref) {
  if (!ref) return '';
  const typeName = ref.nodeType === 'ai_verify' ? 'verify' : ref.nodeType;
  return `${typeName}.${ref.varId}`;
}

function resolveNotifyTemplateNode(workflow, notifyNodeId, ref) {
  if (!ref || !workflow?.nodes?.length) return null;
  if (ref.workflowScope) {
    const scoped = workflow.nodes.filter((n) => n.type === ref.nodeType);
    return scoped.length ? scoped[scoped.length - 1] : null;
  }
  const upstream = resolveUpstreamNodesByType(workflow, notifyNodeId, ref.nodeType);
  if (upstream.length) return upstream[0];
  if (ref.nodeType === 'start') return workflow.nodes.find((n) => n.type === 'start') || null;
  if (Array.isArray(ref.fallbackNodeTypes)) {
    for (const nodeType of ref.fallbackNodeTypes) {
      const fallbackUpstream = resolveUpstreamNodesByType(workflow, notifyNodeId, nodeType);
      if (fallbackUpstream.length) return fallbackUpstream[0];
    }
  }
  return null;
}

function resolveNotifyTemplateVarToken(workflow, notifyNodeId, refKey) {
  const ref = NOTIFY_TEMPLATE_VAR_REFS[refKey];
  if (!ref) return '';
  const node = resolveNotifyTemplateNode(workflow, notifyNodeId, ref);
  if (node) return formatWorkflowOutputVarToken(node, workflow, ref.varId);
  if (ref.fallbackNodeTypes?.length && ref.fallbackVarId) {
    for (const nodeType of ref.fallbackNodeTypes) {
      const fallbackNode = resolveNotifyTemplateNode(workflow, notifyNodeId, { ...ref, nodeType, fallbackNodeTypes: [] });
      if (fallbackNode) return formatWorkflowOutputVarToken(fallbackNode, workflow, ref.fallbackVarId);
    }
  }
  const fallbackPath = getNotifyVarFallbackPath(ref);
  return fallbackPath ? `{${fallbackPath}}` : '';
}

function buildNotifyTemplateFieldText(templateValue, field, workflow = null, notifyNodeId = '') {
  const tpl = NOTIFY_TEMPLATES.find((t) => t.value === migrateNotifyTemplate(templateValue));
  if (!tpl) return '';
  const raw = field === 'subject' ? tpl.defaultSubject : tpl.defaultBody;
  return String(raw || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (
    resolveNotifyTemplateVarToken(workflow, notifyNodeId, key) || `{{${key}}}`
  ));
}

function getNotifyTemplateDefaults(templateValue, workflow = null, notifyNodeId = '') {
  return {
    subject: buildNotifyTemplateFieldText(templateValue, 'subject', workflow, notifyNodeId),
    body: buildNotifyTemplateFieldText(templateValue, 'body', workflow, notifyNodeId),
  };
}

function migrateNotifyLegacyTokens(text, templateValue, workflow = null, notifyNodeId = '') {
  let result = String(text || '');
  getNotifyTemplateVarRefKeys(templateValue).forEach((key) => {
    const ref = NOTIFY_TEMPLATE_VAR_REFS[key];
    if (!ref?.legacyLabel) return;
    const token = resolveNotifyTemplateVarToken(workflow, notifyNodeId, key);
    if (!token) return;
    result = result.split(`[${ref.legacyLabel}]`).join(token);
  });
  return result;
}

function getNotifyTemplateRecommendedVars(templateValue, workflow = null, notifyNodeId = '') {
  const options = workflow && notifyNodeId
    ? getNotifyVariableOptions(workflow, notifyNodeId)
    : [];
  return getNotifyTemplateVarRefKeys(templateValue).map((key) => {
    const ref = NOTIFY_TEMPLATE_VAR_REFS[key];
    const token = resolveNotifyTemplateVarToken(workflow, notifyNodeId, key);
    const value = token.replace(/^\{|\}$/g, '');
    const opt = options.find((item) => item.value === value);
    return {
      key,
      value,
      label: opt?.label || ref?.legacyLabel || key,
      token,
      group: opt?.group || '',
    };
  }).filter((item) => item.token);
}

/** @deprecated use getNotifyTemplateRecommendedVars */
function getNotifyTemplateAllowedVars(templateValue, workflow = null, notifyNodeId = '') {
  return getNotifyTemplateRecommendedVars(templateValue, workflow, notifyNodeId)
    .map((item) => item.label);
}

function formatNotifyVariableToken(varPath) {
  const path = String(varPath || '').trim();
  if (!path) return '';
  return path.startsWith('{') ? path : `{${path}}`;
}

function insertNotifyVariableText(text, varPath) {
  const token = formatNotifyVariableToken(varPath);
  if (!token) return String(text || '');
  const current = String(text || '');
  if (!current) return token;
  const needsSpace = !current.endsWith('\n') && !current.endsWith(' ') && !current.endsWith('{');
  return needsSpace ? `${current} ${token}` : `${current}${token}`;
}

function getNotifyVariableOptions(workflow, nodeId, verifyConfig = null, sceneContext = null) {
  return buildNotifyVariableCatalog(workflow, nodeId, verifyConfig, sceneContext);
}

function getNotifyRecipientsLabel(channel) {
  if (channel === 'system') return '通知先';
  return 'メールアドレス';
}

function getNotifyRecipientsPlaceholder(channel) {
  if (channel === 'system') return '通知先を選択';
  return 'example@company.co.jp;team@example.co.jp';
}

function parseNotifySystemRecipients(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(/[;,;、/／|]/).map((part) => part.trim()).filter(Boolean).map((part) => {
    if (NOTIFY_RECIPIENT_OPTIONS.some((opt) => opt.value === part)) return part;
    const byLabel = NOTIFY_RECIPIENT_OPTIONS.find((opt) => opt.label === part);
    if (byLabel) return byLabel.value;
    if (part.includes('案件担当')) return 'case_owner';
    if (part.includes('その他')) return 'other_role';
    return null;
  }).filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
}

function serializeNotifySystemRecipients(values) {
  const list = Array.isArray(values) ? values : [];
  return list
    .map((v) => String(v || '').trim())
    .filter((v) => NOTIFY_RECIPIENT_OPTIONS.some((opt) => opt.value === v))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(',');
}

function normalizeNotifyRecipients(recipients, channel) {
  if (channel !== 'system') return String(recipients || '').trim();
  return serializeNotifySystemRecipients(parseNotifySystemRecipients(recipients));
}

function formatNotifyRecipientsDisplay(recipients, channel) {
  const raw = String(recipients || '').trim();
  if (!raw) return '';
  if (channel !== 'system') return raw;
  const labels = parseNotifySystemRecipients(raw)
    .map((value) => NOTIFY_RECIPIENT_OPTIONS.find((opt) => opt.value === value)?.label)
    .filter(Boolean);
  return labels.length ? labels.join(' / ') : raw;
}

function validateNotifyRecipients(channel, value) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, message: '' };
  if (channel === 'system') {
    const parsed = parseNotifySystemRecipients(v);
    if (!parsed.length) {
      return { ok: false, message: '通知先を選択してください' };
    }
    return { ok: true, message: '' };
  }
  if (channel === 'email') {
    const emails = v.split(/[;；]/).map((part) => part.trim()).filter(Boolean);
    const emailPattern = /^[^\s@;；]+@[^\s@;；]+\.[^\s@;；]+$/;
    if (!emails.length || emails.some((email) => !emailPattern.test(email))) {
      return { ok: false, message: 'メールアドレスの形式を確認してください' };
    }
  }
  return { ok: true, message: '' };
}

function inferJudgmentContext(node) {
  return 'custom';
}

const HITL_UPSTREAM_TYPE_TO_CONTEXT = {
  preprocess: 'preprocess',
  ocr: 'ocr',
  ai_verify: 'verification',
};

function collectHitlUpstreamSources(workflow, hitlNodeId) {
  const wf = workflow || { nodes: [], edges: [] };
  const nodeMap = Object.fromEntries((wf.nodes || []).map((node) => [node.id, node]));
  const visited = new Set();
  const sources = [];
  const queue = (wf.edges || []).filter((edge) => edge.to === hitlNodeId).map((edge) => edge.from);
  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const node = nodeMap[id];
    if (!node) continue;
    if (node.type === 'decision') {
      (wf.edges || []).filter((edge) => edge.to === id).forEach((edge) => queue.push(edge.from));
      continue;
    }
    if (node.type === 'hitl_gate') {
      (wf.edges || []).filter((edge) => edge.to === id).forEach((edge) => queue.push(edge.from));
      continue;
    }
    sources.push(node);
  }
  return sources;
}

function inferHitlContextFromDecision(decisionNode) {
  const raw = decisionNode?.judgmentContext || decisionNode?.conditionType;
  const map = {
    preprocess_hitl: 'preprocess',
    ocr_hitl: 'ocr',
    verify_hitl: 'verification',
    ocr_low_confidence: 'ocr',
    deficiency_hitl: 'verification',
  };
  return map[raw] || '';
}

function inferHitlContext(node, workflow = null) {
  if (workflow && node?.id) {
    const nodeMap = Object.fromEntries((workflow.nodes || []).map((n) => [n.id, n]));
    const directFromIds = (workflow.edges || [])
      .filter((edge) => edge.to === node.id)
      .map((edge) => edge.from);
    const sources = collectHitlUpstreamSources(workflow, node.id);
    const priority = ['preprocess', 'ocr', 'ai_verify'];
    for (let i = 0; i < priority.length; i += 1) {
      const type = priority[i];
      if (sources.some((source) => source.type === type)) {
        return HITL_UPSTREAM_TYPE_TO_CONTEXT[type];
      }
    }
    for (let i = 0; i < directFromIds.length; i += 1) {
      const direct = nodeMap[directFromIds[i]];
      if (direct?.type === 'decision') {
        const hinted = inferHitlContextFromDecision(direct);
        if (hinted) return hinted;
      }
    }
  }
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
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.case.preprocessStatus`, 'success'));
    });
    if (!ifConditions.length) ifConditions.push(judgmentCond('preprocess.case.preprocessStatus', 'success'));
    resolveUpstreamNodesByType(workflow, nodeId, 'ocr').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.case.ocrStatus`, 'success'));
    });
    if (!resolveUpstreamNodesByType(workflow, nodeId, 'ocr').length) ifConditions.push(judgmentCond('ocr.case.ocrStatus', 'success'));
    resolveUpstreamNodesByType(workflow, nodeId, 'hitl_gate').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.case.confirmStatus`, 'completed'));
    });
    return [
      createDecisionCase('if', { id: 'if', label: '就緒完了', conditions: ifConditions }),
      createDecisionCase('elif', {
        id: 'elif-reupload',
        label: '再アップロード待ち',
        conditions: [judgmentCond('ocr.case.ocrStatus', 'failed')],
      }),
    ];
  }
  if (judgmentContext === 'verification_result') {
    const verifyNodes = resolveUpstreamNodesByType(workflow, nodeId, 'ai_verify');
    const vn = verifyNodes.length
      ? getWorkflowNodeVarName(verifyNodes[verifyNodes.length - 1], workflow)
      : 'verify';
    const ifConditions = [];
    ifConditions.push(judgmentCond(`${vn}.case.verifyStatus`, 'success'));
    if (vCfg.textEnabled !== false) {
      ifConditions.push(judgmentCond(`${vn}.case.textValidationStatus`, 'success'));
    }
    if (vCfg.dataEnabled !== false) {
      ifConditions.push(judgmentCond(`${vn}.case.dataValidationStatus`, 'success'));
    }
    if (vCfg.sealEnabled !== false) {
      ifConditions.push(judgmentCond(`${vn}.case.signatureSealStatus`, 'success'));
    }
    return [createDecisionCase('if', { id: 'if', label: '自動パス', conditions: ifConditions })];
  }
  if (judgmentContext === 'processing_completion') {
    const ifConditions = [];
    resolveUpstreamNodesByType(workflow, nodeId, 'ai_verify').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.case.verifyStatus`, 'success'));
    });
    if (!resolveUpstreamNodesByType(workflow, nodeId, 'ai_verify').length) {
      ifConditions.push(judgmentCond('verify.case.verifyStatus', 'success'));
    }
    resolveUpstreamNodesByType(workflow, nodeId, 'hitl_gate').forEach((n) => {
      ifConditions.push(judgmentCond(`${getWorkflowNodeVarName(n, workflow)}.case.confirmStatus`, 'completed'));
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

function getHitlGatePreset(node, workflow = null) {
  if (!node) return null;
  const hitlContext = inferHitlContext(node, workflow);
  return getHitlContextMeta(hitlContext);
}

function normalizeHitlGateActionValue(action) {
  const raw = String(action || '').trim();
  if (HITL_ACTION_OPTIONS.some((o) => o.value === raw)) return raw;
  return HITL_LEGACY_ACTION_MAP[raw] || '';
}

function normalizeHitlGateActions(actions) {
  const list = Array.isArray(actions)
    ? actions.map(normalizeHitlGateActionValue).filter(Boolean)
    : [];
  const unique = HITL_DEFAULT_ACTIONS.filter((value) => list.includes(value));
  return unique.length === HITL_DEFAULT_ACTIONS.length ? unique : [...HITL_DEFAULT_ACTIONS];
}

function getHitlGateActionLabel(action) {
  return HITL_ACTION_OPTIONS.find((o) => o.value === action)?.label || action || '';
}

function getHitlGateBranchEdgeLabel(branch, node = null) {
  return getHitlGateActionLabel(normalizeHitlGateActionValue(branch));
}

const HITL_GATE_LAYOUT = {
  minW: 224,
  headerH: 50,
  summaryH: 34,
  bodyPadTop: 4,
  bodyPadBottom: 8,
  rowGap: 4,
  rowH: 28,
  labelCharW: 14,
  summaryCharW: 12,
};

function getHitlGateNodeLayoutMetrics(node, canvasSummary = '') {
  const actions = normalizeHitlGateActions(node?.actions);
  const { minW, headerH, summaryH, bodyPadTop, bodyPadBottom, rowGap, rowH, labelCharW, summaryCharW } = HITL_GATE_LAYOUT;
  let maxLabelLen = 0;
  actions.forEach((action) => {
    maxLabelLen = Math.max(maxLabelLen, getHitlGateActionLabel(action).length);
  });
  const summaryLen = String(canvasSummary || '').length;
  const cardW = Math.max(
    minW,
    56 + maxLabelLen * labelCharW,
    summaryLen ? 76 + summaryLen * summaryCharW : 0,
  );
  const branchesH = actions.length * rowH + Math.max(0, actions.length - 1) * rowGap;
  const shellH = headerH + summaryH + bodyPadTop + branchesH + bodyPadBottom;
  const branchStartY = headerH + summaryH + bodyPadTop;
  const rows = actions.map((action, index) => {
    const yCenter = Math.round(
      branchStartY + index * (rowH + rowGap) + rowH / 2,
    );
    return {
      key: action,
      index,
      label: getHitlGateActionLabel(action),
      yCenter,
      rowH,
      ratio: yCenter / shellH,
    };
  });
  return {
    w: cardW,
    h: shellH,
    cardW,
    cardH: shellH,
    headerH,
    branchStartY,
    branchLaneW: 0,
    branchGapW: 0,
    branchesH,
    rows,
  };
}

function getHitlGateNodeBranches(node) {
  return getHitlGateNodeLayoutMetrics(node).rows.map((row) => ({
    key: row.key,
    index: row.index,
    label: row.label,
    ratio: row.ratio,
    yCenter: row.yCenter,
  }));
}

function getHitlGateBranchIndex(node, branchKey) {
  const branches = getHitlGateNodeBranches(node);
  const match = branches.find((b) => b.key === branchKey);
  return match?.index ?? branches.findIndex((b) => b.key === branchKey);
}

/** 已接下游连线的出口 action 键（去重） */
function getHitlGateConnectedBranchKeys(workflow, nodeId) {
  return [...new Set(
    (workflow?.edges || [])
      .filter((e) => e.from === nodeId && e.branch && !e.visualHidden)
      .map((e) => normalizeHitlGateActionValue(e.branch))
      .filter(Boolean),
  )];
}

/** 运行时/待办仅提供已接线的 action；配置期若尚未接线则仍展示全部出口供连接 */
function getHitlGateEnabledActions(workflow, node) {
  if (!node?.id) return [...HITL_DEFAULT_ACTIONS];
  const connected = getHitlGateConnectedBranchKeys(workflow, node.id);
  return connected.length ? connected : [...HITL_DEFAULT_ACTIONS];
}

/** 已有至少一条出口接线后，未接下游的分支标为不要（不需要） */
function isHitlGateBranchMarkedOptional(workflow, nodeId, branchKey) {
  const connected = getHitlGateConnectedBranchKeys(workflow, nodeId);
  if (!connected.length) return false;
  return !connected.includes(normalizeHitlGateActionValue(branchKey));
}

function isHitlGateBranchNode(node) {
  return isHitlGateNode(node);
}

function normalizeHitlGateNode(node, workflow = null) {
  if (!isHitlGateNode(node)) return node;
  const hitlContext = inferHitlContext(node, workflow);
  return normalizeHitlWaitConfig({
    ...node,
    type: 'hitl_gate',
    hitlContext,
    label: node.label || '人工確認',
    role: node.role || getHitlGateDefaultRole(hitlContext),
    actions: normalizeHitlGateActions(node.actions),
    description: node.description || '',
  });
}

function normalizeNotifyNode(node, workflow = null) {
  if (node?.type !== 'notify') return node;
  const template = migrateNotifyTemplate(node.template);
  const defaults = getNotifyTemplateDefaults(template, workflow, node.id);
  const channel = node.channel || 'email';
  const { supplementEventEnabled, ...rest } = node;
  const subjectRaw = node.subject != null && String(node.subject).trim() !== ''
    ? node.subject
    : defaults.subject;
  const bodyRaw = node.body != null && String(node.body).trim() !== ''
    ? node.body
    : defaults.body;
  return {
    ...rest,
    type: 'notify',
    label: node.label || '通知',
    template,
    channel,
    recipients: normalizeNotifyRecipients(node.recipients, channel),
    subject: migrateNotifyLegacyTokens(subjectRaw, template, workflow, node.id),
    body: migrateNotifyLegacyTokens(bodyRaw, template, workflow, node.id),
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
    inputs: 参照パラメータとカスタム値をまとめた dict
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
  const source = row?.source === 'custom' ? 'custom' : 'reference';
  return {
    id: row?.id || newRuleId('cin'),
    name: (row?.name || '').trim() || `input_${index + 1}`,
    dataType: migrateCodeDataType(row?.dataType || row?.type || 'string'),
    source,
    required: row?.required !== false,
    variable: source === 'reference' ? (row?.variable || '') : '',
    customValue: source === 'custom' && row?.customValue != null ? String(row.customValue) : '',
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
  return '';
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
    if (elseTarget) {
      workflow.edges.push({
        from: node.id,
        to: elseTarget,
        branch: 'approve',
        label: getHitlGateBranchEdgeLabel('approve'),
      });
    }
  });
}

const HITL_RESULT_DECISION_BRANCH_MAP = {
  if: 'approve',
  'elif-edit': 'approve',
  'elif-deficiency': 'request_supplement',
  else: 'reject',
};

function migrateHitlResultDecisionNodes(workflow) {
  if (!workflow?.nodes?.length) return;
  const resultNode = (workflow.nodes || []).find((n) =>
    n.id === 'wf-d-hitl-result' && n.type === 'decision');
  if (!resultNode) return;

  const hitlFinal = (workflow.nodes || []).find((n) => n.id === 'wf-hu-final' && isHitlGateNode(n));
  if (!hitlFinal) return;

  const resultEdges = (workflow.edges || []).filter((e) => e.from === resultNode.id);
  workflow.edges = (workflow.edges || []).filter((e) =>
    e.from !== resultNode.id && e.to !== resultNode.id);
  workflow.nodes = workflow.nodes.filter((n) => n.id !== resultNode.id);

  resultEdges.forEach((edge) => {
    const action = HITL_RESULT_DECISION_BRANCH_MAP[edge.branch] || normalizeHitlGateActionValue(edge.branch);
    if (!action) return;
    if (workflow.edges.some((e) => e.from === hitlFinal.id && e.branch === action)) return;
    workflow.edges.push({
      from: hitlFinal.id,
      to: edge.to,
      branch: action,
      label: getHitlGateBranchEdgeLabel(action, hitlFinal),
    });
  });
}

function migrateHitlGateMainEdges(workflow) {
  if (!workflow?.nodes?.length) return;
  (workflow.nodes || []).filter(isHitlGateNode).forEach((hitl) => {
    const outEdges = (workflow.edges || []).filter((e) => e.from === hitl.id);
    const mainEdges = outEdges.filter((e) => !e.branch);
    if (mainEdges.length !== 1) return;
    const target = mainEdges[0].to;
    workflow.edges = workflow.edges.filter((e) => !(e.from === hitl.id && !e.branch));
    if (workflow.edges.some((e) => e.from === hitl.id && e.branch === 'approve')) return;
    workflow.edges.push({
      from: hitl.id,
      to: target,
      branch: 'approve',
      label: getHitlGateBranchEdgeLabel('approve', hitl),
    });
  });
}

function migrateHitlGateEdges(workflow) {
  const nodeMap = Object.fromEntries((workflow?.nodes || []).map((n) => [n.id, n]));
  (workflow?.edges || []).forEach((edge) => {
    const from = nodeMap[edge.from];
    if (!isHitlGateNode(from) || !edge.branch) return;
    const action = normalizeHitlGateActionValue(edge.branch);
    if (action) edge.branch = action;
    edge.label = getHitlGateBranchEdgeLabel(edge.branch, from);
  });
}

function sanitizeHitlGateEdges(workflow) {
  if (!workflow?.edges?.length) return;
  const nodeMap = Object.fromEntries((workflow.nodes || []).map((n) => [n.id, n]));
  workflow.edges = workflow.edges.filter((edge) => {
    const from = nodeMap[edge.from];
    if (!isHitlGateNode(from)) return true;
    if (!edge.branch) return false;
    return normalizeHitlGateActions(from.actions).includes(edge.branch);
  });
  const seen = new Set();
  workflow.edges = workflow.edges.filter((edge) => {
    const from = nodeMap[edge.from];
    if (!isHitlGateNode(from) || !edge.branch) return true;
    const key = `${edge.from}|${edge.branch}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  migrateHitlGateEdges(workflow);
}

const DECISION_RESULT_VALUES = [
  { value: '1', label: '1（命中）' },
  { value: '0', label: '0（违反）' },
];

const DECISION_OPERATORS = [
  { value: 'is', label: '=', types: ['all'], placeholder: '値を入力' },
  { value: 'is_not', label: '≠', types: ['all'], placeholder: '値を入力' },
  { value: 'is_empty', label: '未設定', types: ['all'], requiresValue: false },
  { value: 'is_not_empty', label: '設定済み', types: ['all'], requiresValue: false },
  { value: 'is_true', label: 'true', types: ['boolean'], requiresValue: false },
  { value: 'is_false', label: 'false', types: ['boolean'], requiresValue: false },
  { value: 'greater_than', label: '>', types: ['number', 'date', 'datetime'], placeholder: '比較値を入力' },
  { value: 'greater_than_or_equal', label: '≥', types: ['number', 'date', 'datetime'], placeholder: '比較値を入力' },
  { value: 'less_than', label: '<', types: ['number', 'date', 'datetime'], placeholder: '比較値を入力' },
  { value: 'less_than_or_equal', label: '≤', types: ['number', 'date', 'datetime'], placeholder: '比較値を入力' },
  { value: 'between', label: '範囲内', types: ['number', 'date', 'datetime'], placeholder: '開始値, 終了値' },
  { value: 'not_between', label: '範囲外', types: ['number', 'date', 'datetime'], placeholder: '開始値, 終了値' },
  { value: 'contains', label: '含む', types: ['string', 'enum', 'array'], placeholder: '含める値' },
  { value: 'not_contains', label: '含まない', types: ['string', 'enum', 'array'], placeholder: '除外する値' },
  { value: 'starts_with', label: 'で始まる', types: ['string'], placeholder: '先頭文字列' },
  { value: 'ends_with', label: 'で終わる', types: ['string'], placeholder: '末尾文字列' },
  { value: 'matches_regex', label: '正規表現に一致', types: ['string'], placeholder: '正規表現' },
  { value: 'not_matches_regex', label: '正規表現に不一致', types: ['string'], placeholder: '正規表現' },
  { value: 'text_length_equals', label: '文字数 =', types: ['string'], placeholder: '文字数' },
  { value: 'text_length_greater_than', label: '文字数 >', types: ['string'], placeholder: '文字数' },
  { value: 'text_length_greater_than_or_equal', label: '文字数 ≥', types: ['string'], placeholder: '文字数' },
  { value: 'text_length_less_than', label: '文字数 <', types: ['string'], placeholder: '文字数' },
  { value: 'text_length_less_than_or_equal', label: '文字数 ≤', types: ['string'], placeholder: '文字数' },
  { value: 'in', label: 'いずれか', types: ['string', 'enum', 'number', 'date', 'datetime'], placeholder: '値1, 値2, ...' },
  { value: 'not_in', label: 'いずれでもない', types: ['string', 'enum', 'number', 'date', 'datetime'], placeholder: '値1, 値2, ...' },
  { value: 'within_last_days', label: '直近N日以内', types: ['date', 'datetime'], placeholder: '日数' },
  { value: 'older_than_days', label: 'N日以前', types: ['date', 'datetime'], placeholder: '日数' },
  { value: 'length_equals', label: '件数 =', types: ['array'], placeholder: '件数' },
  { value: 'length_greater_than', label: '件数 >', types: ['array'], placeholder: '件数' },
  { value: 'length_greater_than_or_equal', label: '件数 ≥', types: ['array'], placeholder: '件数' },
  { value: 'length_less_than', label: '件数 <', types: ['array'], placeholder: '件数' },
  { value: 'length_less_than_or_equal', label: '件数 ≤', types: ['array'], placeholder: '件数' },
  { value: 'contains_any', label: 'いずれかを含む', types: ['array'], placeholder: '値1, 値2, ...' },
  { value: 'contains_all', label: 'すべて含む', types: ['array'], placeholder: '値1, 値2, ...' },
  { value: 'has_key', label: 'キーを含む', types: ['object'], placeholder: 'キー名' },
  { value: 'not_has_key', label: 'キーを含まない', types: ['object'], placeholder: 'キー名' },
  { value: 'json_path_exists', label: 'パスあり', types: ['object'], placeholder: '例：result.status' },
  { value: 'json_path_not_exists', label: 'パスなし', types: ['object'], placeholder: '例：result.status' },
  { value: 'json_path_equals', label: 'パス値 =', types: ['object'], placeholder: '例：result.status = success' },
  { value: 'json_path_not_equals', label: 'パス値 ≠', types: ['object'], placeholder: '例：result.status = failed' },
  { value: 'json_path_contains', label: 'パス値に含む', types: ['object'], placeholder: '例：messages[] = 不備' },
  { value: 'file_name_contains', label: 'ファイル名に含む', types: ['file'], placeholder: 'ファイル名' },
  { value: 'file_name_not_contains', label: 'ファイル名に含まない', types: ['file'], placeholder: 'ファイル名' },
  { value: 'file_extension_is', label: '拡張子 =', types: ['file'], placeholder: 'pdf' },
  { value: 'file_extension_in', label: '拡張子いずれか', types: ['file'], placeholder: 'pdf, jpg, png' },
  { value: 'file_size_greater_than', label: 'サイズ >', types: ['file'], placeholder: 'MB' },
  { value: 'file_size_less_than_or_equal', label: 'サイズ ≤', types: ['file'], placeholder: 'MB' },
  { value: 'file_page_count_greater_than', label: 'ページ数 >', types: ['file'], placeholder: 'ページ数' },
  { value: 'file_page_count_less_than_or_equal', label: 'ページ数 ≤', types: ['file'], placeholder: 'ページ数' },
];

const DECISION_VALUELESS_OPERATORS = new Set(
  DECISION_OPERATORS.filter((op) => op.requiresValue === false).map((op) => op.value),
);
const DECISION_OPERATOR_VALUES = new Set(DECISION_OPERATORS.map((op) => op.value));
const DECISION_DEFAULT_OPERATOR_BY_TYPE = {
  boolean: 'is_true',
  number: 'is',
  date: 'is',
  datetime: 'is',
  string: 'is',
  enum: 'is',
  array: 'length_greater_than',
  object: 'is_not_empty',
  file: 'is_not_empty',
};

function normalizeDecisionDataType(dataType) {
  const raw = String(dataType || '').trim().toLowerCase();
  if (!raw) return 'string';
  if (['string', 'text', 'varchar', 'char'].includes(raw)) return 'string';
  if (['enum', 'select', 'status'].includes(raw)) return 'enum';
  if (['number', 'numeric', 'integer', 'int', 'float', 'double', 'decimal'].includes(raw)) return 'number';
  if (['boolean', 'bool'].includes(raw)) return 'boolean';
  if (['array', 'list'].includes(raw)) return 'array';
  if (['object', 'dict', 'json', 'map'].includes(raw)) return 'object';
  if (['file', 'document', 'image', 'pdf'].includes(raw)) return 'file';
  if (['date'].includes(raw)) return 'date';
  if (['datetime', 'timestamp', 'time'].includes(raw)) return 'datetime';
  return raw;
}

function isDecisionOperatorAvailableForType(operator, dataType = '') {
  const op = typeof operator === 'string'
    ? DECISION_OPERATORS.find((item) => item.value === operator)
    : operator;
  if (!op) return false;
  if (!String(dataType || '').trim()) return op.types?.includes('all');
  const type = normalizeDecisionDataType(dataType);
  return op.types?.includes('all') || op.types?.includes(type);
}

/** 条件节点禁用运算符（PRD 6.02.10.1：无 いずれか / 数组聚合；多值用 AND/OR） */
const DECISION_OPERATORS_EXCLUDED_FROM_CONDITION = new Set([
  'in',
  'not_in',
  'contains_any',
  'contains_all',
]);

/** 失败时写入的可选 String 变量（允许 未設定 / 設定済み） */
const DECISION_OPTIONAL_STRING_VAR_SUFFIXES = [
  'lastFailureReason',
  'errorMessage',
  'notifyFailureReason',
];

function isDecisionOptionalStringVariable(variableOption) {
  if (variableOption?.pickerGroup === 'step1_doc') return true;
  const value = String(variableOption?.value || variableOption?.localId || '');
  return DECISION_OPTIONAL_STRING_VAR_SUFFIXES.some((suffix) => value.endsWith(suffix));
}

function getDecisionOperatorsForType(dataType = '', variableOption = null) {
  if (!String(dataType || '').trim()) {
    return DECISION_OPERATORS
      .filter((op) => op.types?.includes('all'))
      .filter((op) => !DECISION_OPERATORS_EXCLUDED_FROM_CONDITION.has(op.value));
  }
  const type = normalizeDecisionDataType(dataType);
  let options = DECISION_OPERATORS.filter((op) => isDecisionOperatorAvailableForType(op, type));
  options = options.filter((op) => !DECISION_OPERATORS_EXCLUDED_FROM_CONDITION.has(op.value));

  if (type === 'enum') {
    options = options.filter((op) => ['is', 'is_not'].includes(op.value));
  } else if (type === 'boolean') {
    options = options.filter((op) => ['is_true', 'is_false'].includes(op.value));
  } else if (type === 'string') {
    if (!isDecisionOptionalStringVariable(variableOption)) {
      options = options.filter((op) => !['is_empty', 'is_not_empty'].includes(op.value));
    }
  } else if (type === 'array') {
    options = options.filter((op) => (
      op.value.startsWith('length_') || op.value === 'contains' || op.value === 'not_contains'
    ));
  } else if (type === 'object') {
    options = options.filter((op) => ['is_empty', 'is_not_empty', 'has_key'].includes(op.value));
  } else if (type === 'file') {
    options = [];
  }

  return options.length
    ? options
    : DECISION_OPERATORS
      .filter((op) => op.types?.includes('all'))
      .filter((op) => !DECISION_OPERATORS_EXCLUDED_FROM_CONDITION.has(op.value));
}

function getDecisionDefaultOperator(dataType = '', variableOption = null) {
  if (!String(dataType || '').trim()) return 'is';
  const type = normalizeDecisionDataType(dataType);
  if (type === 'string' && isDecisionOptionalStringVariable(variableOption)) return 'contains';
  const preferred = DECISION_DEFAULT_OPERATOR_BY_TYPE[type] || 'is';
  return isDecisionOperatorAvailableForType(preferred, type)
    ? preferred
    : getDecisionOperatorsForType(dataType, variableOption)[0]?.value || 'is';
}

function normalizeDecisionOperatorForType(value, dataType = '', variableOption = null) {
  const raw = normalizeDecisionOperator(value);
  const available = getDecisionOperatorsForType(dataType, variableOption);
  if (available.some((op) => op.value === raw)) return raw;
  return getDecisionDefaultOperator(dataType, variableOption);
}

function normalizeDecisionOperator(value) {
  const raw = String(value || '').trim();
  if (DECISION_OPERATOR_VALUES.has(raw)) return raw;
  return 'is';
}

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
  const localId = spec.localId || String(spec.value || '').split('.').pop() || '';
  const consumptionPaths = spec.consumptionPaths?.length
    ? spec.consumptionPaths
    : getWorkflowVarConsumptionPaths({ ...spec, localId: spec.localId || localId });
  options.push({
    group: spec.group || '変数',
    nodeType: spec.nodeType || '',
    nodeId: spec.nodeId || '',
    varName: spec.varName || '',
    localId,
    scope: spec.scope || '',
    dataType: spec.dataType || spec.type || '',
    description: spec.description || '',
    value: spec.value,
    label: spec.label,
    displayName: spec.displayName || localId || spec.value,
    hint: spec.hint || `{${spec.value}}`,
    pickerGroup: spec.pickerGroup || '',
    consumptionPaths,
    consumptionPathLabel: formatWorkflowVarConsumptionLabels(consumptionPaths),
  });
}

function buildDecisionVariableCatalog(workflow, nodeId, verifyConfig = null, sceneContext = null) {
  const nodeMap = Object.fromEntries((workflow?.nodes || []).map((n) => [n.id, n]));
  const options = [];
  getDecisionUpstreamNodeIds(workflow, nodeId).forEach((id) => {
    const n = nodeMap[id];
    if (!n || n.type === 'decision') return;
    appendNodeOutputVarCatalog(n, workflow, options, 'condition');
    if (n.type === 'data_mapping') appendDataMappingStandardFieldCatalog(n, workflow, options);
  });
  const docTypes = sceneContext?.docTypes || [];
  const getDocSchemaFn = sceneContext?.getDocSchema;
  if (docTypes.length) {
    appendDocTypeFieldTemplateCatalog(docTypes, getDocSchemaFn, options);
  }
  return options;
}

function appendWorkflowScopedNotifyCatalog(workflow, notifyNodeId, options) {
  if (!workflow?.nodes?.length) return;
  Object.values(NOTIFY_TEMPLATE_VAR_REFS).forEach((ref) => {
    if (!ref?.workflowScope || !ref.varId) return;
    const node = resolveNotifyTemplateNode(workflow, notifyNodeId, ref);
    if (!node) return;
    const varName = getWorkflowNodeVarName(node, workflow);
    const value = `${varName}.${ref.varId}`;
    if ((options || []).some((opt) => opt.value === value)) return;
    const item = getWorkflowNodeOutputVarItems(node, workflow).find((row) => row.id === ref.varId);
    if (!item || !isWorkflowVarForCatalog(item, 'notify')) return;
    appendDecisionVarOption(options, {
      value,
      label: item.label,
      displayName: String(ref.varId || '').split('.').pop() || ref.varId,
      group: getWorkflowNodeMeta(node.type).title,
      scope: item.scope || '案件',
      dataType: item.type || '',
      description: item.description || item.label,
      nodeType: node.type,
      nodeId: node.id,
      varName,
      localId: ref.varId,
      consumptionPaths: getWorkflowVarConsumptionPaths(item),
    });
  });
}

function buildNotifyVariableCatalog(workflow, nodeId, verifyConfig = null, sceneContext = null) {
  const nodeMap = Object.fromEntries((workflow?.nodes || []).map((n) => [n.id, n]));
  const options = [];
  getDecisionUpstreamNodeIds(workflow, nodeId).forEach((id) => {
    const n = nodeMap[id];
    if (!n || n.type === 'decision') return;
    appendNodeOutputVarCatalog(n, workflow, options, 'notify');
  });
  appendWorkflowScopedNotifyCatalog(workflow, nodeId, options);
  return options;
}

function getDecisionVariableOptionGroups(options) {
  const groups = [];
  const map = new Map();
  (options || []).forEach((opt) => {
    const key = opt.nodeId || opt.group || 'その他';
    if (!map.has(key)) {
      map.set(key, []);
      groups.push({
        id: key,
        label: opt.group || 'その他',
        nodeType: opt.nodeType || '',
        varName: opt.varName || '',
        options: map.get(key),
      });
    }
    map.get(key).push(opt);
  });
  return groups;
}

function getDecisionVariableOptions(workflow, nodeId, verifyConfig = null, sceneContext = null) {
  return buildDecisionVariableCatalog(workflow, nodeId, verifyConfig, sceneContext);
}

function getDecisionVariableLabel(value, options = []) {
  return options.find((o) => o.value === value)?.label || value || '変数';
}

function getDecisionVariableSecondaryLabel(option) {
  if (!option) return '';
  return String(option.displayName || option.localId || option.value || '').trim();
}

function formatDecisionVariableDisplay(value, options = []) {
  if (!value) return '';
  const opt = (options || []).find((o) => o.value === value);
  if (!opt) return String(value).trim();
  if (opt.pickerGroup === 'standard_field') {
    const fieldLabel = opt.pickerStandardFieldLabel || opt.displayName || opt.label;
    return [opt.group, '標準フィールド', fieldLabel].filter(Boolean).join(' › ');
  }
  if (opt.pickerGroup === 'step1_doc') {
    return [
      opt.group || STEP1_DOCTYPE_FIELD_CASCADER_GROUP,
      opt.pickerDocType,
      opt.pickerField || opt.displayName,
    ].filter(Boolean).join(' › ');
  }
  const group = opt.group || '';
  const secondary = getDecisionVariableSecondaryLabel(opt);
  if (group && secondary) return `${group} › ${secondary}`;
  return secondary || String(value).trim();
}

function formatDecisionVariableCanvasDisplay(value, options = []) {
  if (!value) return '';
  const opt = (options || []).find((o) => o.value === value);
  if (!opt) return String(value).trim();
  return getDecisionVariableSecondaryLabel(opt) || String(value).trim();
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
  verify_hitl: '{{verify.status}} = NG OR {{master.match}} = UNMATCHED',
  verify_pass: '{{verify.status}} = PASS',
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
    value: '',
    preset: '',
    ...overrides,
  };
}

function createDecisionCase(kind = 'if', overrides = {}) {
  return {
    id: kind === 'if' ? 'if' : newRuleId('elif'),
    kind,
    logic: 'and',
    conditions: [createDecisionCondition()],
    ...overrides,
  };
}

function normalizeDecisionCondition(condition) {
  const c = condition || {};
  return {
    id: c.id || newRuleId('dc'),
    variable: c.variable || '',
    operator: normalizeDecisionOperator(c.operator),
    value: c.value ?? '',
    preset: c.preset || '',
  };
}

function migrateDecisionVariableScope(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  return raw
    .replace(/\.documents\[\]\.documentCandidates$/g, '.case.fileCandidateCount')
    .replace(/\.documents\[\]\.classificationWarnings$/g, '.case.classificationWarnings')
    .replace(/\.documents\[\]\.classificationConfidence$/g, '.files[].classificationConfidence')
    .replace(/\.documents\[\]\.ocrFields/g, '.files[].ocrFields')
    .replace(/\.files\[\]\.ocrFields/g, '.files[].ocrFields')
    .replace(/\.case\.ocrFields\./g, 'docTypes.')
    .replace(/\.case\.ocrFields$/g, 'docTypes')
    .replace(/^[a-zA-Z0-9_]+\.docTypes\./, 'docTypes.')
    .replace(/\.documents\[\]\.standardFields/g, '.files[].standardFields')
    .replace(/\.documents\[\]\.masterMatchResults/g, '.files[].masterMatchResults')
    .replace(/\.documents\[\]\.validationResults/g, '.files[].validationResults')
    .replace(/\.documents\[\]\.manualEdits/g, '.files[].manualEdits')
    .replace(/\.fields\[\]\.sourceOcrFields$/g, '.docTypes')
    .replace(/\.fields\[\]\.masterCandidates$/g, '.files[].masterMatchResults')
    .replace(/\.rules\[\]\.validationResults$/g, '.files[].validationResults')
    .replace(/\.case\.standardFields\.([^.]+)\.(value|sourceFields|confidence)$/g, '.case.standardFields.$1');
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
    logic: decisionCase?.logic === 'or' ? 'or' : 'and',
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
    const isAllowedVariable = (value) => optionValues.has(value)
      || options.some((o) => o.pickerGroup === 'step1_doc' && String(value || '').startsWith('docTypes.'))
      || options.some((o) => o.pickerGroup === 'standard_field' && String(value || '').startsWith(`${o.varName}.case.standardFields.`));
    (node.cases || []).forEach((c) => {
      (c.conditions || []).forEach((cond) => {
        cond.variable = migrateDecisionVariableScope(cond.variable);
        if (!cond.variable || !isAllowedVariable(cond.variable)) {
          const preset = cond.preset || node.conditionType;
          const resolved = resolveDecisionPresetVariable(workflow, node.id, preset);
          cond.variable = resolved && isAllowedVariable(resolved) ? resolved : options[0].value;
        }
        const baseOption = options.find((o) => o.value === cond.variable)
          || options.find((o) => String(o.value || '').includes('ocrFields') && String(cond.variable || '').startsWith(`${o.value}.`));
        const dataType = String(cond.variable || '').includes('.ocrFields.') ? 'String' : (baseOption?.dataType || '');
        cond.operator = normalizeDecisionOperatorForType(cond.operator, dataType);
        if (!decisionUsesValueField(cond.operator)) {
          cond.value = '';
        } else if (cond.value === '' || cond.value == null) {
          cond.value = inferDecisionConditionValue(cond, c);
        } else {
          cond.value = migrateDecisionConditionValue(cond);
        }
      });
    });
  });
}

function inferDecisionConditionValue(condition, decisionCase = null) {
  const variable = String(condition?.variable || '');
  const branchText = `${decisionCase?.label || ''} ${decisionCase?.id || ''}`;
  if (/confirmAction$/.test(variable)) {
    if (branchText.includes('補件')) return 'request_supplement';
    if (branchText.includes('案件終止') || branchText.includes('異常')) return 'reject';
    if (branchText.includes('完成') || branchText.includes('通過')) return 'approve';
    return 'approve';
  }
  if (/required(Document|Field)Status$/.test(variable)) return branchText.includes('補件') ? 'missing' : 'success';
  if (/dataValidationStatus$/.test(variable)) return branchText.includes('異常') ? 'failed' : 'success';
  if (/textValidationStatus$|signatureSealStatus$|verifyStatus$|ocrStatus$|preprocessStatus$|mappingStatus$|masterStatus$/.test(variable)) {
    return branchText.includes('異常') ? 'failed' : 'success';
  }
  if (/lowConfidenceFieldCount$|master(NoHit|LowScore|MultiCandidate)Count$|fileCandidateCount$/.test(variable)) return '0';
  if (/mappingConflictStatus$|textValidationStatus$|dataValidationStatus$|signatureSealStatus$|required(Document|Field)Status$/.test(variable)) {
    return branchText.includes('補件') || branchText.includes('不足') ? 'missing' : 'success';
  }
  if (/classificationWarnings$|mappingConflicts$|mappingErrors$|missingDocuments$|missingFields$|failedRules$/.test(variable)) return '0';
  if (/ReviewRequired$/.test(variable)) return branchText.includes('確認') ? 'true' : 'false';
  return '';
}

function migrateDecisionConditionValue(condition) {
  if (!condition) return '';
  if (/confirmAction$/.test(String(condition.variable || '')) && condition.value === 'edit') return 'approve';
  if (/confirmAction$/.test(String(condition.variable || '')) && condition.value === 'request_fix') return 'approve';
  return condition.value ?? '';
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
    const optionMap = Object.fromEntries(options.map((o) => [o.value, o]));
    const resolveDecisionConditionVariable = (rawValue) => {
      const migrated = migrateDecisionVariableScope(rawValue);
      if (migrated && optionValues.has(migrated)) return migrated;
      const ocrBase = options.find((o) => String(o.value || '').includes('ocrFields') && String(migrated || '').startsWith(`${o.value}.`));
      if (ocrBase) return migrated;
      return options.find((o) => o.nodeType && migrated?.startsWith(o.varName))?.value || options[0]?.value || migrated;
    };
    const resolveDecisionConditionDataType = (variable) => {
      if (String(variable || '').includes('.ocrFields.')) return 'String';
      const ocrBase = options.find((o) => String(o.value || '').includes('ocrFields') && String(variable || '').startsWith(`${o.value}.`));
      return optionMap[variable]?.dataType || ocrBase?.dataType || '';
    };
    cases = cases.map((c) => ({
      ...c,
      conditions: c.conditions.map((cond) => {
        const variable = resolveDecisionConditionVariable(cond.variable);
        const dataType = resolveDecisionConditionDataType(variable);
        const operator = normalizeDecisionOperatorForType(cond.operator, dataType);
        return {
          ...cond,
          variable,
          operator,
          value: decisionUsesValueField(operator) && (cond.value === '' || cond.value == null)
            ? inferDecisionConditionValue({ ...cond, variable, operator }, c)
            : migrateDecisionConditionValue({ ...cond, variable, operator }),
        };
      }),
    }));
  }
  return {
    ...node,
    label: getWorkflowNodeMeta('decision').title,
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
  if (!conditions.length) return 'Condition NOT setup';
  const parts = conditions.map((c) => {
    const opt = (variableOptions || []).find((o) => o.value === c.variable);
    const variable = opt?.label
      || formatDecisionVariableCanvasDisplay(c.variable, variableOptions)
      || formatDecisionVariableDisplay(c.variable, variableOptions)
      || '—';
    const operator = DECISION_OPERATORS.find((o) => o.value === c.operator)?.label || c.operator;
    if (!decisionUsesValueField(c.operator)) return `${variable} ${operator}`;
    const value = c.value ? c.value : '…';
    return `${variable} ${operator} ${value}`;
  });
  return parts.join(` ${decisionCase?.logic === 'or' ? 'OR' : 'AND'} `);
}

function getDecisionCaseCanvasPreview(node, decisionCase) {
  if (!decisionCase?.conditions?.some((c) => c.variable)) return '条件未設定';
  if (decisionCase.label) return decisionCase.label;
  return decisionConditionPreview(decisionCase);
}

function getDecisionNodeCanvasPreview(node, variableOptions = []) {
  const cases = node?.cases || [];
  if (!cases.length) return '条件未設定';
  const parts = cases.map((decisionCase, i) => {
    if (decisionCase.label) return decisionCase.label;
    const preview = decisionConditionPreview(decisionCase, variableOptions);
    if (preview && preview !== '条件未設定') return preview;
    return i === 0 ? 'IF' : 'ELIF';
  });
  return parts.filter(Boolean).join(WORKFLOW_CANVAS_SUMMARY_SEP);
}

/** 画布单行摘要：首条条件 + 其余分支计数 */
function getDecisionNodeCanvasSummary(node, variableOptions = []) {
  const cases = node?.cases || [];
  if (!cases.length) return WORKFLOW_CANVAS_SUMMARY_EMPTY;
  const firstCase = cases[0];
  const caseLabel = String(firstCase.label || '').trim();
  let head = caseLabel || decisionConditionPreview(firstCase, variableOptions);
  if (!head || head === '条件未設定') head = 'IF';
  if (cases.length > 1) return joinWorkflowCanvasSummary(head, `他 ${cases.length - 1}件`);
  if (caseLabel) {
    const condCount = (firstCase.conditions || []).filter((c) => c?.variable).length;
    if (condCount > 0) return joinWorkflowCanvasSummary(head, `${condCount}件の条件`);
  }
  return head;
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

const DECISION_NODE_LAYOUT = {
  w: 360,
  minW: 280,
  maxW: 520,
  headerH: 44,
  bodyPadTop: 4,
  bodyPadBottom: 8,
  rowGap: 4,
  rowBaseH: 34,
  condLineH: 15,
  elseRowH: 32,
  charW: 5.2,
};

function estimateDecisionConditionTextLines(text, contentWidth = 220) {
  const normalized = String(text || '').trim();
  if (!normalized) return 1;
  const charW = DECISION_NODE_LAYOUT.charW;
  const charsPerLine = Math.max(14, Math.floor(contentWidth / charW));
  return Math.ceil(normalized.length / charsPerLine);
}

function formatDecisionConditionCanvasLine(item) {
  if (!item || item.empty) return '条件未設定';
  const parts = [];
  if (item.variable) parts.push(item.variable);
  if (item.operatorLabel) parts.push(item.operatorLabel);
  if (item.needsValue) parts.push(item.value || '…');
  return parts.length ? parts.join(' ') : '条件未設定';
}

function getDecisionNodeLayoutMetrics(node, variableOptions = []) {
  const { minW, maxW, headerH, bodyPadTop, bodyPadBottom, rowGap, rowBaseH, condLineH, elseRowH, charW } = DECISION_NODE_LAYOUT;
  const cases = node?.cases?.length ? node.cases : [createDecisionCase('if')];
  let maxTextLen = 0;
  let y = headerH + bodyPadTop;
  const rows = [];
  let nodeW = minW;

  cases.forEach((c, i) => {
    const items = getDecisionConditionCanvasItems(c, variableOptions);
    let condLineCount = 0;
    items.forEach((item) => {
      const line = formatDecisionConditionCanvasLine(item);
      maxTextLen = Math.max(maxTextLen, line.length);
      condLineCount += estimateDecisionConditionTextLines(line, minW - 72);
    });
    condLineCount = Math.max(1, condLineCount);
    const rowH = Math.max(rowBaseH, condLineCount * condLineH + 10);
    rows.push({
      key: c.id,
      label: c.kind === 'if' || i === 0 ? 'IF' : 'ELIF',
      caseLabel: `CASE ${i + 1}`,
      yCenter: y + rowH / 2,
      rowH,
      ratio: 0,
    });
    y += rowH + rowGap;
  });

  nodeW = Math.min(maxW, Math.max(minW, 72 + maxTextLen * charW));

  rows.push({
    key: 'else',
    label: 'ELSE',
    caseLabel: 'ELSE',
    yCenter: y + elseRowH / 2,
    rowH: elseRowH,
    ratio: 0,
  });
  y += elseRowH + bodyPadBottom;

  const height = Math.max(96, y);
  rows.forEach((row) => {
    row.ratio = row.yCenter / height;
  });

  return { w: Math.round(nodeW), h: height, rows };
}

function getDecisionNodeBranches(node) {
  const metrics = getDecisionNodeLayoutMetrics(node);
  return metrics.rows.map((row) => ({
    key: row.key,
    label: row.label,
    caseLabel: row.caseLabel,
    ratio: row.ratio,
    yCenter: row.yCenter,
  }));
}

function getDecisionConditionCanvasItems(decisionCase, variableOptions = []) {
  const conditions = decisionCase?.conditions || [];
  if (!conditions.length) {
    return [{ id: 'empty', variable: '', operatorLabel: '', value: '', needsValue: false, empty: true }];
  }
  return conditions.map((c) => ({
    id: c.id,
    variable: formatDecisionVariableCanvasDisplay(c.variable, variableOptions),
    rawVariable: c.variable || '',
    operatorLabel: DECISION_OPERATORS.find((o) => o.value === c.operator)?.label || c.operator || '',
    value: c.value || '',
    needsValue: decisionUsesValueField(c.operator),
    empty: !c.variable,
  }));
}

function getDecisionOperatorLabel(operator) {
  return DECISION_OPERATORS.find((o) => o.value === operator)?.label || operator || '';
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

function buildMinimalCaseWorkflow() {
  const start = normalizeStartNode({
    id: 'wf-start',
    type: 'start',
    label: getWorkflowNodeMeta('start').title,
    x: WF_LAYOUT_PAD.x,
    y: WF_LAYOUT_PAD.y,
    isStart: true,
  });
  const wf = {
    nodes: [start],
    edges: [],
    startNodeId: start.id,
    layoutVersion: 12,
    templateVersion: CASE_WORKFLOW_TEMPLATE_VERSION,
    isTemplate: true,
    topologyCustomized: false,
  };
  layoutWorkflowGraph(wf);
  return wf;
}

function buildDefaultCaseWorkflow() {
  const nodes = [];
  const edges = [];
  const wf = { nodes, edges };
  const cond = (variable, operator, value = '') => createDecisionCondition({ variable, operator, value });

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
        template: template || 'deficiency',
      }, wf);
    } else if (type === 'decision') {
      node = normalizeDecisionNode({
        id,
        type,
        label: label || '条件判断',
        x: 0,
        y: 0,
        judgmentContext: judgmentContext || 'custom',
      }, wf);
    } else if (type === 'data_mapping') {
      node = normalizeDataMappingNode({
        id,
        type,
        label: label || 'データマッピング',
        x: 0,
        y: 0,
        ...(isStart ? { isStart: true } : {}),
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
  place({ id: 'wf-d-pre', type: 'decision', label: '条件判断', judgmentContext: 'custom' });
  place({
    id: 'wf-hu-pre',
    type: 'hitl_gate',
    label: '人工確認',
    hitlContext: 'preprocess',
    role: '入力オペレータ',
  });
  place({ id: 'wf-oc', type: 'ocr', label: 'OCR抽出' });
  place({ id: 'wf-d-ocr', type: 'decision', label: '条件判断', judgmentContext: 'custom' });
  place({
    id: 'wf-hu-ocr',
    type: 'hitl_gate',
    label: '人工確認',
    hitlContext: 'ocr',
    role: '医療審査',
  });
  place({ id: 'wf-map', type: 'data_mapping', label: 'データマッピング' });
  place({ id: 'wf-ai', type: 'ai_verify', label: 'AI検証' });
  place({ id: 'wf-d-final', type: 'decision', label: '条件判断', judgmentContext: 'custom' });
  place({
    id: 'wf-hu-final',
    type: 'hitl_gate',
    label: '人工確認',
    hitlContext: 'verification',
    role: '給付審査',
  });
  place({ id: 'wf-n-supp', type: 'notify', label: '補件通知', template: 'deficiency' });
  place({ id: 'wf-n-error', type: 'notify', label: '異常通知', template: 'exception' });
  place({ id: 'wf-n-ok', type: 'notify', label: '処理完了通知', template: 'completed' });
  place({ id: 'wf-end', type: 'end', label: '終了' });

  const ppVar = getWorkflowNodeVarName(nodes.find((n) => n.id === 'wf-pp'), wf);
  const ocrVar = getWorkflowNodeVarName(nodes.find((n) => n.id === 'wf-oc'), wf);
  const aiVar = getWorkflowNodeVarName(nodes.find((n) => n.id === 'wf-ai'), wf);
  const dPre = nodes.find((n) => n.id === 'wf-d-pre');
  Object.assign(dPre, {
    judgmentContext: 'custom',
    cases: [
      createDecisionCase('if', {
        id: 'if',
        label: '通過',
        logic: 'and',
        conditions: [
          cond(`${ppVar}.case.preprocessStatus`, 'is', 'success'),
        ],
      }),
    ],
    elseLabel: '人工確認',
  });

  const dOcr = nodes.find((n) => n.id === 'wf-d-ocr');
  Object.assign(dOcr, {
    judgmentContext: 'custom',
    cases: [
      createDecisionCase('if', {
        id: 'if',
        label: '通過',
        logic: 'and',
        conditions: [
          cond(`${ocrVar}.case.ocrStatus`, 'is', 'success'),
          cond(`${ocrVar}.case.lowConfidenceFieldCount`, 'is', '0'),
        ],
      }),
    ],
    elseLabel: '人工確認',
  });

  const dFinal = nodes.find((n) => n.id === 'wf-d-final');
  Object.assign(dFinal, {
    judgmentContext: 'custom',
    cases: [
      createDecisionCase('if', {
        id: 'if',
        label: '通過',
        logic: 'and',
        conditions: [
          cond(`${aiVar}.case.verifyStatus`, 'is', 'success'),
        ],
      }),
      createDecisionCase('elif', {
        id: 'elif-deficiency',
        label: '補件',
        logic: 'or',
        conditions: [
          cond(`${aiVar}.case.requiredDocumentStatus`, 'is', 'missing'),
          cond(`${aiVar}.case.requiredFieldStatus`, 'is', 'missing'),
        ],
      }),
      createDecisionCase('elif', {
        id: 'elif-error',
        label: '異常',
        logic: 'or',
        conditions: [
          cond(`${aiVar}.case.verifyStatus`, 'is', 'failed'),
          cond(`${aiVar}.case.dataValidationStatus`, 'is', 'failed'),
        ],
      }),
    ],
    elseLabel: '人工確認',
  });

  edges.push(
    { from: 'wf-start', to: 'wf-pp' },
    { from: 'wf-pp', to: 'wf-d-pre' },
    { from: 'wf-d-pre', to: 'wf-oc', branch: 'if', label: '通過' },
    { from: 'wf-d-pre', to: 'wf-hu-pre', branch: 'else', label: '人工確認' },
    { from: 'wf-hu-pre', to: 'wf-oc', branch: 'approve', label: '完成' },
    { from: 'wf-hu-pre', to: 'wf-n-supp', branch: 'request_supplement', label: '補件', visualHidden: true },
    { from: 'wf-hu-pre', to: 'wf-n-error', branch: 'reject', label: '案件終止', visualHidden: true },
    { from: 'wf-oc', to: 'wf-d-ocr' },
    { from: 'wf-d-ocr', to: 'wf-map', branch: 'if', label: '通過' },
    { from: 'wf-d-ocr', to: 'wf-hu-ocr', branch: 'else', label: '人工確認' },
    { from: 'wf-hu-ocr', to: 'wf-map', branch: 'approve', label: '完成' },
    { from: 'wf-hu-ocr', to: 'wf-n-supp', branch: 'request_supplement', label: '補件', visualHidden: true },
    { from: 'wf-hu-ocr', to: 'wf-n-error', branch: 'reject', label: '案件終止', visualHidden: true },
    { from: 'wf-map', to: 'wf-ai' },
    { from: 'wf-ai', to: 'wf-d-final' },
    { from: 'wf-d-final', to: 'wf-n-ok', branch: 'if', label: '通過' },
    { from: 'wf-d-final', to: 'wf-hu-final', branch: 'elif-deficiency', label: '補件' },
    { from: 'wf-d-final', to: 'wf-n-error', branch: 'elif-error', label: '異常' },
    { from: 'wf-d-final', to: 'wf-hu-final', branch: 'else', label: '人工確認' },
    { from: 'wf-hu-final', to: 'wf-n-ok', branch: 'approve', label: '完成' },
    { from: 'wf-hu-final', to: 'wf-n-supp', branch: 'request_supplement', label: '補件' },
    { from: 'wf-hu-final', to: 'wf-n-error', branch: 'reject', label: '案件終止' },
    { from: 'wf-n-supp', to: 'wf-end' },
    { from: 'wf-n-error', to: 'wf-end' },
    { from: 'wf-n-ok', to: 'wf-end' },
  );

  wf.nodes = wf.nodes.map((n) => {
    if (n.type === 'start') return normalizeStartNode(n);
    if (n.type === 'end') return normalizeEndNode(n);
    if (n.type === 'decision') return normalizeDecisionNode(n, wf);
    if (n.type === 'notify') return normalizeNotifyNode(n, wf);
    if (n.type === 'code') return normalizeCodeNode(n, wf);
    if (n.type === 'data_mapping') return normalizeDataMappingNode(n, wf);
    if (n.type === 'ai_verify') return normalizeAiVerifyNode(n, wf);
    if (isHitlGateNode(n)) return normalizeHitlGateNode(n);
    return n;
  });
  migrateDecisionEdges(wf);
  sanitizeDecisionEdges(wf);
  migrateHitlGateEdges(wf);
  sanitizeHitlGateEdges(wf);
  ensureWorkflowStartNode(wf);
  layoutWorkflowGraph(wf);

  return {
    nodes: wf.nodes,
    edges: wf.edges,
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

function hasCanonicalDefaultCaseWorkflowNodes(workflow) {
  return workflowHasTemplateNodeIds(workflow, STRAIGHT_CASE_WORKFLOW_NODE_IDS);
}

function isDefaultCaseWorkflowTemplate(workflow) {
  if (workflow?.topologyCustomized) return false;
  return hasCanonicalDefaultCaseWorkflowNodes(workflow)
    && workflow?.templateVersion === CASE_WORKFLOW_TEMPLATE_VERSION;
}

function isPreviousV6CaseWorkflowTemplate(workflow) {
  return workflowHasTemplateNodeIds(workflow, PREVIOUS_V6_CASE_WORKFLOW_TEMPLATE_NODE_IDS)
    && !workflowHasTemplateNodeIds(workflow, ['wf-d-pre', 'wf-d-ocr', 'wf-d-hitl-result']);
}

function isMinimalPlaceholderCaseWorkflow(workflow) {
  const nodes = workflow?.nodes || [];
  if (!nodes.length) return true;
  return nodes.length === 1 && nodes[0]?.type === 'start';
}

function markWorkflowTopologyEdited(workflow) {
  if (!workflow) return;
  workflow.isTemplate = false;
  workflow.topologyCustomized = true;
}

function shouldMigrateCaseWorkflowToDefault(workflow) {
  if (!workflow?.nodes?.length) return true;
  if (workflow.topologyCustomized) return false;
  if (isDefaultCaseWorkflowTemplate(workflow)) return false;
  if (isMinimalPlaceholderCaseWorkflow(workflow)) return true;
  if (hasCanonicalDefaultCaseWorkflowNodes(workflow)) {
    return !workflow.templateVersion || workflow.templateVersion < CASE_WORKFLOW_TEMPLATE_VERSION;
  }
  if (isLegacyCaseWorkflowTemplate(workflow)) return true;
  if (isPreviousV6CaseWorkflowTemplate(workflow)) return true;
  if (!workflow.templateVersion || workflow.templateVersion < CASE_WORKFLOW_TEMPLATE_VERSION) return true;
  if (workflow.isTemplate) return true;
  const matchedDefaultIds = DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS
    .filter((id) => (workflow.nodes || []).some((node) => node.id === id));
  if (workflow.isTemplate
    && matchedDefaultIds.length > 0
    && matchedDefaultIds.length < DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS.length) {
    return true;
  }
  if (workflow.isTemplate
    && workflowHasTemplateNodeIds(workflow, DEFAULT_CASE_WORKFLOW_TEMPLATE_NODE_IDS)
    && !hasCanonicalDefaultCaseWorkflowNodes(workflow)) {
    return true;
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
  ) || null;
}

function ensureFormWorkflows(form, { force = false } = {}) {
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
      } else if (needsCanonicalCaseWorkflowLayout(form.workflows.case)) {
        applyCanonicalCaseWorkflowLayout(form.workflows.case);
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
  form.workflows = { case: buildMinimalCaseWorkflow() };
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

  if (!endNode && isStraightCaseWorkflowLayoutTarget(workflow)) {
    const anchor = workflow.nodes.find((n) => n.id === 'wf-n-ok')
      || workflow.nodes.find((n) => n.id === 'wf-hu-final')
      || workflow.nodes.find((n) => n.type === 'notify');
    const endId = workflow.nodes.some((n) => n.id === 'wf-end') ? `wf-end-${Date.now()}` : 'wf-end';
    endNode = createTerminalWorkflowNode(
      'end',
      endId,
      (anchor?.x || WF_LAYOUT_PAD.x) + 280,
      anchor?.y ?? WF_LAYOUT_PAD.y,
    );
    workflow.nodes.push(endNode);
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

const DEPRECATED_WORKFLOW_NODE_REMOVE_TYPES = new Set(['master_match', 'mcp']);

function migrateRemoveDeprecatedWorkflowNodes(workflow) {
  if (!workflow?.nodes?.length) return;
  const removeIds = new Set(
    workflow.nodes.filter((n) => DEPRECATED_WORKFLOW_NODE_REMOVE_TYPES.has(n.type)).map((n) => n.id),
  );
  if (!removeIds.size) return;
  removeIds.forEach((nodeId) => {
    const inMain = workflow.edges.filter((e) => e.to === nodeId && !e.branch);
    const outMain = workflow.edges.filter((e) => e.from === nodeId && !e.branch);
    const inBranch = workflow.edges.filter((e) => e.to === nodeId && e.branch);
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
  });
  workflow.nodes = workflow.nodes.filter((n) => !removeIds.has(n.id));
  workflow.edges = workflow.edges.filter((e) => !removeIds.has(e.from) && !removeIds.has(e.to));
}

/** @deprecated use migrateRemoveDeprecatedWorkflowNodes */
function migrateRemoveMasterMatchNodes(workflow) {
  migrateRemoveDeprecatedWorkflowNodes(workflow);
}

function migrateDefaultHumanBufferFlags(workflow) {
  if (!workflow?.nodes?.length || !hasCanonicalDefaultCaseWorkflowNodes(workflow)) return;
  workflow.nodes.forEach((node) => {
    if ((node.id === 'wf-pp' && node.type === 'preprocess')
      || (node.id === 'wf-oc' && node.type === 'ocr')) {
      delete node.hitlWaitEnabled;
    }
    if (isHitlGateNode(node) && (node.id === 'wf-hu-pre' || node.id === 'wf-hu-ocr')) {
      delete node.hitlWaitEnabled;
    }
  });
}

/** @deprecated */
function migrateDefaultHitlWaitFlags(workflow) {
  migrateDefaultHumanBufferFlags(workflow);
}

function normalizeWorkflow(workflow, flowKey = 'case') {
  const w = cloneJson(workflow || {});
  if (!Array.isArray(w.nodes) || !w.nodes.length) {
    return buildMinimalCaseWorkflow();
  }
  if (!Array.isArray(w.edges)) w.edges = [];
  migrateRemoveLegacyIoNodes(w);
  migrateRemoveCaseLinkNodes(w);
  migrateRemoveDeprecatedWorkflowNodes(w);
  migrateDefaultHitlWaitFlags(w);
  if (w.nodes.some((n) => REMOVED_WORKFLOW_NODE_TYPES.has(n.type))) {
    w.nodes = w.nodes.filter((n) => !REMOVED_WORKFLOW_NODE_TYPES.has(n.type));
    const ids = new Set(w.nodes.map((n) => n.id));
    w.edges = w.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }
  migrateHitlDecisionsInWorkflow(w);
  migrateHitlResultDecisionNodes(w);
  migrateHitlGateMainEdges(w);
  w.nodes = w.nodes.map((n) => {
    if (n.type === 'start') return normalizeStartNode(n);
    if (n.type === 'end') return normalizeEndNode(n);
    if (isHitlGateNode(n)) return normalizeHitlGateNode(n);
    if (n.type === 'decision') return normalizeDecisionNode(n, w);
    if (n.type === 'notify') return normalizeNotifyNode(n, w);
    if (n.type === 'code') return normalizeCodeNode(n, w);
    if (n.type === 'data_mapping') return normalizeDataMappingNode(n, w);
    if (n.type === 'ai_verify') return normalizeAiVerifyNode(n, w);
    if (isWorkflowProcessingNode(n)) return ensureWorkflowNodeVarName(n, w);
    return n;
  });
  syncDecisionVariablesInWorkflow(w);
  migrateDecisionEdges(w);
  migrateDecisionFlowEdges(w);
  sanitizeDecisionEdges(w);
  migrateHitlGateEdges(w);
  sanitizeHitlGateEdges(w);
  migrateEnsureTerminalNodes(w);
  ensureWorkflowStartNode(w);
  applyWorkflowEdgeRoutes(w);
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

function workflowEdgeKey(edge) {
  return `${edge.from}|${edge.to}|${edge.branch || ''}`;
}

function workflowCanReach(workflow, fromId, toId, excludeEdge = null) {
  if (!fromId || !toId || fromId === toId) return false;
  const excludeKey = excludeEdge ? workflowEdgeKey(excludeEdge) : '';
  const edges = (workflow?.edges || []).filter((e) => !excludeKey || workflowEdgeKey(e) !== excludeKey);
  const visited = new Set();
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift();
    if (id === toId) return true;
    if (!id || visited.has(id)) continue;
    visited.add(id);
    edges.filter((e) => e.from === id).forEach((e) => queue.push(e.to));
  }
  return false;
}

function isWorkflowBackflowEdge(workflow, fromId, toId, excludeEdge = null) {
  return workflowCanReach(workflow, toId, fromId, excludeEdge);
}

function getWorkflowCycleNodeIds(workflow) {
  const nodeIds = (workflow?.nodes || []).map((n) => n.id);
  const edges = workflow?.edges || [];
  if (!nodeIds.length || !edges.length) return new Set();
  const adj = Object.fromEntries(nodeIds.map((id) => [id, []]));
  edges.forEach((edge) => {
    if (adj[edge.from]) adj[edge.from].push(edge.to);
  });
  const index = {};
  const lowlink = {};
  const onStack = new Set();
  const stack = [];
  const cycleNodes = new Set();
  let seq = 0;

  function strongConnect(v) {
    index[v] = seq;
    lowlink[v] = seq;
    seq += 1;
    stack.push(v);
    onStack.add(v);
    (adj[v] || []).forEach((w) => {
      if (index[w] === undefined) {
        strongConnect(w);
        lowlink[v] = Math.min(lowlink[v], lowlink[w]);
      } else if (onStack.has(w)) {
        lowlink[v] = Math.min(lowlink[v], index[w]);
      }
    });
    if (lowlink[v] === index[v]) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) comp.forEach((id) => cycleNodes.add(id));
    }
  }

  nodeIds.forEach((id) => {
    if (index[id] === undefined) strongConnect(id);
  });
  return cycleNodes;
}

function workflowHasCycle(workflow) {
  return getWorkflowCycleNodeIds(workflow).size > 0;
}

function isValidWorkflowConnect(from, to, branch) {
  if (!from || !to || from.id === to.id) return false;
  if (from.type === 'decision' && !branch) return false;
  if (isHitlGateNode(from) && !branch) return false;
  if (isHitlGateNode(from) && branch && !normalizeHitlGateActions(from.actions).includes(branch)) return false;
  return true;
}

function normalizeWorkflowEdgeRoute(workflow, edge) {
  if (!edge || !workflow) return edge;
  if (edge.route === 'top') delete edge.route;
  return edge;
}

function applyWorkflowEdgeRoutes(workflow) {
  (workflow?.edges || []).forEach((edge) => normalizeWorkflowEdgeRoute(workflow, edge));
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

function measureWorkflowCanvasSummaryHeight(summary, contentWidth) {
  if (!summary) return 0;
  const CHAR_W = 7;
  const LINE_H = 18;
  const lines = Math.max(1, Math.ceil((String(summary).length * CHAR_W) / Math.max(contentWidth, 120)));
  return lines * LINE_H;
}

function measureWorkflowNodeBodyHeight(tasks, contentWidth) {
  if (!tasks?.length) return 0;
  if (tasks.length === 1) return 22;
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

function getWorkflowNodeSize(node, taskCount = 0, tasks = [], canvasSummary = '') {
  if (node?.type === 'start' || node?.type === 'end') {
    return { ...WORKFLOW_NODE_SIZE.terminal };
  }

  if (node?.__collapsed) {
    return { w: WORKFLOW_NODE_SIZE.default.w, h: 64 };
  }

  if (node?.type === 'decision') {
    const metrics = getDecisionNodeLayoutMetrics(node);
    return { w: metrics.w, h: metrics.h };
  }

  if (isHitlGateNode(node)) {
    const metrics = getHitlGateNodeLayoutMetrics(node, canvasSummary);
    return { w: metrics.w, h: metrics.h };
  }

  const nodeW = WORKFLOW_NODE_SIZE.default.w;
  const tagTexts = tasks?.length ? tasks : (taskCount ? Array.from({ length: taskCount }, () => 'tag') : []);
  const HEADER_H = 44;
  const BODY_TOP_PAD = 0;
  const BODY_BOTTOM_PAD = 14;
  const IO_FOOTER_H = 0;
  const contentWidth = (node?.type === 'case_link' || node?.type === 'scene_aggregate' || node?.type === 'scene_completeness' ? 240 : nodeW) - 28;

  if (node?.type === 'case_link' || node?.type === 'scene_aggregate' || node?.type === 'scene_completeness') {
    if (!tagTexts.length) return { w: 240, h: 76 };
    const bodyHeight = measureWorkflowNodeBodyHeight(tagTexts, contentWidth);
    const h = HEADER_H + BODY_TOP_PAD + bodyHeight + BODY_BOTTOM_PAD;
    return { w: 240, h: Math.max(76, h) };
  }

  const showIoFooter = false;
  const footerH = showIoFooter ? IO_FOOTER_H : 0;
  const hasSummary = Boolean(canvasSummary || tagTexts.length);

  if (!hasSummary) return { w: nodeW, h: Math.max(76, HEADER_H + footerH) + (node?.isStart ? 6 : 0) };

  const bodyHeight = canvasSummary
    ? measureWorkflowCanvasSummaryHeight(canvasSummary, contentWidth)
    : WORKFLOW_CANVAS_SUMMARY_LINE_H;
  let h = HEADER_H + BODY_TOP_PAD + bodyHeight + BODY_BOTTOM_PAD + footerH;
  if (node?.isStart) h += 6;
  return { w: nodeW, h: Math.max(76, h) };
}

function estimateWorkflowNodeLayoutTasks(node) {
  if (!node || isWorkflowTerminalNode(node)) return [];
  if (node.type === 'decision' || isHitlGateNode(node)) return [];
  return ['summary'];
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
  if (isHitlGateNode(from)) {
    return edges.find((e) => e.branch === 'approve') || edges[0];
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
    const overlapX = Math.abs(cur.x - prev.x) < Math.max(prevSize.w, curSize.w) * 0.72;
    const minY = prev.y + prevSize.h + 32;
    if (overlapX && cur.y < minY) cur.y = minY;
    if (overlapX && Math.abs(cur.y - prev.y) < 28) {
      cur.x = prev.x + prevSize.w + 40;
    }
  }
}

function isStraightCaseWorkflowLayoutTarget(workflow) {
  if (hasCanonicalDefaultCaseWorkflowNodes(workflow)) return true;
  const ids = new Set((workflow?.nodes || []).map((node) => node.id));
  const coreIds = [
    'wf-start', 'wf-pp', 'wf-d-pre', 'wf-hu-pre', 'wf-oc', 'wf-d-ocr', 'wf-hu-ocr',
    'wf-map', 'wf-ai', 'wf-d-final', 'wf-hu-final',
  ];
  if (!coreIds.every((id) => ids.has(id))) return false;
  return ['wf-n-ok', 'wf-n-supp', 'wf-n-error'].some((id) => ids.has(id));
}

function needsCanonicalCaseWorkflowLayout(workflow) {
  if (!isStraightCaseWorkflowLayoutTarget(workflow)) return false;
  if (!workflow.nodes.some((n) => n.type === 'end')) return true;
  return !workflow.layoutVersion || workflow.layoutVersion < CANONICAL_CASE_WORKFLOW_LAYOUT_VERSION;
}

function ensureCanonicalCaseWorkflowEndNode(workflow) {
  if (!workflow?.nodes?.length || !isStraightCaseWorkflowLayoutTarget(workflow)) return null;
  let endNode = workflow.nodes.find((n) => n.type === 'end');
  if (!endNode) {
    const endId = workflow.nodes.some((n) => n.id === 'wf-end') ? `wf-end-${Date.now()}` : 'wf-end';
    endNode = createTerminalWorkflowNode('end', endId, WF_LAYOUT_PAD.x, WF_LAYOUT_PAD.y);
    workflow.nodes.push(endNode);
  }
  workflow.edges = workflow.edges || [];
  const endId = endNode.id;
  ['wf-n-ok', 'wf-n-supp', 'wf-n-error'].forEach((fromId) => {
    if (!workflow.nodes.some((n) => n.id === fromId)) return;
    if (!workflow.edges.some((e) => e.from === fromId && e.to === endId)) {
      workflow.edges.push({ from: fromId, to: endId });
    }
  });
  return endNode;
}

function applyCanonicalCaseWorkflowLayout(workflow) {
  if (!isStraightCaseWorkflowLayoutTarget(workflow)) return workflow;
  migrateEnsureTerminalNodes(workflow);
  ensureCanonicalCaseWorkflowEndNode(workflow);
  layoutWorkflowGraph(workflow);
  workflow.layoutVersion = CANONICAL_CASE_WORKFLOW_LAYOUT_VERSION;
  return workflow;
}

function layoutStraightCaseWorkflow(workflow, sizes) {
  const nodes = workflow?.nodes || [];
  if (!isStraightCaseWorkflowLayoutTarget(workflow)) return false;
  ensureCanonicalCaseWorkflowEndNode(workflow);
  const byId = Object.fromEntries(workflow.nodes.map((node) => [node.id, node]));
  const mainIds = [
    'wf-start', 'wf-pp', 'wf-d-pre', 'wf-hu-pre', 'wf-oc', 'wf-d-ocr', 'wf-hu-ocr',
    'wf-map', 'wf-ai', 'wf-d-final', 'wf-hu-final',
  ].filter((id) => byId[id]);
  const notifyIds = ['wf-n-ok', 'wf-n-supp', 'wf-n-error'].filter((id) => byId[id]);
  const stepGap = WF_NODE_GAP;
  const notifyLaneGap = WF_BRANCH_LANE_GAP;
  const rowY = WF_LAYOUT_PAD.y;
  let x = WF_LAYOUT_PAD.x;
  let mainMaxH = 76;

  mainIds.forEach((id) => {
    const node = byId[id];
    const size = sizes.get(node.id) || getWorkflowNodeLayoutSize(node);
    node.x = x;
    node.y = rowY;
    mainMaxH = Math.max(mainMaxH, size.h);
    x += size.w + stepGap;
  });

  const notifyColumnX = x;
  const notifyNodes = notifyIds.map((id) => {
    const size = sizes.get(id) || getWorkflowNodeLayoutSize(byId[id]);
    return { id, size };
  });
  const stackHeight = notifyNodes.reduce(
    (total, item, index) => total + item.size.h + (index > 0 ? notifyLaneGap : 0),
    0,
  );
  let notifyY = rowY + Math.max(0, Math.round((mainMaxH - stackHeight) / 2));
  let maxNotifyRight = notifyColumnX;
  notifyNodes.forEach((item) => {
    const node = byId[item.id];
    node.x = notifyColumnX;
    node.y = notifyY;
    maxNotifyRight = Math.max(maxNotifyRight, node.x + item.size.w);
    notifyY += item.size.h + notifyLaneGap;
  });

  const endNode = workflow.nodes.find((n) => n.type === 'end');
  if (endNode) {
    const endSize = sizes.get(endNode.id) || getWorkflowNodeLayoutSize(endNode);
    endNode.x = (notifyNodes.length ? maxNotifyRight : x) + stepGap;
    endNode.y = rowY + Math.max(0, Math.round((mainMaxH - endSize.h) / 2));
  }

  workflow.layoutVersion = CANONICAL_CASE_WORKFLOW_LAYOUT_VERSION;
  return true;
}

function layoutWorkflowGraph(workflow) {
  if (!workflow?.nodes?.length) return workflow;
  const nodes = workflow.nodes;
  const edges = workflow.edges || [];
  const sizes = new Map(nodes.map((n) => [n.id, getWorkflowNodeLayoutSize(n)]));
  if (layoutStraightCaseWorkflow(workflow, sizes)) return workflow;
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

  workflow.layoutVersion = CANONICAL_CASE_WORKFLOW_LAYOUT_VERSION;
  return workflow;
}

function sortWorkflowEndFlowNodes(nodes) {
  return [...nodes].sort((a, b) => {
    const ao = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[a.type];
    const bo = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[b.type];
    if (ao == null && bo == null) return (a.x || 0) - (b.x || 0);
    if (ao == null) return 1;
    if (bo == null) return -1;
    if (ao !== bo) return ao - bo;
    return (a.x || 0) - (b.x || 0);
  });
}

/** 同一親からの非分岐ファンアウト（実並列） */
function getWorkflowParallelFanOutChildren(workflow, parentId, endNodeId, nodeMap, cache = {}) {
  const edges = (workflow?.edges || []).filter((e) => e.from === parentId && !e.branch);
  const outs = edges.filter((e) => workflowEdgeLeadsToEnd(workflow, parentId, e.to, endNodeId, cache));
  if (outs.length <= 1) return null;
  const children = sortWorkflowEndFlowNodes(outs.map((e) => nodeMap[e.to]).filter(Boolean));
  const mergeIds = children.map((child) => {
    const next = (workflow?.edges || []).filter((e) => e.from === child.id && !e.branch);
    return next.length === 1 ? next[0].to : null;
  });
  if (!mergeIds[0] || !mergeIds.every((id) => id === mergeIds[0])) return null;
  return children;
}

function workflowEndFlowBranchPriority(branch) {
  if (branch === 'if' || branch === 'approve') return 0;
  if (!branch) return 1;
  if (branch && String(branch).startsWith('elif')) return 2;
  if (branch === 'request_supplement') return 2;
  if (branch === 'else' || branch === 'reject') return 3;
  return 4;
}

function workflowEdgeLeadsToEnd(workflow, fromId, toId, endNodeId, cache = {}) {
  const key = `${fromId}->${toId}:${endNodeId}`;
  if (cache[key] !== undefined) return cache[key];
  if (toId === endNodeId) {
    cache[key] = true;
    return true;
  }
  const edges = workflow?.edges || [];
  const visited = new Set();
  const queue = [toId];
  while (queue.length) {
    const id = queue.shift();
    if (id === endNodeId) {
      cache[key] = true;
      return true;
    }
    if (visited.has(id)) continue;
    visited.add(id);
    edges.filter((e) => e.from === id).forEach((e) => queue.push(e.to));
  }
  cache[key] = false;
  return false;
}

function pickWorkflowPathEdge(workflow, fromId, endNodeId, cache = {}) {
  const edges = (workflow?.edges || []).filter((e) => e.from === fromId);
  if (!edges.length) return null;
  const ranked = edges
    .filter((e) => workflowEdgeLeadsToEnd(workflow, e.from, e.to, endNodeId, cache))
    .sort((a, b) => {
      const prio = workflowEndFlowBranchPriority(a.branch) - workflowEndFlowBranchPriority(b.branch);
      if (prio !== 0) return prio;
      return String(a.label || '').localeCompare(String(b.label || ''), 'ja');
    });
  return ranked[0] || edges.find((e) => !e.branch) || edges[0];
}

function getWorkflowPathNodeIds(workflow, endNodeId) {
  const nodes = workflow?.nodes || [];
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const start = getWorkflowStartNode(workflow);
  if (!start || !endNodeId) return [];
  const ids = [];
  const seen = new Set();
  let cur = start;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    ids.push(cur.id);
    if (cur.id === endNodeId) break;
    const edge = pickWorkflowPathEdge(workflow, cur.id, endNodeId);
    if (!edge) break;
    cur = nodeMap[edge.to];
  }
  return ids;
}

function collectWorkflowForwardChain(workflow, startNodeId, stopBeforeId = null) {
  const nodes = workflow?.nodes || [];
  const edges = workflow?.edges || [];
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const chain = [];
  let cur = nodeMap[startNodeId];
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.type === 'end' || cur.id === stopBeforeId) break;
    chain.push(cur);
    const outs = edges.filter((e) => e.from === cur.id);
    if (outs.length !== 1) break;
    cur = nodeMap[outs[0].to];
  }
  return chain;
}

function getWorkflowEndFlowNodeRole(type) {
  if (type === 'start') return 'start';
  if (type === 'end') return 'end';
  if (type === 'decision') return 'condition';
  if (type === 'hitl_gate') return 'confirm';
  if (type === 'notify') return 'notify';
  return 'process';
}

function getWorkflowEndFlowNodeBadge(type) {
  if (type === 'decision') return '条件';
  if (type === 'hitl_gate') return '確認';
  return '';
}

function buildWorkflowEndFlowNodeItem(node, pathIds, endNodeId) {
  if (!node) return null;
  const state = node.id === endNodeId ? 'current' : 'configured';
  return {
    id: node.id,
    type: node.type,
    label: node.label || getWorkflowNodeMeta(node.type).title,
    role: getWorkflowEndFlowNodeRole(node.type),
    badge: getWorkflowEndFlowNodeBadge(node.type),
    state,
  };
}

function buildWorkflowEndFlowSummaryNotes(workflow, pathIds) {
  const notes = [];
  (workflow?.nodes || []).forEach((node) => {
    if (!pathIds.has(node.id) || !isHitlGateNode(node)) return;
    const preset = getHitlGatePreset(node);
    const title = preset?.label || node.label || '人工確認';
    notes.push(`${title}：必要（${node.label || title}へ）`);
  });
  return notes;
}

function buildWorkflowEndFlowPreview(workflow, endNodeId) {
  const nodes = workflow?.nodes || [];
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const endNode = nodeMap[endNodeId];
  if (!endNode || endNode.type !== 'end') {
    return { endLabel: '', summaryNotes: [], stages: [] };
  }
  const pathIds = new Set(getWorkflowPathNodeIds(workflow, endNodeId));
  const pathNodes = getWorkflowPathNodeIds(workflow, endNodeId)
    .map((id) => nodeMap[id])
    .filter(Boolean);
  const stages = [];
  let i = 0;
  while (i < pathNodes.length) {
    const node = pathNodes[i];
    if (node.type === 'end') {
      stages.push({
        id: `stage-end-${node.id}`,
        kind: 'single',
        node: buildWorkflowEndFlowNodeItem(node, pathIds, endNodeId),
      });
      i += 1;
      continue;
    }
    if (node.type === 'decision') {
      const outEdges = (workflow?.edges || []).filter((e) => e.from === node.id);
      const activeEdge = pickWorkflowPathEdge(workflow, node.id, endNodeId);
      const activeChainIds = new Set(
        collectWorkflowForwardChain(workflow, activeEdge?.to, endNodeId).map((n) => n.id),
      );
      const branches = outEdges.map((edge) => {
        const active = edge === activeEdge;
        const branchNodes = collectWorkflowForwardChain(workflow, edge.to, endNodeId)
          .map((n) => buildWorkflowEndFlowNodeItem(n, pathIds, endNodeId));
        return {
          id: `${node.id}-${edge.branch || edge.to}`,
          label: edge.label || getDecisionBranchEdgeLabel(edge.branch, node) || '分岐',
          active,
          nodes: branchNodes,
        };
      });
      stages.push({
        id: `stage-decision-${node.id}`,
        kind: 'decision',
        node: buildWorkflowEndFlowNodeItem(node, pathIds, endNodeId),
        branches,
      });
      while (i + 1 < pathNodes.length && activeChainIds.has(pathNodes[i + 1].id)) {
        i += 1;
      }
      i += 1;
      continue;
    }
    if (isHitlGateNode(node)) {
      const outEdges = (workflow?.edges || []).filter((e) => e.from === node.id && e.branch);
      const activeEdge = pickWorkflowPathEdge(workflow, node.id, endNodeId);
      const activeChainIds = new Set(
        collectWorkflowForwardChain(workflow, activeEdge?.to, endNodeId).map((n) => n.id),
      );
      const branches = outEdges.map((edge) => {
        const active = edge === activeEdge;
        const branchNodes = collectWorkflowForwardChain(workflow, edge.to, endNodeId)
          .map((n) => buildWorkflowEndFlowNodeItem(n, pathIds, endNodeId));
        return {
          id: `${node.id}-${edge.branch || edge.to}`,
          label: edge.label || getHitlGateBranchEdgeLabel(edge.branch, node) || '分岐',
          active,
          nodes: branchNodes,
        };
      });
      stages.push({
        id: `stage-hitl-${node.id}`,
        kind: 'decision',
        node: buildWorkflowEndFlowNodeItem(node, pathIds, endNodeId),
        branches,
      });
      while (i + 1 < pathNodes.length && activeChainIds.has(pathNodes[i + 1].id)) {
        i += 1;
      }
      i += 1;
      continue;
    }
    const fanOutChildren = getWorkflowParallelFanOutChildren(workflow, node.id, endNodeId, nodeMap);
    if (fanOutChildren?.length > 1) {
      stages.push({
        id: `stage-single-${node.id}`,
        kind: 'single',
        node: buildWorkflowEndFlowNodeItem(node, pathIds, endNodeId),
      });
      stages.push({
        id: `stage-row-${fanOutChildren.map((n) => n.id).join('-')}`,
        kind: 'row',
        nodes: fanOutChildren.map((n) => buildWorkflowEndFlowNodeItem(n, pathIds, endNodeId)),
      });
      const childIds = new Set(fanOutChildren.map((n) => n.id));
      i += 1;
      while (i < pathNodes.length && childIds.has(pathNodes[i].id)) i += 1;
      continue;
    }
    stages.push({
      id: `stage-single-${node.id}`,
      kind: 'single',
      node: buildWorkflowEndFlowNodeItem(node, pathIds, endNodeId),
    });
    i += 1;
  }
  return {
    endLabel: endNode.label || getWorkflowNodeMeta('end').title,
    summaryNotes: buildWorkflowEndFlowSummaryNotes(workflow, pathIds),
    stages,
  };
}
