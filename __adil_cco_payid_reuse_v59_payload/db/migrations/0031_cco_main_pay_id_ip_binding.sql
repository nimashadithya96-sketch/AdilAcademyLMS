ALTER TABLE cco_main_pay_ids
  ADD COLUMN IF NOT EXISTS bound_ip_hash text;
