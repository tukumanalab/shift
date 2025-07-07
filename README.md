# アルバイトシフト管理アプリケーション

Vanilla JavaScriptとSupabaseを使用したシフト管理アプリケーション。

## 機能

- ユーザー認証（ログイン/新規登録）
- シフト一覧表示
- シフト希望申請（平日13:00-18:00、1時間単位、複数時間帯同時選択可能）
- 申請履歴の確認
- 管理者機能（シフト管理、申請の承認・却下）

## 技術スタック

- **フロントエンド**: Vanilla JavaScript
- **データベース**: Supabase
- **ホスティング**: GitHub Pages

## 開発環境のセットアップ

### 前提条件

- Node.js / npm
- Supabase CLI（[インストール方法](https://supabase.com/docs/guides/cli)）

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

### 3. 依存関係のインストール

```bash
npm install
```

### 4. ローカル開発環境の起動

```bash
npm start
```

このコマンドで以下が自動的に実行されます：
1. Supabaseローカルコンテナの起動（初回は時間がかかります）
2. データベースマイグレーションの適用
3. ローカルWebサーバーの起動（http://localhost:8080）
4. ブラウザが自動的に開きます
5. テストユーザーの作成（初回のみ）

### 5. 利用可能なURL

- **アプリケーション**: http://localhost:8080
- **Supabase Studio**: http://localhost:54323 (データベース管理UI)
- **API**: http://localhost:54321 (APIエンドポイント)
- **Inbucket**: http://localhost:54324 (メールテスト)

### 6. テストアカウント（ローカル環境）

| メールアドレス | パスワード | 権限 |
|---|---|---|
| admin@example.com | password | 管理者 |
| user1@example.com | password | 一般ユーザー |
| user2@example.com | password | 一般ユーザー |

### 7. その他のコマンド

```bash
# 開発環境の停止
npm run stop

# Supabaseの状態確認
npm run supabase:status

# データベースのリセット（マイグレーション再適用）
npm run db:reset

# テストユーザーの作成
npm run create-users
```

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

## ローカル開発の詳細

### 環境別設定の自動切り替え

`js/supabase-config.js`が環境を自動検出します：

- **ローカル環境** (`localhost` または `127.0.0.1`): ローカルSupabaseに接続
- **本番環境** (GitHub Pages): クラウドSupabaseに接続

### ローカルSupabaseの設定

#### メール確認設定

ローカル環境ではメール確認が無効になっています：

```toml
# supabase/config.toml
[auth.email]
enable_confirmations = false  # false = メール確認なし（開発用）
```

設定変更後の反映方法：
```bash
supabase stop
supabase start
```

#### メールテスト

ローカル環境で送信されるメールの確認：
```
http://localhost:54324 (Inbucket)
```

### データベース管理

#### Supabase Studio
```
http://localhost:54323
```
Table Editor、SQL Editor、認証管理などが使用可能

#### データベース直接接続
```
postgresql://postgres:postgres@localhost:54322/postgres
```

### 開発時の注意事項

- `.env.local`ファイルは`.gitignore`に含まれています
- テストユーザーはAPIを使用して自動作成されます
- **本番環境では必ずメール確認を有効にしてください**

## トラブルシューティング

### よくある問題と解決方法

1. **Supabaseが起動しない場合**
   ```bash
   # Dockerが起動しているか確認
   docker ps
   
   # Supabaseをリセット
   supabase stop --no-backup
   supabase start
   ```

2. **マイグレーションエラーの場合**
   ```bash
   # データベースをリセット
   npm run db:reset
   ```

3. **ローカル環境に接続できない場合**
   - ブラウザのコンソールでエラーを確認
   - `http://localhost:54321`にアクセスできるか確認
   - キャッシュをクリア（Ctrl+Shift+R または Cmd+Shift+R）

4. **ログインに失敗する場合**
   ```bash
   # テストユーザーを再作成
   npm run create-users
   ```

5. **管理者バッジが表示されない場合**
   - ブラウザのキャッシュをクリア
   - コンソールでエラーを確認
   - データベースで管理者フラグを確認: http://localhost:54323

## ドキュメント

- [仕様書](SPECIFICATION.md)
- [Supabaseセットアップ](supabase-setup.md)