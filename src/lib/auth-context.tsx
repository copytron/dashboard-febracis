import { createContext, useContext, type ReactNode } from "react";
import { useSession, signOut as _signOut } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { User } from "@/lib/auth";
import { getServerSession, getUserRole } from "@/server/auth.helpers";

const getMyRole = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getServerSession();
  if (!session?.user) return { role: "viewer" as const };
  const role = await getUserRole(session.user.id);
  return { role };
});

type AuthCtx = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const userId = (session?.user as User)?.id;

  const { data: roleData } = useQuery({
    queryKey: ["my-role", userId],
    queryFn: () => getMyRole(),
    enabled: !!userId,
  });

  return (
    <Ctx.Provider
      value={{
        user: (session?.user as User) ?? null,
        loading: isPending,
        isAdmin: roleData?.role === "admin",
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
