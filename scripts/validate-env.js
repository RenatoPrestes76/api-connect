#!/usr/bin/env node

/**
 * Environment Variable Validator
 * Validates that all required environment variables are set
 */

const requiredEnv = [
  'DATABASE_URL',
  'API_SECRET_KEY',
];

const optionalEnv = [
  'NODE_ENV',
  'LOG_LEVEL',
  'API_PORT',
  'CLOUD_PORT',
  'NEXT_PUBLIC_SUPABASE_URL',
  // ATLAS 46.31 — required specifically when NODE_ENV=production (see
  // apps/api/src/services/production-secrets.ts's REQUIRED_IN_PRODUCTION);
  // "optional" here only in the sense that this script itself doesn't
  // fail the process outside production — each still falls back to a
  // hardcoded, source-visible dev default when unset, and
  // assertProductionSecretsConfigured()/assertProductionCorsConfigured()
  // are the actual fail-loud gate that runs at boot.
  'CORS_ALLOWED_ORIGINS',
  'ATLAS_MASTER_KEY',
  'ADMIN_JWT_SECRET',
  'PORTAL_JWT_SECRET',
  'RUNTIME_JWT_SECRET',
  'RUNTIME_CERT_SECRET',
  'CONNECTOR_PACKAGE_SECRET',
  'MESSAGE_DELIVERY_SECRET',
  'SUPABASE_JWT_SECRET',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
  // Optional external integration — AI Copilot routes fall back to a demo
  // response when unset.
  'ANTHROPIC_API_KEY',
];

console.log('🔍 Validating environment variables...\n');

let valid = true;
const missing = [];

// Check required variables
requiredEnv.forEach((env) => {
  if (!process.env[env]) {
    console.error(`❌ Missing required: ${env}`);
    missing.push(env);
    valid = false;
  } else {
    console.log(`✓ ${env}`);
  }
});

// Warn about optional variables
console.log('\nOptional variables:');
optionalEnv.forEach((env) => {
  if (!process.env[env]) {
    console.warn(`⚠ Not set: ${env} (using default)`);
  } else {
    console.log(`✓ ${env}`);
  }
});

if (!valid) {
  console.error(`\n❌ Missing environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env.local and update with your values.');
  process.exit(1);
}

console.log('\n✅ All required environment variables are set!');
process.exit(0);
