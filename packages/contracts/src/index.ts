/**
 * @crm/contracts — fuente única de verdad del contrato.
 *
 * Regla del proyecto (ADR-012): los schemas Zod viven aquí, de aquí se genera OpenAPI, y del
 * OpenAPI se genera el cliente Angular. El CI falla si el OpenAPI commiteado no coincide con
 * estos schemas. **Nadie escribe un tipo de API a mano.**
 */

// Primero el idioma de los mensajes: es una configuración global de Zod y debe estar aplicada
// antes de que nadie valide nada.
import './zod-locale.js';

export * from './errors.js';
export * from './identity.js';
export * from './leads.js';
export * from './webhooks.js';
