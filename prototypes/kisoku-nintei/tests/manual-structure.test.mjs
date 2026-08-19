import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const manualDir = join(root, 'manual');

async function readManual(file) {
  return readFile(join(manualDir, file), 'utf8');
}

async function exists(file) {
  try {
    await access(join(manualDir, file), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function idsFrom(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
}

function sectionHtml(html, id, nextClass = 'section-card') {
  const start = html.indexOf(`id="${id}"`);
  assert.notEqual(start, -1, `missing #${id}`);
  const next = html.indexOf(`<section class="${nextClass}"`, start + 1);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

function positionsInOrder(html, ids) {
  const positions = ids.map((id) => {
    const position = html.indexOf(`id="${id}"`);
    assert.notEqual(position, -1, `missing #${id}`);
    return position;
  });

  positions.slice(1).forEach((position, index) => {
    assert.ok(position > positions[index], `${ids[index + 1]} should follow ${ids[index]}`);
  });
}

function assertIncludes(haystack, needle) {
  assert.ok(haystack.includes(needle), `expected content to include ${needle}`);
}

describe('single-page NeosAI manual structure', () => {
  it('uses one product-facing HTML page with a simple NeosAI header', async () => {
    const index = await readManual('index.html');
    const css = await readManual('common.css');

    assert.match(index, /<html lang="ja">/);
    assert.match(index, /<title>NeosAI マニュアル<\/title>/);
    assert.match(index, /<h1>NeosAI マニュアル<\/h1>/);
    assert.match(index, /本マニュアルでは、NeosAI IDP の主要機能と基本的な操作手順を説明します/);
    assert.match(css, /:root/);

    assert.equal(await exists('admin.html'), false, 'admin.html should not exist');
    assert.equal(await exists('operator.html'), false, 'operator.html should not exist');
    assert.doesNotMatch(index, /href="admin\.html|href="operator\.html/);
    assert.doesNotMatch(index, /class="meta-row"|対象：|業務：|形式：|对象：|业务：|格式：/);
    assert.doesNotMatch(index, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    assert.doesNotMatch(index, /密码：|パスワード：|API Key：/);
    assert.doesNotMatch(index, /本手册|说明文字暂以中文编写|测试环境/);
  });

  it('merges home and overview and removes the redundant directory blocks', async () => {
    const html = await readManual('index.html');
    const ids = idsFrom(html);
    const home = sectionHtml(html, 'manual-home', 'chapter-page');

    [
      'manual-home',
      'overview-system',
      'overview-case',
      'overview-roles',
      'overview-modules',
    ].forEach((id) => assert.ok(ids.has(id), `missing #${id}`));

    [
      'overview-system',
      'overview-case',
      'overview-roles',
      'overview-modules',
    ].forEach((id) => assert.match(home, new RegExp(`id="${id}"`)));

    positionsInOrder(html, [
      'manual-home',
      'overview-system',
      'overview-case',
      'overview-roles',
      'overview-modules',
      'admin-guide',
    ]);

    [
      'home-chapter-toc',
      'chapter-summary',
      'overview-chapter',
    ].forEach((id) => assert.ok(!ids.has(id), `obsolete #${id} should be removed`));

    assert.doesNotMatch(home, /目录索引|章节摘要|SmartOCR|测试环境|模块与 Step|目次索引|章サマリー|Step \d+/);
    assert.doesNotMatch(html, /class="chapter-toc"|class="toc-box-title"|class="subchapter-toc"|class="step-nav"/);
  });

  it('keeps the left navigation as the only directory source', async () => {
    const html = await readManual('index.html');
    const tocPanel = html.slice(html.indexOf('<aside class="toc-panel"'), html.indexOf('</aside>'));

    [
      '総覧',
      'システム概要',
      'ケース例',
      'ロール設定',
      '機能モジュール',
      'ルール設定モジュール',
      '業務操作モジュール',
      'システム設定モジュール',
      'モデル設定',
      'API設定',
      '帳票タイプ設定',
      'マスターデータ設定',
      'データマッピング設定',
      'AI検証設定',
      '業務シーン設定',
      '新規アップロード',
      '案件一覧',
      'マイタスク',
      'ユーザー管理',
      '権限管理',
      'セキュリティ設定',
    ].forEach((label) => assert.match(tocPanel, new RegExp(label)));

    [
      'href="#admin-guide"',
      'href="#operator-guide"',
      'href="#system-settings"',
      'href="#admin-model-config"',
      'href="#operator-task-module"',
    ].forEach((href) => assert.match(tocPanel, new RegExp(href)));

    assert.doesNotMatch(tocPanel, /href="#step-|目录索引|章节摘要|その他|appendix|导出结果|下一步|出力結果|次へ/);
  });

  it('makes homepage module jumps visibly clickable', async () => {
    const html = await readManual('index.html');
    const css = await readManual('common.css');
    const moduleIndex = sectionHtml(html, 'overview-modules', 'chapter-page');

    assert.match(moduleIndex, /class="module-jump-table"/);
    assert.match(moduleIndex, /class="module-jump"/);
    assert.match(moduleIndex, /class="jump-link"/);

    [
      'href="#admin-guide"',
      'href="#operator-guide"',
      'href="#system-settings"',
      'href="#admin-doctype-config"',
      'href="#operator-case-module"',
      'href="#system-user-management"',
    ].forEach((href) => assert.match(moduleIndex, new RegExp(href)));

    assert.match(css, /\.module-jump\b/);
    assert.match(css, /\.jump-link\b/);
    assert.match(css, /\.module-jump-table\b/);
    assert.doesNotMatch(moduleIndex, /Step \d+|目录索引|目次索引/);
  });

  it('uses one insurance-claim case across admin configuration and operator flow', async () => {
    const html = await readManual('index.html');
    const caseSection = sectionHtml(html, 'overview-case');
    const admin = sectionHtml(html, 'admin-guide', 'chapter-page');
    const operator = sectionHtml(html, 'operator-guide', 'chapter-page');

    assert.match(caseSection, /保険金請求/);
    assert.match(caseSection, /admin は請求書、診断書、診療明細書、領収書などの帳票タイプを設定/);
    assert.match(caseSection, /操作員は同一案件の資料をアップロード/);
    assert.match(admin, /保険金請求/);
    assert.match(operator, /保険金請求/);
    assert.match(html, /<span class="ui-text">保険金請求<\/span>/);
    assert.match(html, /説明用の例です/);
    assert.doesNotMatch(html, /勿删改/);
    assert.doesNotMatch(html, /测试环境示例|删除.*保険金請求\(勿删改\)|公開.*保険金請求\(勿删改\)/);
  });

  it('uses the PRD role model and distinguishes assignee from login roles', async () => {
    const html = await readManual('index.html');
    const roles = sectionHtml(html, 'overview-roles');

    [
      'admin',
      '操作員',
      '操作管理者',
      '担当者',
      '独立したログインロールではなく',
      '対象案件の案件担当者へ解決',
      'ワークフロー設定',
      '通知設定',
      'マイタスク',
    ].forEach((label) => assertIncludes(roles, label));

    assert.doesNotMatch(roles, /<td>管理员<\/td>|<td>业务员<\/td>|<td>管理者<\/td>/);
  });

  it('orders admin configuration by dependency and keeps only functional modules', async () => {
    const html = await readManual('index.html');
    const ids = idsFrom(html);
    const admin = sectionHtml(html, 'admin-guide', 'chapter-page');

    positionsInOrder(html, [
      'admin-guide',
      'admin-model-config',
      'admin-api-config',
      'admin-doctype-config',
      'admin-master-data-config',
      'admin-scene-config',
      'admin-data-mapping-config',
      'operator-guide',
    ]);

    [
      'admin-rule-module-index',
      'admin-basic-config',
      'admin-business-rules',
      'step-01-model',
      'step-20-launch-check',
    ].forEach((id) => assert.ok(!ids.has(id), `obsolete #${id} should be removed`));

    assert.match(admin, /モデル → API → 帳票タイプ → マスターデータ → 業務シーン設定 → データマッピング → AI検証設定/);
    assert.match(admin, /モデル設定 → API設定 → 帳票タイプ設定 → マスターデータ設定 → 業務シーン設定 → データマッピング設定 → AI検証設定/);
    assert.doesNotMatch(admin, /下一步|下一章|快速跳转|模块索引|发布前确认|次へ|次章|クイックリンク|モジュール索引|公開前確認/);
  });

  it('documents document-type setup as the actual five UI steps without field-level required notes', async () => {
    const html = await readManual('index.html');
    const doctype = sectionHtml(html, 'admin-doctype-config');

    [
      '帳票タイプ設定',
      'AI分類設定',
      'AI読取設定',
      '処理ルール設定',
      '画像処理設定',
      '効果テスト',
      '保険金請求書',
      '診断書',
      '診療明細書',
      '領収書',
      '調剤明細書',
    ].forEach((label) => assert.match(doctype, new RegExp(label)));

    assert.match(doctype, /data-shot="admin-doctype-config"/);
    assert.match(doctype, /assets\/doctype-step-1-marked\.png/);
    assert.match(doctype, /assets\/doctype-step-4-enabled-marked\.png/);
    assert.match(doctype, /assets\/doctype-step-5-text-marked\.png/);
    assert.match(doctype, /assets\/doctype-step-5-table-marked\.png/);
    assert.match(doctype, /\+タイプ追加/);
    assert.match(doctype, /AI分類設定/);
    assert.match(doctype, /図では、タイプ追加と分類設定の位置を確認します/);
    assert.match(doctype, /適用ルール/);
    assert.doesNotMatch(doctype, /Step 03|Step 04|基本信息|表格 \/ 明细抽出|AI 前处理 \/ 发布/);
  });

  it('documents IDP API management and keeps notification separate from export', async () => {
    const html = await readManual('index.html');
    const api = sectionHtml(html, 'admin-api-config');
    const scene = sectionHtml(html, 'admin-scene-config');

    [
      'Open API',
      'API Key',
      '通知 URL',
      '業務ルール設定',
      'API設定',
      'API 文書',
    ].forEach((label) => assert.match(api, new RegExp(label)));

    assert.match(api, /画面の詳細説明は、別途用意している API 接続文書を参照します/);
    assert.match(scene, /通知設定.*実行時に該当ノードが存在し、イベント条件に一致した場合のみ起動します/);
    assert.doesNotMatch(api, /APIキー管理|API URL|ファイルアップロードAPI|案件情報取得API|補足資料アップロードAPI|案件データ一括出力API|ファイルダウンロードAPI|Authorization/);
  });

  it('keeps master data and data mapping concise but explains where rules apply', async () => {
    const html = await readManual('index.html');
    const master = sectionHtml(html, 'admin-master-data-config');
    const mapping = sectionHtml(html, 'admin-data-mapping-config');

    [
      'マスターデータ設定',
      '医療機関名',
      '傷病名',
      '薬品名',
      '銀行',
      '支店',
      'マスター追加',
      '列設定',
      '照会コード',
      '一括インポート',
      '追加更新',
      '上書更新',
      '編集',
      '削除',
      '再ベクトル化',
      'マスタ照合',
      '標準データ整合性',
    ].forEach((label) => assertIncludes(master, label));

    [
      'assets/master-data-import-flow.png',
      'assets/master-data-column-settings.png',
      'assets/master-data-table.png',
      'assets/master-data-inline-edit.png',
      'assets/master-data-usage-marked.png',
    ].forEach((asset) => assertIncludes(master, asset));

    [
      'データマッピング設定',
      '標準項目',
      '参照元の帳票タイプ',
      '優先度',
      'データマッピング',
      'ワークフロー設定',
      '項目の競合',
      'AI検証',
    ].forEach((label) => assertIncludes(mapping, label));
  });

  it('documents AI verification as six submodules and business scene as four steps', async () => {
    const html = await readManual('index.html');
    const aiVerification = sectionHtml(html, 'admin-ai-verification-config');
    const businessScene = sectionHtml(html, 'admin-scene-config');
    const aiAssets = [
      'assets/ai-verification-required-fields.png',
      'assets/ai-verification-required-documents.png',
      'assets/ai-verification-standard-consistency.png',
      'assets/ai-verification-text-rules.png',
      'assets/ai-verification-data-rules.png',
      'assets/ai-verification-signature-seal.png',
    ];

    [
      '必須フィールド',
      '必要書類',
      '標準データ整合性',
      'テキスト検証',
      'データ検証',
      '署名・印鑑検証',
      '操作ポイント',
      'AIルール最適化',
      '業務シーンのワークフロー',
      'verifyStatus',
      'verifyResult',
    ].forEach((label) => assert.match(aiVerification, new RegExp(label)));

    for (const asset of aiAssets) {
      assertIncludes(aiVerification, asset);
      assert.equal(await exists(asset), true, `${asset} should exist`);
    }

    assert.equal([...aiVerification.matchAll(/class="operation-step"/g)].length, 6);
    assert.equal([...aiVerification.matchAll(/data-lightbox="manual-shots"/g)].length, 6);
    assert.doesNotMatch(aiVerification, /screenshot-placeholder|スクリーンショット差し替え位置|差し替え例/);
    assert.match(aiVerification, /AI検証ルールは、業務シーンのワークフロー内にある .*AI検証.* ノードで適用されます/);
    assert.match(aiVerification, /マイタスク/);

    [
      '業務シーン・案件集約',
      'ワークフロー設定',
      '通知設定',
      'エクスポート設定',
      '関連チェック',
      'IF/ELSE',
      '開始',
      'マイタスク',
    ].forEach((label) => assert.match(businessScene, new RegExp(label)));

    assert.match(businessScene, /案件集約ルールは、同一案件にまとめるかどうかを決めます/);
    assert.match(businessScene, /通知設定.*実行時に該当ノードが存在し、イベント条件に一致した場合のみ起動します/);
    assert.match(businessScene, /エクスポート設定.*マイタスク.*取得する出力結果の範囲を決めます/);
  });

  it('keeps operator flow to upload, case list, and MyTask with export inside MyTask', async () => {
    const html = await readManual('index.html');
    const ids = idsFrom(html);
    const operator = sectionHtml(html, 'operator-guide', 'chapter-page');
    const caseList = sectionHtml(html, 'operator-case-module');
    const myTask = sectionHtml(html, 'operator-task-module');

    positionsInOrder(html, [
      'operator-guide',
      'operator-upload-module',
      'operator-case-module',
      'operator-task-module',
      'system-settings',
    ]);

    [
      'step-21-upload',
      'step-22-case-list',
      'step-23-my-task-ocr',
      'step-26-export-notification',
    ].forEach((id) => assert.ok(!ids.has(id), `obsolete #${id} should be removed`));

    assert.match(operator, /操作員は同一の保険金請求案件を対象に、資料アップロード/);
    assert.match(operator, /マイタスク.*人工確認、補足資料対応、出力結果の取得/);
    assert.match(caseList, /集約済み案件/);
    assert.match(caseList, /未集約ファイル/);
    assert.match(caseList, /案件を展開すると、ファイル名/);
    assert.match(caseList, /ファイルステータス/);

    assert.match(myTask, /すべての人工確認タスクの入口/);
    assert.match(myTask, /OCR確認/);
    assert.match(myTask, /AI検証確認/);
    assert.match(myTask, /補足資料対応/);
    assert.match(myTask, /出力結果/);
    assert.match(myTask, /出力設定・公開/);
    assert.doesNotMatch(operator, /导出结果<\/h2>|导出通知|发送站内通知|外部 API 通知|出力結果<\/h2>|出力通知/);
  });

  it('promotes system settings to a first-class module instead of an appendix', async () => {
    const html = await readManual('index.html');
    const ids = idsFrom(html);
    const system = sectionHtml(html, 'system-settings', 'chapter-page');

    positionsInOrder(html, [
      'system-settings',
      'system-user-management',
      'system-role-management',
      'system-security-settings',
    ]);

    [
      'appendix',
      'appendix-usage-notes',
      'appendix-system-settings',
      'appendix-user-management',
      'appendix-role-management',
    ].forEach((id) => assert.ok(!ids.has(id), `obsolete #${id} should be removed`));

    [
      'ユーザー管理',
      '権限管理',
      'セキュリティ設定',
      'データ権限',
      'パスワードリセット',
      '有効ユーザー数',
      'メニュー権限',
      'データ保存期限設定',
      'アイドルセッション設定',
    ].forEach((label) => assert.match(system, new RegExp(label)));

    assert.doesNotMatch(system, /IPアドレスホワイトリスト|白名单|API 呼び出し/);
    assert.doesNotMatch(system, /ログ設定/);

    [
      'assets/system-user-management-flow.png',
      'assets/system-role-menu-flow.png',
      'assets/security-duration-flow.png',
      'assets/security-idle-flow.png',
    ].forEach((asset) => assert.match(system, new RegExp(asset)));
  });

  it('uses real screenshots in every functional module section', async () => {
    const html = await readManual('index.html');
    const css = await readManual('common.css');

    [
      'admin-api-config',
      'admin-data-mapping-config',
      'admin-scene-config',
      'operator-task-module',
    ].forEach((id) => {
      const section = sectionHtml(html, id);
      assert.doesNotMatch(section, /スクリーンショット差し替え位置|差し替え例/);
    });

    assert.match(html, /assets\/operator-upload-main-marked\.png/);
    assert.match(html, /assets\/operator-upload-preview\.png/);
    assert.match(html, /assets\/case-list-overview-marked\.png/);
    assert.match(html, /assets\/case-list-case-header\.png/);
    assert.match(html, /assets\/case-list-expanded-files\.png/);
    assert.match(html, /assets\/case-list-file-detail-marked\.png/);
    assert.match(html, /assets\/case-list-workflow\.png/);
    assert.match(html, /assets\/case-list-workflow-nodes\.png/);
    assert.match(html, /assets\/case-list-assign-modal\.png/);
    assert.match(html, /assets\/case-list-change-modal\.png/);
    assert.match(html, /assets\/case-list-stop-modal\.png/);
    assert.match(html, /assets\/case-list-unaggregated\.png/);
    assert.doesNotMatch(html, /data-shot="operator-case-module"|data-shot="operator-upload-module"/);
    assert.match(css, /\.screenshot-placeholder/);
    assert.match(css, /\.shot-frame/);
  });

  it('shows clean localized model-setting screenshots without overlay callouts', async () => {
    const html = await readManual('index.html');
    const css = await readManual('common.css');
    const model = sectionHtml(html, 'admin-model-config');

    [
      'assets/model-api-add-flow.png',
      'assets/model-provider-select-flow.png',
      'assets/model-usage-assignment-marked.png',
      'API 接続',
      '接続を追加',
      'プロバイダ',
      '用途割当',
      'カスタム（OpenAI 互換）',
      'data-lightbox="manual-shots"',
    ].forEach((label) => assertIncludes(model, label));

    for (const asset of [
      'assets/model-api-add-flow.png',
      'assets/model-provider-select-flow.png',
      'assets/model-usage-assignment-marked.png',
    ]) {
      assert.equal(await exists(asset), true, `${asset} should exist`);
    }

    assert.equal(await exists('assets/model-api-registration-annotated.png'), false);
    assert.equal(await exists('assets/model-usage-assignment-annotated.png'), false);
    assert.equal([...model.matchAll(/class="screenshot-figure/g)].length, 3);
    assert.equal([...model.matchAll(/class="step-code">1</g)].length, 1);
    assert.equal([...model.matchAll(/class="step-code">2</g)].length, 1);
    assert.equal([...model.matchAll(/class="step-code">3</g)].length, 1);
    assert.doesNotMatch(model, /model-api-registration-annotated|model-usage-assignment-annotated/);
    assert.match(model, /class="operation-step"/);
    assert.match(model, /class="figure-row"/);
    assert.doesNotMatch(model, /target="_blank"/);
    assert.doesNotMatch(model, /1-1-1|1-1-2|1-1-3|赤枠|モデル接続に必要な接続情報と保存ボタン/);
    assert.doesNotMatch(model, /class="annotated-shot"|class="callout-box"|class="callout-pin|class="callout-outline"|class="figure-notes"|class="note-number"/);
    assert.doesNotMatch(model, /截图占位|替换为真实截图|スクリーンショット差し替え位置|差し替え例|図中のポイント/);
    assert.match(css, /\.screenshot-figure/);
    assert.match(css, /\.operation-step/);
    assert.match(css, /\.step-code/);
    assert.doesNotMatch(css, /\.annotated-shot|\.callout-stage|\.callout-box|\.callout-pin|\.callout-outline/);
  });

  it('opens screenshots in an in-page lightbox with close and multi-image controls', async () => {
    const html = await readManual('index.html');
    const css = await readManual('common.css');

    assert.match(html, /id="manualLightbox"/);
    assert.match(html, /id="lightboxImage"/);
    assert.match(html, /id="lightboxCaption"/);
    assert.match(html, /class="lightbox-close"/);
    assert.match(html, /class="lightbox-nav lightbox-prev"/);
    assert.match(html, /class="lightbox-nav lightbox-next"/);
    assert.match(html, /class="lightbox-toolbar"/);
    assert.match(html, /class="lightbox-zoom-in"/);
    assert.match(html, /class="lightbox-zoom-out"/);
    assert.match(html, /class="lightbox-zoom-reset"/);
    assert.match(html, /data-lightbox-close/);
    assert.match(html, /ArrowLeft/);
    assert.match(html, /ArrowRight/);
    assert.match(html, /Escape/);
    assert.match(html, /scale = Math\.min\(scale \+ 0\.25, 3\)/);
    assert.doesNotMatch(html, /target="_blank"/);

    assert.match(css, /\.lightbox/);
    assert.match(css, /\.lightbox\.is-open/);
    assert.match(css, /\.lightbox-figure img/);
    assert.match(css, /\.lightbox-toolbar/);
    assert.match(css, /body\.lightbox-open/);
  });

  it('renders the system overview diagram as a real flowchart', async () => {
    const html = await readManual('index.html');
    const css = await readManual('common.css');
    const overview = sectionHtml(html, 'overview-system');

    assert.match(overview, /class="process-flow overview-flow"/);
    assert.match(overview, /class="flow-row primary-flow"/);
    assert.match(overview, /class="flow-row config-flow"/);
    assert.match(overview, /class="flow-arrow"/);
    assert.match(overview, /admin 設定/);
    [
      'モデル設定',
      'API設定',
      '帳票タイプ設定',
      'マスターデータ設定',
      'データマッピング設定',
      'AI検証設定',
      '業務シーン設定',
    ].forEach((label) => assert.match(overview, new RegExp(label)));
    assert.match(overview, /業務操作/);
    assert.match(overview, /マイタスク/);

    assert.match(css, /\.process-flow/);
    assert.match(css, /\.flow-node/);
    assert.match(css, /\.flow-arrow/);
  });

  it('uses the SmartOCR reference palette without product-visible SmartOCR wording', async () => {
    const html = await readManual('index.html');
    const css = await readManual('common.css');

    [
      '--blue: #3598db',
      '--blue-dark: #00838f',
      '--blue-line: #46accb',
      '--blue-soft: #dfedf4',
      '--blue-pale: #f7fbff',
      '--smartocr-green: #4ebcab',
      '--toc-blue: #47accb',
      '--toc-fold: #2f7388',
      '--line: #d2d7e0',
      '--control-line: #bfbfbf',
    ].forEach((token) => assert.match(css, new RegExp(token)));

    assert.doesNotMatch(html, /SmartOCR/);
    [
      '#357af2',
      '#175cd3',
      '#84caff',
      '#eff4ff',
      '#eff8ff',
      'rgba\\(23, 92, 211',
      'rgba\\(53, 122, 242',
    ].forEach((testEnvironmentColor) => assert.doesNotMatch(css, new RegExp(testEnvironmentColor, 'i')));
  });
});
