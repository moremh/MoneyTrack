/**
 * Cálculos monetarios de Cobros y pagos.
 * Se opera en centavos para que los recargos no modifiquen la deuda principal
 * ni generen errores de coma flotante en el saldo restante.
 */
export function moneyToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents)) return null;
  if (Math.abs(amount * 100 - cents) > 0.00001) return null;
  return cents;
}

export function calculateDebtPayment(amount, feeAmount, outstandingAmount) {
  const amountCents = moneyToCents(amount);
  const feeCents = moneyToCents(feeAmount);
  const outstandingCents = moneyToCents(outstandingAmount);
  if (amountCents === null || feeCents === null || outstandingCents === null) {
    return { valid: false, reason: 'INVALID_PRECISION' };
  }
  if (amountCents <= 0 || feeCents < 0 || outstandingCents < 0) {
    return { valid: false, reason: 'INVALID_AMOUNT' };
  }
  if (amountCents > outstandingCents) {
    return { valid: false, reason: 'EXCEEDS_BALANCE' };
  }
  const totalCents = amountCents + feeCents;
  if (!Number.isSafeInteger(totalCents)) {
    return { valid: false, reason: 'INVALID_AMOUNT' };
  }
  return {
    valid: true,
    principal: amountCents / 100,
    fee: feeCents / 100,
    total: totalCents / 100,
    outstandingAfter: (outstandingCents - amountCents) / 100,
  };
}


/**
 * El usuario ingresa solamente lo que efectivamente desembolsó/recibió.
 * Cuando paga una cuota, cualquier excedente respecto del saldo pendiente
 * se considera interés de ESA cuota, no anticipo ni capital de otras.
 * En deudas flexibles no se supone automáticamente que el excedente sea interés.
 */
export function calculateDebtPaymentFromTotal(totalPaid, outstandingAmount, isInstallment = true) {
  const paidCents = moneyToCents(totalPaid);
  const outstandingCents = moneyToCents(outstandingAmount);
  if (paidCents === null || outstandingCents === null) {
    return { valid: false, reason: 'INVALID_PRECISION' };
  }
  if (paidCents <= 0 || outstandingCents <= 0) {
    return { valid: false, reason: 'INVALID_AMOUNT' };
  }
  if (!isInstallment && paidCents > outstandingCents) {
    return { valid: false, reason: 'EXCEEDS_BALANCE' };
  }
  const principalCents = Math.min(paidCents, outstandingCents);
  const interestCents = paidCents - principalCents;
  return {
    valid: true,
    principal: principalCents / 100,
    fee: interestCents / 100,
    total: paidCents / 100,
    outstandingAfter: (outstandingCents - principalCents) / 100,
  };
}
