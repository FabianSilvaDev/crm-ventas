import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { Permission } from '@crm/contracts';
import {
  loginRequestSchema,
  registerOwnerRequestSchema,
  registerRequestSchema,
  setupRequestSchema,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type RefreshResponse,
  type RegisterOwnerRequest,
  type RegisterOwnerResponse,
  type RegisterRequest,
  type RegisterResponse,
  type SetupRequest,
  type SetupResponse,
} from '@crm/contracts';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { AppError } from '../common/app-error.js';

import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import { RequirePermission } from './require-permission.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';

/**
 * Controller REST de autenticación (`docs/api.md` §3 y catálogo §9.1).
 *
 * Endpoints públicos: `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/setup`,
 * `POST /auth/setup`.
 * Endpoints autenticados: `/auth/me`, `/auth/register` (requiere `MANAGE_AGENTS`).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginRequestSchema }) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { user, accessToken, refreshToken, expiresIn } = await this.authService.login(body, req);

    this.setRefreshCookie(res, refreshToken);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: this.authService.buildAuthenticatedUser(user),
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const cookieName = this.cookieName();
    const oldToken = this.readCookie(req, cookieName);

    const { response, refreshToken } = await this.authService.refresh(oldToken, req);
    this.setRefreshCookie(res, refreshToken);

    return response;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const cookieName = this.cookieName();
    await this.authService.logout(this.readCookie(req, cookieName), req);
    this.clearRefreshCookie(res);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.MANAGE_AGENTS)
  @HttpCode(201)
  async register(
    @Body({ schema: registerRequestSchema }) body: RegisterRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<RegisterResponse> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: req.user.organizationId },
    });
    if (organization === null) {
      throw new Error(`Organización ${req.user.organizationId} no encontrada.`);
    }
    return this.authService.register(body, organization.id, this.actor(req.user), req);
  }

  @Post('register-owner')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.MANAGE_AGENTS)
  @HttpCode(201)
  async registerOwner(
    @Body({ schema: registerOwnerRequestSchema }) body: RegisterOwnerRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<RegisterOwnerResponse> {
    if (req.user.role !== 'OWNER') {
      throw new AppError('FORBIDDEN_PERMISSION', 'Solo un OWNER puede crear otro OWNER.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: req.user.organizationId },
    });
    if (organization === null) {
      throw new Error(`Organización ${req.user.organizationId} no encontrada.`);
    }

    return this.authService.registerOwner(body, organization.id, this.actor(req.user), req);
  }

  @Get('setup')
  async setupRequired(): Promise<{ required: boolean }> {
    const count = await this.authService.countUsers();
    return { required: count === 0 };
  }

  @Post('setup')
  @HttpCode(200)
  async setup(
    @Body({ schema: setupRequestSchema }) body: SetupRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SetupResponse> {
    const { user, accessToken, refreshToken, expiresIn } = await this.authService.setup(body, req);

    this.setRefreshCookie(res, refreshToken);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: this.authService.buildAuthenticatedUser(user),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async me(@Req() req: AuthenticatedRequest): Promise<MeResponse> {
    return this.authService.me(req.user.id);
  }

  private setRefreshCookie(res: Response, token: string): void {
    // El prefijo `__Host-` exige `Secure`, `Path=/` y ausencia de `Domain`. En desarrollo con
    // `http://localhost` los navegadores modernos aceptan cookies `Secure`.
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.cookieName(), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  private readCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (header === undefined) {
      return undefined;
    }

    const match = header.split(';').find((part) => part.trim().startsWith(`${name}=`));
    if (match === undefined) {
      return undefined;
    }

    return decodeURIComponent(match.split('=')[1] ?? '');
  }

  private cookieName(): string {
    return '__Host-crm_rt';
  }

  private actor(user: AuthenticatedRequest['user']): { userId: string; organizationId: string } {
    return { userId: user.id, organizationId: user.organizationId };
  }
}
