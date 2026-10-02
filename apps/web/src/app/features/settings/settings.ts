import { ChangeDetectionStrategy, Component } from '@angular/core';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
} from '../../ui';
import {
  SettingsCardComponent,
  type SettingsAction,
} from './components/settings-card/settings-card';

/**
 * Settings — configuración del workspace.
 *
 * Punto central para workspace, usuarios, permisos, integraciones, proveedores de
 * IA, notificaciones y branding. Hoy funciona como estructura visual de
 * configuración con datos estáticos; las acciones se registran como
 * `FRONTEND DATA GAP` hasta que existan los endpoints correspondientes.
 *
 * ## FRONTEND DATA GAP
 *
 * El backend no expone aún:
 *   - gestión de workspace (nombre, zona horaria, idioma, marca);
 *   - usuarios, roles y permisos;
 *   - integraciones con Meta Ads, Google Ads, TikTok, email, etc.;
 *   - proveedores de IA (API keys, modelos, límites de presupuesto);
 *   - preferencias de notificaciones (canales, frecuencia, umbrales);
 *   - branding (logo, colores, dominios).
 *
 * Todas las acciones de "configurar" en esta pantalla se registran como
 * `FRONTEND DATA GAP`.
 */

interface SettingsSection {
  readonly id: string;
  readonly icon: 'user' | 'users' | 'campaign' | 'ai' | 'notifications' | 'settings';
  readonly title: string;
  readonly description: string;
  readonly status: string | null;
  readonly statusVariant: 'success' | 'warning' | 'neutral' | 'info';
  readonly actions: readonly SettingsAction[];
}

@Component({
  selector: 'app-settings',
  imports: [
    CardComponent,
    BadgeComponent,
    EmptyStateComponent,
    SettingsCardComponent,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  protected readonly sections: readonly SettingsSection[] = [
    {
      id: 'workspace',
      icon: 'user',
      title: 'Workspace',
      description: 'Nombre del negocio, zona horaria, idioma y apariencia general.',
      status: 'Configurado',
      statusVariant: 'success',
      actions: [
        { id: 'edit-workspace', label: 'Editar', primary: true },
        { id: 'branding', label: 'Branding' },
      ],
    },
    {
      id: 'users',
      icon: 'users',
      title: 'Usuarios y permisos',
      description: 'Invita a tu equipo, asigna roles y controla qué puede ver cada perfil.',
      status: '1 usuario',
      statusVariant: 'neutral',
      actions: [
        { id: 'invite-user', label: 'Invitar', primary: true },
        { id: 'manage-roles', label: 'Roles' },
      ],
    },
    {
      id: 'integrations',
      icon: 'campaign',
      title: 'Integraciones',
      description: 'Conecta Meta Ads, Google Ads, TikTok, email y otros canales.',
      status: 'Sin conectar',
      statusVariant: 'warning',
      actions: [
        { id: 'add-integration', label: 'Añadir', primary: true },
        { id: 'view-integrations', label: 'Ver todas' },
      ],
    },
    {
      id: 'ai-providers',
      icon: 'ai',
      title: 'Proveedores de IA',
      description: 'Configura API keys, modelos por defecto y límites de gasto.',
      status: 'Pendiente',
      statusVariant: 'warning',
      actions: [
        { id: 'add-provider', label: 'Configurar', primary: true },
      ],
    },
    {
      id: 'notifications',
      icon: 'notifications',
      title: 'Notificaciones',
      description: 'Elige canales, frecuencia y umbrales para alertas del sistema y de IA.',
      status: 'Por defecto',
      statusVariant: 'neutral',
      actions: [
        { id: 'edit-notifications', label: 'Personalizar', primary: true },
      ],
    },
    {
      id: 'security',
      icon: 'settings',
      title: 'Seguridad',
      description: 'Sesiones activas, autenticación de dos factores y política de acceso.',
      status: null,
      statusVariant: 'neutral',
      actions: [
        { id: 'security-settings', label: 'Revisar', primary: true },
      ],
    },
  ];

  protected onSectionAction(sectionId: string, actionId: string): void {
    console.log(
      `FRONTEND DATA GAP: no backend endpoint for settings action "${actionId}" in "${sectionId}"`,
    );
  }

  protected onBillingAction(): void {
    console.log('FRONTEND DATA GAP: no backend endpoint for billing/subscription');
  }
}
