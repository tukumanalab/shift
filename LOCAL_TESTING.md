# ローカルテスト環境のセットアップ

## 前提条件

- Supabase CLIがインストール済み
- プロジェクトルートで `supabase init` 実行済み

## セットアップ手順

### 1. ローカルSupabaseの起動
```bash
cd /Users/ishihara/js/shift
supabase start
```

### 2. ローカルWebサーバーの起動
```bash
# http-serverのインストール（初回のみ）
npm install -g http-server

# サーバー起動
http-server
```

### 3. ブラウザでアクセス
```
http://localhost:8080
```

## 環境別設定ファイルの自動切り替え

このプロジェクトでは、環境に応じて自動的に設定ファイルが切り替わります：

- **ローカル環境** (`localhost` または `127.0.0.1`): `js/supabase-config-local.js`
- **本番環境** (GitHub Pages): `js/supabase-config.js`

コンソールに「ローカル環境の設定を使用」と表示されれば成功です。

## Supabaseデータの確認方法

### ローカルSupabase Studio
```
http://localhost:54323
```
Table Editor、SQL Editor、認証管理などが使用可能


## ローカルSupabaseのメール確認設定

ローカルSupabaseでメール確認を有効/無効にする設定：

### 設定ファイルの場所
`supabase/config.toml` の `[auth.email]` セクション：

```toml
[auth.email]
enable_confirmations = false  # false = メール確認なし（開発用）
                             # true = メール確認あり
```

### 設定変更後の反映
```bash
# Supabaseを再起動
supabase stop
supabase start
```

### 現在の設定
- **ローカル環境**: メール確認なし（すぐにログイン可能）
- **本番環境**: Supabaseダッシュボードで設定

## ローカルSupabaseの各種URL

- **Studio (ダッシュボード)**: http://localhost:54323
- **API**: http://localhost:54321
- **Inbucket (メール確認)**: http://localhost:54324
- **Database**: localhost:54322

### 起動状態の確認
```bash
supabase status
```

## メール確認の方法

### Inbucketで確認（ローカルSupabase使用時）
```
http://localhost:54324
```
ユーザー登録時のすべてのメールをここで確認できます。

### メール確認を無効化する場合
`supabase/config.toml`で設定済み：
```toml
[auth.email]
enable_confirmations = false  # メール確認なし
```

⚠️ **注意**: 本番環境では必ずメール確認を有効にしてください。