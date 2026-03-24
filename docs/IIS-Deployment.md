# IIS Deployment Guide

This document explains how to deploy the Chart Builder application on Windows Server with IIS.

## 1. Deployment Architecture

Use one of these patterns:

1. Recommended (single domain)
- Host the Vue frontend as static files in IIS (for example: `D:\inetpub\chartbuilder\frontend`).
- Host the ASP.NET Core API in IIS as an application under `/api` (for example: `D:\inetpub\chartbuilder\api`).
- Result:
  - Frontend: `https://your-domain/`
  - API: `https://your-domain/api/...`

2. Alternative (separate domains)
- Frontend on one IIS site/domain.
- API on another IIS site/domain.
- Requires CORS configuration in API.

## 2. Prerequisites

Install on the server:

1. IIS with required features
- Web Server
- Static Content
- Default Document
- HTTP Errors
- Request Filtering
- IIS Management Console

2. ASP.NET Core Hosting Bundle
- Install the .NET Hosting Bundle matching your target runtime.
- This installs the ASP.NET Core Module for IIS.

3. Node.js LTS (for frontend build, unless built in CI)

4. Optional but recommended
- URL Rewrite module (useful for SPA fallback and reverse-proxy patterns)

## 3. Build and Publish

Run these from the repository root on your build machine.

### 3.1 Publish the API

```powershell
cd ChartBuilder\ChartBuilder.Api
dotnet restore
dotnet publish -c Release -o .\publish
```

Deploy the publish output to the server, for example:

- Source: `ChartBuilder\ChartBuilder.Api\publish`
- Target: `D:\inetpub\chartbuilder\api`

### 3.2 Build the Frontend

If your main frontend is at repo root:

```powershell
cd D:\Chart-Builder\Chart-Builder-1
npm install
npm run build
```

Deploy:

- Source: `dist`
- Target: `D:\inetpub\chartbuilder\frontend`

If you are using `chart-platform` instead:

```powershell
cd chart-platform
npm install
npm run build
```

Deploy `chart-platform\dist` to your frontend IIS folder.

## 4. IIS Configuration

## 4.1 Application Pool for API

Create an app pool for API:

- Name: `ChartBuilderApiPool`
- .NET CLR version: `No Managed Code`
- Managed pipeline: `Integrated`
- Identity: `ApplicationPoolIdentity` (or service account if needed)

## 4.2 Site and Application Setup

1. Create or use an IIS site for frontend:
- Physical path: `D:\inetpub\chartbuilder\frontend`
- Binding: your host/port/certificate

2. Under that site, add an IIS application:
- Alias: `api`
- Physical path: `D:\inetpub\chartbuilder\api`
- App pool: `ChartBuilderApiPool`

This gives one-domain hosting where frontend and API share origin.

## 5. API Configuration

Set production settings in `appsettings.Production.json` (or environment variables):

- Connection strings
- JWT/Authentication settings
- CORS origins if needed
- Logging levels

Environment variables for IIS app pool:

- `ASPNETCORE_ENVIRONMENT=Production`

Folder permissions:

- Grant read/execute access to the API app pool identity on `D:\inetpub\chartbuilder\api`.
- Grant write permissions only where required (logs/temp/uploads).

## 6. Frontend SPA Fallback

If refreshing deep links returns 404, add this `web.config` in frontend folder (`D:\inetpub\chartbuilder\frontend\web.config`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/api" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## 7. Frontend API Base URL

Ensure frontend points to your deployed API path.

Examples:

- Same domain: use relative `/api`
- Separate API domain: `https://api.your-domain.com`

For Vite, use an environment file and rebuild:

`.env.production`

```env
VITE_API_BASE_URL=/api
```

## 8. Validate Deployment

Run these checks after deployment:

1. API health
- Open `https://your-domain/api/health` (or another known endpoint)

2. Frontend load
- Open `https://your-domain/`
- Confirm no blank screen and no 404 for static assets

3. Auth flow
- Login/register and verify token-based requests succeed

4. Deep link refresh
- Open a routed path directly (for example `/reports`) and refresh

5. Browser dev tools
- Check network calls resolve to correct API URL
- Check CORS and 401/403 responses

## 9. Troubleshooting

1. HTTP 500.30 (ASP.NET Core app failed to start)
- Check `stdout` logs (enable in API `web.config` temporarily).
- Verify runtime/hosting bundle installed.
- Verify appsettings and connection strings.

2. HTTP 502.5
- Usually process start/runtime issue.
- Confirm published output complete and permissions are correct.

3. API works locally but not in IIS
- Confirm app pool is `No Managed Code`.
- Confirm IIS application points to published API folder.
- Confirm database/network access from server.

4. CORS errors
- Use same-origin `/api` when possible.
- If cross-origin, allow frontend origin in API CORS policy.

5. Frontend route 404 on refresh
- Ensure frontend `web.config` SPA fallback exists.

## 10. Update/Release Procedure

For each release:

1. Build and publish new API artifacts.
2. Build new frontend artifacts.
3. Backup current deployed folders.
4. Replace frontend and API files.
5. Recycle API app pool.
6. Run validation checklist.

## 11. Recommended Hardening

- Enable HTTPS only and redirect HTTP to HTTPS.
- Use strong production secrets (never commit secrets).
- Limit write permissions on deployment folders.
- Configure structured logs and retention.
- Add a health endpoint and uptime monitoring.
- Set request size limits if file uploads are used.
