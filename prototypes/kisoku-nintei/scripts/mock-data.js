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
  fileFormat: 'CSV',
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
  exportReviewRequired: false,
  exportReviewRole: '案件担当者',
  templateLocked: true,
  exportStandardFieldIds: [],
  exportStandardFieldIdsInitialized: false,
  exportStandardFieldOrderByDoc: {},
  exportFieldModeByDoc: {},
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
const OUTPUT_FORMATS = ['CSV', 'JSON', 'EXCEL'];
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
    tables: { 診療項目明細: ['診療日', '区分', '項目名', '点数', '回数', '合計点数'] },
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

const MASTER_MATCH_EXPORT_FIELD_SAMPLES = [
  { id: 'export-master-field:icd10', label: 'ICD-10コード', sample: 'K35.80' },
  { id: 'export-master-field:std_disease', label: '標準傷病名', sample: '急性虫垂炎' },
  { id: 'export-master-field:inst_code', label: '機関コード', sample: '1310123456' },
  { id: 'export-master-field:std_inst', label: '標準医療機関名', sample: '慶應大学病院' },
];

const EXPORT_FIELD_SAMPLE_VALUES = {
  証券番号: '02468135-008-002',
  ご契約者氏名: '高橋 誠',
  'ご契約者氏名（カナ）': 'タカハシマコト',
  被保険者氏名: '高橋 真由美',
  患者氏名: '高橋 真由美',
  被保険者生年月日: '1992-07-18',
  患者生年月日: '1992-07-18',
  請求区分: '入院給付金',
  給付金種類: '入院給付金',
  入院日: '2025-09-08',
  退院日: '2025-09-14',
  入院日数: '7',
  請求金額: '420,000',
  振込先金融機関名: 'みずほ銀行',
  合計金額: '128,400',
  医療機関名: '慶應大学病院',
  傷病名: '急性虫垂炎',
  診断名: '急性虫垂炎',
  発行日: '2025-09-15',
  金額: '128,400',
  診療日: '2025-09-12',
  氏名: '高橋 真由美',
  明細合計: '128,400',
  項目名: '入院基本料',
  数量: '1',
  単価: '42,000',
};

function getExportFieldSampleValue(docType, fieldLabel) {
  const name = String(fieldLabel || '').split('.').pop();
  return EXPORT_FIELD_SAMPLE_VALUES[name]
    || EXPORT_FIELD_SAMPLE_VALUES[fieldLabel]
    || `${getDocExportLabel(docType)} 抽出値`;
}

function getMasterMatchOutputFieldSample(outputFieldLabel) {
  const label = String(outputFieldLabel || '').trim();
  if (!label) return '—';
  const matched = MASTER_MATCH_EXPORT_FIELD_SAMPLES.find((item) => item.label === label);
  return matched?.sample || `${label}（照合値）`;
}

function formatExportMatchValue(outputFields) {
  const fields = Array.isArray(outputFields) ? outputFields.filter(Boolean) : [];
  if (!fields.length) return '—';
  return fields.map((field) => getMasterMatchOutputFieldSample(field)).join(' / ');
}

function findMasterMatchRuleForExport(ctx, matchRules) {
  const { docType, standardFieldId, fieldName, sourceFieldIds } = ctx || {};
  const rules = matchRules || [];

  if (standardFieldId) {
    const direct = rules.find((rule) => rule.inputKind === 'standard' && rule.standardFieldId === standardFieldId);
    if (direct) return direct;
  }

  if (fieldName && docType) {
    const targetDoc = migrateDocTypeId(docType);
    const ocr = rules.find((rule) => {
      if (rule.inputKind === 'standard') return false;
      return migrateDocTypeId(rule.docType || '') === targetDoc && rule.field === fieldName;
    });
    if (ocr) return ocr;
  }

  for (const sourceId of (sourceFieldIds || [])) {
    const text = String(sourceId || '');
    const dot = text.indexOf('.');
    if (dot < 0) continue;
    const srcDoc = migrateDocTypeId(text.slice(0, dot));
    const srcField = text.slice(dot + 1);
    const linked = rules.find((rule) => {
      if (rule.inputKind === 'standard') return false;
      return migrateDocTypeId(rule.docType || '') === srcDoc && rule.field === srcField;
    });
    if (linked) return linked;
  }

  return null;
}

function getExportExtractValueFromMappingRule(rule, docType) {
  const sources = (rule?.sourceFieldIds || []).filter(Boolean);
  if (!sources.length) return '—';
  const docKey = docType || '';
  const forDoc = sources.find((sourceId) => {
    const text = String(sourceId || '');
    return text.startsWith(`${docKey}.`) || text.includes(`${docKey}・`);
  });
  const sourceId = forDoc || sources.find((item) => item.includes('.')) || sources[0];
  const dot = String(sourceId).indexOf('.');
  if (dot < 0) return getExportFieldSampleValue(docKey, sourceId);
  return getExportFieldSampleValue(sourceId.slice(0, dot), sourceId.slice(dot + 1));
}

function resolveExportMatchValue(ctx, matchRules) {
  const rule = findMasterMatchRuleForExport(ctx, matchRules);
  if (!rule) return '—';
  const outputFields = Array.isArray(rule.outputFields) && rule.outputFields.length
    ? rule.outputFields
    : resolveMasterRuleOutputFields(rule);
  return formatExportMatchValue(outputFields);
}

function buildMasterMatchPreviewNodes() {
  return MASTER_MATCH_EXPORT_FIELD_SAMPLES.map((item) => ({
    id: item.id,
    kind: 'master_field',
    scope: 'master_match',
    label: item.label,
  }));
}

/** 出力設定：左ナビ用（OCR 抽出 → 帳票タイプ / 標準フィールド） */
function buildExportPreviewTree(docFields) {
  const docs = docFields || [];
  return {
    id: 'export-root',
    kind: 'root',
    label: 'エクスポート対象',
    children: [
      {
        id: 'export-folder:ocr',
        kind: 'folder',
        label: 'OCR抽出',
        outputMode: 'ocr',
        children: docs.map((doc) => ({
          id: `export-ocr-doc:${doc.docType}`,
          kind: 'doctype',
          scope: 'doctype',
          outputMode: 'ocr',
          docType: doc.docType,
          label: getDocExportLabel(doc.docType),
        })),
      },
      {
        id: 'export-folder:standard',
        kind: 'folder',
        label: '標準フィールド',
        outputMode: 'standard',
        children: [],
      },
    ],
  };
}

function buildExportOcrFieldRows(docType, docFieldsEntry, matchRules = []) {
  const schema = getDocSchema(docType);
  const schemaFields = schema.fields || [];
  if (!schemaFields.length) return [];
  const existing = docFieldsEntry?.fields || [];
  const existingMap = Object.fromEntries(existing.map((field) => [field.name, field]));
  const orderedNames = existing.length
    ? [...new Set([...existing.map((field) => field.name), ...schemaFields])]
    : schemaFields;
  const fieldRows = orderedNames
    .filter((name) => schemaFields.includes(name))
    .map((name) => {
      const ctx = { docType, fieldName: name };
      return {
        key: `ocr:${docType}:${name}`,
        orderKey: `field:${name}`,
        fieldName: name,
        label: name,
        checked: existingMap[name]?.checked !== false,
        extractValue: getExportFieldSampleValue(docType, name),
        matchValue: resolveExportMatchValue(ctx, matchRules),
      };
    });
  return fieldRows;
}

/** プレビュー用：Workflow 完了時に自動出力される対象一覧 */
function buildExportAutoTargetLabels(docFields, includeVerifyReport = true) {
  const docs = docFields || [];
  const labels = [
    '検証済み OCR 抽出結果',
    ...docs.map((doc) => getDocExportLabel(doc.docType)),
    'マスタ照合結果',
    '前処理後案件ファイル',
  ];
  if (includeVerifyReport) labels.push('検証結果レポート');
  return labels;
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

function buildExportPreviewFiles(docType, fileKind = 'processed') {
  const label = getDocExportLabel(docType);
  const sourceLabel = fileKind === 'original' ? '原本' : '処理後';
  const sourceKind = fileKind === 'original' ? 'original' : 'processed';
  const prefix = fileKind === 'original' ? 'original-file' : 'export-file';
  if (label.includes('診断書')) {
    return [
      { id: `${prefix}:${docType}:a`, kind: 'file', docType, label: '診断書_A.pdf', sourceLabel, sourceKind },
      { id: `${prefix}:${docType}:b`, kind: 'file', docType, label: '診断書_補足説明.pdf', sourceLabel, sourceKind },
    ];
  }
  if (label.includes('領収書') || label.includes('診療明細')) {
    return [
      { id: `${prefix}:${docType}:a`, kind: 'file', docType, label: '診療明細_慶應大学病院.pdf', sourceLabel, sourceKind },
      { id: `${prefix}:${docType}:b`, kind: 'file', docType, label: '領収書_入院費.pdf', sourceLabel, sourceKind },
    ];
  }
  return [
    { id: `${prefix}:${docType}:a`, kind: 'file', docType, label: '請求書_001.pdf', sourceLabel, sourceKind },
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

const WORKFLOW_TEST_DEFAULT_ZIP = {
  name: 'surgery_claim_batch.zip',
  sizeLabel: '6.8 MB',
  fileCount: 4,
  extractedFiles: [
    { name: 'claim_pack.pdf', pages: 8, sizeLabel: '2.4 MB' },
    { name: 'Medical Bill_11.JPG', pages: 1, sizeLabel: '1.1 MB' },
    { name: 'receipt_scan.png', pages: 1, sizeLabel: '0.9 MB' },
    { name: 'memo_page.tiff', pages: 2, sizeLabel: '2.4 MB' },
  ],
};

const WORKFLOW_TEST_SYSTEM_STEPS = [
  { id: 'sys-upload', label: 'アップロード', type: 'system', phase: 'upload' },
  { id: 'sys-aggregate', label: '案件集約 / 路由', type: 'system', phase: 'aggregate' },
];

const ROUTING_STAGE_LABELS = {
  pre_ai_verify: 'pre_ai_verify（AI 检证前）',
  post_ai_verify: 'post_ai_verify（AI 检证后）',
  closed: 'closed（已结束）',
};

function withCaseRoutingMeta(caseItem, {
  routingStage = 'pre_ai_verify',
  userStatus = '处理中',
  waitingHumanBuffer = false,
} = {}) {
  return {
    ...caseItem,
    routingStage,
    routingStageLabel: ROUTING_STAGE_LABELS[routingStage] || routingStage,
    userStatus,
    waitingHumanBuffer,
  };
}

function buildWorkflowTestUploadArtifacts(caseType = 'normal') {
  if (caseType === 'multi_batch' || caseType === 'hitl_wait') {
    return {
      name: 'multi_batch_demo.zip',
      sizeLabel: '4.2 MB',
      fileCount: 4,
      batchMode: 'multi',
      batches: [
        {
          id: 'upload-batch-1',
          label: 'バッチ1',
          action: '案件 A を新規作成',
          extractedFiles: [
            { name: 'claim_pack.pdf', pages: 4, sizeLabel: '1.8 MB' },
            { name: 'Medical Bill_11.JPG', pages: 1, sizeLabel: '0.9 MB' },
          ],
        },
        {
          id: 'upload-batch-2',
          label: 'バッチ2',
          action: '既存案件 A に并入（Open Case 池）',
          extractedFiles: [
            { name: 'id_card.jpg', pages: 1, sizeLabel: '0.8 MB' },
            { name: 'income_proof.pdf', pages: 2, sizeLabel: '0.7 MB' },
          ],
        },
      ],
      extractedFiles: [
        { name: 'claim_pack.pdf', pages: 4, sizeLabel: '1.8 MB', batch: 'バッチ1' },
        { name: 'Medical Bill_11.JPG', pages: 1, sizeLabel: '0.9 MB', batch: 'バッチ1' },
        { name: 'id_card.jpg', pages: 1, sizeLabel: '0.8 MB', batch: 'バッチ2' },
        { name: 'income_proof.pdf', pages: 2, sizeLabel: '0.7 MB', batch: 'バッチ2' },
      ],
    };
  }
  if (caseType === 'auto_supplement') {
    return {
      name: 'auto_supplement_demo.zip',
      sizeLabel: '2.1 MB',
      fileCount: 3,
      batchMode: 'multi',
      batches: [
        {
          id: 'upload-batch-1',
          label: 'バッチ1（既存）',
          action: '案件 A 已处于 post_ai_verify',
          extractedFiles: [],
        },
        {
          id: 'upload-batch-2',
          label: 'バッチ2',
          action: '补件候选池 → 案件 A 自动补件绑定',
          extractedFiles: [
            { name: 'receipt_scan.png', pages: 1, sizeLabel: '0.9 MB' },
            { name: 'memo_page.tiff', pages: 2, sizeLabel: '1.2 MB' },
          ],
        },
      ],
      extractedFiles: [
        { name: 'receipt_scan.png', pages: 1, sizeLabel: '0.9 MB', batch: 'バッチ2' },
        { name: 'memo_page.tiff', pages: 2, sizeLabel: '1.2 MB', batch: 'バッチ2' },
      ],
    };
  }
  return { ...WORKFLOW_TEST_DEFAULT_ZIP, batchMode: 'single' };
}

function buildWorkflowTestAggregateArtifacts(caseType = 'normal') {
  if (caseType === 'multi_batch') {
    return {
      status: 'success',
      statusLabel: '成功',
      summary: 'バッチ1で案件 A を新規作成（pre_ai_verify）。バッチ2は Open Case 池で唯一命中 → 案件 A に并入。案件 B は未作成。',
      crossBatch: {
        batch1: { label: 'バッチ1', action: '案件 A を新規作成' },
        batch2: { label: 'バッチ2', action: 'Open Case 池 → 案件 A に并入', matchedCaseId: 'case-1' },
      },
      touchpointDedup: [
        { node: 'OCR 人工確認', key: '案件A + OCR確認ノード', result: 'open 待办 1 件（バッチ2 分を追記、新規待办なし）' },
        { node: '通知', key: '案件A + 通知ノード', result: '同一 workflow 周期内 1 回のみ送信' },
      ],
      cases: [
        withCaseRoutingMeta({
          id: 'case-1',
          label: '高橋誠_手術請求',
          caseNo: 'REQ-2025-0018890',
          mainDocType: '保険金請求書',
          mergedBatches: ['upload-batch-1', 'upload-batch-2'],
          matchKeys: [
            { label: '証券番号', value: '02468135-008-002' },
            { label: '被保険者氏名', value: '高橋 真由美' },
          ],
          files: [
            { label: '保険金請求書_p1-2.pdf', docType: '保険金請求書', role: '主帳票', batch: 'バッチ1' },
            { label: '診断書_p3-4.pdf', docType: '診断書', role: '関連帳票', batch: 'バッチ1' },
            { label: '診療明細書_001.jpg', docType: '診療明細書', role: '関連帳票', batch: 'バッチ1' },
            { label: '本人確認書類_001.jpg', docType: '本人確認書類', role: '関連帳票', batch: 'バッチ2' },
            { label: '収入証明_p1-2.pdf', docType: '収入証明', role: '関連帳票', batch: 'バッチ2' },
          ],
          warnings: [],
        }),
      ],
    };
  }
  if (caseType === 'hitl_wait') {
    return {
      status: 'success',
      statusLabel: '成功',
      summary: 'バッチ2 并入後、前処理・OCR 人工確認で 30 分缓冲。各触点 pending 项合并，缓冲结束各触发 1 条待办。',
      crossBatch: {
        batch1: { label: 'バッチ1', action: '案件 A を新規作成' },
        batch2: { label: 'バッチ2', action: 'Open Case 池 → 案件 A に并入', matchedCaseId: 'case-1' },
      },
      touchpointDedup: [
        { node: '前処理人工確認', key: '前処理確認 + 30min', result: '缓冲期内 sliding 延长；列表仍显示处理中 + 等待人工缓冲' },
        { node: 'OCR 人工確認', key: 'OCR人工確認 + 30min', result: '缓冲结束 → open 待办 1 件（两批合并）' },
      ],
      cases: [
        withCaseRoutingMeta({
          id: 'case-1',
          label: '高橋誠_手術請求',
          caseNo: 'REQ-2025-0018890',
          mainDocType: '保険金請求書',
          mergedBatches: ['upload-batch-1', 'upload-batch-2'],
          matchKeys: [
            { label: '証券番号', value: '02468135-008-002' },
            { label: '被保険者氏名', value: '高橋 真由美' },
          ],
          files: [
            { label: '保険金請求書_p1-2.pdf', docType: '保険金請求書', role: '主帳票', batch: 'バッチ1' },
            { label: '診断書_p3-4.pdf', docType: '診断書', role: '関連帳票', batch: 'バッチ1' },
            { label: '本人確認書類_001.jpg', docType: '本人確認書類', role: '関連帳票', batch: 'バッチ2' },
          ],
          warnings: [],
        }, { waitingHumanBuffer: true }),
      ],
    };
  }
  if (caseType === 'auto_supplement') {
    return {
      status: 'success',
      statusLabel: '成功',
      summary: 'バッチ2は补件候选池（post_ai_verify）に唯一命中 → 案件 A へ自动补件绑定。新規案件なし、案件集约跳过。从前处理重跑到 AI 检证。',
      autoSupplement: {
        pool: 'post_ai_verify',
        batch2: { label: 'バッチ2', action: '自动补件绑定 → 案件 A', matchedCaseId: 'case-1' },
        rerun: '前处理 → OCR → Data Mapping → AI 检证',
      },
      cases: [
        withCaseRoutingMeta({
          id: 'case-1',
          label: '高橋誠_手術請求',
          caseNo: 'REQ-2025-0018890',
          mainDocType: '保険金請求書',
          matchKeys: [
            { label: '証券番号', value: '02468135-008-002' },
            { label: '被保険者氏名', value: '高橋 真由美' },
          ],
          files: [
            { label: '保険金請求書_p1-2.pdf', docType: '保険金請求書', role: '主帳票' },
            { label: '診断書_p3-4.pdf', docType: '診断書', role: '関連帳票' },
            { label: '領収書_入院費.png', docType: '診療明細書', role: '补件文件', batch: 'バッチ2' },
            { label: '補足説明_p1-2.tiff', docType: 'その他', role: '补件文件', batch: 'バッチ2' },
          ],
          warnings: [],
        }, { routingStage: 'post_ai_verify' }),
      ],
    };
  }
  if (caseType === 'supplement') {
    return {
      status: 'warning',
      statusLabel: '要確認',
      summary: '1 案件を生成しました。関連帳票の不足候補があります（案件详情补件兜底入口）。',
      cases: [
        withCaseRoutingMeta({
          id: 'case-1',
          label: '高橋誠_手術請求',
          caseNo: 'REQ-2025-0018890',
          mainDocType: '保険金請求書',
          matchKeys: [
            { label: '証券番号', value: '02468135-008-002' },
            { label: '被保険者氏名', value: '高橋 真由美' },
          ],
          files: [
            { label: '保険金請求書_p1-2.pdf', docType: '保険金請求書', role: '主帳票' },
            { label: '診断書_p3-4.pdf', docType: '診断書', role: '関連帳票' },
            { label: '診療明細書_001.jpg', docType: '診療明細書', role: '関連帳票' },
          ],
          warnings: ['領収書・診療明細書が未紐付け（補填候補）'],
        }, { userStatus: '等待补件' }),
      ],
    };
  }
  if (caseType === 'abnormal') {
    return {
      status: 'warning',
      statusLabel: '要確認',
      summary: '案件候補が複数件。人工集約確認が必要です。',
      cases: [
        withCaseRoutingMeta({
          id: 'case-candidate-a',
          label: '候補 A：高橋誠_手術請求',
          caseNo: '—',
          mainDocType: '保険金請求書',
          matchKeys: [
            { label: '証券番号', value: '02468135-008-002' },
            { label: '被保険者氏名', value: '高橋 真由美' },
          ],
          files: [
            { label: '保険金請求書_p1-2.pdf', docType: '保険金請求書', role: '主帳票' },
            { label: '診断書_p3-4.pdf', docType: '診断書', role: '関連帳票' },
          ],
          warnings: ['候補案件（信頼度 0.78）'],
        }),
        withCaseRoutingMeta({
          id: 'case-candidate-b',
          label: '候補 B：同一証券・別請求',
          caseNo: '—',
          mainDocType: '保険金請求書',
          matchKeys: [
            { label: '証券番号', value: '02468135-008-002' },
            { label: '被保険者氏名', value: '高橋 誠' },
          ],
          files: [
            { label: '領収書_入院費.png', docType: '診療明細書', role: '関連帳票' },
          ],
          warnings: ['契約者氏名が不一致'],
        }),
      ],
    };
  }
  return {
    status: 'success',
    statusLabel: '成功',
    summary: '1 案件を生成し、6 処理ファイルを紐付けました。',
    cases: [
      withCaseRoutingMeta({
        id: 'case-1',
        label: '高橋誠_手術請求',
        caseNo: 'REQ-2025-0018890',
        mainDocType: '保険金請求書',
        matchKeys: [
          { label: '証券番号', value: '02468135-008-002' },
          { label: '被保険者氏名', value: '高橋 真由美' },
        ],
        files: [
          { label: '保険金請求書_p1-2.pdf', docType: '保険金請求書', role: '主帳票' },
          { label: '診断書_p3-4.pdf', docType: '診断書', role: '関連帳票' },
          { label: '領収書_p5-6.pdf', docType: '診療明細書', role: '関連帳票' },
          { label: '診療明細書_001.jpg', docType: '診療明細書', role: '関連帳票' },
          { label: '領収書_入院費.png', docType: '診療明細書', role: '関連帳票' },
          { label: '補足説明_p1-2.tiff', docType: 'その他', role: '参考資料' },
        ],
        warnings: [],
      }),
    ],
  };
}

function buildWorkflowTestNodeDetail(step, caseType = 'normal') {
  const type = step?.type || '';
  if (type === 'preprocess') {
    return {
      title: '前処理結果',
      rows: [
        { label: '成功ファイル', value: caseType === 'abnormal' ? '5 / 6' : (caseType === 'multi_batch' ? '5 / 5' : '6 / 6') },
        { label: '失敗ファイル', value: caseType === 'abnormal' ? '1（補足説明_p1-2.tiff）' : '0' },
        { label: '回転補正', value: '4 件適用' },
        { label: '透視補正', value: '2 件適用' },
      ],
      issues: caseType === 'abnormal' ? ['補足説明_p1-2.tiff：画像破損のため前処理失敗'] : [],
    };
  }
  if (type === 'ocr') {
    const rows = [
      { label: '抽出フィールド', value: caseType === 'multi_batch' ? '48 件' : '42 件' },
      { label: '低信頼フィールド', value: caseType === 'abnormal' ? '3 件' : '0 件' },
      { label: '帳票タイプ別', value: caseType === 'multi_batch'
        ? '保険金請求書 11 / 診断書 9 / 診療明細書 12 / 本人確認 8 / 収入証明 8'
        : '保険金請求書 11 / 診断書 9 / 診療明細書 22' },
    ];
    if (caseType === 'multi_batch' || caseType === 'hitl_wait') {
      rows.push({ label: '人工確認待办', value: caseType === 'hitl_wait'
        ? '缓冲中（等待人工缓冲）；结束 → 1 件 open'
        : '1 件 open（バッチ2 追記、重複待办なし）' });
    }
    return {
      title: 'OCR 抽出結果',
      rows,
      issues: caseType === 'abnormal'
        ? ['診療明細書.医療機関名：信頼度 0.62（閾値 0.75）']
        : [],
    };
  }
  if (type === 'data_mapping') {
    return {
      title: 'データマッピング結果',
      rows: [
        { label: '標準フィールド', value: '11 件' },
        { label: '競合フィールド', value: caseType === 'abnormal' ? '1 件' : '0 件' },
        { label: '未マッピング', value: '0 件' },
      ],
      issues: caseType === 'abnormal'
        ? ['claimAmount：保険金請求書 420,000 と診療明細合計 128,400 が不一致']
        : [],
    };
  }
  if (type === 'notify') {
    if (caseType === 'multi_batch') {
      return {
        title: '通知送信結果',
        rows: [
          { label: '送信回数', value: '1 回（去重済）' },
          { label: '去重键', value: '案件 A + 通知ノード ID' },
          { label: 'バッチ2 追加分', value: '再送信なし（同一周期内）' },
        ],
        issues: [],
      };
    }
    return {
      title: '通知送信結果',
      rows: [
        { label: '送信状態', value: '成功' },
        { label: '送信先', value: 'ops@example.com' },
      ],
      issues: [],
    };
  }
  if (type === 'ai_verify') {
    if (caseType === 'supplement') {
      return {
        title: 'AI 検証結果',
        rows: [
          { label: '総合判定', value: '要確認' },
          { label: '必要書類', value: '領収書・診療明細書 不足候補' },
          { label: 'データ検証', value: '2 / 3 通過' },
        ],
        issues: ['必要書類チェック：領収書・診療明細書が案件に未紐付け'],
      };
    }
    if (caseType === 'abnormal') {
      return {
        title: 'AI 検証結果',
        rows: [
          { label: '総合判定', value: '不通過' },
          { label: 'データ検証', value: '1 / 3 通過' },
          { label: '署名・印鑑', value: '通過' },
        ],
        issues: [
          'c2：{{保険金請求書.請求金額}} ≠ {{診療明細書.合計金額}}',
          '必須フィールド：入院日が空値',
        ],
      };
    }
    return {
      title: 'AI 検証結果',
      rows: [
        { label: '総合判定', value: '通過' },
        { label: '検証モジュール', value: '6 / 6 実行' },
        { label: 'データ検証', value: '3 / 3 通過' },
        { label: 'マッピング競合', value: '0 件' },
        { label: '必要書類', value: '充足' },
      ],
      issues: [],
    };
  }
  if (type === 'hitl_gate') {
    return {
      title: '人工確認待ち',
      rows: [
        { label: '確認対象', value: step.label || '人工確認' },
        { label: 'テスト状態', value: 'このノードで停止し、待確認内容を表示します' },
      ],
      issues: [],
    };
  }
  if (type === 'notify') {
    return {
      title: '通知結果',
      rows: [
        { label: '送信先', value: 'reviewer@example.com' },
        { label: '件名', value: '【テスト】案件処理完了通知' },
        { label: '送信状態', value: '成功（テスト標識付き）' },
      ],
      issues: [],
    };
  }
  if (type === 'end') {
    return {
      title: '出力結果',
      rows: [
        { label: 'テスト案件', value: 'REQ-2025-0018890' },
        { label: '実行結果', value: 'Workflow 終了まで到達' },
        { label: '出力フィールド', value: 'OCR 18 / 標準 11' },
      ],
      issues: [],
    };
  }
  return null;
}

function getWorkflowTestHitlBranchLabel(workflow, nodeId) {
  const wf = workflow || { edges: [] };
  const edges = (wf.edges || []).filter((edge) => edge.from === nodeId && edge.branch && !edge.visualHidden);
  if (!edges.length) return '';
  const branch = edges.find((edge) => edge.branch === 'approve') || edges[0];
  const label = branch.label || getHitlGateBranchEdgeLabel(branch.branch);
  return label ? `分岐: ${label}` : '';
}

function workflowTestStepResultText(step, caseType) {
  const label = step.label || '';
  const type = step.type || '';
  const phase = step.phase || '';
  if (phase === 'upload') {
    if (caseType === 'multi_batch' || caseType === 'hitl_wait') return 'バッチ1・バッチ2 を順次取り込み（計 4 原ファイル）';
    if (caseType === 'auto_supplement') return 'バッチ2 を主上传取り込み（案件 A は post_ai_verify）';
    return 'ZIP を解凍し 4 原ファイルを取り込みました';
  }
  if (phase === 'aggregate') {
    if (caseType === 'abnormal') return '案件候補が複数件。人工集約確認が必要です';
    if (caseType === 'supplement') return '1 案件を生成。関連帳票の不足候補あり';
    if (caseType === 'auto_supplement') return '补件候选池命中 → 案件 A 自动补件绑定。不新建';
    if (caseType === 'hitl_wait') return 'バッチ2 Open Case 并入 A；前処理・OCR 人工確認缓冲 30 分钟合并 pending';
    if (caseType === 'multi_batch') return 'バッチ2 Open Case 并入 A。案件 B 未作成';
    return '1 案件 REQ-2025-0018890 に 6 ファイルを紐付けました';
  }
  const summaries = {
    start: 'Workflow を起動しました',
    preprocess: '画像補正・回転・画像分割を完了しました',
    ocr: '帳票タイプ別に公式フィールドを抽出しました',
    data_mapping: '標準フィールドへマッピングしました',
    ai_verify: '必須フィールド・必要書類・各種検証を通過しました',
    decision: '条件分岐を評価しました',
    hitl_gate: '人工確認が必要なため、このノードで停止しました',
    notify: '通知テンプレートを生成しました',
    end: 'Workflow を終了しました',
    mcp: '外部連携を完了しました',
    code: 'コード実行を完了しました',
  };
  if (caseType === 'supplement' && type === 'ai_verify') return '不足書類を検出しました（補填候補）';
  if (caseType === 'multi_batch' && type === 'notify') return '同一案件・同一通知ノードのため 1 回のみ送信';
  if ((caseType === 'multi_batch' || caseType === 'hitl_wait') && type === 'hitl_gate') {
    if (caseType === 'hitl_wait' && (step.id === 'wf-hu-pre' || step.id === 'wf-hu-ocr' || /OCR|前処理|前处理/.test(label))) {
      return '30 分钟缓冲中；列表显示处理中 + 等待人工缓冲';
    }
    return caseType === 'hitl_wait'
      ? '缓冲结束 → open 待办 1 件（两批合并）'
      : 'open 待办 1 件（バッチ2 追記、新規待办なし）';
  }
  if (caseType === 'auto_supplement' && type === 'preprocess') return '补件文件のみ前处理実行（既存ファイルは再実行なし）';
  if (caseType === 'abnormal' && type === 'ai_verify') return '必須フィールド不一致を検出しました';
  if (caseType === 'abnormal' && type === 'ocr') return '低信頼フィールドが閾値を下回りました';
  return summaries[type] || `${label} を完了しました`;
}

function workflowTestStepErrorReason(step, caseType) {
  if (caseType !== 'abnormal') return '';
  if (step.type === 'ocr') return '抽出信頼度 0.62 < 閾値 0.75（医療機関名）';
  if (step.type === 'ai_verify') return 'データ検証 c2：請求金額と診療明細合計が不一致';
  return '';
}

function getWorkflowTestReachableNodeIds(workflow) {
  const wf = workflow || { nodes: [], edges: [] };
  if (!wf.nodes?.length) return [];
  const nodeMap = Object.fromEntries(wf.nodes.map((node) => [node.id, node]));
  const start = (typeof getWorkflowStartNode === 'function' ? getWorkflowStartNode(wf) : null) || wf.nodes[0];
  const visited = new Set();
  const ids = [];
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id) || !nodeMap[id]) continue;
    visited.add(id);
    ids.push(id);
    (wf.edges || [])
      .filter((edge) => edge.from === id && !edge.visualHidden)
      .forEach((edge) => queue.push(edge.to));
  }
  return ids;
}

function buildWorkflowTestSteps(workflow, caseType = 'normal') {
  const wf = workflow || { nodes: [], edges: [] };
  const chainIds = getWorkflowTestReachableNodeIds(wf);
  const cycleNodeIds = typeof getWorkflowCycleNodeIds === 'function'
    ? getWorkflowCycleNodeIds(wf)
    : new Set();
  const nodeMap = Object.fromEntries((wf.nodes || []).map((node) => [node.id, node]));
  const orderedChainIds = [
    ...chainIds.filter((id) => nodeMap[id]?.type !== 'end'),
    ...chainIds.filter((id) => nodeMap[id]?.type === 'end'),
  ];
  const wfSteps = orderedChainIds.map((id) => {
    const node = nodeMap[id] || {};
    return {
      id,
      label: node.label || (typeof getWorkflowNodeMeta === 'function'
        ? getWorkflowNodeMeta(node.type).title
        : node.type),
      type: node.type || 'custom',
    };
  });
  const allSteps = [...WORKFLOW_TEST_SYSTEM_STEPS, ...wfSteps];
  const hitlIssues = Object.fromEntries(validateWorkflowTestHitlContext(wf).map((issue) => [issue.nodeId, issue.message]));
  const errorStepId = caseType === 'abnormal'
    ? (allSteps.find((step) => step.type === 'ocr')?.id
      || allSteps.find((step) => step.type === 'ai_verify')?.id
      || allSteps[allSteps.length - 2]?.id)
    : '';
  const warningStepId = caseType === 'supplement'
    ? allSteps.find((step) => step.type === 'ai_verify')?.id
    : (caseType === 'abnormal' ? allSteps.find((step) => step.phase === 'aggregate')?.id : '');
  const skippedTypes = new Set(['hitl_gate']);

  return allSteps.map((step) => {
    let status = 'success';
    if (skippedTypes.has(step.type)) status = 'skipped';
    if (step.id === warningStepId && caseType !== 'abnormal') status = 'warning';
    if (step.id === warningStepId && caseType === 'abnormal' && step.phase === 'aggregate') status = 'warning';
    if (step.id === errorStepId) status = 'error';
    if (hitlIssues[step.id]) status = 'error';
    if (status === 'error' && errorStepId) {
      const errorIndex = allSteps.findIndex((item) => item.id === errorStepId);
      const stepIndex = allSteps.findIndex((item) => item.id === step.id);
      if (stepIndex > errorIndex) status = 'pending';
    }
    return {
      ...step,
      status,
      onCycle: cycleNodeIds.has(step.id),
      summary: (() => {
        let text = status === 'pending' ? '未実行' : workflowTestStepResultText(step, caseType);
        if (step.type === 'hitl_gate' && status !== 'pending') {
          const branchLabel = getWorkflowTestHitlBranchLabel(wf, step.id);
          if (branchLabel) text = `${text}（${branchLabel}）`;
        }
        if (cycleNodeIds.has(step.id) && status !== 'pending') {
          text += '（環状パス上のノード）';
        }
        return text;
      })(),
      errorReason: hitlIssues[step.id] || (status === 'error' ? workflowTestStepErrorReason(step, caseType) : ''),
      needsHuman: false,
    };
  });
}

function buildWorkflowTestSummary(steps, caseType = 'normal', upload = WORKFLOW_TEST_DEFAULT_ZIP) {
  const list = steps || [];
  const passed = list.filter((step) => ['success', 'skipped', 'warning'].includes(step.status)).length;
  const hasError = list.some((step) => step.status === 'error');
  const hasWarning = list.some((step) => step.status === 'warning');
  const endStep = [...list].reverse().find((step) => step.type === 'end');
  const reachedEnd = !!endStep && ['success', 'warning', 'skipped'].includes(endStep.status);
  let overallStatus = 'success';
  let overallLabel = '成功';
  if (hasError) {
    overallStatus = 'error';
    overallLabel = '失敗';
  } else if (!reachedEnd) {
    overallStatus = 'error';
    overallLabel = '終了未到達';
  } else if (hasWarning || caseType === 'supplement') {
    overallStatus = 'warning';
    overallLabel = '要確認';
  }
  const aggregate = buildWorkflowTestAggregateArtifacts(caseType);
  return {
    overallStatus,
    overallLabel,
    durationSec: caseType === 'abnormal' ? 12.6
      : (caseType === 'supplement' ? 16.2
        : (caseType === 'auto_supplement' ? 14.5
          : (caseType === 'hitl_wait' ? 21.2
            : (caseType === 'multi_batch' ? 19.8 : 18.4)))),
    passedCount: passed,
    totalCount: list.length,
    uploadFileCount: upload.fileCount,
    caseCount: aggregate.cases?.length || 0,
    reachedEnd,
  };
}

function buildWorkflowTestArtifacts(caseType = 'normal') {
  return {
    upload: buildWorkflowTestUploadArtifacts(caseType),
    aggregate: buildWorkflowTestAggregateArtifacts(caseType),
  };
}

const WORKFLOW_TEST_HITL_CONTEXT_RULES = {
  preprocess: { label: '前処理確認', allowedTypes: ['preprocess'] },
  ocr: { label: 'OCR結果確認', allowedTypes: ['ocr'] },
  verification: { label: 'AI検証確認', allowedTypes: ['ai_verify'] },
};

function collectWorkflowTestHitlSourceTypes(workflow, hitlNodeId) {
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
    sources.push(node);
  }
  return sources;
}

function validateWorkflowTestHitlContext(workflow) {
  const wf = workflow || { nodes: [], edges: [] };
  const hitlNodes = (wf.nodes || []).filter((node) => node.type === 'hitl_gate');
  const issues = [];
  hitlNodes.forEach((node) => {
    const context = node.hitlContext || 'ocr';
    const rule = WORKFLOW_TEST_HITL_CONTEXT_RULES[context] || WORKFLOW_TEST_HITL_CONTEXT_RULES.ocr;
    const sources = collectWorkflowTestHitlSourceTypes(wf, node.id);
    const matched = sources.some((source) => rule.allowedTypes.includes(source.type));
    if (!matched) {
      const sourceLabels = sources.length
        ? sources.map((source) => source.label || source.type).join('、')
        : '上流ノードなし';
      issues.push({
        nodeId: node.id,
        message: `${node.label || '人工確認'}：コンテキスト「${rule.label}」に対して、上流が ${sourceLabels} です。前処理/OCR/AI検証以外、または一致しない上流から人工確認へ接続されています。`,
      });
    }
  });
  return issues;
}

function buildWorkflowTestDiagnostics(workflow) {
  const wf = workflow || { nodes: [], edges: [] };
  const nodeLabels = (wf.nodes || []).map((node) => node.label || node.type);
  const hitlIssues = validateWorkflowTestHitlContext(wf);
  const cycleNodeIds = typeof getWorkflowCycleNodeIds === 'function'
    ? getWorkflowCycleNodeIds(wf)
    : new Set();
  return {
    variableRefs: nodeLabels.length
      ? '未生成ノードまたは存在しない帳票タイプ・フィールドへの変数参照は検出されませんでした。'
      : 'Workflow ノードが未設定のため、変数参照チェックをスキップしました。',
    branchChecks: (() => {
      const parts = [];
      if ((wf.edges || []).some((edge) => edge.branch)) {
        parts.push('IF/ELSE 分岐先・入力値・型不一致は検出されませんでした。');
      } else {
        parts.push('条件分岐ノードがないため、分岐チェックをスキップしました。');
      }
      if (cycleNodeIds.size) {
        parts.push(`環状パスを ${cycleNodeIds.size} ノードで検出しました（回流は許可・公開可）。`);
      }
      return parts.join('\n');
    })(),
    hitlContext: hitlIssues.length
      ? hitlIssues.map((issue) => issue.message).join('\n')
      : '人工確認コンテキストと上流ノードの不一致は検出されませんでした。',
    hasError: hitlIssues.length > 0,
  };
}
