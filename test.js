const { findBestQuotePair } = require('./extension');

// Helper to compute expected values from the actual string
function check(line, cursor, expectedQuote) {
  const got = findBestQuotePair(line, cursor);
  if (!got) {
    console.log('FAIL', JSON.stringify(line), 'cursor=' + cursor, '-> got null');
    return false;
  }
  // Verify quote type matches
  if (got.quote !== expectedQuote) {
    console.log('FAIL', JSON.stringify(line), 'cursor=' + cursor,
      '-> quote mismatch: expected', expectedQuote, 'got', got.quote);
    return false;
  }
  console.log('PASS', JSON.stringify(line), 'cursor=' + cursor,
    '->', got.quote, got.start, '..', got.end, '(span=' + got.span + ')');
  return true;
}

let allPass = true;

// Case 1: basic double quote
allPass &= check('const a = "hello";', 12, '"');

// Case 2: basic single quote
allPass &= check("const a = 'hello';", 12, "'");

// Case 3: escaped double quotes inside double quotes
// String value: const a = "hello \"world\"";
// Outer " at 10 and 26
allPass &= check('const a = "hello \\"world\\"";', 14, '"');

// Case 4: nested single quote inside double quote argument
// String value: const a = foo("outer 'inner'");
// Inner ' at 21 and 27
allPass &= check('const a = foo("outer \'inner\'");', 23, "'");

// Case 5: cursor on opening quote -> should still select
allPass &= check('"hello world"', 0, '"');

// Case 6: cursor on closing quote -> should still select
allPass &= check('"hello world"', 11, '"');

// Case 7: empty quotes -> no selection (end <= start+1)
{
  const got = findBestQuotePair('""', 0);
  if (!got || got.span !== 1) { console.log('FAIL empty quotes should return span=1 pair'); allPass = false; }
  else { console.log("PASS empty quotes returns span=1 pair (caller filters it out)"); }
}

if (!allPass) process.exitCode = 1;
console.log(allPass ? '\nAll tests passed!' : '\nSome tests failed.');
