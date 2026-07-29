import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAggregateRulePrompt,
  callGlmAggregateRules,
  normalizeAggregateRuleResponse,
} from '../server/aggregate-ai.mjs';

const input = {
  businessScene: '保険金請求',
  mainDocument: {
    docType: '保険金請求書',
    primaryKey: '請求番号',
    fields: ['請求番号', '被保険者氏名'],
  },
  relatedDocuments: [
    { docType: '診断書', fields: ['患者氏名', '生年月日'] },
  ],
  existingRules: [{
    leftDocType: '保険金請求書',
    rightDocType: '診断書',
    group: { relations: [{ leftField: '被保険者氏名', rightField: '患者氏名' }] },
  }],
};

test('builds prompt with current scene documents and output schema', () => {
  const prompt = buildAggregateRulePrompt(input);

  assert.match(prompt, /<business_scene>\s*保険金請求\s*<\/business_scene>/);
  assert.match(prompt, /"primaryKey": "請求番号"/);
  assert.match(prompt, /"docType": "診断書"/);
  assert.match(prompt, /<existing_rules>[\s\S]*"leftField": "被保険者氏名"[\s\S]*<\/existing_rules>/);
  assert.match(prompt, /"rules"/);
});

test('requests both main-related and related-related rule forms', () => {
  const prompt = buildAggregateRulePrompt(input);

  assert.match(prompt, /生成以下两种形式的关联关系：主账票与关联账票之间、关联账票与关联账票之间/);
  assert.match(prompt, /允许同一账票与1张以上的账票关联/);
  assert.match(prompt, /同一业务对象的同一属性/);
  assert.doesNotMatch(prompt, /主账票配置的主键/);
  assert.match(prompt, /JSON 返回示例/);
  assert.match(prompt, /"leftDocType": "左帳票名"/);
  assert.doesNotMatch(prompt, /"warnings"/);
  assert.match(prompt, /多个可对应字段/);
  assert.doesNotMatch(prompt, /区分度较高/);
  assert.doesNotMatch(prompt, /不设账票对优先级/);
  assert.doesNotMatch(prompt, /优先关联主账票与关联账票/);
  assert.doesNotMatch(prompt, /姓名字段/);
  assert.doesNotMatch(prompt, /"reason"/);
});

test('normalizes one generated group into workflow relations', () => {
  const response = {
    rules: [{
      leftDocType: '保険金請求書',
      rightDocType: '診断書',
      group: {
        relations: [{ leftField: '被保険者氏名', rightField: '患者氏名' }],
      },
    }],
  };

  const relations = normalizeAggregateRuleResponse(response, input);

  assert.equal(relations.length, 1);
  assert.equal(relations[0].sourceDocType, '保険金請求書');
  assert.equal(relations[0].targetDocType, '診断書');
  assert.equal(relations[0].sourceField, '被保険者氏名');
  assert.equal(relations[0].targetField, '患者氏名');
  assert.equal('reason' in relations[0], false);
  assert.match(relations[0].conditionGroupId, /^group-ai-/);
});

test('rejects fields that are not in the current document schema', () => {
  const response = {
    rules: [{
      leftDocType: '保険金請求書',
      rightDocType: '診断書',
      group: {
        relations: [{ leftField: '存在しない項目', rightField: '患者氏名' }],
      },
    }],
  };

  assert.throws(
    () => normalizeAggregateRuleResponse(response, input),
    /入力に存在しないフィールド/,
  );
});

test('disables model thinking for rule generation', async () => {
  let requestBody;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              rules: [{
                leftDocType: '保険金請求書',
                rightDocType: '診断書',
                group: {
                  relations: [{ leftField: '被保険者氏名', rightField: '患者氏名' }],
                },
              }],
            }),
          },
        }],
      }),
    };
  };

  try {
    await callGlmAggregateRules(input, { apiKey: 'test-key' });
    assert.deepEqual(requestBody.thinking, { type: 'disabled' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
