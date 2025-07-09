# Claude Code - プロジェクト設定・記録

## プロジェクト概要
アルバイトシフト管理アプリ（Supabase + JavaScript）

## 重要な設定・過去の指摘事項

### 認証・ユーザー管理
- **デフォルトパスワード**: テストアカウントのパスワードは常に `password` を使用する
- **テストアカウント**:
  - 管理者: `admin@example.com` / `password`
  - 一般ユーザー1: `user1@example.com` / `password` (田中太郎)
  - 一般ユーザー2: `user2@example.com` / `password` (佐藤花子)

### UI・UX
- 管理者は以下のタブのみ表示:
  - シフト管理（全ユーザーのシフト管理）
  - 設定
- 一般ユーザーは以下のタブのみ表示:
  - シフト一覧（自分のシフトのみ）
  - シフト申請

### データベース
- Supabaseを使用
- RLSポリシーで権限管理
- 管理者は全ユーザーのusersテーブル情報を読み取り可能

### 開発環境
- ローカル開発: `supabase start`
- データリセット: `supabase db reset`
- シードデータ: `/supabase/seed.sql`

## よくある問題と解決策

### ユーザー名が「ユーザー不明」と表示される
- 原因: RLSポリシーでusersテーブルの読み取り権限不足
- 解決: 管理者用ポリシー `"Admins can view all users"` が適用されているか確認

### マイグレーション適用
```bash
supabase db reset  # 全マイグレーション + シードデータを適用
```

## 禁止事項・注意点
- パスワードは `password` 以外を使用しない（過去に複数回指摘済み）
- デバッグ用console.logは作業完了時に削除する
- 新機能追加時は既存のUI構造（タブ表示制御）を考慮する

## ファイル構造
```
/
├── index.html          # メインHTML
├── js/
│   ├── app.js         # メインロジック
│   └── supabase-config.js
├── styles.css         # スタイル
└── supabase/
    ├── migrations/    # データベーススキーマ
    └── seed.sql      # テストデータ
```

## 最終更新
2025-01-09: 初回作成、パスワード設定に関する指摘事項を記録