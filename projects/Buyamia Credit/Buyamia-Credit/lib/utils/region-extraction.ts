/**
 * Region Extraction Utilities
 * 
 * Extracts region/city from buyer address or other location data
 */

/**
 * Extract region/city from address string
 * Tries to match common Indonesian city names
 */
export function extractRegionFromAddress(address: string): string | null {
  if (!address) return null

  const addressLower = address.toLowerCase()
  
  // Common Indonesian cities/regions
  const regions = [
    'jakarta',
    'bandung',
    'surabaya',
    'yogyakarta',
    'tangerang',
    'bali',
    'denpasar',
    'medan',
    'semarang',
    'makassar',
    'palembang',
    'batam',
    'pekanbaru',
    'padang',
    'malang',
    'bogor',
    'depok',
    'bekasi',
    'cirebon',
    'tasikmalaya',
  ]

  // Check if address contains any region name
  for (const region of regions) {
    if (addressLower.includes(region)) {
      // Capitalize first letter
      return region.charAt(0).toUpperCase() + region.slice(1)
    }
  }

  // If no match, try to extract from common patterns
  // Pattern: "Jl. ..., Jakarta" or "Jakarta, ..."
  const patterns = [
    /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/, // After comma
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,?\s*$/i, // At end
  ]

  for (const pattern of patterns) {
    const match = address.match(pattern)
    if (match && match[1]) {
      const potentialRegion = match[1].trim()
      // Check if it's a known region
      if (regions.includes(potentialRegion.toLowerCase())) {
        return potentialRegion.charAt(0).toUpperCase() + potentialRegion.slice(1).toLowerCase()
      }
    }
  }

  return null
}

/**
 * Extract region from buyer data
 * Priority: address > city field (if exists)
 */
export function extractRegionFromBuyer(buyer: {
  address?: string | null
  city?: string | null
}): string | null {
  // First try city field if available
  if (buyer.city) {
    return buyer.city.trim()
  }

  // Then try to extract from address
  if (buyer.address) {
    return extractRegionFromAddress(buyer.address)
  }

  return null
}

