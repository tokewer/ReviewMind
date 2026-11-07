@echo off
chcp 65001 >nul
title ReviewMind - 连接到 Gemini MCP
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch_gemini_mcp.ps1"
pause
