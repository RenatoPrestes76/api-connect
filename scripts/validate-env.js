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
