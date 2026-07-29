import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function AdminRoute() {
  const {
    isAdmin,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
      >
        <p>Verificando permisos...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return <Outlet />;
}

export default AdminRoute;