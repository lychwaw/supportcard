@echo off
title SupportCard Local API (port 3000)
cd /d "%~dp0"
echo Starting local API server...
echo.
node scripts/dev-server.mjs
pause
