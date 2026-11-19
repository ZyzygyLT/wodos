import type { AttributeDefinition } from '../../core/attributes/attribute'

/** Minimal structural shape of Prisma AttributeDefinition; keeps Prisma out of the engine. */
export interface PersistedAttributeDefinition {
  readonly name: string
  readonly abbreviation: string
  readonly minValue: number
  readonly maxValue: number
  readonly archivedAt: Date | string | null
}

export interface AttributeAdapterOptions {
  /** Wodos currently has no persisted default value; minValue is the compatibility default. */
  readonly defaultValue?: (attribute: PersistedAttributeDefinition) => number
}

export function toEngineAttributeDefinition(
  attribute: PersistedAttributeDefinition,
  options: AttributeAdapterOptions = {}
): AttributeDefinition {
  return {
    key: attribute.abbreviation,
    label: attribute.name,
    min: attribute.minValue,
    max: attribute.maxValue,
    defaultValue: options.defaultValue?.(attribute) ?? attribute.minValue,
    integer: true,
  }
}

export function toActiveEngineAttributes(
  attributes: readonly PersistedAttributeDefinition[],
  options: AttributeAdapterOptions = {}
): AttributeDefinition[] {
  return attributes
    .filter(attribute => attribute.archivedAt === null)
    .map(attribute => toEngineAttributeDefinition(attribute, options))
}
