@echo off
REM Detiene los procesos de desarrollo del CRM.

echo Deteniendo procesos de Node.js del CRM...
taskkill /F /IM node.exe

echo Procesos detenidos.
