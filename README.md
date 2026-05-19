# Smart Quote Select

A tiny VSCode extension command for VSCodeVim users.

It provides this command:

```text
smartQuoteSelect.selectInside
```

The command selects the content inside the nearest single or double quotes on the current line.

## VSCodeVim binding

Add this to `settings.json`:

```json
{
  "vim.normalModeKeyBindingsNonRecursive": [
    {
      "before": ["v", "i", "i"],
      "commands": ["smartQuoteSelect.selectInside"]
    }
  ]
}
```

Then press:

```vim
vii
```

## Behavior

For:

```js
const a = foo("hello world")
```

cursor inside `hello world` -> selects `hello world`.

For:

```js
const a = foo('hello world')
```

cursor inside `hello world` -> selects `hello world`.

Escaped quotes are ignored:

```js
const a = "hello \"world\""
```

## Install locally

Copy this folder to your machine, then run:

```bash
code --extensionDevelopmentPath=/path/to/vscode-smart-quote-select
```

For normal installation, package it with `vsce`:

```bash
npm install -g @vscode/vsce
vsce package
code --install-extension vscode-smart-quote-select-0.0.1.vsix
```
