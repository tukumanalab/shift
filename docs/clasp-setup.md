# Google Apps Script CLI (clasp) セットアップガイド

Google Apps Scriptのデプロイを自動化するためのCLIツール「clasp」のセットアップ方法を説明します。

## 1. 前提条件

- Node.js がインストールされていること
- Google アカウントを持っていること
- Google Apps Script プロジェクトが既に作成されていること

## 2. clasp のインストール

```bash
# claspをグローバルにインストール
npm install -g @google/clasp

# インストール確認
clasp --version
```

## 3. Google Apps Script API の有効化

1. [Google Apps Script API](https://script.google.com/home/usersettings) にアクセス
2. 「Google Apps Script API」をオンにする

## 4. Google アカウントでの認証

```bash
# Googleアカウントでログイン（ブラウザが開きます）
clasp login
```

ブラウザでGoogleアカウントにログインし、claspへのアクセスを許可してください。

## 5. 既存プロジェクトの設定

### 方法1: 既存プロジェクトをクローン

```bash
# Google Apps ScriptのプロジェクトIDを取得
# プロジェクトのURLから: https://script.google.com/d/[PROJECT_ID]/edit

# プロジェクトをクローン
clasp clone [PROJECT_ID]
```

### 方法2: 既存ディレクトリでプロジェクトを関連付け

```bash
# プロジェクトルートで実行
clasp create --type standalone --title "シフト管理システム"

# または既存プロジェクトと関連付け
echo '{"scriptId":"[PROJECT_ID]","rootDir":"."}' > .clasp.json
```

## 6. ファイル構成の調整

### .claspignore ファイルの作成

Google Apps Scriptにアップロードしないファイルを指定：

```bash
# .claspignore ファイルを作成
cat > .claspignore << 'EOF'
**/**
!google-apps-script.js
!appsscript.json
EOF
```

### appsscript.json ファイルの作成

Google Apps Scriptの設定ファイル：

```bash
# appsscript.json ファイルを作成
cat > appsscript.json << 'EOF'
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {
    "enabledAdvancedServices": []
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
EOF
```

## 7. 基本的な使用方法

### ファイルのアップロード

```bash
# ローカルファイルをGoogle Apps Scriptにプッシュ
clasp push

# 特定のファイルのみプッシュ
clasp push --force
```

### デプロイメント

```bash
# 新しいバージョンをデプロイ
clasp deploy

# 説明付きでデプロイ
clasp deploy --description "シフト申請機能を追加"

# 特定のバージョンをデプロイ
clasp deploy --versionNumber 1
```

### その他の便利なコマンド

```bash
# プロジェクト情報を表示
clasp status

# ログを表示
clasp logs

# ブラウザでスクリプトエディタを開く
clasp open

# プロジェクトの詳細を表示
clasp versions
```

## 8. 自動化スクリプトの作成

プロジェクトルートに便利なスクリプトを作成：

### deploy.sh
```bash
#!/bin/bash

echo "Google Apps Scriptをデプロイ中..."

# ファイルをプッシュ
clasp push

# デプロイ
clasp deploy --description "$(date '+%Y-%m-%d %H:%M:%S') 自動デプロイ"

echo "デプロイが完了しました。"
```

### 使用方法
```bash
chmod +x deploy.sh
./deploy.sh
```

## 9. GitHub Actions での自動デプロイ（オプション）

### .github/workflows/gas-deploy.yml

```yaml
name: Deploy Google Apps Script

on:
  push:
    branches: [main]
    paths: ['google-apps-script.js']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install clasp
        run: npm install -g @google/clasp
      
      - name: Create clasp credentials
        run: |
          echo '${{ secrets.CLASP_CREDENTIALS }}' > ~/.clasprc.json
      
      - name: Deploy to Google Apps Script
        run: |
          clasp push
          clasp deploy --description "GitHub Actions auto-deploy $(date)"
```

### GitHub Secrets の設定

1. `clasp login` 後に作成される `~/.clasprc.json` の内容をコピー
2. GitHubリポジトリの Settings → Secrets and variables → Actions
3. `CLASP_CREDENTIALS` という名前でシークレットを作成し、JSONの内容を貼り付け

## 10. トラブルシューティング

### よくある問題と解決方法

#### 認証エラー
```bash
# 再ログイン
clasp logout
clasp login
```

#### プッシュエラー
```bash
# 強制プッシュ
clasp push --force
```

#### プロジェクトが見つからない
```bash
# プロジェクトIDを確認
clasp list

# 正しいプロジェクトIDで再設定
echo '{"scriptId":"正しいプロジェクトID","rootDir":"."}' > .clasp.json
```

## 11. 参考リンク

- [clasp 公式ドキュメント](https://github.com/google/clasp)
- [Google Apps Script API](https://developers.google.com/apps-script/api/)
- [Google Apps Script リファレンス](https://developers.google.com/apps-script/reference/)

## 12. 今後の使用フロー

1. `google-apps-script.js` を編集
2. `clasp push` でアップロード
3. `clasp deploy` でデプロイ
4. 必要に応じて Google Apps Script エディタで設定確認

これで手動でのコピー&ペーストが不要になり、効率的に開発できます。