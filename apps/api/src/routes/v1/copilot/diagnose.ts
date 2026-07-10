import Anthropic from '@anthropic-ai/sdk';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { copilotStore } from '../../../modules/ai-copilot/copilot-store.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const DIAGNOSE_SYSTEM = `You are Atlas Copilot's diagnostic engine for the Atlas Connect integration platform.
When given a natural language question about platform issues, respond with a structured JSON object.

Always respond with valid JSON matching this schema:
{
  "diagnosis": "string — summary of what is wrong",
  "rootCause": "string — most likely root cause",
  "severity": "low | medium | high | critical",
  "suggestions": [
    { "step": 1, "action": "string", "description": "string", "command": "optional CLI command" }
  ],
  "relatedResources": ["optional list of affected resource IDs or names"]
}`;

interface DiagnoseRequest {
  question: string;
  context?: {
    workflowId?: string;
    connectorId?: string;
    agentId?: string;
    executionId?: string;
  };
}

interface DiagnosisResult {
  diagnosis: string;
  rootCause?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestions: Array<{ step: number; action: string; description: string; command?: string }>;
  relatedResources?: string[];
}

function demoDiagnosis(question: string): DiagnosisResult {
  const q = question.toLowerCase();

  if (q.includes('heartbeat') || q.includes('agent') || q.includes('offline')) {
    return {
      diagnosis: 'Two edge agents are not sending heartbeats to the Atlas Hub.',
      rootCause: 'Network connectivity issue between agent host and Atlas Hub API.',
      severity: 'high',
      suggestions: [
        {
          step: 1,
          action: 'Check agent process',
          description: 'Verify the agent process is running on the host machine.',
          command: 'atlas agent status edge-01',
        },
        {
          step: 2,
          action: 'Test connectivity',
          description: 'Test network connection from agent host to Atlas Hub.',
          command: 'curl -s https://atlas-hub/health',
        },
        {
          step: 3,
          action: 'Restart agent',
          description: 'If the process is stopped, restart it.',
          command: 'atlas agent restart edge-01',
        },
        {
          step: 4,
          action: 'Check firewall',
          description: 'Verify firewall rules allow outbound HTTPS on port 443.',
        },
      ],
      relatedResources: ['agent-edge-01', 'agent-edge-03'],
    };
  }

  if (q.includes('sync') || q.includes('fail') || q.includes('falhou') || q.includes('erro')) {
    return {
      diagnosis:
        'ERP synchronization workflow is failing at the HTTP step with connection timeout.',
      rootCause:
        'ERP endpoint overloaded during peak hours — batch size of 500 records causes 30s+ response times.',
      severity: 'high',
      suggestions: [
        {
          step: 1,
          action: 'Reduce batch size',
          description: 'Change batchSize from 500 to 100 in the HTTP node config.',
        },
        {
          step: 2,
          action: 'Increase timeout',
          description: 'Set timeoutMs to 60000 (60s) in the HTTP node config.',
        },
        {
          step: 3,
          action: 'Enable retry',
          description:
            'Set retryOn: ["timeout", "5xx"], maxRetries: 3, retryStrategy: "exponential".',
        },
        {
          step: 4,
          action: 'Monitor execution',
          description: 'Trigger a manual test run and watch the execution log.',
          command: 'atlas workflow trigger wf-erp-product-sync',
        },
      ],
      relatedResources: ['wf-erp-product-sync', 'conn-erp-prod'],
    };
  }

  if (q.includes('sla') || q.includes('breach') || q.includes('violação')) {
    return {
      diagnosis:
        'ERP Product Sync is breaching its 10-second SLA with average duration of 35 seconds.',
      rootCause:
        'Batch processing overhead combined with ERP server latency under business-hour load.',
      severity: 'critical',
      suggestions: [
        {
          step: 1,
          action: 'Reduce batch size',
          description: 'Process 100 records per batch instead of 500.',
        },
        {
          step: 2,
          action: 'Schedule off-peak',
          description: 'Move full-sync to 02:00 AM when ERP load is lower.',
        },
        {
          step: 3,
          action: 'Enable incremental',
          description: 'Use delta sync (only changed records) for frequent syncs.',
        },
        {
          step: 4,
          action: 'Update SLA threshold',
          description:
            'If 10s is unrealistic, update the SLA definition to 30s and set 20s as warning threshold.',
        },
      ],
      relatedResources: ['sla-erp-product-sync', 'wf-erp-product-sync'],
    };
  }

  return {
    diagnosis: 'I found no active critical issues in the current platform context.',
    rootCause: 'Platform appears to be operating within normal parameters.',
    severity: 'low',
    suggestions: [
      {
        step: 1,
        action: 'Review Observatory',
        description: 'Check the Observatory dashboard for any warnings or degraded metrics.',
      },
      {
        step: 2,
        action: 'Verify agent health',
        description: 'Confirm all edge agents have recent heartbeats.',
      },
      {
        step: 3,
        action: 'Check alert rules',
        description: 'Review active alert rules to ensure coverage for key scenarios.',
      },
    ],
  };
}

export async function diagnose(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { question, context } = ctx.body as DiagnoseRequest;

  if (!question || typeof question !== 'string' || !question.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'question is required' }));
    return;
  }

  const t0 = Date.now();
  let result: DiagnosisResult;
  let modelUsed = 'demo';

  if (anthropic) {
    const contextStr = context ? JSON.stringify(context) : 'none';
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: DIAGNOSE_SYSTEM,
        messages: [{ role: 'user', content: `Question: ${question}\nContext: ${contextStr}` }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? (JSON.parse(jsonMatch[0]) as DiagnosisResult) : demoDiagnosis(question);
      modelUsed = 'claude-opus-4-8';
    } catch {
      result = demoDiagnosis(question);
    }
  } else {
    result = demoDiagnosis(question);
  }

  copilotStore.addAuditLog({
    action: 'diagnose',
    prompt: question.trim().slice(0, 200),
    responsePreview: result.diagnosis.slice(0, 120),
    context: context ?? {},
    modelUsed,
    durationMs: Date.now() - t0,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...result, model: modelUsed }));
}
