// Test-only controllers used by default-auth.runtime.test.ts to prove the app-level guard denies
// on its own.
//
// Deliberately NOT listed in src/controllers.ts: `unguarded` carries no auth decorator, so
// including it would (correctly) fail default-auth.metadata.test.ts. The runtime test mounts
// these into its own App instance instead, and collectRegisteredRoutes() filters on CONTROLLERS,
// so neither route shows up in the enumerated route lists.

import { Controller, Get, UseBefore } from 'routing-controllers';

import authMiddleware from '@/middlewares/auth.middleware';
import { Public } from '@/middlewares/public.decorator';

@Controller('/__guard-fixture__')
export class GuardFixtureController {
  /**
   * No @UseBefore(authMiddleware) and no @Public(). Nothing but createDefaultAuthGuard can stop
   * this handler from answering 200 — which makes the 401 assertion a proof about the guard
   * rather than about a decorator.
   */
  @Get('/unguarded')
  unguarded() {
    return 'reached';
  }

  /**
   * Control case. An unmounted path and an unguarded path both answer 401, so without this the
   * assertion above would pass just as happily against a controller that was never registered.
   */
  @Get('/reachable')
  @Public('Test fixture - proves the fixture controller is actually mounted')
  reachable() {
    return 'reached';
  }
}

/** Covers @Public() on a whole controller, with one handler opting back into auth. */
@Controller('/__public-class-fixture__')
@Public('Test fixture - whole controller marked public')
export class PublicControllerFixture {
  /** Inherits the controller's @Public(), so it answers without a session. */
  @Get('/inherited')
  inherited() {
    return 'reached';
  }

  /** Must stay protected despite the controller being public. */
  @Get('/protected')
  @UseBefore(authMiddleware)
  protectedRoute() {
    return 'reached';
  }
}
