export function allocateDeposit(amount: number, rules: {id: number; percent: number}[]) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || rules.some(r => !Number.isInteger(r.percent) || r.percent < 0 || r.percent > 100) || rules.reduce((s,r) => s+r.percent,0) > 100) throw new Error("Invalid allocation");
  const allocations = rules.map(r => ({id:r.id, amount:Math.floor(amount*r.percent/100)}));
  return {allocations, spendable:amount-allocations.reduce((sum,r)=>sum+r.amount,0)};
}
