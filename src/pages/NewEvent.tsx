import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useMockAuth";
import Coordination from "./admin/Coordination";

export default function NewEvent() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Coordination />;
}
