import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('initializes the workflow canvas with only the fixed start node', async () => {
  const sceneConfig = await readFile(new URL('../scripts/scene-config.js', import.meta.url), 'utf8');
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
