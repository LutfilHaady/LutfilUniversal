/**
 * Utility functions for buyer credit assessment
 */

export interface BuyerCreditInfo {
  creditScore: number
  riskLevel?: string
  totalOutstanding?: number
  overdueInvoices?: number
}

/**
 * Determines if a buyer has bad credit based on multiple factors
 */
export function isBadCredit(buyer: BuyerCreditInfo): boolean {
  return (
    buyer.creditScore < 50 ||
    buyer.riskLevel === 'High Risk' ||
    buyer.riskLevel === 'Critical Risk' ||
    (buyer.overdueInvoices && buyer.overdueInvoices > 0)
  )
}

/**
 * Get risk level from credit score
 */
export function getRiskLevel(creditScore: number, overdueInvoices?: number): string {
  if (creditScore < 50 || (overdueInvoices && overdueInvoices > 0)) {
    return 'High Risk'
  }
  if (creditScore < 70) {
    return 'Medium Risk'
  }
  return 'Low Risk'
}

