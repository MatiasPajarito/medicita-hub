import { createOnHoldHandler } from "./handler.mjs";

Deno.serve(createOnHoldHandler({ env: (name: string) => Deno.env.get(name) }));
