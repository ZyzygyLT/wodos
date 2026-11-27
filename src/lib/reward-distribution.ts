export function splitIntegerReward(total: number, recipientCount: number): number[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError('Reward total must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(recipientCount) || recipientCount < 1) {
    throw new RangeError('Recipient count must be a positive safe integer')
  }

  const baseShare = Math.floor(total / recipientCount)
  const remainder = total % recipientCount
  return Array.from({ length: recipientCount }, (_, index) =>
    baseShare + (index < remainder ? 1 : 0)
  )
}

