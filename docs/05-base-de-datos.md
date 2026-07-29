# MoneyTrack - Base de Datos

## Objetivo

La base de datos almacenará toda la información necesaria para gestionar las finanzas personales de cada usuario de forma segura y organizada.

---

# Tablas principales

## Usuarios

Descripción:
Almacena la información de cada usuario registrado.

Campos:

- Id
- Nombre
- Apellido
- Email
- ContraseñaHash
- FechaRegistro
- FotoPerfil
- MonedaPreferida
- Tema
- Estado

---

## Categorías

Descripción:
Permite clasificar los movimientos financieros.

Campos:

- Id
- Nombre
- Tipo (Ingreso/Gasto)
- Color
- Icono
- UsuarioId

---

## Movimientos

Descripción:
Almacena todos los ingresos y gastos.

Campos:

- Id
- UsuarioId
- CategoriaId
- Tipo
- Monto
- Fecha
- Descripcion
- MetodoPago
- Estado

---

## Objetivos

Descripción:
Permite registrar metas de ahorro.

Campos:

- Id
- UsuarioId
- Nombre
- MontoObjetivo
- MontoActual
- FechaInicio
- FechaLimite
- Estado

---

## Presupuestos

Descripción:
Permite establecer límites de gasto por categoría.

Campos:

- Id
- UsuarioId
- CategoriaId
- MontoLimite
- Mes
- Año

---

# Relaciones

Usuarios

1 ---- N Categorías

Usuarios

1 ---- N Movimientos

Usuarios

1 ---- N Objetivos

Usuarios

1 ---- N Presupuestos

Categorías

1 ---- N Movimientos

Categorías

1 ---- N Presupuestos