-- =========================================================
-- MONEYTRACK
-- CATÁLOGO COMERCIAL ADMINISTRABLE
-- =========================================================

begin;

-- =========================================================
-- 1. CONFIGURACIÓN GENERAL DE LA PÁGINA DE PLANES
-- =========================================================

create table if not exists public.commercial_settings (
  id text primary key
    default 'main'
    check (id = 'main'),

  whatsapp_number text not null default '',

  plans_eyebrow text not null
    default 'Planes MoneyTrack',

  plans_title text not null
    default 'Elegí el plan que mejor se adapte a vos',

  plans_description text not null
    default 'Todos los planes tienen las mismas herramientas. La diferencia está en la cantidad de movimientos que podés registrar.',

  activation_title text not null
    default '¿Cómo se activa Premium?',

  activation_description text not null
    default 'Elegís el plan, enviás el mensaje por WhatsApp y recibís los datos para realizar la transferencia. Después de verificar el comprobante, tu cuenta se activa desde el panel administrativo.',

  modal_eyebrow text not null
    default 'MoneyTrack Premium',

  modal_title text not null
    default 'Conocé los planes Premium',

  modal_limit_title text not null
    default 'Llegaste al límite mensual',

  modal_description text not null
    default 'Elegí un plan Premium para registrar movimientos sin límites.',

  modal_limit_description text not null
    default 'Elegí un plan para continuar registrando movimientos sin límites.',

  payment_disclaimer text not null
    default 'El plan se activará después de verificar el comprobante de pago.',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

-- =========================================================
-- 2. PLANES VISIBLES PARA LOS CLIENTES
-- =========================================================

create table if not exists public.commercial_plans (
  id text primary key
    check (
      id in (
        'free',
        'monthly',
        'annual'
      )
    ),

  title text not null,
  subtitle text not null default '',
  duration text not null default '',

  price numeric(12, 2) not null
    default 0
    check (price >= 0),

  price_suffix text not null default '',
  description text not null default '',
  badge text,

  button_text text not null default '',

  features text[] not null
    default array[]::text[],

  is_visible boolean not null
    default true,

  sort_order integer not null
    default 0,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

-- =========================================================
-- 3. PROMOCIONES
-- =========================================================

create table if not exists public.commercial_promotions (
  id uuid primary key
    default gen_random_uuid(),

  plan_id text not null
    references public.commercial_plans(id)
    on update cascade
    on delete restrict,

  title text not null,
  description text not null default '',
  badge text,

  promotional_price numeric(12, 2) not null
    check (promotional_price >= 0),

  previous_price numeric(12, 2)
    check (
      previous_price is null
      or previous_price >= 0
    ),

  button_text text not null
    default 'Solicitar promoción',

  details text[] not null
    default array[]::text[],

  starts_on date,
  ends_on date,

  is_active boolean not null
    default true,

  show_on_plans boolean not null
    default true,

  show_on_modal boolean not null
    default true,

  sort_order integer not null
    default 0,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint commercial_promotions_plan_check
    check (
      plan_id in (
        'monthly',
        'annual'
      )
    ),

  constraint commercial_promotions_dates_check
    check (
      starts_on is null
      or ends_on is null
      or starts_on <= ends_on
    )
);

-- =========================================================
-- 4. ÍNDICES
-- =========================================================

create index if not exists
commercial_plans_visibility_order_idx
on public.commercial_plans (
  is_visible,
  sort_order
);

create index if not exists
commercial_promotions_plan_idx
on public.commercial_promotions (
  plan_id
);

create index if not exists
commercial_promotions_visibility_idx
on public.commercial_promotions (
  is_active,
  starts_on,
  ends_on,
  sort_order
);

-- =========================================================
-- 5. UPDATED_AT AUTOMÁTICO
-- Usa la función creada en 001_initial_schema.sql.
-- =========================================================

drop trigger if exists
commercial_settings_set_updated_at
on public.commercial_settings;

create trigger
commercial_settings_set_updated_at
before update
on public.commercial_settings
for each row
execute function public.set_updated_at();

drop trigger if exists
commercial_plans_set_updated_at
on public.commercial_plans;

create trigger
commercial_plans_set_updated_at
before update
on public.commercial_plans
for each row
execute function public.set_updated_at();

drop trigger if exists
commercial_promotions_set_updated_at
on public.commercial_promotions;

create trigger
commercial_promotions_set_updated_at
before update
on public.commercial_promotions
for each row
execute function public.set_updated_at();

-- =========================================================
-- 6. DATOS INICIALES
-- =========================================================

insert into public.commercial_settings (
  id,
  whatsapp_number,
  plans_eyebrow,
  plans_title,
  plans_description,
  activation_title,
  activation_description,
  modal_eyebrow,
  modal_title,
  modal_limit_title,
  modal_description,
  modal_limit_description,
  payment_disclaimer
)
values (
  'main',
  '5493813540133',
  'Planes MoneyTrack',
  'Elegí el plan que mejor se adapte a vos',
  'Todos los planes tienen las mismas herramientas. La diferencia está en la cantidad de movimientos que podés registrar.',
  '¿Cómo se activa Premium?',
  'Elegís el plan, enviás el mensaje por WhatsApp y recibís los datos para realizar la transferencia. Después de verificar el comprobante, tu cuenta se activa desde el panel administrativo.',
  'MoneyTrack Premium',
  'Conocé los planes Premium',
  'Llegaste al límite mensual',
  'Elegí un plan Premium para registrar movimientos sin límites.',
  'Elegí un plan para continuar registrando movimientos sin límites.',
  'El plan se activará después de verificar el comprobante de pago.'
)
on conflict (id)
do nothing;

insert into public.commercial_plans (
  id,
  title,
  subtitle,
  duration,
  price,
  price_suffix,
  description,
  badge,
  button_text,
  features,
  is_visible,
  sort_order
)
values
(
  'free',
  'Gratuito',
  'Para comenzar',
  'Sin vencimiento',
  0,
  'sin vencimiento',
  'Las herramientas esenciales para organizar tus finanzas.',
  null,
  '',
  array[
    '100 movimientos por mes',
    'Ingresos y gastos',
    'Reportes PDF y Excel',
    'Objetivos y categorías',
    'Todos los gráficos y filtros'
  ],
  true,
  1
),
(
  'monthly',
  'Premium mensual',
  'Movimientos ilimitados',
  '1 mes',
  6000,
  'por mes',
  'Movimientos ilimitados durante un mes.',
  null,
  'Solicitar Premium mensual',
  array[
    'Movimientos ilimitados',
    'Todas las funciones del plan gratuito',
    'Reportes PDF y Excel',
    'Filtros y estadísticas completas',
    'Activación manual por WhatsApp'
  ],
  true,
  2
),
(
  'annual',
  'Premium anual',
  'Movimientos ilimitados',
  '12 meses',
  60000,
  'por año',
  'Movimientos ilimitados durante doce meses.',
  '2 meses bonificados',
  'Solicitar Premium anual',
  array[
    'Movimientos ilimitados',
    'Todas las funciones del plan gratuito',
    'Reportes PDF y Excel',
    'Filtros y estadísticas completas',
    'Activación manual por WhatsApp'
  ],
  true,
  3
)
on conflict (id)
do nothing;

-- =========================================================
-- 7. ROW LEVEL SECURITY
-- =========================================================

alter table public.commercial_settings
enable row level security;

alter table public.commercial_plans
enable row level security;

alter table public.commercial_promotions
enable row level security;

-- =========================================================
-- 8. POLÍTICAS DE CONFIGURACIÓN GENERAL
-- =========================================================

drop policy if exists
commercial_settings_select_authenticated
on public.commercial_settings;

create policy
commercial_settings_select_authenticated
on public.commercial_settings
for select
to authenticated
using (true);

drop policy if exists
commercial_settings_update_admin
on public.commercial_settings;

create policy
commercial_settings_update_admin
on public.commercial_settings
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- =========================================================
-- 9. POLÍTICAS DE PLANES
-- Los clientes leen solamente planes visibles.
-- El administrador puede leerlos todos.
-- =========================================================

drop policy if exists
commercial_plans_select_visible_or_admin
on public.commercial_plans;

create policy
commercial_plans_select_visible_or_admin
on public.commercial_plans
for select
to authenticated
using (
  is_visible
  or public.is_admin()
);

drop policy if exists
commercial_plans_insert_admin
on public.commercial_plans;

create policy
commercial_plans_insert_admin
on public.commercial_plans
for insert
to authenticated
with check (
  public.is_admin()
);

drop policy if exists
commercial_plans_update_admin
on public.commercial_plans;

create policy
commercial_plans_update_admin
on public.commercial_plans
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

drop policy if exists
commercial_plans_delete_admin
on public.commercial_plans;

create policy
commercial_plans_delete_admin
on public.commercial_plans
for delete
to authenticated
using (
  public.is_admin()
);

-- =========================================================
-- 10. POLÍTICAS DE PROMOCIONES
-- Los clientes leen solo promociones activas
-- dentro de sus fechas de vigencia.
-- =========================================================

drop policy if exists
commercial_promotions_select_active_or_admin
on public.commercial_promotions;

create policy
commercial_promotions_select_active_or_admin
on public.commercial_promotions
for select
to authenticated
using (
  public.is_admin()
  or (
    is_active
    and (
      starts_on is null
      or starts_on <= current_date
    )
    and (
      ends_on is null
      or ends_on >= current_date
    )
  )
);

drop policy if exists
commercial_promotions_insert_admin
on public.commercial_promotions;

create policy
commercial_promotions_insert_admin
on public.commercial_promotions
for insert
to authenticated
with check (
  public.is_admin()
);

drop policy if exists
commercial_promotions_update_admin
on public.commercial_promotions;

create policy
commercial_promotions_update_admin
on public.commercial_promotions
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

drop policy if exists
commercial_promotions_delete_admin
on public.commercial_promotions;

create policy
commercial_promotions_delete_admin
on public.commercial_promotions
for delete
to authenticated
using (
  public.is_admin()
);

-- =========================================================
-- 11. PERMISOS
-- RLS seguirá decidiendo quién puede modificar.
-- =========================================================

revoke all
on table public.commercial_settings
from anon, authenticated;

revoke all
on table public.commercial_plans
from anon, authenticated;

revoke all
on table public.commercial_promotions
from anon, authenticated;

grant select, update
on table public.commercial_settings
to authenticated;

grant select, insert, update, delete
on table public.commercial_plans
to authenticated;

grant select, insert, update, delete
on table public.commercial_promotions
to authenticated;

commit;