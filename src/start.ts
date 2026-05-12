import { createStart, createMiddleware } from "@tanstack/react-start";
import { auth } from "@/lib/auth";

const authMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, next }) => {
    if (pathname.startsWith("/api/auth/")) {
      return auth.handler(request);
    }
    return next();
  }
);

export const startInstance = createStart(() => ({
  requestMiddleware: [authMiddleware] as const,
}));
