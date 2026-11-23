export interface AdventureGraphChoice {
  readonly nextStep?: number
  readonly skillCheck?: {
    readonly passStep?: number
    readonly failStep?: number
  }
}

export interface AdventureGraphStep {
  readonly type: string
  readonly choices?: readonly AdventureGraphChoice[]
}

/**
 * Validates the control-flow graph used by seeded adventures.
 * Non-choice steps advance to the following index; choices jump to their targets.
 */
export function getAdventureStepGraphErrors(steps: readonly AdventureGraphStep[]): string[] {
  const errors: string[] = []
  if (steps.length === 0) return ['La aventura no contiene pasos']

  const edges: number[][] = steps.map(() => [])

  steps.forEach((step, index) => {
    if (step.type !== 'choice') {
      if (index < steps.length - 1) edges[index].push(index + 1)
      return
    }

    if (!step.choices?.length) {
      errors.push(`El paso ${index} no contiene opciones`)
      return
    }

    for (const [choiceIndex, choice] of step.choices.entries()) {
      const targets = choice.skillCheck
        ? [choice.skillCheck.passStep, choice.skillCheck.failStep]
        : [choice.nextStep]

      for (const target of targets) {
        if (!Number.isInteger(target) || target === undefined || target < 0 || target >= steps.length) {
          errors.push(`La opción ${choiceIndex} del paso ${index} apunta a un paso inválido: ${String(target)}`)
          continue
        }
        edges[index].push(target)
      }
    }
  })

  const state = new Array<number>(steps.length).fill(0)
  const reportedCycles = new Set<string>()

  function visit(index: number, path: number[]) {
    if (state[index] === 1) {
      const cycleStart = path.indexOf(index)
      const cycle = [...path.slice(cycleStart), index]
      const key = cycle.join('->')
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key)
        errors.push(`Se detectó un ciclo en la ruta: ${key}`)
      }
      return
    }
    if (state[index] === 2) return

    state[index] = 1
    for (const target of edges[index]) visit(target, [...path, index])
    state[index] = 2
  }

  for (let index = 0; index < steps.length; index++) visit(index, [])

  const reachable = new Set<number>()
  const pending = [0]
  while (pending.length > 0) {
    const index = pending.pop()!
    if (reachable.has(index)) continue
    reachable.add(index)
    for (const target of edges[index]) pending.push(target)
  }
  for (let index = 0; index < steps.length; index++) {
    if (!reachable.has(index)) errors.push(`El paso ${index} es inalcanzable desde el inicio`)
  }

  return errors
}
