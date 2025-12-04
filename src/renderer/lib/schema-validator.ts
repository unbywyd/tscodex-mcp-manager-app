/**
 * Client-side JSON Schema validation
 */

export interface ValidationError {
  path: string[];
  message: string;
  keyword: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface SchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  format?: string;

  // String validation
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number validation
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Array validation
  items?: SchemaProperty;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Object validation
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | SchemaProperty;
  minProperties?: number;
  maxProperties?: number;
}

/**
 * Validate a value against a JSON Schema
 */
export function validateSchema(
  value: unknown,
  schema: SchemaProperty,
  path: string[] = []
): ValidationResult {
  const errors: ValidationError[] = [];

  // Type validation
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = getType(value);

    // Allow null if 'null' is in types
    if (value === null && !types.includes('null')) {
      errors.push({
        path,
        message: `Expected ${types.join(' or ')}, got null`,
        keyword: 'type',
      });
    } else if (value !== null && !types.includes(actualType)) {
      // Special case: integer is also a valid number
      const isIntegerValidForNumber = actualType === 'integer' && types.includes('number');
      // Special case: number that is integer is valid for integer type
      const isNumberValidForInteger = actualType === 'number' && types.includes('integer') && Number.isInteger(value as number);

      if (!isIntegerValidForNumber && !isNumberValidForInteger) {
        errors.push({
          path,
          message: `Expected ${types.join(' or ')}, got ${actualType}`,
          keyword: 'type',
        });
      }
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({
      path,
      message: `Value must be one of: ${schema.enum.map(String).join(', ')}`,
      keyword: 'enum',
    });
  }

  // Const validation
  if (schema.const !== undefined && value !== schema.const) {
    errors.push({
      path,
      message: `Value must be ${JSON.stringify(schema.const)}`,
      keyword: 'const',
    });
  }

  // String validation
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `Minimum length is ${schema.minLength} characters`,
        keyword: 'minLength',
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `Maximum length is ${schema.maxLength} characters`,
        keyword: 'maxLength',
      });
    }

    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `Value does not match pattern: ${schema.pattern}`,
          keyword: 'pattern',
        });
      }
    }

    // Format validation
    if (schema.format) {
      const formatError = validateFormat(value, schema.format);
      if (formatError) {
        errors.push({
          path,
          message: formatError,
          keyword: 'format',
        });
      }
    }
  }

  // Number validation
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Minimum value is ${schema.minimum}`,
        keyword: 'minimum',
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Maximum value is ${schema.maximum}`,
        keyword: 'maximum',
      });
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push({
        path,
        message: `Value must be greater than ${schema.exclusiveMinimum}`,
        keyword: 'exclusiveMinimum',
      });
    }

    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push({
        path,
        message: `Value must be less than ${schema.exclusiveMaximum}`,
        keyword: 'exclusiveMaximum',
      });
    }

    if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
      errors.push({
        path,
        message: `Value must be a multiple of ${schema.multipleOf}`,
        keyword: 'multipleOf',
      });
    }
  }

  // Array validation
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path,
        message: `Minimum ${schema.minItems} items required`,
        keyword: 'minItems',
      });
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `Maximum ${schema.maxItems} items allowed`,
        keyword: 'maxItems',
      });
    }

    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) {
      errors.push({
        path,
        message: 'Array items must be unique',
        keyword: 'uniqueItems',
      });
    }

    // Validate each item
    if (schema.items) {
      value.forEach((item, index) => {
        const itemResult = validateSchema(item, schema.items!, [...path, String(index)]);
        errors.push(...itemResult.errors);
      });
    }
  }

  // Object validation
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push({
        path,
        message: `Minimum ${schema.minProperties} properties required`,
        keyword: 'minProperties',
      });
    }

    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      errors.push({
        path,
        message: `Maximum ${schema.maxProperties} properties allowed`,
        keyword: 'maxProperties',
      });
    }

    // Required properties
    if (schema.required) {
      for (const requiredKey of schema.required) {
        const propValue = obj[requiredKey];
        // Only show required error if:
        // - Property is missing entirely
        // - Property is undefined
        // - Property is an empty string (for string types)
        const isMissing = !(requiredKey in obj) || propValue === undefined;
        const isEmptyString = typeof propValue === 'string' && propValue === '';

        if (isMissing || isEmptyString) {
          errors.push({
            path: [...path, requiredKey],
            message: 'This field is required',
            keyword: 'required',
          });
        }
      }
    }

    // Validate each property
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propResult = validateSchema(obj[key], propSchema, [...path, key]);
          errors.push(...propResult.errors);
        }
      }
    }

    // Additional properties
    if (schema.additionalProperties === false) {
      const allowedKeys = Object.keys(schema.properties || {});
      for (const key of keys) {
        if (!allowedKeys.includes(key)) {
          errors.push({
            path: [...path, key],
            message: 'Additional properties are not allowed',
            keyword: 'additionalProperties',
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the JSON Schema type of a value
 */
function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

/**
 * Validate string format
 */
function validateFormat(value: string, format: string): string | null {
  switch (format) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Invalid email format';
      }
      break;
    }

    case 'uri':
    case 'url': {
      try {
        new URL(value);
      } catch {
        return 'Invalid URL format';
      }
      break;
    }

    case 'date': {
      const date = new Date(value);
      if (isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return 'Invalid date format (YYYY-MM-DD)';
      }
      break;
    }

    case 'time': {
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
        return 'Invalid time format (HH:MM or HH:MM:SS)';
      }
      break;
    }

    case 'date-time': {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return 'Invalid date-time format (ISO 8601)';
      }
      break;
    }

    case 'ipv4': {
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Regex.test(value)) {
        return 'Invalid IPv4 address';
      }
      const parts = value.split('.').map(Number);
      if (parts.some(p => p > 255)) {
        return 'Invalid IPv4 address';
      }
      break;
    }

    case 'ipv6': {
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      if (!ipv6Regex.test(value)) {
        return 'Invalid IPv6 address';
      }
      break;
    }

    case 'uuid': {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        return 'Invalid UUID format';
      }
      break;
    }

    case 'hostname': {
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!hostnameRegex.test(value)) {
        return 'Invalid hostname';
      }
      break;
    }

    // Custom formats for editors
    case 'html':
    case 'markdown':
    case 'code':
    case 'json':
    case 'javascript':
    case 'typescript':
      // These are valid formats for editor selection, no validation needed
      break;
  }

  return null;
}

/**
 * Get validation errors for a specific path
 */
export function getErrorsForPath(
  errors: ValidationError[],
  path: string[]
): ValidationError[] {
  const pathStr = path.join('.');
  return errors.filter(e => e.path.join('.') === pathStr);
}

/**
 * Check if a path has errors
 */
export function hasErrorAtPath(errors: ValidationError[], path: string[]): boolean {
  return getErrorsForPath(errors, path).length > 0;
}
