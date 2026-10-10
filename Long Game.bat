@echo off
cd /d "%~dp0"
title Long Game
python longgame.py --open
if errorlevel 1 (
  echo.
  echo Long Game could not start. Is Python installed and on your PATH?
  pause
)
