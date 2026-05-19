let vscode;
try {
  vscode = require("vscode");
} catch (_) {
  vscode = undefined;
}

// ─── Single-line quote pair finder ──────────────────────────────────────

function findBestQuotePair(lineText, cursorCharacter) {
  const pairs = [];
  for (const quote of ['"', "'"]) {
    const stack = [];
    for (let i = 0; i < lineText.length; i++) {
      const ch = lineText[i];
      if (ch !== quote) continue;
      if (isEscaped(lineText, i)) continue;
      if (stack.length === 0) { stack.push(i); }
      else {
        const start = stack.pop();
        if (cursorCharacter >= start && cursorCharacter <= i)
          pairs.push({ quote, start, end: i, span: i - start });
      }
    }
  }
  if (pairs.length === 0) return undefined;
  pairs.sort((a, b) => {
    if (a.span !== b.span) return a.span - b.span;
    return Math.min(Math.abs(cursorCharacter - a.start), Math.abs(cursorCharacter - a.end))
         - Math.min(Math.abs(cursorCharacter - b.start), Math.abs(cursorCharacter - b.end));
  });
  return pairs[0];
}

function isEscaped(text, index) {
  let c = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) c++;
  return c % 2 === 1;
}

// ─── Multi-line backtick pair finder ────────────────────────────────────

/**
 * Two-phase algorithm:
 * Phase 1 — Stack matching (handles normal balanced cases).
 * Phase 2 — Nearest-enclosing fallback (handles Go raw string concat with odd tick counts).
 *           Rejects candidates whose opener/closer were already consumed by Phase 1 stack pairs.
 */
function findBacktickPairMultiLine(doc, cursorLine, cursorChar) {
  const lineCount = doc.lineCount;

  function inside(sl, sc, el, ec) {
    if (cursorLine > sl && cursorLine < el) return true;
    if (cursorLine === sl && cursorLine === el) return cursorChar >= sc && cursorChar <= ec;
    if (cursorLine === sl) return cursorChar >= sc;
    if (cursorLine === el) return cursorChar <= ec;
    return false;
  }

  function span(p) { return p.startLine === p.endLine ? p.endChar - p.startChar : 100000 + (p.endLine - p.startLine); }

  // ── Phase 1: Stack-based matching ──
  const stackPairs = [];
  const stack = [];
  // Track which positions are "consumed" by stack matching
  const consumed = new Set(); // "line:char" strings

  for (let ln = 0; ln < lineCount; ln++) {
    const text = doc.lineAt(ln).text;
    for (let ch = 0; ch < text.length; ch++) {
      if (text[ch] !== '`') continue;
      if (stack.length === 0) {
        stack.push({ line: ln, char: ch });
      } else {
        const open = stack.pop();
        stackPairs.push({ startLine: open.line, startChar: open.char, endLine: ln, endChar: ch });
        consumed.add(open.line + ':' + open.char);
        consumed.add(ln + ':' + ch);
      }
    }
  }

  const p1 = stackPairs.filter(p => inside(p.startLine, p.startChar, p.endLine, p.endChar));
  if (p1.length > 0) { p1.sort((a, b) => span(a) - span(b)); return p1[0]; }

  // ── Phase 2: Nearest-enclosing fallback ──
  const allTicks = [];
  for (let ln = 0; ln < lineCount; ln++) {
    const text = doc.lineAt(ln).text;
    for (let ch = 0; ch < text.length; ch++)
      if (text[ch] === '`') allTicks.push({ line: ln, char: ch });
  }

  function nextTick(fl, fc) {
    const t = doc.lineAt(fl).text;
    for (let i = fc; i < t.length; i++) if (t[i] === '`') return { line: fl, char: i };
    for (let ln = fl + 1; ln < lineCount; ln++) {
      const tt = doc.lineAt(ln).text;
      for (let i = 0; i < tt.length; i++) if (tt[i] === '`') return { line: ln, char: i };
    }
    return undefined;
  }

  const candidates = [];
  for (let i = allTicks.length - 1; i >= 0; i--) {
    const op = allTicks[i];
    if (op.line > cursorLine || (op.line === cursorLine && op.char > cursorChar)) continue;

    // Skip if this opener was consumed by stack matching (it was a closer in a stack pair)
    if (consumed.has(op.line + ':' + op.char)) continue;

    const cl = nextTick(op.line, op.char + 1);
    if (!cl || cl.line < cursorLine || (cl.line === cursorLine && cl.char < cursorChar)) continue;
    if (!inside(op.line, op.char, cl.line, cl.char)) continue;

    // Skip if closer was consumed by stack matching (it was an opener in a stack pair)
    if (consumed.has(cl.line + ':' + cl.char)) continue;

    candidates.push({ startLine: op.line, startChar: op.char, endLine: cl.line, endChar: cl.char });
  }

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => span(a) - span(b));
  return candidates[0];
}

// ─── Range computation ───────────────────────────────────────────────────

function getTargetRange(editor, selection, around) {
  const doc = editor.document;
  const pos = selection.active;
  const line = doc.lineAt(pos.line);

  const multi = findBacktickPairMultiLine(doc, pos.line, pos.character);
  const single = findBestQuotePair(line.text, pos.character);

  if (multi) {
    const sC = around ? multi.startChar : multi.startChar + 1;
    const eC = around ? multi.endChar + 1 : multi.endChar;
    if (!around && multi.startLine === multi.endLine && eC <= sC) return undefined;
    return new vscode.Range(new vscode.Position(multi.startLine, sC), new vscode.Position(multi.endLine, eC));
  }
  if (single) {
    const sC = around ? single.start : single.start + 1;
    const eC = around ? single.end + 1 : single.end;
    if (eC < sC) return undefined;
    return new vscode.Range(new vscode.Position(pos.line, sC), new vscode.Position(pos.line, eC));
  }
  return undefined;
}

// ─── Commands ────────────────────────────────────────────────────────────

async function selectSmartQuotes(around) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const selections = editor.selections.map(s => {
    const r = getTargetRange(editor, s, around);
    return r ? new vscode.Selection(r.start, r.end) : s;
  });
  editor.selections = selections;
  if (selections.length > 0) editor.revealRange(new vscode.Range(selections[0].start, selections[0].end));
}

async function deleteSmartQuotes(around, enterInsertMode) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const ranges = editor.selections.map(s => getTargetRange(editor, s, around)).filter(Boolean).sort((a, b) => b.start.compareTo(a.start));
  if (ranges.length === 0) return;
  await editor.edit(eb => { for (const r of ranges) eb.delete(r); });
  editor.selections = ranges.slice().sort((a, b) => a.start.compareTo(b.start)).map(r => new vscode.Selection(r.start, r.start));
  if (enterInsertMode) await vscode.commands.executeCommand("extension.vim_insert");
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("smartQuoteSelect.selectInside", () => selectSmartQuotes(false)),
    vscode.commands.registerCommand("smartQuoteSelect.selectAround", () => selectSmartQuotes(true)),
    vscode.commands.registerCommand("smartQuoteSelect.deleteInside", () => deleteSmartQuotes(false, false)),
    vscode.commands.registerCommand("smartQuoteSelect.deleteAround", () => deleteSmartQuotes(true, false)),
    vscode.commands.registerCommand("smartQuoteSelect.changeInside", () => deleteSmartQuotes(false, true)),
    vscode.commands.registerCommand("smartQuoteSelect.changeAround", () => deleteSmartQuotes(true, true)),
  );
}
function deactivate() {}

module.exports = {
  activate,
  deactivate,
  findBestQuotePair,
  findBacktickPairMultiLine,
  isEscaped,
};
