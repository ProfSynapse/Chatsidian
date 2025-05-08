/**
 * UI/Backend Integration Test Script
 * 
 * This script runs the UI/Backend integration tests and provides a detailed report
 * of the test results. It focuses on testing the integration between the ChatView
 * component and the StorageManager for conversation persistence.
 * 
 * Usage: node scripts/test-ui-backend-integration.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for formatting output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Print a header with the given text
 * @param {string} text - The text to display in the header
 */
function printHeader(text) {
  const line = '='.repeat(text.length + 4);
  console.log(`\n${colors.bright}${colors.cyan}${line}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}= ${text} =${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${line}${colors.reset}\n`);
}

/**
 * Print a section header with the given text
 * @param {string} text - The text to display in the section header
 */
function printSectionHeader(text) {
  console.log(`\n${colors.bright}${colors.yellow}${text}${colors.reset}`);
  console.log(`${colors.yellow}${'-'.repeat(text.length)}${colors.reset}\n`);
}

/**
 * Print a success message
 * @param {string} text - The success message to display
 */
function printSuccess(text) {
  console.log(`${colors.green}✓ ${text}${colors.reset}`);
}

/**
 * Print an error message
 * @param {string} text - The error message to display
 */
function printError(text) {
  console.log(`${colors.red}✗ ${text}${colors.reset}`);
}

/**
 * Print an info message
 * @param {string} text - The info message to display
 */
function printInfo(text) {
  console.log(`${colors.blue}ℹ ${text}${colors.reset}`);
}

/**
 * Run the UI/Backend integration tests
 */
function runIntegrationTests() {
  printHeader('UI/Backend Integration Tests');
  
  try {
    // Check if the test file exists
    const testFilePath = path.join(__dirname, '..', 'tests', 'integration', 'UIBackendIntegration.test.ts');
    if (!fs.existsSync(testFilePath)) {
      printError(`Test file not found: ${testFilePath}`);
      process.exit(1);
    }
    
    printInfo('Running UI/Backend integration tests...');
    
    // Run the tests using Jest
    const command = 'npx jest tests/integration/UIBackendIntegration.test.ts --verbose';
    const output = execSync(command, { encoding: 'utf8' });
    
    // Parse the test results
    const lines = output.split('\n');
    const testResults = [];
    let currentTest = null;
    
    for (const line of lines) {
      if (line.includes('PASS') || line.includes('FAIL')) {
        printInfo(line);
      } else if (line.match(/^✓\s/)) {
        // Passing test
        const testName = line.replace(/^✓\s/, '').trim();
        testResults.push({ name: testName, passed: true });
        printSuccess(testName);
      } else if (line.match(/^✕\s/)) {
        // Failing test
        const testName = line.replace(/^✕\s/, '').trim();
        currentTest = { name: testName, passed: false, errors: [] };
        testResults.push(currentTest);
        printError(testName);
      } else if (currentTest && !currentTest.passed && line.trim().startsWith('Error:')) {
        // Error message for failing test
        currentTest.errors.push(line.trim());
        printError(`  ${line.trim()}`);
      }
    }
    
    // Print summary
    printSectionHeader('Test Summary');
    
    const totalTests = testResults.length;
    const passedTests = testResults.filter(test => test.passed).length;
    const failedTests = totalTests - passedTests;
    
    printInfo(`Total tests: ${totalTests}`);
    printSuccess(`Passed tests: ${passedTests}`);
    
    if (failedTests > 0) {
      printError(`Failed tests: ${failedTests}`);
      
      printSectionHeader('Failed Tests');
      
      for (const test of testResults) {
        if (!test.passed) {
          printError(test.name);
          for (const error of test.errors) {
            printError(`  ${error}`);
          }
        }
      }
      
      process.exit(1);
    } else {
      printSuccess('All tests passed!');
    }
  } catch (error) {
    printError('Error running tests:');
    printError(error.message);
    process.exit(1);
  }
}

// Run the tests
runIntegrationTests();
