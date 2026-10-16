@echo off
cd /d "%~dp0"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm start
