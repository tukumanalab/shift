# Supabase セットアップガイド

## 1. Supabaseプロジェクトの作成
1. [Supabase](https://supabase.com)にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクトのURLとAnon Keyを取得

## 2. データベーステーブルの作成

### 方法1: Migrationを使用（推奨）

ローカル開発環境では、migrationファイルが自動的に適用されます：

```bash
# ローカルSupabaseを起動（migrationが自動適用される）
supabase start

# リモートにmigrationを適用する場合
supabase db push
```

### 方法2: 手動でSQLを実行

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

-- 管理者は全てのシフトを表示・削除できるポリシー
CREATE POLICY "Admins can view all shifts" ON shifts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can delete all shifts" ON shifts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND is_admin = true
        )
    );
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

-- 管理者は全ての申請を表示できるポリシー
CREATE POLICY "Admins can view all requests" ON shift_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND is_admin = true
        )
    );
```

### user_profiles テーブル（管理者フラグ管理用）
```sql
CREATE TABLE user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLSを有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のプロフィールを表示可能
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- 新規ユーザー登録時に自動でプロフィールを作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, is_admin)
    VALUES (new.id, false);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 3. 管理者ユーザーの設定

初回管理者を設定するには、SQL Editorで以下を実行：

```sql
-- 管理者にするユーザーのIDを確認
SELECT id, email FROM auth.users;

-- 特定ユーザーを管理者に設定
UPDATE user_profiles SET is_admin = true WHERE user_id = 'ユーザーのUUID';
```

## 4. 設定の適用
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