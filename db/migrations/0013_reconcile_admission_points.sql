-- Rebuild every missing propagation event idempotently from approved full payments.
WITH RECURSIVE propagation AS (
  SELECT
    p.id AS source_payment_id,
    p.requested_parent_account_id AS beneficiary_account_id,
    p.requested_side AS side,
    p.created_at,
    0 AS depth
  FROM payment_requests p
  WHERE p.status = 'APPROVED'
    AND p.paid_amount >= p.total_amount
    AND p.requested_parent_account_id IS NOT NULL
    AND p.requested_side IS NOT NULL

  UNION ALL

  SELECT
    propagation.source_payment_id,
    placement.parent_account_id,
    placement.side,
    propagation.created_at,
    propagation.depth + 1
  FROM propagation
  JOIN network_placements placement
    ON placement.account_id = propagation.beneficiary_account_id
  WHERE propagation.depth < 99
)
INSERT INTO point_events (
  id,
  idempotency_key,
  source_payment_id,
  beneficiary_account_id,
  side,
  points,
  event_type,
  created_at
)
SELECT
  gen_random_uuid(),
  'payment:' || source_payment_id::text || ':account:' || beneficiary_account_id::text,
  source_payment_id,
  beneficiary_account_id,
  side,
  1,
  'FULL_ADMISSION',
  created_at
FROM propagation
ON CONFLICT (idempotency_key) DO NOTHING;

-- Make the balance table exactly match the event ledger. Events at or before the
-- last completed Friday cycle belong to history; newer events remain available.
WITH cutoff AS (
  SELECT COALESCE(MAX(period_end), '-infinity'::timestamptz) AS last_period_end
  FROM commission_cycles
  WHERE status IN ('CALCULATED', 'APPROVED', 'PAID')
), totals AS (
  SELECT
    e.beneficiary_account_id AS account_id,
    COALESCE(SUM(e.points) FILTER (WHERE e.side = 'LEFT' AND e.created_at > cutoff.last_period_end), 0)::integer AS left_available,
    COALESCE(SUM(e.points) FILTER (WHERE e.side = 'RIGHT' AND e.created_at > cutoff.last_period_end), 0)::integer AS right_available,
    COALESCE(SUM(e.points) FILTER (WHERE e.side = 'LEFT'), 0)::integer AS lifetime_left,
    COALESCE(SUM(e.points) FILTER (WHERE e.side = 'RIGHT'), 0)::integer AS lifetime_right,
    MAX(e.created_at) AS last_activity
  FROM point_events e
  CROSS JOIN cutoff
  GROUP BY e.beneficiary_account_id
)
INSERT INTO account_point_balances (
  id,
  account_id,
  left_available,
  right_available,
  lifetime_left,
  lifetime_right,
  last_qualified_activity_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  account_id,
  left_available,
  right_available,
  lifetime_left,
  lifetime_right,
  last_activity,
  NOW()
FROM totals
ON CONFLICT (account_id) DO UPDATE SET
  left_available = EXCLUDED.left_available,
  right_available = EXCLUDED.right_available,
  lifetime_left = EXCLUDED.lifetime_left,
  lifetime_right = EXCLUDED.lifetime_right,
  last_qualified_activity_at = EXCLUDED.last_qualified_activity_at,
  updated_at = NOW();
