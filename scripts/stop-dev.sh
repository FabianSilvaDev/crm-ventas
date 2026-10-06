#!/usr/bin/env bash
# Detiene los procesos de desarrollo del CRM.

echo "🛑 Deteniendo procesos de Node.js del CRM..."
taskkill //F //IM node.exe || true

echo "✅ Procesos detenidos."
