@echo off
cd /d "%~dp0"
title Long Game
if not exist build\longgame.html python tools\build_data.py
python server\longgame.py --open
if errorlevel 1 (
  echo.
  echo Long Game could not start. Is Python installed and on your PATH?
  pause
)
