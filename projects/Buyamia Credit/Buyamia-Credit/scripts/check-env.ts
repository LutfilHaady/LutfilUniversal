/**
 * Environment Variables Validation Script
 * 
 * Checks if all required environment variables are properly configured
 */

const requiredEnvVars = {
  // Database
  DATABASE_URL: {
    required: true,
    description: 'Primary PostgreSQL database (Supabase)',
    format: 'postgresql://...',
  },
  EXTERNAL_DATABASE_URL: {
    required: true,
    description: 'External Buyamia database (read-only)',
    format: 'postgresql://...',
  },
  
  // NextAuth
  NEXTAUTH_URL: {
    required: true,
    description: 'NextAuth base URL',
    format: 'http://localhost:3000 or production URL',
  },
  NEXTAUTH_SECRET: {
    required: true,
    description: 'NextAuth secret key',
    format: 'Random string (min 32 chars)',
  },
  
  // Weather API
  OPENWEATHER_API_KEY: {
    required: true,
    description: 'OpenWeatherMap API key',
    format: '32-character hex string',
  },
  
  // LiveKit
  LIVEKIT_URL: {
    required: true,
    description: 'LiveKit WebSocket URL',
    format: 'wss://...',
  },
  LIVEKIT_API_KEY: {
    required: true,
    description: 'LiveKit API key',
    format: 'API...',
  },
  LIVEKIT_API_SECRET: {
    required: true,
    description: 'LiveKit API secret',
    format: 'Random string',
  },
  
  // OpenAI
  OPENAI_API_KEY: {
    required: false,
    description: 'OpenAI API key for AI features',
    format: 'sk-proj-...',
  },
  
  // Twilio (optional)
  TWILIO_ACCOUNT_SID: {
    required: false,
    description: 'Twilio Account SID',
    format: 'AC...',
  },
  TWILIO_AUTH_TOKEN: {
    required: false,
    description: 'Twilio Auth Token',
    format: 'Random string',
  },
  TWILIO_WHATSAPP_NUMBER: {
    required: false,
    description: 'Twilio WhatsApp number',
    format: '+14155238886',
  },
}

function validateEnvVar(key: string, config: { required: boolean; description: string; format: string }): {
  key: string
  status: '✅ OK' | '⚠️  MISSING' | '❌ INVALID'
  value: string
  message: string
} {
  const value = process.env[key] || ''
  
  if (!value) {
    return {
      key,
      status: config.required ? '❌ INVALID' : '⚠️  MISSING',
      value: '(not set)',
      message: config.required 
        ? `Required but not set: ${config.description}`
        : `Optional: ${config.description}`,
    }
  }
  
  // Basic format validation
  let isValid = true
  let message = `✅ ${config.description}`
  
  if (key === 'DATABASE_URL' || key === 'EXTERNAL_DATABASE_URL') {
    isValid = value.startsWith('postgresql://')
    if (!isValid) message = `❌ Invalid format: Should start with 'postgresql://'`
  } else if (key === 'NEXTAUTH_URL') {
    isValid = value.startsWith('http://') || value.startsWith('https://')
    if (!isValid) message = `❌ Invalid format: Should start with 'http://' or 'https://'`
  } else if (key === 'NEXTAUTH_SECRET') {
    isValid = value.length >= 32
    if (!isValid) message = `⚠️  Warning: Should be at least 32 characters for security`
  } else if (key === 'OPENWEATHER_API_KEY') {
    isValid = value.length === 32 && /^[a-f0-9]+$/i.test(value)
    if (!isValid) message = `⚠️  Warning: Should be 32-character hex string (format may vary)`
  } else if (key === 'LIVEKIT_URL') {
    isValid = value.startsWith('wss://') || value.startsWith('ws://')
    if (!isValid) message = `❌ Invalid format: Should start with 'wss://' or 'ws://'`
  } else if (key === 'LIVEKIT_API_KEY') {
    isValid = value.length > 0
    if (!isValid) message = `❌ Invalid: Cannot be empty`
  } else if (key === 'OPENAI_API_KEY') {
    isValid = value.startsWith('sk-')
    if (!isValid) message = `⚠️  Warning: OpenAI keys usually start with 'sk-'`
  }
  
  return {
    key,
    status: isValid ? '✅ OK' : (config.required ? '❌ INVALID' : '⚠️  MISSING'),
    value: key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY') 
      ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}` 
      : value,
    message,
  }
}

function main() {
  console.log('🔍 Checking Environment Variables...\n')
  console.log('=' .repeat(80))
  
  const results = Object.entries(requiredEnvVars).map(([key, config]) => 
    validateEnvVar(key, config)
  )
  
  const required = results.filter(r => requiredEnvVars[r.key as keyof typeof requiredEnvVars].required)
  const optional = results.filter(r => !requiredEnvVars[r.key as keyof typeof requiredEnvVars].required)
  
  console.log('\n📋 REQUIRED VARIABLES:\n')
  required.forEach(result => {
    console.log(`${result.status} ${result.key}`)
    console.log(`   ${result.message}`)
    console.log(`   Value: ${result.value}`)
    console.log()
  })
  
  if (optional.length > 0) {
    console.log('\n📋 OPTIONAL VARIABLES:\n')
    optional.forEach(result => {
      console.log(`${result.status} ${result.key}`)
      console.log(`   ${result.message}`)
      if (result.value !== '(not set)') {
        console.log(`   Value: ${result.value}`)
      }
      console.log()
    })
  }
  
  const errors = results.filter(r => r.status === '❌ INVALID')
  const warnings = results.filter(r => r.status === '⚠️  MISSING')
  
  console.log('=' .repeat(80))
  console.log('\n📊 SUMMARY:\n')
  console.log(`✅ Valid: ${results.filter(r => r.status === '✅ OK').length}`)
  console.log(`⚠️  Warnings: ${warnings.length}`)
  console.log(`❌ Errors: ${errors.length}`)
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS FOUND - Please fix these before running the application:\n')
    errors.forEach(e => console.log(`   - ${e.key}: ${e.message}`))
    process.exit(1)
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS - These are optional but recommended:\n')
    warnings.forEach(w => console.log(`   - ${w.key}: ${w.message}`))
  }
  
  console.log('\n✅ All required environment variables are properly configured!')
}

main()

