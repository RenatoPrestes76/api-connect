import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { buildSystemPrompt, parsePlanFromText, demoPlan } from '@seltriva/workflow-builder';

let Anthropic: typeof import('@anthropic-ai/sdk').default | null = null;
let anthropic: InstanceType<typeof import('@anthropic-ai/sdk').default> | null = null;
try {
  if (process.env.ANTHROPIC_API_KEY) {
    const mod = await import('@anthropic-ai/sdk');
    Anthropic = mod.default;
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} catch {
  /* no sdk */
}

export async function planWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { prompt?: string; context?: string } | undefined;
  if (!body?.prompt?.trim()) {
    apiError(res, 'prompt is required', 400, 'VALIDATION_ERROR');
    return;
  }

  const { prompt, context } = body;
  const userMessage = context ? `${prompt}\n\nContexto adicional: ${context}` : prompt;

  let plan;
  if (anthropic) {
    try {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: userMessage }],
      });
      const final = await stream.finalMessage();
      const text = final.content
        .filter(
          (b): b is import('@anthropic-ai/sdk').default.Messages.TextBlock => b.type === 'text'
        )
        .map((b) => b.text)
        .join('');
      plan = parsePlanFromText(text) ?? demoPlan(prompt);
    } catch {
      plan = demoPlan(prompt);
    }
  } else {
    plan = demoPlan(prompt);
  }

  json(res, { plan, model: anthropic ? 'claude-opus-4-8' : 'demo' });
}
