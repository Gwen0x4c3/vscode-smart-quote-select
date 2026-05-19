# Smart Quote Select

A tiny VSCode extension command for VSCodeVim users.

It provides smart quote text-object-like commands for single quotes (`'`) and double quotes (`"`). The extension automatically decides whether the current cursor is inside single quotes or double quotes, then applies the corresponding operation.

## Commands

| Command | Description |
|---|---|
| `smartQuoteSelect.selectInside` | Select inside the nearest quote pair |
| `smartQuoteSelect.selectAround` | Select around the nearest quote pair, including quotes |
| `smartQuoteSelect.deleteInside` | Delete inside the nearest quote pair |
| `smartQuoteSelect.deleteAround` | Delete around the nearest quote pair, including quotes |
| `smartQuoteSelect.changeInside` | Delete inside the nearest quote pair and enter insert mode |
| `smartQuoteSelect.changeAround` | Delete around the nearest quote pair, including quotes, and enter insert mode |

## Behavior

For double quotes:

```js
const a = "hello world"
```

When the cursor is inside `hello world`:

| Key | Result |
|---|---|
| `vii` | Selects `hello world` |
| `vai` | Selects `"hello world"` |
| `dii` | Deletes `hello world`, keeps the quotes |
| `dai` | Deletes `"hello world"` |
| `cii` | Deletes `hello world`, keeps the quotes, then enters insert mode |
| `cai` | Deletes `"hello world"`, then enters insert mode |

For single quotes:

```js
const a = 'hello world'
```

The same keys work automatically. You do not need to choose between `vi"` and `vi'` manually.

Escaped quotes are ignored:

```js
const a = "hello \"world\""
```

Nested quotes prefer the innermost quote pair:

```js
const a = "outer 'inner'"
```

When the cursor is inside `inner`, `vii` selects `inner`.

## Use with VSCodeVim

Install the VSCodeVim extension first:

- Extension name: `Vim`
- Extension id: `vscodevim.vim`

Then add the following mappings to your VSCode `settings.json`.

### Minimal config

```json
{
  "vim.normalModeKeyBindingsNonRecursive": [
    {
      "before": ["v", "i", "i"],
      "commands": ["smartQuoteSelect.selectInside"]
    },
    {
      "before": ["v", "a", "i"],
      "commands": ["smartQuoteSelect.selectAround"]
    },
    {
      "before": ["d", "i", "i"],
      "commands": ["smartQuoteSelect.deleteInside"]
    },
    {
      "before": ["d", "a", "i"],
      "commands": ["smartQuoteSelect.deleteAround"]
    },
    {
      "before": ["c", "i", "i"],
      "commands": ["smartQuoteSelect.changeInside"]
    },
    {
      "before": ["c", "a", "i"],
      "commands": ["smartQuoteSelect.changeAround"]
    }
  ]
}
```
