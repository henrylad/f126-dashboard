# --- build the dashboard frontend ---
FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm test && npm run build

# --- build and test the server ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/ ./
RUN dotnet test && dotnet publish src/PitWall.Server -c Release -o /out

# --- runtime: server + built frontend only ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend /out ./
COPY --from=frontend /src/dist ./wwwroot
RUN mkdir -p recordings data && chown app:app recordings data
USER app

# 5173 = dashboard (HTTP + WebSocket), 20777/udp = F1 telemetry
ENV ASPNETCORE_URLS=http://+:5173
EXPOSE 5173 20777/udp
HEALTHCHECK --interval=30s --timeout=3s CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/5173 && printf 'GET /health HTTP/1.0\\r\\n\\r\\n' >&3 && head -1 <&3 | grep -q ' 200 '"]
ENTRYPOINT ["dotnet", "PitWall.Server.dll"]
