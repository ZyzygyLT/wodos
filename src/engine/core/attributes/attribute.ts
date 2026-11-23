export interface AttributeDefinition {
  readonly key: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly defaultValue: number
  readonly integer?: boolean
}

export type AttributeValues = Readonly<Record<string, number>>

export interface AttributeValidationIssue {
  readonly key: string
  readonly code: 'unknown' | 'not_number' | 'not_integer' | 'below_min' | 'above_max'
  readonly message: string
}

/** Validates values against a game-specific attribute catalogue without assuming fixed keys. */
export function validateAttributes(
  values: AttributeValues,
  definitions: readonly AttributeDefinition[],
  options: { allowUnknown?: boolean } = {}
): AttributeValidationIssue[] {
  const byKey = new Map(definitions.map(definition => [definition.key, definition]))
  const issues: AttributeValidationIssue[] = []

  for (const [key, value] of Object.entries(values)) {
    const definition = byKey.get(key)
    if (!definition) {
      if (!options.allowUnknown) issues.push({ key, code: 'unknown', message: `Unknown attribute: ${key}` })
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ key, code: 'not_number', message: `${key} must be a finite number` })
      continue
    }
    if (definition.integer && !Number.isInteger(value)) {
      issues.push({ key, code: 'not_integer', message: `${key} must be an integer` })
      continue
    }
    if (value < definition.min) issues.push({ key, code: 'below_min', message: `${key} must be at least ${definition.min}` })
    if (value > definition.max) issues.push({ key, code: 'above_max', message: `${key} must be at most ${definition.max}` })
  }
  return issues
}

export function getAttributeValue(
  values: AttributeValues,
  definition: AttributeDefinition
): number {
  return values[definition.key] ?? definition.defaultValue
}
