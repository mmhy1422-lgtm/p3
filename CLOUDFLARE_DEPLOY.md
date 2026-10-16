# Cloudflare Free Trial Deployment

The app runs as a Cloudflare Worker with D1. The public menu and offers are seeded from `data/menu.json` and `data/offers.json`; users and orders are stored in D1. The local Express/JSON server remains available with `npm start`.

## First-time setup

Run these commands from the project directory:

```powershell
npm.cmd install
npm.cmd run build:cloudflare
npm.cmd exec wrangler -- login
npm.cmd exec wrangler -- d1 create kaza-mix-db
```

When Wrangler asks to update `wrangler.jsonc` with the D1 binding, approve it. Then apply the schema remotely:

```powershell
npm.cmd exec wrangler -- d1 migrations apply kaza-mix-db --remote
```

Set a strong admin password. Wrangler prompts for it; type it directly in the terminal and do not paste it into chat or commit it:

```powershell
npm.cmd exec wrangler -- secret put ADMIN_PASSWORD
```

Deploy the Worker and its static assets:

```powershell
npm.cmd run build:cloudflare
npm.cmd exec wrangler -- deploy
```

Wrangler prints the public `workers.dev` URL. Add that URL as an Authorized JavaScript origin in Google Cloud for Google Sign-In.

## Local Cloudflare development

Apply the migration to Wrangler's local D1 database, then start the local Worker:

```powershell
npm.cmd exec wrangler -- d1 migrations apply kaza-mix-db --local
npm.cmd run dev:cloudflare
```

Set `ADMIN_PASSWORD` in the current terminal before starting `wrangler dev`; it is required to initialize the admin account.

## Free-plan notes

Cloudflare's free limits apply to Worker requests and D1 storage/queries. D1 is persistent, unlike the previous Render Free filesystem. Check the Cloudflare dashboard's current usage limits before opening the site to real traffic.
