const sidebarMenu = [
  {
    title: "Dashboard",
    path: "/",
    icon: "bi bi-grid-1x2-fill",
  },
  {
    title: "Ingresos",
    path: "/income",
    icon: "bi bi-arrow-up-circle",
  },
  {
    title: "Gastos",
    path: "/expenses",
    icon: "bi bi-arrow-down-circle",
  },
  {
    title: "Categorías",
    path: "/categories",
    icon: "bi bi-tags",
  },
  {
    title: "Objetivos",
    path: "/goals",
    icon: "bi bi-bullseye",
  },
  {
    title: "Reportes",
    path: "/reports",
    icon: "bi bi-bar-chart",
  },
  {
    title: "Planes",
    path: "/plans",
    icon: "bi bi-gem",
    clientOnly: true,
  },
  {
    title: "Mi cuenta",
    path: "/account",
    icon: "bi bi-person-circle",
  },
  {
    title: "Configuración",
    path: "/settings",
    icon: "bi bi-gear",
  },
  {
    title: "Administración",
    path: "/admin",
    icon: "bi bi-shield-lock",
    adminOnly: true,
  },
];

export default sidebarMenu;