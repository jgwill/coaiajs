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

export function validate(args: unknown, schema: ValidationSchema): { valid: boolean; error?: string } {
  if (typeof args !== 'object' || args === null) {
    return { valid: false, error: 'Arguments must be an object' };
  }

  const record = args as Record<string, unknown>;

  for (const [key, rule] of Object.entries(schema)) {
    const value = record[key];

    if (rule.required && (value === undefined || value === null)) {
      return { valid: false, error: `Missing required field: ${key}` };
    }

    if (value === undefined || value === null) continue;

    const result = validateValue(value, rule, key);
    if (!result.valid) return result;
  }

  return { valid: true };
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
