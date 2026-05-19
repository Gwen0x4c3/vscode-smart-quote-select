const { findBestQuotePair, findBacktickPairMultiLine } = require('./extension');

function makeDoc(lines) {
  return {
    lineCount: lines.length,
    lineAt: (line) => ({ text: lines[line] }),
  };
}

function assertCase(name, condition, detail = '') {
  if (condition) {
    console.log('PASS', name);
    return true;
  }
  console.log('FAIL', name, detail);
  return false;
}

let ok = true;

// Case 1: Go raw string concatenation. Cursor inside the second raw string
// should select the second backtick pair, not the previous segment.
{
  const lines = [
    'voiceDesignBatchSystemPrompt = `请根据提供的参考图片和相关信息，为人物设计音色提示词，可参考提示词模板 ',
    '` + voiceLanguagePrefixVar + `. <Gender>, <Age range>. Clean and perfect audio quality. Persona: <2–5 words>. <1–2 sentences about timbre, pacing, delivery> `',
  ];
  const cursorLine = 1;
  const cursorChar = lines[cursorLine].indexOf('<Gender>');
  const got = findBacktickPairMultiLine(makeDoc(lines), cursorLine, cursorChar);
  ok &= assertCase(
    'Go raw string concat selects current backtick segment',
    got && got.startLine === 1 && got.startChar === 29 && got.endLine === 1 && got.endChar === lines[1].length - 1,
    JSON.stringify(got),
  );
}

// Case 2: Cursor in a normal double-quoted map value should not be captured
// by unrelated backticks above/below. It must fall through to double quotes.
{
  const lines = [
    'test = `The result should sound like the same person, just speaking with a different emotion.`',
    '',
    'some other things',
    '',
    'var languageCodeToNativeLanguage = map[string]string{',
    '\t"en-US":  "English (US)",',
    '\t"en":     "American English",',
    '}',
    '',
    'type collectedCharacter struct {',
    '\tSpeakerID string `json:"speaker_id"`',
    '}',
  ];
  const cursorLine = 5;
  const cursorChar = lines[cursorLine].indexOf('English (US)');
  const backtick = findBacktickPairMultiLine(makeDoc(lines), cursorLine, cursorChar);
  const quote = findBestQuotePair(lines[cursorLine], cursorChar);
  ok &= assertCase('Map value is not captured by unrelated backticks', !backtick, JSON.stringify(backtick));
  ok &= assertCase('Map value falls through to double quotes', quote && quote.quote === '"' && quote.start === 11 && quote.end === 24, JSON.stringify(quote));
}

// Case 3: Cursor inside Go struct tag should still select the struct tag backticks.
{
  const lines = ['\tSpeakerID string `json:"speaker_id"`'];
  const cursorChar = lines[0].indexOf('speaker_id');
  const got = findBacktickPairMultiLine(makeDoc(lines), 0, cursorChar);
  ok &= assertCase(
    'Struct tag backticks still work',
    got && got.startLine === 0 && got.startChar === 18 && got.endLine === 0 && got.endChar === 36,
    JSON.stringify(got),
  );
}

// Case 4: Simple one-line backtick string.
{
  const lines = ['const s = `hello world`;'];
  const got = findBacktickPairMultiLine(makeDoc(lines), 0, lines[0].indexOf('hello'));
  ok &= assertCase(
    'Single-line backticks still work',
    got && got.startLine === 0 && got.startChar === 10 && got.endLine === 0 && got.endChar === 22,
    JSON.stringify(got),
  );
}

console.log(ok ? '\nAll multiline tests passed!' : '\nSome multiline tests failed.');
if (!ok) process.exitCode = 1;
