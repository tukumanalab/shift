# アルバイトシフト管理アプリケーション仕様書

## 概要
Vanilla JavaScriptとSupabaseを使用したWebベースのシフト管理アプリケーション。
GitHub Pagesでホスティングすることを前提とした静的サイトとして構築。

## 技術スタック
- **フロントエンド**: Vanilla JavaScript (フレームワーク不使用)
- **スタイリング**: Pure CSS
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **ホスティング**: GitHub Pages

## 主要機能

### 1. ユーザー認証
- メールアドレスとパスワードによるログイン
- 新規ユーザー登録（名前、メールアドレス、パスワード）
- ログアウト機能
- セッション管理

### 2. シフト管理
- **勤務時間**: 13:00-18:00の間で1時間単位
  - 13:00-14:00
  - 14:00-15:00
  - 15:00-16:00
  - 16:00-17:00
  - 17:00-18:00
- **勤務可能日**: 平日のみ（土日は選択不可）

### 3. カレンダー表示
- 月単位でのカレンダー表示
- 前月・次月への移動機能
- シフトがある日の視覚的表示（青色ハイライト）
- 土日のグレーアウト表示
- 日付クリックで選択可能（平日のみ）

### 4. シフト希望申請
- 日付選択（土日は選択不可）
- 時間帯選択（1時間単位）
- 備考欄（任意）
- 申請ステータス管理（申請中/承認済み/却下）

### 5. シフト一覧
- 当月のシフト一覧表示
- 日付と時間帯の表示

### 6. 申請済みシフト希望一覧
- 申請履歴の表示
- ステータス別の色分け表示
  - 申請中: オレンジ
  - 承認済み: 緑
  - 却下: 赤

## データベース構造

### shiftsテーブル
- `id`: UUID (主キー)
- `user_id`: UUID (外部キー → auth.users)
- `date`: DATE
- `time_slot`: VARCHAR(20)
- `created_at`: TIMESTAMP WITH TIME ZONE

### shift_requestsテーブル
- `id`: UUID (主キー)
- `user_id`: UUID (外部キー → auth.users)
- `date`: DATE
- `time_slot`: VARCHAR(20)
- `note`: TEXT (任意)
- `status`: VARCHAR(20) (pending/approved/rejected)
- `created_at`: TIMESTAMP WITH TIME ZONE

## セキュリティ
- Row Level Security (RLS) を使用
- ユーザーは自分のデータのみアクセス可能
- anon keyのみ使用（service_role keyは不使用）

## ファイル構成
```
/
├── index.html          # メインHTML
├── styles.css          # スタイルシート
├── js/
│   ├── app.js         # メインアプリケーションロジック
│   └── supabase-config.js  # Supabase設定
├── supabase-setup.md  # Supabaseセットアップガイド
└── SPECIFICATION.md   # この仕様書
```

## UI/UX仕様

### レスポンシブデザイン
- モバイル対応（768px以下でレイアウト調整）
- タブナビゲーションは縦並びに変更

### カラースキーム
- プライマリカラー: #3498db (青)
- 背景色: #f5f5f5
- カード背景: #fff
- 土日: #ecf0f1 (グレー)

### タブ構成
1. **カレンダー**: メインビュー、月間カレンダー表示
2. **シフト一覧**: 確定シフトの一覧
3. **シフト希望**: 新規申請と申請履歴

## 制限事項
- 管理者機能は未実装（シフト承認は手動でデータベース更新が必要）
- 通知機能なし
- シフトの編集・削除機能なし
- 複数時間帯の一括申請不可