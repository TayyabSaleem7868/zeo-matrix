import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type AdminAuthContextType = {
  isAuthorized: boolean;
  login: (name: string, secret: string) => boolean;
  logout: () => void;
};
const ADMIN_CREDENTIALS = {
  NAME: "ZAROON",
  SECRET: "ZAROON_IS_TRUE_ADMIN",
};

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthorized, setIsAuthorized] = useState(false);

  const value = useMemo<AdminAuthContextType>(
    () => ({
      isAuthorized,
      login: (name: string, secret: string) => {
        const ok = name === ADMIN_CREDENTIALS.NAME && secret === ADMIN_CREDENTIALS.SECRET;
        setIsAuthorized(ok);
        return ok;
      },
      logout: () => setIsAuthorized(false),
    }),
    [isAuthorized]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
};
