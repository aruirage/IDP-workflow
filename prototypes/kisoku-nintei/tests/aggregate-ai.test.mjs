import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAggregateRulePrompt,
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
};

test('builds prompt with current scene documents and output schema', () => {
  const prompt = buildAggregateRulePrompt(input);

  assert.match(prompt, /<business_scene>\s*保険金請求\s*<\/business_scene>/);
  assert.match(prompt, /"primaryKey": "請求番号"/);
  assert.match(prompt, /"docType": "診断書"/);
  assert.match(prompt, /"rules"/);
});

test('evaluates main-related and related-related document pairs without priority', () => {
  const prompt = buildAggregateRulePrompt(input);

  assert.match(prompt, /主账票与关联账票、关联账票与关联账票可同时评估/);
  assert.doesNotMatch(prompt, /优先关联主账票与关联账票/);
  assert.doesNotMatch(prompt, /姓名字段/);
});

test('normalizes one generated group into workflow relations', () => {
  const response = {
    rules: [{
      leftDocType: '保険金請求書',
      rightDocType: '診断書',
      group: {
        relations: [{ leftField: '被保険者氏名', rightField: '患者氏名' }],
        reason: '同一人物を示す氏名項目',
      },
    }],
  };

  const relations = normalizeAggregateRuleResponse(response, input);

  assert.equal(relations.length, 1);
  assert.equal(relations[0].sourceDocType, '保険金請求書');
  assert.equal(relations[0].targetDocType, '診断書');
  assert.equal(relations[0].sourceField, '被保険者氏名');
  assert.equal(relations[0].targetField, '患者氏名');
  assert.equal(relations[0].reason, '同一人物を示す氏名項目');
  assert.match(relations[0].conditionGroupId, /^group-ai-/);
});

test('rejects fields that are not in the current document schema', () => {
  const response = {
    rules: [{
      leftDocType: '保険金請求書',
      rightDocType: '診断書',
      group: {
        relations: [{ leftField: '存在しない項目', rightField: '患者氏名' }],
        reason: '不正な項目',
      },
    }],
  };

  assert.throws(
    () => normalizeAggregateRuleResponse(response, input),
    /入力に存在しないフィールド/,
  );
});
