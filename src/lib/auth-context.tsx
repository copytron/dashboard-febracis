import { createContext, useContext, type ReactNode } from "react";
import { useSession, signOut as _signOut } from "@/lib/auth-client";
import type { User } from "@/lib/auth";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  return (
    <Ctx.Provider
      value={{
        user: (session?.user as User) ?? null,
        loading: isPending,
        signOut: async () => {
          await _signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
