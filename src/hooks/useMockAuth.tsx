import { createContext, useContext, useState, ReactNode } from "react";
import type { AppRole, Profile } from "@/types/database";

// Mock user data
const MOCK_ADMIN_USER = {
  id: "mock-admin-1",
  email: "admin@nodocrisis.cl",
};

const MOCK_ACTOR_USER = {
  id: "mock-actor-1",
  email: "actor@ongchile.cl",
};

const MOCK_ADMIN_PROFILE: Profile = {
  id: "profile-admin-1",
  user_id: "mock-admin-1",
  email: "admin@nodocrisis.cl",
  full_name: "Coordinador Demo",
  organization_name: "ONEMI Regional",
  organization_type: "gobierno",
  phone: "+56 9 1234 5678",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_ACTOR_PROFILE: Profile = {
  id: "profile-actor-1",
  user_id: "mock-actor-1",
  email: "actor@ongchile.cl",
  full_name: "María González",
  organization_name: "Cruz Roja Chilena",
  organization_type: "ong",
  phone: "+56 9 8765 4321",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

interface MockUser {
  id: string;
  email: string;
}

interface MockAuthContextType {
  user: MockUser | null;
  session: { user: MockUser } | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isActor: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { full_name?: string; organization_name?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Mock-specific
  toggleRole: () => void;
  currentRole: "admin" | "actor";
}

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<"admin" | "actor">("admin");
  
  const user = currentRole === "admin" ? MOCK_ADMIN_USER : MOCK_ACTOR_USER;
  const profile = currentRole === "admin" ? MOCK_ADMIN_PROFILE : MOCK_ACTOR_PROFILE;
  const roles: AppRole[] = currentRole === "admin" ? ["admin"] : ["actor"];

  const toggleRole = () => {
    setCurrentRole(prev => prev === "admin" ? "actor" : "admin");
  };

  const signIn = async () => {
    return { error: null };
  };

  const signUp = async () => {
    return { error: null };
  };

  const signOut = async () => {
    // No-op for mock
  };

  const refreshProfile = async () => {
    // No-op for mock
  };

  return (
    <MockAuthContext.Provider
      value={{
        user,
        session: { user },
        profile,
        roles,
        isAdmin: currentRole === "admin",
        isActor: currentRole === "actor",
        isLoading: false,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        toggleRole,
        currentRole,
      }}
    >
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (context === undefined) {
    throw new Error("useMockAuth must be used within a MockAuthProvider");
  }
  return context;
}

// Re-export as useAuth for compatibility
export { useMockAuth as useAuth };
