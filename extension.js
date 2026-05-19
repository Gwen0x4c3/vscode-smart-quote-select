let vscode;
try {
  vscode = require("vscode");
} catch (_) {
  // Allows running lightweight unit tests outside VSCode.
  vscode = undefined;
}

/**
 * Find quote pairs on one line and return the best pair containing the cursor.
 * Supports single quote and double quote. Escaped quotes like \" and \' are ignored.
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

function getTargetRange(editor, selection, around) {
  const doc = editor.document;
  const pos = selection.active;
  const line = doc.lineAt(pos.line);
  const pair = findBestQuotePair(line.text, pos.character);

  if (!pair) return undefined;

  const startChar = around ? pair.start : pair.start + 1;
  const endChar = around ? pair.end + 1 : pair.end;

  if (endChar < startChar) return undefined;
  return new vscode.Range(
    new vscode.Position(pos.line, startChar),
    new vscode.Position(pos.line, endChar),
  );
}

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
    // Delete from bottom/right to top/left to keep ranges stable.
    .sort((a, b) => b.start.compareTo(a.start));

  if (ranges.length === 0) return;

  await editor.edit((editBuilder) => {
    for (const range of ranges) {
      editBuilder.delete(range);
    }
  });

  // Put cursor at deletion start positions. After edit, VSCode keeps selection reasonably,
  // but setting it explicitly makes behavior closer to Vim's change/delete.
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
