-- ============================================================
-- MONEYTRACK
-- Reconciliar saldo de objetivos con su historial de ahorro
-- ============================================================

with goal_balances as (
  select
    g.id as goal_id,

    coalesce(
      sum(
        case
          when gm.type = 'deposit'
            then gm.amount

          when gm.type = 'withdrawal'
            then -gm.amount

          else 0
        end
      ),
      0
    ) as calculated_amount

  from public.goals g

  left join public.goal_movements gm
    on gm.goal_id = g.id
    and gm.user_id = g.user_id

  group by g.id
)

update public.goals g

set
  current_amount =
    gb.calculated_amount,

  status =
    case
      when
        gb.calculated_amount >=
        g.target_amount
      then 'completed'

      else 'active'
    end,

  updated_at = now()

from goal_balances gb

where g.id = gb.goal_id

  and g.current_amount
    is distinct from
    gb.calculated_amount;