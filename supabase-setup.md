# Supabase セットアップガイド

## 1. Supabaseプロジェクトの作成
1. [Supabase](https://supabase.com)にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクトのURLとAnon Keyを取得

## 2. データベーステーブルの作成

### shifts テーブル
```sql
CREATE TABLE shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLSを有効化
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- ユーザーが自分のシフトのみ表示できるポリシー
CREATE POLICY "Users can view own shifts" ON shifts
    FOR SELECT USING (auth.uid() = user_id);
```

### shift_requests テーブル
```sql
CREATE TABLE shift_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    note TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLSを有効化
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;

-- ユーザーが自分の申請を作成・表示できるポリシー
CREATE POLICY "Users can create own requests" ON shift_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests" ON shift_requests
    FOR SELECT USING (auth.uid() = user_id);
```

## 3. 設定の適用
1. `js/supabase-config.js`ファイルを開く
2. 以下の値を実際の値に置き換える：
   - `YOUR_SUPABASE_URL` → プロジェクトのURL
   - `YOUR_SUPABASE_ANON_KEY` → プロジェクトのAnon Key

## 4. GitHub Pagesへのデプロイ
1. GitHubリポジトリを作成
2. 全ファイルをコミット・プッシュ
3. Settings → Pages → Source を "Deploy from a branch" に設定
4. Branch を main（またはmaster）、フォルダを / (root) に設定
5. Saveをクリック

数分後、`https://[username].github.io/[repository-name]/`でアクセス可能になります。