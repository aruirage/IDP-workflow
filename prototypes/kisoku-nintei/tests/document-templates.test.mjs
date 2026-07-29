import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadTemplateRegistry() {
  const source = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');
  const start = source.indexOf('const DOC_TYPE_REGISTRY =');
  const end = source.indexOf('const EXTRACT_FIELDS =', start);
  assert.ok(start >= 0 && end > start, 'document template registry declaration is missing');
  const registrySource = source.slice(start, end);
  const context = {};
  const maxDocsMatch = source.match(/const MAX_DOCS = (\d+);/);
  vm.runInNewContext(`${registrySource}\nthis.registry = DOC_TYPE_REGISTRY;`, context);
  context.maxDocs = Number(maxDocsMatch?.[1]);
  return context;
}

test('uses ten initial templates while retaining the twenty-document limit', async () => {
  const { registry, maxDocs } = await loadTemplateRegistry();
  const ids = Array.from(registry, (item) => item.id);

  assert.equal(maxDocs, 20);
  assert.deepEqual(ids, [
    '保険請求書',
    '診断書',
    '診療明細書',
    '調剤明細書',
    '抗がん剤・ホルモン剤治療給付金請求書',
    '事故状況報告書',
    '法定相続人代表者選任書',
    '代理署名・押印念書',
    '印鑑登録証明書',
    '住民票',
  ]);
});

test('uses exported field names in document templates', async () => {
  const { registry } = await loadTemplateRegistry();
  const templates = new Map(Array.from(registry, (item) => [item.id, Array.from(item.fields)]));

  assert.ok(templates.get('保険請求書').includes('請求番号'));
  assert.ok(templates.get('診断書').includes('ICD10コード'));
  assert.ok(templates.get('診療明細書').includes('医療機関名'));
  assert.ok(!templates.get('診療明細書').includes('診療機関名'));
  assert.ok(templates.get('調剤明細書').includes('保険証記号番号'));
  assert.ok(templates.get('代理署名・押印念書').includes('代理者 新郵便番号'));
  assert.ok(templates.get('住民票').includes('住民コード'));
});

test('does not create initial aggregate field relations', async () => {
  const sceneConfig = await readFile(new URL('../scripts/scene-config.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');

  assert.match(sceneConfig, /scene\.docFieldLinks = normalizeDocFieldLinks\(scene\.docFieldLinks, documents\);/);
  assert.doesNotMatch(sceneConfig, /normalized\.length\s*\?[\s\S]*buildDefaultDocFieldLinks/);
  assert.doesNotMatch(main, /if \(!sceneSetupDraft\.docFieldLinks\.length && sceneSetupDraft\.documents\.length >= 2\)/);
  assert.match(sceneConfig, /const AGGREGATE_RULE_DATA_VERSION = 'ten-documents-clean-links-v2';/);
  assert.match(sceneConfig, /scene\.docFieldLinks = \[\];/);
});

test('loads all ten templates as the initial scene documents', async () => {
  const sceneConfig = await readFile(new URL('../scripts/scene-config.js', import.meta.url), 'utf8');
  const mockData = await readFile(new URL('../scripts/mock-data.js', import.meta.url), 'utf8');

  assert.match(mockData, /const INITIAL_SCENE_DOCUMENT_TYPES = DOC_TYPE_REGISTRY\.map/);
  assert.match(sceneConfig, /function ensureInitialSceneDocuments\(documents\)/);
  assert.match(sceneConfig, /INITIAL_SCENE_DOCUMENT_TYPES\.map/);
  assert.equal((sceneConfig.match(/documents = ensureInitialSceneDocuments/g) || []).length, 3);
});
