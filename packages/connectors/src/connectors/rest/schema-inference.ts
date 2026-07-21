/**
 * JSON Schema inference from runtime values.
 * Analyses JSON responses to produce a structural schema with types and examples.
 */

export interface InferredField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';
  nullable: boolean;
  example?: unknown;
  children?: InferredField[];
  arrayItemType?: InferredField;
  format?: 'date' | 'date-time' | 'uri' | 'email' | 'uuid' | 'unknown';
}

export interface InferredSchema {
  type: 'object' | 'array' | 'primitive';
  fields: InferredField[];
  totalRecords?: number;
  sampleSize: number;
}

// ─── Type Detection ──────────────────────────────────────────────────────────

function detectFormat(value: string): InferredField['format'] | undefined {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'date-time';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
  if (/^https?:\/\//.test(value)) return 'uri';
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return 'email';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid';
  return undefined;
}

function inferType(value: unknown): InferredField['type'] {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

function inferField(key: string, values: unknown[]): InferredField {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  const nullable = nonNull.length < values.length;

  if (nonNull.length === 0) {
    return { key, type: 'null', nullable: true };
  }

  // Determine dominant type from samples
  const typeCounts = new Map<InferredField['type'], number>();
  for (const v of nonNull) {
    const t = inferType(v);
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const dominantType = sortedTypes[0]?.[0] ?? 'unknown';
  const example = nonNull[0];

  const field: InferredField = {
    key,
    type: dominantType,
    nullable,
    example,
  };

  if (dominantType === 'string' && typeof example === 'string') {
    const fmt = detectFormat(example);
    if (fmt) field.format = fmt;
  }

  if (dominantType === 'object') {
    const objects = nonNull.filter(
      (v): v is Record<string, unknown> => typeof v === 'object' && !Array.isArray(v) && v !== null
    );
    const allKeys = new Set(objects.flatMap((o) => Object.keys(o)));
    field.children = [...allKeys].map((childKey) =>
      inferField(
        childKey,
        objects.map((o) => o[childKey] ?? null)
      )
    );
  }

  if (dominantType === 'array') {
    const arrays = nonNull.filter(Array.isArray);
    const allItems = arrays.flat();
    if (allItems.length > 0) {
      field.arrayItemType = inferField('item', allItems);
    }
  }

  return field;
}

// ─── Schema Inference ────────────────────────────────────────────────────────

export function inferSchema(data: unknown, sampleSize = 1): InferredSchema {
  if (Array.isArray(data)) {
    const sample = data.slice(0, Math.min(data.length, 50));
    const schema: InferredSchema = {
      type: 'array',
      totalRecords: data.length,
      sampleSize: sample.length,
      fields: [],
    };

    if (sample.length === 0) return schema;

    const firstItem = sample[0];
    if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
      const allKeys = new Set(
        sample
          .filter(
            (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
          )
          .flatMap((item) => Object.keys(item))
      );
      schema.fields = [...allKeys].map((key) =>
        inferField(
          key,
          sample.map(
            (item) =>
              (typeof item === 'object' && item !== null
                ? (item as Record<string, unknown>)[key]
                : null) ?? null
          )
        )
      );
    }

    return schema;
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Check if this is a paginated response wrapping an array
    const arrayField = Object.entries(obj).find(([, v]) => Array.isArray(v));
    if (arrayField) {
      const nestedSchema = inferSchema(arrayField[1], sampleSize);
      return {
        ...nestedSchema,
        fields: nestedSchema.fields,
      };
    }

    return {
      type: 'object',
      sampleSize,
      fields: Object.entries(obj).map(([key, value]) => inferField(key, [value])),
    };
  }

  return { type: 'primitive', sampleSize, fields: [] };
}

export function schemaToMarkdown(schema: InferredSchema, name = 'Response'): string {
  const lines: string[] = [
    `## ${name} Schema\n`,
    '| Field | Type | Nullable | Format | Example |',
    '|-------|------|----------|--------|---------|',
  ];

  const renderFields = (fields: InferredField[], prefix = ''): void => {
    for (const f of fields) {
      const fieldName = prefix ? `${prefix}.${f.key}` : f.key;
      const example = f.example !== undefined ? String(f.example).slice(0, 30) : '';
      lines.push(
        `| \`${fieldName}\` | ${f.type} | ${f.nullable ? 'yes' : 'no'} | ${f.format ?? ''} | ${example} |`
      );
      if (f.children) renderFields(f.children, fieldName);
    }
  };

  renderFields(schema.fields);
  return lines.join('\n');
}
