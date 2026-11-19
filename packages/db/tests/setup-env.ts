// Points the package's own pool (used by withTenant and the privileged calls) at the test database,
// connected as the app role.
import { inject } from "vitest";

process.env.DATABASE_URL = inject("appUrl");
