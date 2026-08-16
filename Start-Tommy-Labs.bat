@echo off
title Tommy Labs Server
cd /d C:\Users\TOMMY\scruggs3d
echo Starting Tommy Labs website...
start "Tommy Labs Server" cmd /k "python -m http.server 8123 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8123/index.html"
