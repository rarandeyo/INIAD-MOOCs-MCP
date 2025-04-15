# INIAD MOOCs MCP サーバー

大学の課題提出サイト [INIAD MOOCs](https://moocs.iniad.org/) への自動ログイン・課題提出・ファイルアップロード・フォーム入力を自動化する [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) サーバーです。  
[Playwright MCP](https://github.com/microsoft/playwright-mcp) をベースに、INIAD向けの自動化ツールを追加しています。

## 主な特徴

- **INIADアカウントで自動ログイン**（環境変数で指定）
- **講義一覧・講義回・スライド・課題内容の自動取得**
- **課題提出の自動化（ファイルアップロード・フォーム入力）**
- **MCPプロトコル対応**：ClaudeやCursor、VSCode等各種MCPホストから利用可能

## 必要な環境変数

- `INIAD_USERNAME` : INIAD MOOCsのユーザー名（メールアドレスの「@」より前の部分、かつ必ずsで始まる学籍番号を指定してください。
- `INIAD_PASSWORD` : INIAD MOOCsのパスワード

## 使用方法

<details>
<summary>⚠️ CursorやVS CodeなどでWSLを利用している場合のnpm・npxバージョン互換性について</summary>

CursorやVS CodeなどでWSLを利用している場合、WSL側とWindows側で異なるメジャーバージョンのnpmやnpxを使用していると、コマンド実行時にエラーや予期しない挙動が発生することがあります。  
<strong>特にnpxのバージョン違いによる動作不良が報告されています。</strong>  
トラブルが発生した場合は、WSLとWindowsのnpm/npxのバージョンを揃えることを検討してください。

</details>

### 1. MCPホスト設定例

Cursor、Cline、Claude Desktop など主要なMCPホストでは、以下のような 例: `mcp_config.json` を用いてMCPサーバーを登録できます。

```json
{
  "mcpServers": {
    "iniad-moocs-mcp": {
      "command": "npx",
      "args": [
        "iniad-moocs-mcp",
        "--headless"
      ],
      "env": {
        "INIAD_USERNAME": "your_username",
        "INIAD_PASSWORD": "your_password"
      }
    }
  }
}
```

#### ヘッドあり（ブラウザ画面を表示したい場合）

```json
{
  "mcpServers": {
    "iniad-moocs-mcp": {
      "command": "npx",
      "args": [
        "iniad-moocs-mcp"
      ],
      "env": {
        "INIAD_USERNAME": "your_username",
        "INIAD_PASSWORD": "your_password"
      }
    }
  }
}
```

---

### 2. VS Code からのインストール・起動

#### コマンドパレットから

1. コマンドパレット（`Ctrl+Shift+P`）を開く
2. `MCP: Add Server` を選択
3. 以下の内容を入力

**ヘッドレスモード:**
```json
{"name":"iniad-moocs-mcp","command":"npx","args":["iniad-moocs-mcp","--headless"],"env":{"INIAD_USERNAME":"your_username","INIAD_PASSWORD":"your_password"}}
```

**ヘッドあり:**
```json
{"name":"iniad-moocs-mcp","command":"npx","args":["iniad-moocs-mcp"],"env":{"INIAD_USERNAME":"your_username","INIAD_PASSWORD":"your_password"}}
```

#### CLIから直接追加

**VS Codeの場合:**
```bash
code --add-mcp '{"name":"iniad-moocs-mcp","command":"npx","args":["iniad-moocs-mcp","--headless"],"env":{"INIAD_USERNAME":"your_username","INIAD_PASSWORD":"your_password"}}'
```

**VS Code Insidersの場合:**
```bash
code-insiders --add-mcp '{"name":"iniad-moocs-mcp","command":"npx","args":["iniad-moocs-mcp","--headless"],"env":{"INIAD_USERNAME":"your_username","INIAD_PASSWORD":"your_password"}}'
```

---

### 3. 直接コマンドで起動

**ヘッドレスモード:**
```bash
npx iniad-moocs-mcp --headless
```

**ヘッドあり:**
```bash
npx iniad-moocs-mcp
```

---

### 補足

- `--browser <browser>` でブラウザ指定も可能（例: `--browser chrome`）


## ユーザーデータディレクトリについて

Playwright MCP（および本ツール）は、ブラウザを起動する際に「ユーザープロファイル（ユーザーデータ）」を新規作成し、その中にログイン情報やCookie、キャッシュなどを保存します。

- **保存場所（OSごと）:**
  - **Windows:**  `%USERPROFILE%\AppData\Local\ms-playwright\mcp-chrome-profile`
  - **macOS:**    `~/Library/Caches/ms-playwright/mcp-chrome-profile`
  - **Linux:**    `~/.cache/ms-playwright/mcp-chrome-profile`

このディレクトリには、ログイン状態やセッション情報、履歴などが保存されます。

- **メリット:**
  - 一度ログインすれば、次回以降も自動でログイン状態が維持されます。
  - 毎回ログインし直す必要がありません。
- **リセット方法:**
  - セッションやログイン状態をリセットしたい場合は、このディレクトリを削除してください。
  - 削除すると、次回起動時は新しいプロファイルでまっさらな状態から開始されます。

## ライセンス

Apache License 2.0

---

## 注意事項・コントリビューション

⚠️ **注意**  
本リポジトリは [Playwright MCP](https://github.com/microsoft/playwright-mcp) を直接フォークしたものではなく、参考にして独自に作成・拡張したものです。  
よって本家MCPの変更に合わせて随時メンテナンス・追従する可能性は低いです。

💡 **コントリビューション歓迎**  
バグ報告・機能要望・プルリクエスト等は歓迎です！

**参考**  
- [Playwright MCP README](https://github.com/microsoft/playwright-mcp/blob/main/README.md)  
- [Model Context Protocol (MCP) 公式ドキュメント](https://modelcontextprotocol.io/introduction)

