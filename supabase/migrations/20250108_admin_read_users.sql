-- 管理者が全ユーザーの情報を読み取れるようにするポリシーを追加
create policy "Admins can view all users" on public.users
    for select using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.is_admin = true
        )
    );