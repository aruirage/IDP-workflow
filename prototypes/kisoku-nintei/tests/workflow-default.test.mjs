import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('initializes the workflow canvas with only the fixed start node', async () => {
  const sceneConfig = await readFile(new URL('../scripts/scene-config.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');

  assert.doesNotMatch(sceneConfig, /case: buildDefaultCaseWorkflow\(\)/);
  assert.equal((sceneConfig.match(/case: buildMinimalCaseWorkflow\(\)/g) || []).length, 2);
  assert.match(main, /initialForm\.workflows\.case = buildDefaultCaseWorkflow\(\)/);
  assert.doesNotMatch(main, /initialForm\.workflows\.case = buildMinimalCaseWorkflow\(\)/);
});

test('keeps new drafts minimal and restores accidentally cleared published workflows', async () => {
  const workflowCore = await readFile(new URL('../scripts/workflow-core.js', import.meta.url), 'utf8');

  assert.match(workflowCore, /if \(isMinimalPlaceholderCaseWorkflow\(workflow\)\) return false;/);
  assert.match(workflowCore, /if \(isDefaultCaseWorkflowTemplate\(workflow\)\) return true;/);
  assert.match(workflowCore, /function shouldRestorePublishedWorkflow\(form\)/);
  assert.match(workflowCore, /form\?\.scene\?\.publishStatus === 'published'/);
  assert.match(workflowCore, /if \(shouldRestorePublishedWorkflow\(form\)\) \{\s*form\.workflows\.case = buildDefaultCaseWorkflow\(\);/s);
  assert.doesNotMatch(workflowCore, /shouldMigrateCaseWorkflowToDefault\(form\.workflows\.case\)\) \{\s*form\.workflows\.case = buildMinimalCaseWorkflow\(\);/s);
});

test('labels the built-in workflow test fixture as mock data', async () => {
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(mockData, /label: 'Mock テストデータ'/);
  assert.match(mockData, /Mock の集約済み案件データ/);
  assert.match(index, />Mock データ</);
  assert.doesNotMatch(index, />ファイル固定</);
});

test('routes workflow backflow curves through compact bottom lanes', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');

  assert.match(main, /const WF_EDGE_ROUTE_GAP = 40;/);
  assert.match(main, /const WF_EDGE_ROUTE_STEP = 24;/);
  assert.match(main, /if \(draft\.isBackflow \|\| draft\.x2 < draft\.x1\) return 'bottom';/);
  assert.match(main, /Math\.min\(72, absDx \* 0\.28\)/);
  assert.match(main, /const sideX = Math\.min\(x1, x2\) - curve;/);
  assert.match(main, /`C \$\{x1 \+ curve\} \$\{y1\}, \$\{x1 \+ curve\} \$\{laneY\}, \$\{x1\} \$\{laneY\}`/);
  assert.match(main, /`C \$\{x1 - curve\} \$\{laneY\}, \$\{sideX\} \$\{laneY\}, \$\{sideX\} \$\{laneY\}`/);
  assert.match(main, /`C \$\{sideX\} \$\{y2\}, \$\{x2 - curve\} \$\{y2\}, \$\{x2\} \$\{y2\}`/);
});

test('uses current document names and a distinct test-input error step', async () => {
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');
  const sampleStart = mockData.indexOf('const WORKFLOW_TEST_SAMPLES =');
  const sampleEnd = mockData.indexOf('const WORKFLOW_TEST_START_EVENT_IDS', sampleStart);
  const sampleSource = mockData.slice(sampleStart, sampleEnd);

  assert.match(sampleSource, /name: '保険請求書_p1-2\.pdf'/);
  assert.match(sampleSource, /docType: '保険請求書'/);
  assert.doesNotMatch(sampleSource, /docType: '保険金請求書'/);
  assert.match(mockData, /const errorId = first\?\.nodeId \|\| 'gate';/);
  assert.match(mockData, /'テスト入力チェック'/);
});

test('hides the uncompiled Vue template until mount', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(index, /\[v-cloak\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(index, /<div id="app" v-cloak>/);
});

test('always opens the prototype in Japanese', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');

  assert.match(main, /localStorage\.setItem\('neosai-idp-ui-language', 'ja'\);/);
  assert.match(main, /const uiLanguage = ref\('ja'\);/);
  assert.doesNotMatch(main, /ref\(localStorage\.getItem\('neosai-idp-ui-language'\)/);
});

test('uses a compact required badge for the scene name', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(index, /業務シーン名<span class="field-required">必須<\/span>/);
  assert.doesNotMatch(index, /field-required">（必須）/);
  assert.match(style, /\.field-required\s*\{[^}]*background:\s*#fff1f3;[^}]*color:\s*#e54861;/s);
});

test('shows Japanese output names and focused value tooltips', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const workflowCore = await readFile(new URL('../scripts/workflow-core.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(index, /workflow-output-var-name[\s\S]*item\.displayName[\s\S]*aria-label="取値範囲"[\s\S]*workflow-output-var-type/);
  assert.match(main, /displayName: getWorkflowOutputDisplayName\(item\)/);
  assert.match(main, /item\?\.valueSpec \? `取値範囲：\$\{t\(item\.valueSpec\)\}`/);
  assert.doesNotMatch(main, /`変数名：\$\{name\}`/);
  assert.match(main, /return `\$\{base\}\\n\\n例：\\n\$\{example\}`/);
  assert.match(workflowCore, /id: 'case\.standardFields', label: '標準変数', scope: '案件', type: 'Object'/);
  assert.doesNotMatch(workflowCore, /WORKFLOW_STANDARD_FIELDS_OBJECT_EXAMPLE/);
  assert.match(style, /\.workflow-output-var-item\s*\{[^}]*justify-content:\s*space-between;/s);
  assert.match(style, /\.workflow-output-var-type\s*\{[^}]*margin-left:\s*auto;/s);
});

test('keeps data mapping output limited to status and standard variables', async () => {
  const workflowCore = await readFile(new URL('../scripts/workflow-core.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const dataMappingOutputStart = workflowCore.indexOf('  data_mapping: [');
  const dataMappingOutputEnd = workflowCore.indexOf('  decision: [],', dataMappingOutputStart);
  const dataMappingOutput = workflowCore.slice(dataMappingOutputStart, dataMappingOutputEnd);

  assert.match(dataMappingOutput, /case\.mappingStatus/);
  assert.match(dataMappingOutput, /case\.standardFields/);
  assert.doesNotMatch(dataMappingOutput, /case\.mappingResult/);
  assert.doesNotMatch(main, /value: 'mappingResult'/);
});

test('removes match-result columns from Step4 export tables', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(index, /照合結果（サンプル）/);
  assert.doesNotMatch(index, /class="col-match"/);
  assert.doesNotMatch(index, /row\.matchValue/);
});

test('centers the workflow setup step track independently from actions', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(index, /class="wf-setup-stepper-track"/);
  assert.match(index, /class="wf-setup-stepper-actions"/);
  assert.match(style, /\.wf-setup-stepper\s*\{[^}]*justify-content:\s*center;/s);
  assert.match(style, /\.wf-setup-stepper-actions\s*\{[^}]*position:\s*absolute;[^}]*right:\s*20px;/s);
});

test('excludes custom functions from Step2 configuration checks', async () => {
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');

  assert.doesNotMatch(mockData, /JavaScript を入力してください/);
  assert.doesNotMatch(mockData, /関数入力「\$\{raw\}」が上流から到達できません/);
  assert.match(mockData, /case 'code':\s*return '';/);
});

test('collapses relation preview documents to linked fields with straight lines', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const sceneConfig = await readFile(new URL('../scripts/scene-config.js', import.meta.url), 'utf8');

  assert.match(main, /const sceneSetupNetworkExpandedDocs = reactive\(\{\}\)/);
  assert.match(main, /sceneSetupNetworkExpandedDocs/);
  assert.match(sceneConfig, /const visibleFields = expandedDocs\?\.\[docType\] \? fields : linkedFields/);
  assert.match(sceneConfig, /return `M \$\{x1\} \$\{y1\} L \$\{x2\} \$\{y2\}`/);
  assert.match(sceneConfig, /function buildNetSameColumnEdgePath/);
  assert.match(sceneConfig, /path: buildNetSameColumnEdgePath\(srcNode, tgtNode, srcY, tgtY\)/);
  assert.match(sceneConfig, /isLeftColumn\s*\?\s*Math\.max\(8, Math\.min\(sourceNode\.left, targetNode\.left\) - 24\)/);
  assert.match(sceneConfig, /: Math\.max\(sourceNode\.left \+ sourceNode\.width, targetNode\.left \+ targetNode\.width\) \+ 24/);
  assert.match(sceneConfig, /const sourceX = isLeftColumn \? sourceNode\.left : sourceNode\.left \+ sourceNode\.width/);
  assert.match(index, /@click="toggleSceneSetupNetworkDoc\(node\.docType\)"/);
  assert.match(index, /v-for="field in node\.visibleFields"/);
  assert.match(index, /wf-network-doc-toggle[^>]*is-expanded/);
  assert.doesNotMatch(index, /marker-end="url\(#wf-net-arrow\)"/);
});

test('uses one regular-weight settings shortcut label', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.equal((index.match(/class="inspector-settings-link"/g) || []).length, 3);
  assert.equal((index.match(/>設定ページへ →<\/el-button>/g) || []).length, 3);
  assert.match(style, /\.idp-inspector-body \.inspector-settings-link\.el-button\.is-link\s*\{[^}]*font-weight:\s*400;/s);
});

test('aligns OCR extraction switches to the row end', async () => {
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(style, /\.ocr-extract-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
  assert.match(style, /\.ocr-extract-row__toggle\s*\{[^}]*margin-left:\s*auto;/s);
});

test('does not render forward edges as backflow inside a cycle', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const edgePathsStart = main.indexOf('const workflowEdgePaths = computed');
  const edgePathsEnd = main.indexOf('const wfCanvasStageStyle', edgePathsStart);
  const edgePathsSource = main.slice(edgePathsStart, edgePathsEnd);

  assert.match(edgePathsSource, /const isBackflow = x2 < x1 - 24\s*\|\| edge\.branch === 'request_supplement';/);
  assert.doesNotMatch(edgePathsSource, /isWorkflowBackflowEdge\(getActiveWf\(\), edge\.from, edge\.to\)/);
});

test('keeps both notification insertion targets visible', async () => {
  const styles = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(styles, /\.notify-var-insert-target\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*width:\s*112px;[^}]*flex:\s*0 0 112px;/s);
  assert.match(styles, /\.notify-var-insert-target \.el-radio-button__inner\s*\{[^}]*width:\s*100%;/s);
  assert.equal((index.match(/<el-radio-button value="subject" :label="t\('件名'\)"><\/el-radio-button>/g) || []).length, 3);
  assert.equal((index.match(/<el-radio-button value="body" :label="t\('内容'\)"><\/el-radio-button>/g) || []).length, 3);
  assert.doesNotMatch(index, /<el-radio-button[^>]+\/>/);
});

test('uses type-aware condition value controls', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const workflowCore = await readFile(new URL('../scripts/workflow-core.js', import.meta.url), 'utf8');

  assert.match(index, /v-if="decisionUsesFreeTextValue\(condition\)"/);
  assert.match(index, /v-else-if="decisionUsesValueSelect\(condition\)"/);
  assert.match(index, /v-for="opt in getDecisionValueOptions\(condition\)"/);
  assert.match(main, /return \['string', 'number'\]\.includes\(type\);/);
  assert.match(main, /return type === 'enum';/);
  assert.match(main, /return \{ value, label: value \};/);
  assert.match(workflowCore, /valueSpec: spec\.valueSpec \|\| ''/);
});

test('keeps status outputs but removes them from condition choices', async () => {
  const workflowCore = await readFile(new URL('../scripts/workflow-core.js', import.meta.url), 'utf8');
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');

  assert.match(workflowCore, /case\.preprocessStatus[^\n]*WORKFLOW_OUTPUT_VALUE_SPECS\.nodeStatus/);
  assert.match(workflowCore, /function getDecisionVariableOptions[\s\S]*filter\(\(option\) => !isDecisionStatusVariable\(option\.value\)\)/);
  assert.match(workflowCore, /function buildCodeVariableOptions[\s\S]*buildCodeSourceVariableOptions/);
  assert.match(workflowCore, /if \(isDecisionStatusVariable\(cond\.variable\)\) return;/);
  assert.match(mockData, /typeof buildCodeVariableOptions === 'function'[\s\S]*buildCodeVariableOptions\(wf, node\.id, varSceneCtx\)/);
  assert.match(mockData, /status は条件に使用できません/);
  assert.doesNotMatch(workflowCore, /cond\(`\$\{(?:ppVar|ocrVar|aiVar)\}\.case\.(?:preprocess|ocr|verify)Status`/);
});

test('keeps only rotation, correction, and image alignment preprocessing', async () => {
  const workflowCore = await readFile(new URL('../scripts/workflow-core.js', import.meta.url), 'utf8');
  const sceneConfig = await readFile(new URL('../scripts/scene-config.js', import.meta.url), 'utf8');
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');

  assert.match(workflowCore, /key: 'sort',[\s\S]*label: '画像整列'/);
  assert.doesNotMatch(workflowCore, /画像並び替え/);
  assert.doesNotMatch(workflowCore, /画像分割|画像組合|key: 'split'|key: 'combine'/);
  assert.doesNotMatch(mockData, /splitDocTypes|combineDocTypes/);
  assert.doesNotMatch(sceneConfig, /splitDocTypes|combineDocTypes/);
});

test('shows connected target names in decision branch rows', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');

  assert.match(index, /getDecisionBranchTarget\(node\.id, 'else'\)/);
  assert.match(main, /if \(!edge\) return '未接続';/);
});

test('does not revalidate rules already enforced by configuration controls', async () => {
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');

  assert.doesNotMatch(mockData, /案件中止出口は接続できません/);
  assert.doesNotMatch(mockData, /補件出口は前述ノードへの回流接続のみ可能です/);
  assert.doesNotMatch(mockData, /審査ロールを選択してください/);
  assert.doesNotMatch(mockData, /データマッピングの上流に前処理\/OCR がありません/);
  assert.doesNotMatch(mockData, /AI検証の上流に OCR\/前処理結果がありません/);
});

test('keeps draft and published workflow history separate', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sceneConfig = await readFile(new URL('../scripts/scene-config.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(sceneConfig, /function createPublishedSnapshot\(formData\)/);
  assert.match(sceneConfig, /delete snapshot\.publishedSnapshot;/);
  assert.match(sceneConfig, /delete snapshot\.publishedVersions;/);
  assert.match(sceneConfig, /form\.publishedVersions = \[\{/);
  assert.match(sceneConfig, /form\.publishedVersions = \[form\.publishedVersions\[form\.publishedVersions\.length - 1\]\];/);
  assert.match(main, /const workflowVersionView = ref\('draft'\);/);
  assert.match(main, /const selectedPublishedVersionId = ref\(''\);/);
  assert.match(main, /const latestPublishedVersion = computed/);
  assert.match(main, /form\.publishedVersions = \[publishedVersion\];/);
  assert.match(main, /function switchWorkflowVersionView\(versionId = ''\)/);
  assert.match(main, /const isWorkflowTopologyEditable = computed\(\(\) => workflowVersionView\.value === 'draft'\);/);
  assert.doesNotMatch(main, /showLatestPublishedVersionIfNeeded/);
  assert.match(main, /workflowVersionView\.value = 'published';/);
  assert.match(main, /function switchWorkflowVersionView\(versionId = ''\)[\s\S]*if \(!draftVersionBuffer\)[\s\S]*draftVersionBuffer\.scene\.publishStatus = 'draft';/);
  assert.match(index, /class="wf-version-history-btn" title="バージョン履歴"/);
  assert.match(index, /<el-icon class="wf-version-history-icon"><clock \/><\/el-icon>/);
  assert.match(index, /@element-plus\/icons-vue@2\.3\.1\/dist\/index\.iife\.min\.js/);
  assert.match(main, /app\.component\('Clock', ElementPlusIconsVue\.Clock\);/);
  assert.doesNotMatch(index, /<span>バージョン履歴<\/span>/);
  assert.match(index, />現在の下書き</);
  assert.doesNotMatch(index, /v-for="version in publishedVersionOptions"/);
  assert.match(index, /latestPublishedVersion/);
  assert.match(index, />適用中<\/span>/);
  assert.match(main, /function selectScene\(id, options = \{\}\)[\s\S]*workflowVersionView\.value = 'draft';/);
  assert.match(index, /:class="\{ 'is-applied-view': workflowVersionView === 'published' \}"/);
  assert.doesNotMatch(style, /適用中の設定（閲覧のみ）/);
  assert.match(index, /v-if="workflowVersionView === 'published'" class="wf-toolbar-right"[\s\S]*goToWorkflowSetupStep\(2, \{ readonlyNavigation: true \}\)[\s\S]*次へ/);
  assert.match(index, /goToWorkflowSetupStep\(3, \{ readonlyNavigation: true \}\)/);
  assert.match(index, /goToWorkflowSetupStep\(4, \{ readonlyNavigation: true \}\)/);
  assert.match(main, /if \(workflowVersionView\.value === 'published'\)[\s\S]*workflowSetupStep\.value = step;/);
  assert.match(index, /class="wf-setup-page" :inert="workflowVersionView === 'published'"/);
  assert.match(index, /class="idp-workspace"[\s\S]*:inert="workflowVersionView === 'published'"/);
  assert.match(index, /class="wf-notification-step-page" :inert="workflowVersionView === 'published'"/);
  assert.match(index, /class="wf-export-step-page" :inert="workflowVersionView === 'published'"/);
});

test('records scene publish history only after successful publication', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(index, /<el-dropdown-item command="history">変更履歴<\/el-dropdown-item>/);
  assert.match(index, /title="変更履歴"/);
  assert.match(index, /label="公開者"[\s\S]*label="公開日時"/);
  assert.match(main, /function openScenePublishHistory\(scene\)/);
  assert.match(main, /form\.publishHistory\.push\(\{[\s\S]*publishedBy:[\s\S]*publishedAt:/);
  assert.doesNotMatch(main, /function handleSave\(options = \{\}\)[\s\S]*publishHistory\.push/);
});

test('runs the Step2 configuration check before publishing from Step4', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(index, /class="wf-check-links-btn" @click="openWorkflowTestDialog">テスト/);
  assert.match(index, /<el-button type="primary" @click="publishWorkflowScene">公開<\/el-button>/);
  assert.match(index, /<el-button type="primary" @click="saveOutputConfigFromStep3">保存<\/el-button>/);
  assert.match(main, /function publishWorkflowScene\(\)[\s\S]*scenePublishStatusKey\.value !== 'ready'[\s\S]*checkWorkflowStep2Configuration\(\)[\s\S]*goToWorkflowSetupStep\(2\)[\s\S]*confirmPublishWorkflowScene\(\);/);
  assert.doesNotMatch(main, /function showWorkflowNotPublishableDialog\(\)/);
  assert.doesNotMatch(main, /function publishWorkflowScene\(\)[\s\S]{0,240}openWorkflowTestDialog/);
  assert.match(main, /function confirmPublishWorkflowScene\(\)[\s\S]*form\.scene\.publishStatus = 'published';/);
  assert.match(main, /workflowVersionView\.value = 'published';/);
  assert.match(main, /selectedPublishedVersionId\.value = publishedVersion\.id;/);
});

test('places workflow reset at the end of the canvas history toolbar', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const step2Start = index.indexOf('<template v-else-if="workflowSetupStep === 2">');
  const step2Workspace = index.indexOf('class="idp-workspace"', step2Start);
  const step2Toolbar = index.slice(step2Start, step2Workspace);
  const step2DraftToolbar = step2Toolbar.slice(
    step2Toolbar.indexOf('v-if="workflowVersionView === \'draft\'"'),
    step2Toolbar.indexOf('v-if="workflowVersionView === \'published\'"'),
  );
  const step2PublishedToolbar = step2Toolbar.slice(
    step2Toolbar.indexOf('v-if="workflowVersionView === \'published\'"'),
  );
  const historyToolbar = index.slice(
    index.indexOf('class="wf-canvas-floating-actions wf-canvas-history-actions"'),
    index.indexOf('class="wf-canvas-floating-actions wf-canvas-view-actions"'),
  );

  assert.doesNotMatch(step2Toolbar, /resetWorkflowCanvas/);
  assert.equal((step2DraftToolbar.match(/<el-button/g) || []).length, 4);
  assert.equal((step2PublishedToolbar.match(/<el-button/g) || []).length, 2);
  assert.match(historyToolbar, /title="リセット"[\s\S]*@click="resetWorkflowCanvas"/);
  assert.ok(historyToolbar.lastIndexOf('@click="resetWorkflowCanvas"') > historyToolbar.lastIndexOf('</el-popover>'));
  assert.match(main, /ElementPlus\.ElMessageBox\.confirm\('開始ノード以外のすべてのノードと接続を削除します。続行しますか？'/);
});

test('deletes workflow nodes immediately without a confirmation dialog', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const removeHandler = main.match(/function confirmRemoveSelectedWorkflowNode\(\)[\s\S]*?\n    }\n\n    function onWfKeyDown/)?.[0] || '';

  assert.doesNotMatch(removeHandler, /ElMessageBox\.confirm/);
  assert.match(removeHandler, /開始ノードは削除できません/);
  assert.match(removeHandler, /removeWorkflowNode\(id\)/);
  assert.match(removeHandler, /ノードを削除しました/);
});

test('offers a separate Step2 configuration check without blocking save or navigation', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(mockData, /function collectWorkflowTestDimensionErrors\(workflow, testCase, sceneContext = \{\}, options = \{\}\)/);
  assert.match(mockData, /if \(!options\.skipTestInput/);
  assert.match(main, /function validateWorkflowStaticConfiguration\(options = \{\}\)/);
  assert.match(main, /collectWorkflowTestDimensionErrors\([\s\S]*skipTestInput: true/);
  assert.match(main, /function checkWorkflowStep2Configuration\(\)[\s\S]*handleSave\(\{ silent: true \}\)[\s\S]*validateWorkflowStaticConfiguration\(\)[\s\S]*markWorkflowReadyAfterStaticValidation\(\)/);
  assert.match(main, /function saveWorkflowStep2\(\)/);
  assert.match(main, /function goToWorkflowStep3\(\)/);
  assert.match(index, /@click="goToWorkflowStep3">次へ<\/el-button>/);
  assert.match(index, /@click="saveWorkflowStep2">保存<\/el-button>/);
  assert.match(index, /type="warning"[\s\S]*class="wf-check-links-btn wf-toolbar-check-btn"[\s\S]*@click="checkWorkflowStep2Configuration"[\s\S]*設定チェック/);
  assert.match(main, /設定チェックが完了し、公開可能になりました。/);
  assert.doesNotMatch(main, /設定チェックが完了しました/);
  assert.match(style, /\.wf-toolbar-right\s*\{[^}]*position:\s*relative;/s);
  assert.match(style, /\.wf-toolbar-check-btn\s*\{[^}]*position:\s*absolute;[^}]*right:\s*calc\(100% \+ 8px\);/s);
  const saveStep2Source = main.slice(main.indexOf('function saveWorkflowStep2()'), main.indexOf('function goToWorkflowStep3()'));
  const nextStep2Source = main.slice(main.indexOf('function goToWorkflowStep3()'), main.indexOf('function checkWorkflowStep2Configuration()'));
  assert.doesNotMatch(saveStep2Source, /validateWorkflowStaticConfiguration/);
  assert.doesNotMatch(nextStep2Source, /validateWorkflowStaticConfiguration/);
  const checkStep2Source = main.slice(main.indexOf('function checkWorkflowStep2Configuration()'), main.indexOf('function markWorkflowReadyAfterStaticValidation()'));
  assert.match(checkStep2Source, /if \(!handleSave\(\{ silent: true \}\)\) return false;/);
});

test('requires human-review supplement exits to loop back to a prior node', async () => {
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');

  assert.match(mockData, /補件出口を前述ノードへ回流接続してください/);
  assert.match(mockData, /workflowCanReach\(wf, supplementEdge\.to, node\.id, supplementEdge\)/);
  assert.match(mockData, /normalizeHitlGateActionValue\(edge\.branch\) === 'request_supplement'/);
});

test('separates Step1 draft save from validated navigation', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(index, /@click="proceedToWorkflowStep">次へ<\/el-button>[\s\S]*type="primary" @click="saveSceneSetupStep1">保存<\/el-button>/);
  assert.match(main, /function saveSceneSetupStep1\(\)[\s\S]*persistSceneSetupDraft\(\{ validate: false \}\)[\s\S]*下書きを保存しました/);
  assert.match(main, /function proceedToWorkflowStep\(\)[\s\S]*persistSceneSetupDraft\(\{ validate: true \}\)[\s\S]*workflowSetupStep\.value = 2/);
});

test('disables browser caching for local prototype previews', async () => {
  const server = await readFile(new URL('../server/local-server.mjs', import.meta.url), 'utf8');

  assert.match(server, /'Cache-Control': 'no-store'/);
});

test('labels the AI verification mapping module as standard data consistency', async () => {
  const workflowCore = await readFile(new URL('../scripts/workflow-core.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');

  assert.match(workflowCore, /key: 'mapping_conflict', label: '標準データ整合性'/);
  assert.match(workflowCore, /mapping_conflict: '整合性'/);
  assert.match(main, /key === 'mapping_conflict'\) return count \? `\$\{count\} 件`/);
});

test('explains the publishable status beside every workflow status badge', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.equal((index.match(/Step2の設定チェック完了後、ステータスが「公開可能」に更新され、公開できます。/g) || []).length, 4);
  assert.equal((index.match(/class="wf-publish-help"/g) || []).length, 4);
  assert.match(style, /\.wf-publish-help\s*\{[^}]*cursor:\s*help;/s);
});
