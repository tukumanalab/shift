-- 許容人数を日付ごとに設定するように変更

-- 既存のshift_capacityテーブルを削除
DROP TABLE IF EXISTS public.shift_capacity CASCADE;

-- 新しいshift_capacityテーブルを作成（日付ごとの設定）
CREATE TABLE IF NOT EXISTS public.shift_capacity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    max_capacity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- shift_capacityテーブルのRLS設定
ALTER TABLE public.shift_capacity ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが許容人数情報を参照できるポリシー
CREATE POLICY "Anyone can view shift capacity" ON public.shift_capacity
    FOR SELECT USING (true);

-- 管理者のみが許容人数を設定・更新・削除できるポリシー
CREATE POLICY "Admins can insert shift capacity" ON public.shift_capacity
    FOR INSERT WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update shift capacity" ON public.shift_capacity
    FOR UPDATE USING (public.is_admin_user(auth.uid())) 
    WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete shift capacity" ON public.shift_capacity
    FOR DELETE USING (public.is_admin_user(auth.uid()));

-- 許容人数をチェックする関数（日付ごと）
CREATE OR REPLACE FUNCTION public.check_shift_capacity(
    p_date DATE,
    p_exclude_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_max_capacity INTEGER;
    v_current_approved INTEGER;
BEGIN
    -- 該当日の許容人数を取得（設定されていない場合は1）
    SELECT COALESCE(max_capacity, 1)
    INTO v_max_capacity
    FROM public.shift_capacity
    WHERE date = p_date;
    
    -- 設定がない場合はデフォルト値を使用
    IF v_max_capacity IS NULL THEN
        v_max_capacity := 1;
    END IF;
    
    -- 現在の承認済みシフト数を取得（除外ユーザーがいる場合は除く）
    SELECT COUNT(DISTINCT user_id)
    INTO v_current_approved
    FROM public.shifts
    WHERE date = p_date 
      AND status = 'approved'
      AND (p_exclude_user_id IS NULL OR user_id != p_exclude_user_id);
    
    -- 許容人数内かどうかを判定
    RETURN v_current_approved < v_max_capacity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- シフト申請時に許容人数をチェックするトリガー関数（日付ごと）
CREATE OR REPLACE FUNCTION public.validate_shift_capacity()
RETURNS TRIGGER AS $$
BEGIN
    -- 承認済みシフトを作成・更新する場合のみチェック
    IF NEW.status = 'approved' THEN
        -- 許容人数を超えていないかチェック（更新の場合は現在のユーザーを除外）
        IF NOT public.check_shift_capacity(
            NEW.date, 
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.user_id ELSE NULL END
        ) THEN
            RAISE EXCEPTION 'この日付の許容人数を超えています。日付: %', NEW.date;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーを削除して新しいトリガーを追加
DROP TRIGGER IF EXISTS validate_shift_capacity_trigger ON public.shifts;
CREATE TRIGGER validate_shift_capacity_trigger
    BEFORE INSERT OR UPDATE ON public.shifts
    FOR EACH ROW EXECUTE FUNCTION public.validate_shift_capacity();

-- shift_capacityテーブルのupdated_atトリガー
CREATE TRIGGER handle_shift_capacity_updated_at
    BEFORE UPDATE ON public.shift_capacity
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_shift_capacity_date ON public.shift_capacity(date);
CREATE INDEX IF NOT EXISTS idx_shifts_date_status ON public.shifts(date, status);

-- デフォルトの許容人数設定を挿入（今後1週間、平日1人・土日0人）
INSERT INTO public.shift_capacity (date, max_capacity)
SELECT 
    date_val,
    CASE 
        WHEN EXTRACT(DOW FROM date_val) IN (0, 6) THEN 0  -- 土日は0人
        ELSE 1  -- 平日は1人
    END as max_capacity
FROM (
    SELECT CURRENT_DATE + INTERVAL '1 day' * generate_series(0, 6) as date_val
) dates
ON CONFLICT (date) DO NOTHING;