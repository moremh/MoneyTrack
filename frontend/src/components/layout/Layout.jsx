import {
  useEffect,
  useState,
} from "react";

import {
  Outlet,
  useLocation,
} from "react-router-dom";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

import styles from "./Layout.module.css";

const MOBILE_MEDIA_QUERY =
  "(max-width: 900px)";

const getIsMobileViewport = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window
    .matchMedia(MOBILE_MEDIA_QUERY)
    .matches;
};

function Layout() {
  const location = useLocation();

  const [
    isMobile,
    setIsMobile,
  ] = useState(
    getIsMobileViewport
  );

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(
    () => !getIsMobileViewport()
  );

  const toggleSidebar = () => {
    setSidebarOpen(
      (previousValue) =>
        !previousValue
    );
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  /*
   * Detecta el cambio entre la vista móvil
   * y la vista de escritorio.
   *
   * En escritorio, el menú comienza abierto.
   * En teléfono, comienza cerrado.
   */
  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        MOBILE_MEDIA_QUERY
      );

    const handleViewportChange = (
      event
    ) => {
      setIsMobile(
        event.matches
      );

      setSidebarOpen(
        !event.matches
      );
    };

    setIsMobile(
      mediaQuery.matches
    );

    setSidebarOpen(
      !mediaQuery.matches
    );

    mediaQuery.addEventListener?.(
      "change",
      handleViewportChange
    );

    return () => {
      mediaQuery.removeEventListener?.(
        "change",
        handleViewportChange
      );
    };
  }, []);

  /*
   * Cierra el sidebar móvil cuando cambia
   * la ruta de la aplicación.
   */
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [
    isMobile,
    location.pathname,
  ]);

  /*
   * Impide que el contenido del fondo se
   * desplace cuando el menú móvil está abierto.
   */
  useEffect(() => {
    if (
      !isMobile ||
      !sidebarOpen
    ) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    isMobile,
    sidebarOpen,
  ]);

  /*
   * Permite cerrar el menú móvil con Escape.
   */
  useEffect(() => {
    if (
      !isMobile ||
      !sidebarOpen
    ) {
      return undefined;
    }

    const handleKeyDown = (
      event
    ) => {
      if (
        event.key === "Escape"
      ) {
        closeSidebar();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isMobile,
    sidebarOpen,
  ]);

  return (
    <>
      <Navbar
        toggleSidebar={
          toggleSidebar
        }
      />

      <div
        className={
          styles.container
        }
      >
        <Sidebar
          isOpen={sidebarOpen}
          isMobile={isMobile}
          onClose={closeSidebar}
        />

        {isMobile &&
          sidebarOpen && (
            <button
              type="button"
              className={
                styles.backdrop
              }
              onClick={
                closeSidebar
              }
              aria-label="Cerrar menú lateral"
            />
          )}

        <main
          className={
            styles.content
          }
        >
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default Layout;