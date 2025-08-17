// Test validation fix
const { validateField, VALIDATION_RULES } = require('./src/utils/validation');

console.log('Testing username validation with email format...');

const testCases = [
  'admin@jaskirat.com',
  'admin123',
  'user_name',
  'invalid@',
  'test@example.com',
  'ab' // too short
];

testCases.forEach(testCase => {
  const result = validateField(testCase, VALIDATION_RULES.username);
  console.log(`"${testCase}": ${result.isValid ? '✅ Valid' : '❌ Invalid'} - ${result.errors.join(', ')}`);
});
