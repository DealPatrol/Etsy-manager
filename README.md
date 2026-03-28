# Etsy Manager Pro

Dashboard to manage your Etsy listings — view inventory, edit quantities, bulk add, export to CSV.

## Deploy to Vercel (5 min)

### 1. Create a GitHub repo
- Go to github.com → New repository → name it `etsy-manager` → Create

### 2. Upload these files to your repo
```
index.html
vercel.json
api/token.js
```

### 3. Deploy on Vercel
- Go to vercel.com → Add New Project
- Import your `etsy-manager` GitHub repo
- Click Deploy (no build settings needed)

### 4. Add Environment Variable
- In your Vercel project → Settings → Environment Variables
- Add: `ETSY_API_KEY` = `yspyf6n6947nnvsozogmenvd`
- Redeploy after adding

### 5. Add Redirect URI in Etsy
- Go to etsy.com/developers → your app → Edit
- Add your Vercel URL as a redirect URI
  e.g. `https://etsy-manager.vercel.app`

### 6. Connect
- Open your Vercel URL
- Click "Connect Etsy" → authorize → done!

## Files
- `index.html` — the full dashboard UI
- `api/token.js` — serverless function (keeps your shared secret safe)
- `vercel.json` — routing config
