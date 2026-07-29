import { useState } from "react";
import { Outlet } from "react-router-dom";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

import styles from "./Layout.module.css";

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  return (
    <>
      <Navbar toggleSidebar={toggleSidebar} />

      <div className={styles.container}>
        <Sidebar isOpen={sidebarOpen} />

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default Layout;