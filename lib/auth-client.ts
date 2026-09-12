import { createAuthClient } from "better-auth/react";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";
import { ac, roles } from "./permissions";

export const authClient = createAuthClient({
  // inferAdditionalFields is type-only glue: it types signUp.email's extra
  // fields (company) from the server config without bundling server code.
  plugins: [adminClient({ ac, roles }), inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, useSession, admin } = authClient;
