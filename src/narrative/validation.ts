// Strict input validation for multi-LLM compatibility (no zod dependency)
type ValidationType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'enum';

interface ValidationRule {
  type: ValidationType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  minValue?: number;
  maxValue?: number;
  enumValues?: (string | number)[];
  items?: ValidationRule;
  properties?: Record<string, ValidationRule>;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /**
   * Argument keys the caller supplied that this schema does not know.
   *
   * They are NOT rejected — an unknown key has never been fatal here and making
   * it so would break existing callers. But it must be *said*: an argument that
   * is silently dropped returns a success for a call that did less than it was
   * asked, and the caller has no way to tell the difference. Handlers surface
   * this alongside their own result.
   */
  ignored?: string[];
}

export function validate(args: unknown, schema: ValidationSchema): ValidationResult {
  if (typeof args !== 'object' || args === null) {
    return { valid: false, error: 'Arguments must be an object' };
  }

  const record = args as Record<string, unknown>;

  // Every problem at once. Returning on the first one costs the caller a whole
  // round trip per missing field, which reads as a broken tool rather than a
  // mis-shaped call — two required fields meant learning the schema in three
  // exchanges instead of one.
  const problems: string[] = [];

  for (const [key, rule] of Object.entries(schema)) {
    const value = record[key];

    if (rule.required && (value === undefined || value === null)) {
      problems.push(`Missing required field: ${key}`);
      continue;
    }

    if (value === undefined || value === null) continue;

    const result = validateValue(value, rule, key);
    if (!result.valid && result.error) problems.push(result.error);
  }

  const ignored = Object.keys(record).filter(k => !(k in schema));

  if (problems.length > 0) {
    const known = Object.keys(schema).join(', ');
    let error = problems.join('; ');
    if (ignored.length > 0) {
      error += `; unrecognised argument(s) ignored: ${ignored.join(', ')} (this tool accepts: ${known})`;
    }
    return { valid: false, error, ignored };
  }

  return ignored.length > 0 ? { valid: true, ignored } : { valid: true };
}

function validateValue(value: unknown, rule: ValidationRule, path: string): { valid: boolean; error?: string } {
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: `${path} must be a string, got ${typeof value}` };
      }
      if (rule.minLength && value.length < rule.minLength) {
        return { valid: false, error: `${path} must be at least ${rule.minLength} characters` };
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return { valid: false, error: `${path} must be at most ${rule.maxLength} characters` };
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return { valid: false, error: `${path} format is invalid` };
      }
      if (rule.enumValues && !rule.enumValues.includes(value)) {
        return { valid: false, error: `${path} must be one of: ${rule.enumValues.join(', ')}` };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: `${path} must be a number` };
      }
      if (rule.minValue !== undefined && value < rule.minValue) {
        return { valid: false, error: `${path} must be at least ${rule.minValue}` };
      }
      if (rule.maxValue !== undefined && value > rule.maxValue) {
        return { valid: false, error: `${path} must be at most ${rule.maxValue}` };
      }
      if (rule.enumValues && !rule.enumValues.includes(value)) {
        return { valid: false, error: `${path} must be one of: ${rule.enumValues.join(', ')}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `${path} must be a boolean` };
      }
      break;

    case 'date':
      if (typeof value !== 'string') {
        return { valid: false, error: `${path} must be an ISO date string` };
      }
      if (isNaN(Date.parse(value))) {
        return { valid: false, error: `${path} must be a valid ISO date string` };
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return { valid: false, error: `${path} must be an array` };
      }
      if (rule.minLength && value.length < rule.minLength) {
        return { valid: false, error: `${path} must have at least ${rule.minLength} items` };
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return { valid: false, error: `${path} must have at most ${rule.maxLength} items` };
      }
      if (rule.items) {
        for (let i = 0; i < value.length; i++) {
          const itemResult = validateValue(value[i], rule.items, `${path}[${i}]`);
          if (!itemResult.valid) return itemResult;
        }
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { valid: false, error: `${path} must be an object` };
      }
      if (rule.properties) {
        const nestedResult = validate(value, rule.properties);
        if (!nestedResult.valid) {
          return { valid: false, error: `${path}: ${nestedResult.error}` };
        }
      }
      break;

    case 'enum':
      if (!rule.enumValues?.includes(value as string | number)) {
        return { valid: false, error: `${path} must be one of: ${rule.enumValues?.join(', ')}` };
      }
      break;
  }

  return { valid: true };
}

// Pre-built schemas for common tool patterns
export const ValidationSchemas = {
  stringArray: (minLength = 0): ValidationRule => ({
    type: 'array',
    required: true,
    minLength,
    items: { type: 'string' },
  }),

  entityArray: (): ValidationRule => ({
    type: 'array',
    required: true,
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', required: true },
        entityType: { type: 'string', required: true },
        observations: { type: 'array', required: true, items: { type: 'string' } },
      },
    },
  }),

  relationArray: (): ValidationRule => ({
    type: 'array',
    required: true,
    items: {
      type: 'object',
      properties: {
        from: { type: 'string', required: true },
        to: { type: 'string', required: true },
        relationType: { type: 'string', required: true },
      },
    },
  }),

  isoDate: (): ValidationRule => ({
    type: 'date',
    required: true,
  }),

  nonEmptyString: (): ValidationRule => ({
    type: 'string',
    required: true,
    minLength: 1,
  }),
};
