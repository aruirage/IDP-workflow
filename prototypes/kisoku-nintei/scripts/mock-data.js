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
    mergeByType: {},
    mergeSameType: false,
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
  prefixMode: 'doc_type',
  prefixCustom: '',
  serialDigits: 6,
  includeDate: true,
  dateFormat: 'yyyyMMdd',
  separator: '_',
  caseFilePattern: '{帳票タイプ}_{連番6桁}_{yyyyMMdd}',
  docFilePattern: '{帳票タイプ}_{連番6桁}_{yyyyMMdd}',
  usePerDocFilePattern: true,
  apiObjectKey: '{案件番号}/{帳票タイプ}/{yyyyMMdd}',
  apiPayloadName: '{帳票タイプ}_{連番6桁}_{yyyyMMdd}',
  excelSheetPattern: '{帳票タイプ}',
};

const OUTPUT_NAMING_PREFIX_MODES = [
  { value: 'doc_type', label: '帳票タイプ（固定）' },
  { value: 'custom', label: '固定文字列' },
];

const OUTPUT_NAMING_SERIAL_DIGIT_OPTIONS = [4, 5, 6, 8];

const OUTPUT_EXPORT_VALUE_SOURCES = [
  { value: 'ocr', label: 'OCR原値' },
  { value: 'standard', label: '標準フィールド' },
  { value: 'master_return', label: 'マスタ返却列' },
];

const OUTPUT_TARGET_DEFAULT = '基幹システム';
const OUTPUT_TIMING_LABEL = '案件 Workflow 完了後';
const OUTPUT_DELIVERY_OPTIONS = [
  { value: 'api', label: 'API', desc: '基幹システムが能動的に照会（ポーリング）' },
  { value: 'shared_folder', label: '共有フォルダ', desc: 'リモート共有フォルダへ配置' },
];
const OUTPUT_VERIFY_REPORT_FIELDS = [
  { id: 'verifyResult', label: '検証結果' },
  { id: 'missingDocsList', label: '不足書類一覧' },
  { id: 'missingFieldsList', label: '不足項目一覧' },
  { id: 'textViolationCount', label: 'テキスト違反件数' },
  { id: 'dataViolationCount', label: 'データ違反件数' },
  { id: 'sealViolationCount', label: '署名押印違反件数' },
];

const OUTPUT_NAMING_TOKENS = [
  { token: '{案件ID}', label: '案件ID', example: 'CASE-2026-001234' },
  { token: '{案件番号}', label: '案件番号', example: 'A20260617001' },
  { token: '{証券番号}', label: '証券番号', example: 'POL-88991234' },
  { token: '{業務シーン}', label: '業務シーン名', example: '医療保険通院給付' },
  { token: '{帳票タイプ}', label: '帳票タイプ', example: '診断書' },
  { token: '{連番6桁}', label: '連番（6桁）', example: '000001' },
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
  format: 'API',
  deliveryMethod: 'api',
  outputTarget: OUTPUT_TARGET_DEFAULT,
  encoding: 'UTF-8',
  sheetExportMode: '帳票別Sheetで出力',
  fileNamePattern: '{帳票タイプ}_{連番6桁}_{yyyyMMdd}',
  naming: cloneJson(OUTPUT_NAMING_DEFAULTS),
  maskingLevel: '部分マスキング',
  apiExportEnabled: true,
  apiExportEndpoint: 'https://core.example.com/api/v1/idp/export',
  sharedFolderPath: '\\\\fileserver\\idp\\export',
  includeVerifyReport: true,
  templateLocked: true,
  exportStandardFieldIds: [],
  exportStandardFieldOrderByDoc: {},
  masterMatchExports: [],
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
  { value: '案件担当者', label: '案件担当者', hint: '日常案件処理・一次確認を担当' },
  { value: '給付審査', label: '給付審査', hint: '給付要件・支払可否の審査を担当' },
  { value: '管理者', label: '管理者', hint: '管理者ロールへタスクを割り当て' },
  { value: 'その他ロール', label: 'その他ロール', hint: 'カスタムロールへ割り当て' },
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
      '医療機関名',
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

/** 出力設定：左プレビュー用（P1: OCR / 前処理ファイル / 検証レポート / マスタ照合） */
function buildExportPreviewTree(docFields, masterMatchRules = []) {
  const docs = docFields || [];
  const rules = masterMatchRules || [];
  const fileNodes = docs.flatMap((doc) =>
    buildExportPreviewFiles(doc.docType).map((file) => ({
      ...file,
      parentScope: 'files',
    })));
  const masterNodes = rules.map((rule) => ({
    id: `export-mm:${rule.id}`,
    kind: 'master_rule',
    scope: 'master_match',
    ruleId: rule.id,
    label: rule.name || '照合ルール',
  }));
  return {
    id: 'export-root',
    kind: 'group',
    label: 'エクスポート対象',
    children: [
      {
        id: 'export-scope-ocr',
        kind: 'scope',
        scope: 'ocr',
        label: '検証済み OCR 抽出結果',
        children: docs.map((doc) => ({
          id: `export-ocr:${doc.docType}`,
          kind: 'doctype',
          scope: 'ocr',
          docType: doc.docType,
          label: getDocExportLabel(doc.docType),
        })),
      },
      {
        id: 'export-scope-master',
        kind: 'scope',
        scope: 'master_match',
        label: 'マスタ照合結果',
        children: masterNodes.length
          ? masterNodes
          : [{ id: 'export-master-empty', kind: 'placeholder', scope: 'master_match', label: '照合ルール未設定' }],
      },
      {
        id: 'export-scope-files',
        kind: 'scope',
        scope: 'files',
        label: '前処理後案件ファイル',
        children: fileNodes.length
          ? fileNodes
          : [{ id: 'export-files-empty', kind: 'placeholder', scope: 'files', label: '対象ファイルなし' }],
      },
      {
        id: 'export-scope-report',
        kind: 'scope',
        scope: 'report',
        label: '検証結果レポート',
        children: [{
          id: 'export-report',
          kind: 'report',
          scope: 'report',
          label: '検証結果レポート',
        }],
      },
    ],
  };
}

function buildStructuredNamingPattern(naming) {
  const cfg = { ...cloneJson(OUTPUT_NAMING_DEFAULTS), ...(naming || {}) };
  const sep = cfg.separator || '_';
  const parts = [];
  if (cfg.prefixMode === 'custom' && cfg.prefixCustom) {
    parts.push(cfg.prefixCustom);
  } else {
    parts.push('{帳票タイプ}');
  }
  const digits = Math.min(8, Math.max(4, Number(cfg.serialDigits) || 6));
  parts.push(`{連番${digits}桁}`);
  if (cfg.includeDate !== false) {
    parts.push(`{${cfg.dateFormat || 'yyyyMMdd'}}`);
  }
  return parts.join(sep);
}

function syncOutputNamingPatterns(naming) {
  const next = { ...cloneJson(OUTPUT_NAMING_DEFAULTS), ...(naming || {}) };
  const pattern = buildStructuredNamingPattern(next);
  next.docFilePattern = pattern;
  next.caseFilePattern = pattern;
  next.apiPayloadName = pattern;
  next.serialDigits = Math.min(8, Math.max(4, Number(next.serialDigits) || 6));
  next.prefixMode = next.prefixMode === 'custom' ? 'custom' : 'doc_type';
  next.includeDate = next.includeDate !== false;
  next.dateFormat = next.dateFormat || 'yyyyMMdd';
  next.separator = next.separator || '_';
  return next;
}

function formatMasterMatchOutputFieldsSummary(outputFields) {
  const fields = Array.isArray(outputFields) ? outputFields.filter(Boolean) : [];
  if (!fields.length) return '返却列未設定';
  return fields.join(' / ');
}

function buildMasterMatchExportRows(rules, exportConfigs = []) {
  const cfgMap = Object.fromEntries((exportConfigs || []).map((item) => [item.ruleId, item]));
  return (rules || []).map((rule) => {
    const cfg = cfgMap[rule.id] || {};
    const ruleOutputFields = Array.isArray(rule.outputFields) ? [...rule.outputFields] : [];
    return {
      ruleId: rule.id,
      name: rule.name || '照合ルール',
      inputSummary: summarizeMasterMatchRuleInput(rule),
      masterRefSummary: summarizeMasterMatchRuleMasterRef(rule),
      enabled: cfg.enabled !== false,
      valueSource: OUTPUT_EXPORT_VALUE_SOURCES.some((opt) => opt.value === cfg.valueSource)
        ? cfg.valueSource
        : 'master_return',
      ruleOutputFields,
      outputFieldsSummary: formatMasterMatchOutputFieldsSummary(ruleOutputFields),
    };
  });
}

function summarizeMasterMatchRuleInput(rule) {
  if (!rule) return '—';
  if (rule.inputKind === 'standard') {
    const meta = DATA_MAPPING_STANDARD_FIELDS.find((f) => f.value === rule.standardFieldId);
    return `標準: ${meta?.label || rule.standardFieldId || '—'}`;
  }
  const doc = rule.docType ? getDocDisplayLabel(rule.docType) : '—';
  return `${doc} · ${rule.field || '—'}`;
}

function summarizeMasterMatchRuleMasterRef(rule) {
  if (!rule) return '—';
  const src = typeof getMasterSystemSource === 'function'
    ? getMasterSystemSource(rule.masterSourceId)
    : null;
  const masterLabel = src?.label || rule.masterSourceId || '—';
  return `${masterLabel} · ${rule.lookupField || '—'}`;
}

function syncMasterMatchExportConfig(exportConfigs, rules) {
  const prevMap = Object.fromEntries((exportConfigs || []).map((item) => [item.ruleId, item]));
  return (rules || []).map((rule) => {
    const prev = prevMap[rule.id] || {};
    return {
      ruleId: rule.id,
      enabled: prev.enabled !== false,
      valueSource: OUTPUT_EXPORT_VALUE_SOURCES.some((opt) => opt.value === prev.valueSource)
        ? prev.valueSource
        : 'master_return',
    };
  });
}

function buildExportPreviewFiles(docType) {
  const label = getDocExportLabel(docType);
  if (label.includes('診断書')) {
    return [
      { id: `export-file:${docType}:a`, kind: 'file', docType, label: '診断書_A.pdf' },
      { id: `export-file:${docType}:b`, kind: 'file', docType, label: '診断書_補足説明.pdf' },
    ];
  }
  if (label.includes('領収書') || label.includes('診療明細')) {
    return [
      { id: `export-file:${docType}:a`, kind: 'file', docType, label: '診療明細_慶應大学病院.pdf' },
      { id: `export-file:${docType}:b`, kind: 'file', docType, label: '領収書_入院費.pdf' },
    ];
  }
  return [
    { id: `export-file:${docType}:a`, kind: 'file', docType, label: '請求書_001.pdf' },
  ];
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

function getDocFieldOptions(docType) {
  const schema = getDocSchema(migrateDocTypeId(docType));
  return [...new Set([...(schema.fields || [])].filter(Boolean))];
}

function getDefaultRequiredFieldsForDocType(docType) {
  return getDocFieldOptions(docType);
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
  const expr = (expression || '').trim();
  if (expr) {
    return buildDataExpressionRule(id, expr, tolerance, action);
  }
  return {
    id,
    mode: 'natural',
    description,
    natural: description,
    expression: '',
    tolerance: tolerance || '—',
    action: action || 'HITL審査',
    invalid: false,
  };
}

function buildDataExpressionRule(id, expression, tolerance = '—', action = DEFAULT_VERIFY_ACTION) {
  const expr = (expression || '').trim();
  return {
    id,
    mode: 'expression',
    expression: expr,
    text: expr,
    description: expr,
    natural: expr,
    label: expr,
    tolerance: tolerance || '—',
    action: action || DEFAULT_VERIFY_ACTION,
    invalid: false,
  };
}

const DEFAULT_VERIFY_ACTION = 'HITL審査';

const DEFAULT_SEAL = {
  rules: [],
};

function buildSealRule(docTypes, detectionTarget = '両方', threshold = 80) {
  const types = (Array.isArray(docTypes) ? docTypes : [docTypes]).filter(Boolean);
  return {
    id: `seal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    docTypes: types,
    detectionTarget,
    threshold,
  };
}

function sealFromDocs(docs, detectionTarget = '両方', extra = {}) {
  const threshold = extra.threshold ?? 80;
  const types = (docs || []).filter(Boolean);
  if (!types.length) return { rules: [] };
  return {
    rules: [buildSealRule(types, detectionTarget, threshold)],
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

const MASTER_SYSTEM_SOURCES = [
  ...MASTER_DICTIONARIES.map((d) => ({
    id: `dict:${d.id}`,
    label: d.label,
    sourceType: 'dict',
    dictionaryId: d.id,
    sheets: [],
    columns: getMasterDictionaryFieldValues(d),
  })),
  {
    id: 'table:insurance_product',
    label: '保険商品マスタ（表）',
    sourceType: 'table',
    sheets: ['商品一覧', '特約一覧'],
    columns: ['商品コード', '商品名', '保険種類', '特約コード'],
  },
  {
    id: 'table:provider_network',
    label: '医療機関ネットワーク（表）',
    sourceType: 'table',
    sheets: ['医療機関一覧', 'ネットワーク契約'],
    columns: ['機関コード', '医療機関名', '都道府県', '契約区分'],
  },
];

function getMasterSourceSheetOptions(sourceId) {
  const src = getMasterSystemSource(sourceId);
  if (!src || src.sourceType === 'dict') return [];
  return (src.sheets || []).map((sheet) => ({ label: sheet, value: sheet }));
}

function getMasterSourceColumnOptions(sourceId) {
  const src = getMasterSystemSource(sourceId);
  if (!src) return [];
  if (src.sourceType === 'dict') {
    return getMasterDictFieldOptions(src.dictionaryId);
  }
  return (src.columns || []).map((col) => ({ label: col, value: col }));
}

function getMasterSourceOutputColumnOptions(sourceId, selected = []) {
  const picked = new Set(selected);
  return getMasterSourceColumnOptions(sourceId).filter((opt) => !picked.has(opt.value));
}

function masterSourceRequiresSheet(sourceId) {
  return getMasterSystemSource(sourceId)?.sourceType === 'table';
}

function getMasterSystemSource(sourceId) {
  return MASTER_SYSTEM_SOURCES.find((s) => s.id === sourceId) || null;
}

function getMasterSystemSourceLabel(sourceId) {
  return getMasterSystemSource(sourceId)?.label || sourceId || '';
}

function resolveMasterMatchKnowledgeSource(node) {
  const opt = getMasterSystemSource(node?.masterSourceId);
  if (opt?.sourceType === 'dict') {
    return normalizeKnowledgeSource({ type: 'dict', dictionaryId: opt.dictionaryId });
  }
  if (opt?.sourceType === 'table') {
    return normalizeKnowledgeSource({
      type: 'external_api',
      endpoint: opt.id,
      label: opt.label,
    });
  }
  return normalizeKnowledgeSource(node?.knowledgeSource);
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
  const naming = syncOutputNamingPatterns({ ...cloneJson(OUTPUT_NAMING_DEFAULTS), ...(output?.naming || {}) });
  if (!output?.naming?.caseFilePattern && legacy && !output?.naming?.prefixMode) {
    naming.caseFilePattern = legacy;
    naming.docFilePattern = legacy;
  }
  return syncOutputNamingPatterns(naming);
}

function resolveNamingPattern(pattern, context = {}) {
  if (!pattern) return '';
  const samples = {
    '{案件ID}': 'CASE-2026-001234',
    '{案件番号}': 'A20260617001',
    '{証券番号}': 'POL-88991234',
    '{業務シーン}': (context.sceneName || '医療保険通院給付').replace(/\s+/g, ''),
    '{帳票タイプ}': context.docType || '診断書',
    '{連番4桁}': context.serialNo || '0001',
    '{連番5桁}': context.serialNo || '00001',
    '{連番6桁}': context.serialNo || '000001',
    '{連番8桁}': context.serialNo || '00000001',
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

const DATA_RULE_EXPRESSION_MIGRATIONS = {
  '保険金請求書と診断書の被保険者氏名は一致すること': '{{保険金請求書.被保険者氏名}} = {{診断書.被保険者氏名}}',
  '保険金請求書の請求金額は診療明細書の金額合計と一致すること': '{{保険金請求書.請求金額}} = {{診療明細書.合計金額}}',
  '保険金請求書の請求金額は領収書・診療明細書の金額合計と一致すること': '{{保険金請求書.請求金額}} = {{診療明細書.合計金額}}',
  '保険金請求書、診断書、診療明細書の被保険者氏名は一致すること': '{{保険金請求書.被保険者氏名}} = {{診断書.被保険者氏名}} = {{診療明細書.被保険者氏名}}',
  '保険金請求書、診断书、領収書・診療明細書の被保険者氏名は一致すること': '{{保険金請求書.被保険者氏名}} = {{診断書.被保険者氏名}} = {{診療明細書.被保険者氏名}}',
  '保険金請求書、診断書、診療明細書の医療機関名は一致すること': '{{保険金請求書.医療機関名}} = {{診断書.医療機関名}} = {{診療明細書.医療機関名}}',
  '保険金請求書、診断书、領収書・診療明細書の医療機関名は一致すること': '{{保険金請求書.医療機関名}} = {{診断書.医療機関名}} = {{診療明細書.医療機関名}}',
};

function normalizeDataRule(rule) {
  const natural = rule.description || rule.natural || rule.text || rule.label || '';
  let expression = (rule.expression || '').trim();
  if (!expression && /\{\{[^}]+\}\}/.test(rule.text || '')) {
    expression = rule.text.trim();
  }
  if (!expression && DATA_RULE_EXPRESSION_MIGRATIONS[natural]) {
    expression = DATA_RULE_EXPRESSION_MIGRATIONS[natural];
  }
  const mode = expression ? 'expression' : (rule.mode || 'natural');
  return {
    ...rule,
    mode,
    description: mode === 'expression' ? expression : natural,
    natural: mode === 'expression' ? expression : natural,
    expression,
    text: expression || rule.text || '',
    label: mode === 'expression' ? expression : (rule.label || natural),
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
  v.seal = (() => {
    const legacy = v.seal || {};
    if (Array.isArray(legacy.rules)) {
      return {
        rules: legacy.rules.map((rule) => {
          const docTypes = Array.isArray(rule.docTypes)
            ? rule.docTypes.map(migrateDocTypeId)
            : rule.docType
              ? [migrateDocTypeId(rule.docType)]
              : [];
          return {
            id: rule.id || `seal_${Date.now().toString(36)}`,
            docTypes,
            detectionTarget: rule.detectionTarget || '両方',
            threshold: Number.isFinite(rule.threshold) ? rule.threshold : 80,
          };
        }),
      };
    }
    const docs = (legacy.targetDocs || []).map(migrateDocTypeId);
    return sealFromDocs(docs, legacy.detectionTarget || '両方', {
      threshold: legacy.threshold ?? 80,
    });
  })();
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

