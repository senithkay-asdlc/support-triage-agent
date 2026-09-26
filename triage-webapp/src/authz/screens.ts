// Adapted from thunder-authentication's screens.example.ts pattern for THIS
// app's two screens (wireframes.dsl: TicketQueue, TicketDetail).
//
// THIS IS THE ONLY FILE THAT KNOWS ABOUT SCREENS. A screen is reachable when
// the caller may call the operation it LOADS — named here, checked against
// ./operations.gen.ts, never retyped as a literal handle anywhere else.
//
// TicketDetail carries no sidebar item of its own (the wireframe reaches it
// only by clicking a queue row), but it is still gated on its own load
// operation through RequireOperation, so a caller who guesses the URL without
// tickets:read sees Forbidden rather than a raw 401.

import { canCall } from "./core";
import { OPERATIONS, isOperationKey, type OperationKey } from "./operations.gen";

export interface ScreenRoute {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly loads: OperationKey | null;
  readonly public?: boolean;
}

export const SCREEN_ROUTES: readonly ScreenRoute[] = [
  { key: "queue", label: "Queue", path: "/queue", loads: "GET /tickets" },
  {
    key: "ticket-detail",
    label: "Ticket Detail",
    path: "/tickets/:ticketId",
    loads: "GET /tickets/{ticketId}",
  },
];

for (const screen of SCREEN_ROUTES) {
  if (screen.loads !== null && !isOperationKey(screen.loads)) {
    throw new Error(
      `src/authz/screens.ts: screen "${screen.label}" loads "${screen.loads}", which ` +
        `no contract declares. Re-run \`npm run gen\`, or name the operation the ` +
        `way openapi.yaml spells it.`,
    );
  }
}

export function reachableScreens(
  scopes: ReadonlySet<string>,
  signedIn: boolean,
): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((screen) => {
    if (screen.public) return true;
    if (screen.loads === null) return signedIn;
    return canCall(OPERATIONS[screen.loads], scopes, signedIn);
  });
}

export function hasScopedReach(scopes: ReadonlySet<string>, signedIn: boolean): boolean {
  return reachableScreens(scopes, signedIn).some(
    (screen) => !screen.public && screen.loads !== null,
  );
}
