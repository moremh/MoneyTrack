
# MoneyTrack

MoneyTrack es una aplicación web de gestión financiera personal que permite registrar ingresos y gastos, organizar movimientos por categorías, controlar objetivos de ahorro y consultar reportes desde una interfaz moderna y adaptable.

La aplicación fue desarrollada con React, Vite y Supabase, e incluye autenticación, persistencia en PostgreSQL, control de acceso con RLS, panel administrativo, planes Premium y soporte como aplicación web progresiva.

## Demo

**Aplicación publicada:**  
https://money-track-beta-v1.vercel.app

## Funciones principales

- Registro e inicio de sesión con Supabase Auth.
- Confirmación de correo electrónico.
- Dashboard con balance, ingresos, gastos y ahorros.
- Filtros por mes, trimestre, año o período personalizado.
- Registro, edición y eliminación de ingresos y gastos.
- Categorías personalizadas para cada tipo de movimiento.
- Objetivos de ahorro con monto objetivo, monto actual y fecha límite.
- Gráficos de balance y gastos por categoría.
- Reportes financieros por período.
- Exportación de reportes a Excel y PDF.
- Tema claro, oscuro o automático según el sistema.
- Formato regional de montos con separadores de miles y decimales.
- Límite mensual configurable para cuentas gratuitas.
- Planes Premium con movimientos ilimitados.
- Panel administrativo para usuarios, suscripciones y catálogo comercial.
- Gestión de precios, promociones y textos comerciales desde Administración.
- Aplicación instalable como PWA.
- Diseño adaptable para computadora, tablet y dispositivos móviles.

## Tecnologías utilizadas

### Frontend

- React
- Vite
- React Router DOM
- CSS Modules
- Bootstrap Icons
- Recharts
- XLSX
- jsPDF
- jspdf-autotable
- vite-plugin-pwa

### Backend y base de datos

- Supabase Auth
- Supabase PostgreSQL
- Row Level Security
- Funciones RPC
- Políticas de acceso por usuario y administrador

### Despliegue

- Vercel
- GitHub

## Estructura general

```text
MoneyTrack/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── config/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vercel.json
│   ├── vite.config.js
│   └── package.json
├── supabase/
│   └── migrations/
└── README.md
```

## Instalación local

### 1. Clonar el repositorio

```bash
git clone https://github.com/moremh/MoneyTrack.git
cd MoneyTrack/frontend
```

### 2. Instalar las dependencias

```bash
npm install
```

### 3. Configurar las variables de entorno

Crear el archivo:

```text
frontend/.env.local
```

Agregar las credenciales públicas del proyecto de Supabase:

```env
VITE_SUPABASE_URL=TU_URL_DE_SUPABASE
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA_DE_SUPABASE
```

No se deben subir archivos `.env` ni credenciales privadas al repositorio.

### 4. Preparar Supabase

Crear un proyecto en Supabase y ejecutar las migraciones SQL disponibles en:

```text
supabase/migrations/
```

Las migraciones contienen las tablas, funciones, políticas RLS y configuraciones necesarias para el funcionamiento de MoneyTrack.

### 5. Iniciar el proyecto

```bash
npm run dev
```

La aplicación se abrirá normalmente en:

```text
http://localhost:5173
```

## Comandos disponibles

```bash
npm run dev
```

Inicia el servidor de desarrollo.

```bash
npm run build
```

Genera la versión de producción dentro de `frontend/dist`.

```bash
npm run preview
```

Permite probar localmente la compilación de producción.

## Despliegue en Vercel

Configuración recomendada:

```text
Root Directory: frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Las variables de entorno también deben configurarse dentro del proyecto de Vercel:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

El archivo `frontend/vercel.json` contiene la redirección necesaria para que las rutas internas de React Router funcionen correctamente al recargar la página.

## Seguridad

MoneyTrack utiliza Row Level Security en Supabase para impedir que un usuario pueda consultar o modificar información perteneciente a otra cuenta.

Las operaciones sensibles se validan tanto en la interfaz como en la capa de acceso a datos. Entre ellas se incluyen:

- autenticación del usuario;
- propiedad de movimientos y categorías;
- restricciones por tipo de cuenta;
- validación de fechas y montos;
- permisos administrativos;
- límites mensuales del plan gratuito.

## Funcionamiento de los movimientos

Cada movimiento contiene:

- tipo: ingreso o gasto;
- descripción;
- monto;
- categoría;
- fecha;
- usuario propietario.

El saldo se calcula de la siguiente forma:

```text
Saldo = total de ingresos - total de gastos
```

El Dashboard puede mostrar todos los movimientos registrados o únicamente los pertenecientes al período seleccionado.

## Objetivos de ahorro

Los objetivos permiten registrar:

- nombre del objetivo;
- monto objetivo;
- monto ahorrado;
- fecha límite;
- estado del objetivo.

El progreso se actualiza según la relación entre el monto actual y el monto objetivo.

## Plan gratuito y Premium

El plan gratuito utiliza un límite de movimientos por mes calendario.

El contador se reinicia al comenzar un nuevo mes. Los administradores y usuarios Premium pueden registrar movimientos ilimitados.

El catálogo comercial permite administrar:

- nombres de planes;
- precios;
- ciclos de facturación;
- promociones;
- textos visibles;
- disponibilidad de cada opción.

## PWA

MoneyTrack puede instalarse desde navegadores compatibles y utilizarse como una aplicación independiente.

La configuración PWA incluye:

- manifiesto;
- iconos;
- service worker;
- recursos almacenados para una mejor experiencia de uso.

## Exportación de reportes

Desde la sección Reportes se pueden generar:

- archivos Excel con resumen, ingresos, gastos, categorías y datos mensuales;
- documentos PDF con resúmenes y tablas de movimientos.

Los archivos exportados respetan los filtros seleccionados por el usuario.

## Estado del proyecto

MoneyTrack se encuentra en desarrollo activo. Las funciones principales ya están disponibles, aunque pueden incorporarse nuevas mejoras visuales, comerciales y financieras.

## Autor

Desarrollado por **moremh**.

Repositorio:

https://github.com/moremh/MoneyTrack
