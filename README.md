# アルバイトシフト管理アプリケーション

Vanilla JavaScriptとSupabaseを使用したシフト管理アプリケーション。

## 機能

- ユーザー認証（ログイン/新規登録）
- カレンダーでのシフト表示
- シフト希望申請（平日13:00-18:00、1時間単位）
- 申請履歴の確認

## 技術スタック

- **フロントエンド**: Vanilla JavaScript
- **データベース**: Supabase
- **ホスティング**: GitHub Pages

## 開発環境のセットアップ

### 前提条件

- Node.js / npm
- Supabase CLI

### 1. Supabase CLIのインストール

```bash
# macOS
brew install supabase/tap/supabase

# その他のOS
npm install -g supabase
```

### 2. プロジェクトのクローン

```bash
git clone [リポジトリURL]
cd shift
```

### 3. ローカルSupabaseの初期化と起動

```bash
# 初期化（初回のみ）
supabase init

# ローカルSupabaseの起動
supabase start
```

起動すると以下のURLが利用可能になります：
- Studio: http://localhost:54323
- API: http://localhost:54321
- Inbucket（メール）: http://localhost:54324

### 4. データベースのセットアップ

ローカル環境では、`supabase start`実行時にmigrationファイルが自動的に適用されます。

本番環境にmigrationを適用する場合：
```bash
supabase db push
```

### 5. ローカルサーバーの起動

```bash
# http-serverのインストール（初回のみ）
npm install -g http-server

# プロジェクトルートで実行
http-server
```

### 6. アプリケーションにアクセス

ブラウザで http://localhost:8080 を開く（デフォルトポート）

## 本番環境へのデプロイ

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)でアカウント作成
2. 新規プロジェクトを作成
3. プロジェクトのURLとAnon Keyを取得

### 2. 本番用設定ファイルの更新

`js/supabase-config.js`を編集：
```javascript
const SUPABASE_URL = 'あなたのプロジェクトURL';
const SUPABASE_ANON_KEY = 'あなたのAnon Key';
```

### 3. GitHub Pagesへデプロイ

1. GitHubリポジトリにプッシュ
2. Settings → Pages → Source を "Deploy from a branch" に設定
3. Branch を main、フォルダを / (root) に設定

## 開発時の注意事項

- `js/supabase-config-local.js`は`.gitignore`に含まれています
- 環境に応じて自動的に設定ファイルが切り替わります
- ローカルではメール確認が無効になっています（`supabase/config.toml`で設定）

## デバッグ

ローカルSupabase Studio (http://localhost:54323) でデータの確認・編集が可能です。

## ドキュメント

- [仕様書](SPECIFICATION.md)
- [ローカルテスト環境](LOCAL_TESTING.md)
- [Supabaseセットアップ](supabase-setup.md)