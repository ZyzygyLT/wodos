export interface HeroAttributeValues {
  [abbreviation: string]: number
}

export function validateHeroAttributes(
  values: HeroAttributeValues,
  ranges: Record<string, { min: number; max: number }>
): string[] {
  const errors: string[] = []
  for (const [key, value] of Object.entries(values)) {
    const range = ranges[key]
    if (!range) {
      errors.push(`Unknown attribute: ${key}`)
      continue
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors.push(`${key} must be an integer`)
      continue
    }
    if (value < range.min) errors.push(`${key} value ${value} is below minimum ${range.min}`)
    if (value > range.max) errors.push(`${key} value ${value} exceeds maximum ${range.max}`)
  }
  return errors
}
