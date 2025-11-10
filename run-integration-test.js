#!/usr/bin/env node

/**
 * Integration Test Runner
 * Runs the comprehensive integration test suite
 */

import { integrationTest } from './src/utils/IntegrationTest.js';

// Polyfill for requestAnimationFrame in Node.js environment
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 1000 / 60); // 60 FPS
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

async function runIntegrationTest() {
  console.log('🚀 Starting Integration Test Suite...');
  console.log('='.repeat(50));
  
  try {
    const startTime = Date.now();
    
    // Run the full integration test
    const results = await integrationTest.runFullTest();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('='.repeat(50));
    console.log(`✅ Integration Test completed in ${duration}ms`);
    console.log('📊 Test Results:', JSON.stringify(results, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Integration Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
runIntegrationTest();