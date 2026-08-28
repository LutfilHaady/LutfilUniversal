/**
 * Navigation utilities for Buyamia Credit Platform
 * 
 * Provides website structure knowledge and navigation helpers
 * for the AI assistant to guide users through the platform.
 */

export type UserType = 'BUYER' | 'SUPPLIER'

export interface PageInfo {
  name: string
  description: string
  roles: UserType[]
  features: string[]
  path: string
}

/**
 * Complete website structure map
 * Maps all routes to their metadata
 */
export const WEBSITE_STRUCTURE: Record<string, PageInfo> = {
  '/': {
    name: 'Home',
    description: 'Landing page with registration options and platform overview',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Registration options', 'Platform introduction', 'Login access'],
    path: '/',
  },
  '/login': {
    name: 'Login',
    description: 'User authentication page to access the platform',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['User ID login', 'Phone number verification', 'Session management'],
    path: '/login',
  },
  '/register': {
    name: 'Registration',
    description: 'Create a new account as a buyer or supplier',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Buyer registration', 'Supplier registration', 'Profile setup'],
    path: '/register',
  },
  '/dashboard': {
    name: 'Dashboard',
    description: 'Overview of your credit score, reliability metrics, and recent activity',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Credit score display', 'Reliability metrics', 'Recent invoices', 'Ongoing orders', 'Score history'],
    path: '/dashboard',
  },
  '/invoices': {
    name: 'Invoices',
    description: 'View and manage all your invoices',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Invoice list', 'Create new invoice', 'Filter and search', 'Invoice status tracking'],
    path: '/invoices',
  },
  '/invoices/new': {
    name: 'New Invoice',
    description: 'Create a new invoice',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Invoice creation form', 'Buyer selection', 'Amount and due date', 'Invoice details'],
    path: '/invoices/new',
  },
  '/issues': {
    name: 'Issues',
    description: 'View and manage reported issues',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Issue list', 'Report new issue', 'Issue status tracking', 'Issue resolution'],
    path: '/issues',
  },
  '/issues/new': {
    name: 'New Issue',
    description: 'Report a new issue',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Issue reporting form', 'Issue type selection', 'Description and details', 'Attachments'],
    path: '/issues/new',
  },
  '/issues/[id]': {
    name: 'Issue Details',
    description: 'View details of a specific issue',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Issue details', 'Timeline', 'Status updates', 'Resolution tracking'],
    path: '/issues/[id]',
  },
  '/search': {
    name: 'Search',
    description: 'Search for buyers or suppliers with category and weather filtering',
    roles: ['BUYER', 'SUPPLIER'],
    features: [
      'Buyer search by User ID (BJ####) or category',
      'Supplier search by User ID (SP####) or category',
      'Category filtering (Fresh Food, Frozen Food, Dry Groceries, Beverages)',
      'Credit score and reliability score filtering',
      'Weather-aware search (shows weather impact status)',
      'Detailed buyer/supplier profiles',
      'Credit and reliability score display',
    ],
    path: '/search',
  },
  '/buyer-registry': {
    name: 'Buyer Registry',
    description: 'Comprehensive buyer management system with blacklist, potential buyers, and AI risk assessment (Supplier only)',
    roles: ['SUPPLIER'],
    features: [
      'My Buyers list (buyers with invoices)',
      'Potential Buyers list (buyers added from search)',
      'Search All (find new buyers by ID or category)',
      'AI Risk Assessment for each buyer',
      'Credit score visualization',
      'Blacklist management (Add/Remove/Restore buyers)',
      'Buyer payment history and metrics',
      'Outstanding debt tracking',
    ],
    path: '/buyer-registry',
  },
  '/risk-monitor': {
    name: 'Risk Monitor',
    description: 'Monitor weather-related risks and supplier status with real-time weather data',
    roles: ['BUYER', 'SUPPLIER'],
    features: [
      'Weather impact monitoring by region',
      'Risk assessment based on weather events',
      'Supplier status (Normal, Moderate Impact, High Impact)',
      'Regional weather alerts',
      'Weather-impacted supplier identification',
      'Real-time weather data integration',
    ],
    path: '/risk-monitor',
  },
  '/collections': {
    name: 'Collections',
    description: 'Manage collection attempts, payment reminders, and automated WhatsApp reminders (Supplier only)',
    roles: ['SUPPLIER'],
    features: [
      'Collection attempt history',
      'Collection statistics and metrics',
      'Automated payment reminders via WhatsApp',
      'Collection status tracking (Pending, Sent, Delivered, Failed)',
      'Filter by collection type and status',
      'Search collection history',
    ],
    path: '/collections',
  },
  '/profile': {
    name: 'Profile',
    description: 'View and edit your profile information',
    roles: ['BUYER', 'SUPPLIER'],
    features: ['Profile information', 'Business details', 'Contact information', 'Account settings'],
    path: '/profile',
  },
}

/**
 * Get page information by pathname
 */
export function getPageInfo(
  pathname: string,
  userType?: UserType
): PageInfo | null {
  // Handle dynamic routes
  if (pathname.startsWith('/issues/') && pathname !== '/issues/new') {
    return WEBSITE_STRUCTURE['/issues/[id]']
  }

  // Direct match
  const pageInfo = WEBSITE_STRUCTURE[pathname]
  if (!pageInfo) {
    return null
  }

  // Check role-based access
  if (userType && !pageInfo.roles.includes(userType)) {
    return null
  }

  return pageInfo
}

/**
 * Get all available pages for a user type
 */
export function getAvailablePages(userType: UserType): PageInfo[] {
  return Object.values(WEBSITE_STRUCTURE).filter((page) =>
    page.roles.includes(userType)
  )
}

/**
 * Suggest navigation based on user intent
 */
export function suggestNavigation(
  intent: string,
  userType: UserType
): PageInfo[] {
  const intentLower = intent.toLowerCase()
  const availablePages = getAvailablePages(userType)

  // Keyword-based matching
  const suggestions: PageInfo[] = []

  // Invoice-related
  if (
    intentLower.includes('invoice') ||
    intentLower.includes('bill') ||
    intentLower.includes('payment')
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/invoices'])
    if (intentLower.includes('create') || intentLower.includes('new')) {
      suggestions.push(WEBSITE_STRUCTURE['/invoices/new'])
    }
  }

  // Issue-related
  if (
    intentLower.includes('issue') ||
    intentLower.includes('problem') ||
    intentLower.includes('complaint')
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/issues'])
    if (intentLower.includes('report') || intentLower.includes('new')) {
      suggestions.push(WEBSITE_STRUCTURE['/issues/new'])
    }
  }

  // Dashboard/overview
  if (
    intentLower.includes('dashboard') ||
    intentLower.includes('overview') ||
    intentLower.includes('home') ||
    intentLower.includes('summary')
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/dashboard'])
  }

  // Buyer Registry (Supplier only) - check before generic search
  if (
    userType === 'SUPPLIER' &&
    (intentLower.includes('buyer') &&
      !intentLower.includes('search') &&
      !intentLower.includes('find') &&
      !intentLower.includes('look for'))
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/buyer-registry'])
  }

  // Search - only suggest for explicit search/find requests
  if (
    intentLower.includes('search') ||
    intentLower.includes('find') ||
    intentLower.includes('look for') ||
    (intentLower.includes('buyer') && (intentLower.includes('search') || intentLower.includes('find') || intentLower.includes('look for'))) ||
    (intentLower.includes('supplier') && (intentLower.includes('search') || intentLower.includes('find') || intentLower.includes('look for')))
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/search'])
  }

  // Profile
  if (
    intentLower.includes('profile') ||
    intentLower.includes('account') ||
    intentLower.includes('settings') ||
    intentLower.includes('information')
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/profile'])
  }

  // Risk monitoring
  if (
    intentLower.includes('risk') ||
    intentLower.includes('weather') ||
    intentLower.includes('monitor')
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/risk-monitor'])
  }

  // Collections (Supplier only)
  if (
    userType === 'SUPPLIER' &&
    (intentLower.includes('collection') ||
      intentLower.includes('reminder') ||
      intentLower.includes('payment reminder'))
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/collections'])
  }

  // Buyer Registry (Supplier only) - explicit mentions
  if (
    userType === 'SUPPLIER' &&
    (intentLower.includes('buyer registry') ||
      intentLower.includes('buyer list') ||
      intentLower.includes('registered buyers') ||
      intentLower.includes('my buyers') ||
      intentLower.includes('potential buyers'))
  ) {
    suggestions.push(WEBSITE_STRUCTURE['/buyer-registry'])
  }

  // Remove duplicates
  return Array.from(
    new Map(suggestions.map((page) => [page.path, page])).values()
  )
}

/**
 * Get page description for AI context
 */
export function getPageDescription(
  pathname: string,
  userType?: UserType
): string {
  const pageInfo = getPageInfo(pathname, userType)
  if (!pageInfo) {
    return `You are on page: ${pathname}`
  }

  return `You are currently on the ${pageInfo.name} page. ${pageInfo.description}. Available features: ${pageInfo.features.join(', ')}.`
}

/**
 * Format navigation suggestions for display
 */
export function formatNavigationSuggestion(page: PageInfo): string {
  return `Go to ${page.name}`
}


