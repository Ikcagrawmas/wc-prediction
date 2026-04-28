export const ENTRY_FEE = 50
export const HOST_FEE_PCT = 0.10
export const PRIZE_POOL_PCT = 0.90
export const FIRST_PLACE_PCT = 0.65
export const SECOND_PLACE_PCT = 0.25
export const THIRD_PLACE_PCT = 0.10

export function calcPrizePool(paidUsers) {
  const totalPot = paidUsers * ENTRY_FEE
  const hostFee = totalPot * HOST_FEE_PCT
  const prizePool = totalPot * PRIZE_POOL_PCT
  const first = prizePool * FIRST_PLACE_PCT
  const second = prizePool * SECOND_PLACE_PCT
  const third = prizePool * THIRD_PLACE_PCT

  return {
    paidUsers,
    totalPot,
    hostFee,
    prizePool,
    first,
    second,
    third,
  }
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
