import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { Permission } from '@crm/contracts';

import { PermissionsGuard } from './permissions.guard.js';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator.js';

function createMockContext(
  handlerPermissions: readonly Permission[] | undefined,
  granted: readonly Permission[],
) {
  function handler() {
    /* no-op */
  }
  if (handlerPermissions !== undefined) {
    Reflect.defineMetadata(REQUIRE_PERMISSION_KEY, handlerPermissions, handler);
  }

  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { permissions: granted } }),
    }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as import('@nestjs/common').ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('permite la petición cuando no hay permisos requeridos', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(guard.canActivate(createMockContext(undefined, []))).toBe(true);
  });

  it('permite cuando el usuario tiene todos los permisos requeridos', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(
      guard.canActivate(
        createMockContext([Permission.READ_CUSTOMER_DATA], [Permission.READ_CUSTOMER_DATA]),
      ),
    ).toBe(true);
  });

  it('rechaza cuando le falta un permiso al usuario', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createMockContext(
          [Permission.READ_CUSTOMER_DATA, Permission.WRITE_CUSTOMER_DATA],
          [Permission.READ_CUSTOMER_DATA],
        ),
      ),
    ).toThrowError(/Permiso insuficiente/);
  });
});
