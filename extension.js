let vscode;
try {
  vscode = require("vscode");
} catch (_) {
  // Allows running lightweight unit tests outside VSCode.
  vscode = undefined;
}

// ─── Single-line quote pair finder ──────────────────────────────────────

/**
 * Find quote pairs on one line and return the best pair containing the cursor.
 * Supports single quote, double quote only. Backticks are handled separately
 * via multi-line search to support Go raw strings etc.
 *
 * Selection rule:
 * 1. Only consider quote pairs whose range contains the cursor.
 * 2. Prefer the innermost pair, i.e. the pair with the smallest span.
 * 3. If spans are equal, prefer the pair whose boundary is closer to cursor.
 */
function findBestQuotePair(lineText, cursorCharacter) {
  const pairs = [];

  for (const quote of ['"', "'"]) {
    const stack = [];

    for (let i = 0; i < lineText.length; i++) {
      const ch = lineText[i];
      if (ch !== quote) continue;
      if (isEscaped(lineText, i)) continue;

      if (stack.length === 0) {
        stack.push(i);
      } else {
        const start = stack.pop();
        const end = i;
        if (cursorCharacter >= start && cursorCharacter <= end) {
          pairs.push({ quote, start, end, span: end - start });
        }
      }
    }
  }

  if (pairs.length === 0) return undefined;

  pairs.sort((a, b) => {
    if (a.span !== b.span) return a.span - b.span;
    const da = Math.min(Math.abs(cursorCharacter - a.start), Math.abs(cursorCharacter - a.end));
    const db = Math.min(Math.abs(cursorCharacter - b.start), Math.abs(cursorCharacter - b.end));
    return da - db;
  });

  return pairs[0];
}

function isEscaped(text, index) {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

// ─── Multi-line backtick pair finder (for Go raw strings etc.) ──────────

/**
 * Find a backtick pair that may span multiple lines, starting from the cursor position.
 * Scans backward to find the opening backtick, then forward to find the closing one.
 * Returns { startLine, startChar, endLine, endChar } or undefined.
 */
function findBacktickPairMultiLine(doc, cursorLine, cursorChar) {
  const lineCount = doc.lineCount;

  // Phase 1: Scan backward from cursor position to find an unmatched opening backtick
  let openLine = -1;
  let openChar = -1;
  let depth = 0;

  // Current line: scan from cursor char leftward
  const curLineText = doc.lineAt(cursorLine).text;
  for (let i = cursorChar; i >= 0; i--) {
    if (curLineText[i] === '`') {
      if (depth === 0) {
        openLine = cursorLine;
        openChar = i;
      } else {
        depth--;
      }
    }
  }

  // Earlier lines: scan bottom-up
  if (openLine === -1) {
    for (let ln = cursorLine - 1; ln >= 0; ln--) {
      const text = doc.lineAt(ln).text;
      for (let i = text.length - 1; i >= 0; i--) {
        if (text[i] === '`') {
          if (depth === 0) {
            openLine = ln;
            openChar = i;
            break;
          } else {
            depth--;
          }
        }
      }
      if (openLine !== -1) break;
    }
  }

  if (openLine === -1) return undefined;

  // Phase 2: Forward from opening backtick to find the closing one
  let closeLine = -1;
  let closeChar = -1;

  // Rest of opening line after the opening backtick
  const openLineText = doc.lineAt(openLine).text;
  for (let i = openChar + 1; i < openLineText.length; i++) {
    if (openLineText[i] === '`') {
      closeLine = openLine;
      closeChar = i;
      break;
    }
  }

  if (closeLine === -1) {
    for (let ln = openLine + 1; ln < lineCount; ln++) {
      const text = doc.lineAt(ln).text;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '`') {
          closeLine = ln;
          closeChar = i;
          break;
        }
      }
      if (closeLine !== -1) break;
    }
  }

  if (closeLine === -1) return undefined;

  return {
    quote: '`',
    startLine: openLine,
    startChar: openChar,
    endLine: closeLine,
    endChar: closeChar,
  };
}

// ─── Range computation ───────────────────────────────────────────────────

/**
 * Get the target selection range for a given editor selection.
 * Strategy:
 * 1. Run multi-line search for backtick first (Go raw strings, template literals)
 * 2. Run single-line search for " and '
 * 3. Backtick wins when present — because if cursor is inside a backtick-delimited
 *    string, the inner "/' are just content characters, not structural quotes.
 */
function getTargetRange(editor, selection, around) {
  const doc = editor.document;
  const pos = selection.active;
  const line = doc.lineAt(pos.line);

  // Multi-line: backtick (handles both single-line and multi-line cases)
  const multi = findBacktickPairMultiLine(doc, pos.line, pos.character);

  // Single-line: only " and '
  const single = findBestQuotePair(line.text, pos.character);

  // Backtick takes priority when found — inner " and ' are just string content
  if (multi) {
    const sChar = around ? multi.startChar : multi.startChar + 1;
    const eChar = around ? multi.endChar + 1 : multi.endChar;
    if (!around && multi.startLine === multi.endLine && eChar <= sChar) return undefined;
    return new vscode.Range(
      new vscode.Position(multi.startLine, sChar),
      new vscode.Position(multi.endLine, eChar),
    );
  }

  if (single) {
    const startChar = around ? single.start : single.start + 1;
    const endChar = around ? single.end + 1 : single.end;
    if (endChar < startChar) return undefined;
    return new vscode.Range(
      new vscode.Position(pos.line, startChar),
      new vscode.Position(pos.line, endChar),
    );
  }

  return undefined;
}

// ─── Commands ────────────────────────────────────────────────────────────

async function selectSmartQuotes(around) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selections = editor.selections.map((selection) => {
    const range = getTargetRange(editor, selection, around);
    if (!range) return selection;
    return new vscode.Selection(range.start, range.end);
  });

  editor.selections = selections;
  if (selections.length > 0) {
    editor.revealRange(
      new vscode.Range(selections[0].start, selections[0].end),
    );
  }
}

async function deleteSmartQuotes(around, enterInsertMode) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const ranges = editor.selections
    .map((selection) => getTargetRange(editor, selection, around))
    .filter(Boolean)
    .sort((a, b) => b.start.compareTo(a.start));

  if (ranges.length === 0) return;

  await editor.edit((editBuilder) => {
    for (const range of ranges) {
      editBuilder.delete(range);
    }
  });

  const newSelections = ranges
    .slice()
    .sort((a, b) => a.start.compareTo(b.start))
    .map((range) => new vscode.Selection(range.start, range.start));
  editor.selections = newSelections;

  if (enterInsertMode) {
    await vscode.commands.executeCommand("extension.vim_insert");
  }
}

function activate(context) {
  const disposables = [
    vscode.commands.registerCommand("smartQuoteSelect.selectInside", () =>
      selectSmartQuotes(false),
    ),
    vscode.commands.registerCommand("smartQuoteSelect.selectAround", () =>
      selectSmartQuotes(true),
    ),
    vscode.commands.registerCommand("smartQuoteSelect.deleteInside", () =>
      deleteSmartQuotes(false, false),
    ),
    vscode.commands.registerCommand("smartQuoteSelect.deleteAround", () =>
      deleteSmartQuotes(true, false),
    ),
    vscode.commands.registerCommand("smartQuoteSelect.changeInside", () =>
      deleteSmartQuotes(false, true),
    ),
    vscode.commands.registerCommand("smartQuoteSelect.changeAround", () =>
      deleteSmartQuotes(true, true),
    ),
  ];

  context.subscriptions.push(...disposables);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  // exported for lightweight manual tests
  findBestQuotePair,
  isEscaped,
};
