/**
 * MarkdownExporter — renders a DatabaseIntelligenceReport as Markdown.
 * The Markdown is structured to be convertible to PDF via any standard renderer.
 */
import type { DatabaseIntelligenceReport, EntityClassification, EntityType } from '../types/index.js';

const ENTITY_LABELS: Readonly<Record<EntityType, string>> = {
  PRODUCT:       'Produtos',
  SUPPLIER:      'Fornecedores',
  CATEGORY:      'Categorias',
  PRICE:         'Preços',
  INVENTORY:     'Estoque',
  MOVEMENT:      'Movimentações',
  SALE:          'Vendas',
  PURCHASE:      'Compras',
  CUSTOMER:      'Clientes',
  USER:          'Usuários',
  BRANCH:        'Filiais',
  EXPIRY:        'Validades',
  LOT:           'Lotes',
  PROMOTION:     'Promoções',
  FISCAL:        'Fiscal',
  LOG:           'Logs',
  AUDIT:         'Auditoria',
  PERMISSION:    'Permissões',
  CONFIGURATION: 'Configurações',
  LOOKUP:        'Auxiliares',
  UNKNOWN:       'Não Identificadas',
};

function bar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export class MarkdownExporter {
  export(report: DatabaseIntelligenceReport): string {
    const lines: string[] = [];

    // ─── Header ───────────────────────────────────────────────────────
    lines.push(`# ATHENA DB AI — Relatório de Inteligência de Banco de Dados`);
    lines.push('');
    lines.push(`> **Gerado em:** ${new Date(report.generatedAt).toLocaleString('pt-BR')}`);
    lines.push(`> **Banco:** \`${report.database}\` em \`${report.host}:${report.port}\``);
    lines.push(`> **Tempo de análise:** ${report.durationMs.toLocaleString()} ms`);
    lines.push('');

    // ─── Executive Summary ────────────────────────────────────────────
    lines.push('---');
    lines.push('## Resumo Executivo');
    lines.push('');
    lines.push(`| Métrica | Valor |`);
    lines.push(`|---------|-------|`);
    lines.push(`| Schemas encontrados | **${report.summary.schemasFound}** |`);
    lines.push(`| Tabelas encontradas | **${report.summary.tablesFound}** |`);
    lines.push(`| Colunas mapeadas | **${report.summary.columnsFound}** |`);
    lines.push(`| Entidades identificadas | **${report.summary.entitiesIdentified}** |`);
    lines.push(`| Relacionamentos | **${report.summary.relationshipsFound}** |`);
    lines.push(`| Tabelas auxiliares | ${report.summary.auxiliaryTables} |`);
    lines.push(`| Tabelas junction (N:N) | ${report.summary.junctionTables} |`);
    lines.push(`| Confiança geral | **${report.summary.overallConfidence}%** |`);
    lines.push(`| Riscos críticos | ${report.summary.hasRisks ? '⚠️  Sim' : '✓ Nenhum'} |`);
    lines.push('');

    // ─── Entities ─────────────────────────────────────────────────────
    lines.push('---');
    lines.push('## Entidades Identificadas');
    lines.push('');

    const entityOrder: EntityType[] = [
      'PRODUCT', 'INVENTORY', 'PRICE', 'SUPPLIER', 'CATEGORY', 'CUSTOMER',
      'SALE', 'PURCHASE', 'MOVEMENT', 'BRANCH', 'EXPIRY', 'LOT',
      'USER', 'PROMOTION', 'FISCAL', 'LOG', 'AUDIT', 'PERMISSION',
      'CONFIGURATION', 'LOOKUP', 'UNKNOWN',
    ];

    for (const entityType of entityOrder) {
      const group = report.entities[entityType];
      if (!group || group.length === 0) continue;

      lines.push(`### ${ENTITY_LABELS[entityType]}`);
      lines.push('');
      lines.push(`| Tabela | Schema | Confiança | Linhas Est. | Auxiliar |`);
      lines.push(`|--------|--------|-----------|-------------|----------|`);

      for (const cls of group) {
        const rows = cls.estimatedRows != null ? cls.estimatedRows.toLocaleString() : '—';
        lines.push(
          `| \`${cls.tableName}\` | ${cls.tableSchema} | ${bar(cls.confidence)} **${cls.confidence}%** | ${rows} | ${cls.isAuxiliary ? 'Sim' : 'Não'} |`,
        );
      }

      // Reasons for top table
      const top = group[0];
      if (top && top.confidence >= 60) {
        lines.push('');
        lines.push(`**Por que \`${top.tableName}\` é ${ENTITY_LABELS[entityType]}?**`);
        const topReasons = [...top.reasons]
          .filter((r) => r.weight >= 20)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 5);
        for (const r of topReasons) {
          lines.push(`- ${r.detail} _(peso: ${r.weight})_`);
        }
      }

      lines.push('');
    }

    // ─── Relationships ────────────────────────────────────────────────
    lines.push('---');
    lines.push('## Mapa de Relacionamentos');
    lines.push('');
    lines.push(`| De | Para | Tipo | Cardinalidade | Confiança |`);
    lines.push(`|----|------|------|---------------|-----------|`);

    for (const rel of report.relationships) {
      lines.push(
        `| \`${rel.fromTable}\` | \`${rel.toTable}\` | ${rel.kind} | ${rel.cardinality} | ${rel.confidence}% |`,
      );
    }
    lines.push('');

    // ─── Risks ────────────────────────────────────────────────────────
    if (report.risks.length > 0) {
      lines.push('---');
      lines.push('## ⚠️ Riscos Encontrados');
      lines.push('');

      for (const risk of report.risks) {
        const icon = risk.level === 'HIGH' ? '🔴' : risk.level === 'MEDIUM' ? '🟡' : '🟢';
        lines.push(`### ${icon} [${risk.level}] ${risk.category}`);
        lines.push('');
        lines.push(risk.description);
        if (risk.tables.length > 0) {
          lines.push('');
          lines.push(`**Tabelas afetadas:** ${risk.tables.map((t) => `\`${t}\``).join(', ')}`);
        }
        lines.push('');
        lines.push(`> 💡 **Sugestão:** ${risk.suggestion}`);
        lines.push('');
      }
    }

    // ─── Suggestions ──────────────────────────────────────────────────
    if (report.suggestions.length > 0) {
      lines.push('---');
      lines.push('## 🔗 Sugestões de Integração');
      lines.push('');
      lines.push(`| Prioridade | Entidade | Tabela | Confiança | Campos Mapeados |`);
      lines.push(`|------------|----------|--------|-----------|-----------------|`);

      for (const sug of report.suggestions) {
        const mapped = sug.fieldMapping.size;
        const pLabel = sug.priority === 1 ? '🔴 Alta' : sug.priority === 2 ? '🟡 Média' : '🟢 Baixa';
        const entityCls = Object.values(report.entities).flat()
          .find((c): c is EntityClassification => !!c && `${c.tableSchema}.${c.tableName}` === sug.table);
        const conf = entityCls?.confidence ?? 0;
        lines.push(
          `| ${pLabel} | ${ENTITY_LABELS[sug.entity]} | \`${sug.table}\` | ${conf}% | ${mapped} campos |`,
        );
      }
      lines.push('');
    }

    // ─── Footer ───────────────────────────────────────────────────────
    lines.push('---');
    lines.push('');
    lines.push('_Relatório gerado automaticamente por ATHENA DB AI — Atlas Connect_');
    lines.push('');

    return lines.join('\n');
  }
}
