import { handleAggregateRuleRequest } from '../../server/aggregate-api.mjs';

export default async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    const result = await handleAggregateRuleRequest(await request.json());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error?.message || 'AI関連ルールの生成に失敗しました' },
      { status: 500 },
    );
  }
};
