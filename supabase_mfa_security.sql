-- 可选双重验证：未启用 MFA 的管理员维持原登录方式；启用后必须达到 aal2。
-- 已通过 Supabase migration 应用；此文件用于代码仓库留档。

create policy "verified mfa required when enrolled for orders"
on public.orders as restrictive for all to authenticated
using (not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified') or ((select auth.jwt())->>'aal') = 'aal2')
with check (not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified') or ((select auth.jwt())->>'aal') = 'aal2');

create policy "verified mfa required when enrolled for settings"
on public.settings as restrictive for all to authenticated
using (not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified') or ((select auth.jwt())->>'aal') = 'aal2')
with check (not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified') or ((select auth.jwt())->>'aal') = 'aal2');

create policy "verified mfa required when enrolled for admin membership"
on public.admin_users as restrictive for select to authenticated
using (not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified') or ((select auth.jwt())->>'aal') = 'aal2');

create policy "verified mfa required when enrolled for audit logs"
on public.order_audit_logs as restrictive for select to authenticated
using (not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified') or ((select auth.jwt())->>'aal') = 'aal2');
