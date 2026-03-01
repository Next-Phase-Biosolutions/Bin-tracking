# Deploying Bin Tracker to Netlify

Since `bin-tracker` is a Turborepo monorepo with separate frontend (`apps/web`) and backend (`apps/api`) packages, deploying to Netlify requires a specific configuration to tell Netlify how to build the frontend Vite app and where to find the environment variables.

Here is the step-by-step guide to hosting this on Netlify.

---

## Step 1: Push your Code to GitHub (or GitLab/Bitbucket)
Netlify connects directly to your Git repository to automatically build and deploy whenever you push changes.

1. Ensure all your code is committed (excluding the `.env` file).
2. Push your `main` branch to your GitHub repository.

---

## Step 2: Create a `netlify.toml` file
To make Netlify understand your Turborepo structure automatically, create a file named `netlify.toml` in the **root** of your project (same level as `package.json`).

Create a file at `/Users/cryptonean/Desktop/abdul/bin-tracker/netlify.toml` and paste this exact content:

```toml
[build]
  # Tell Netlify to run the turbo build command from the root
  command = "npm run build --filter=@bin-tracker/web..."
  
  # Tell Netlify where the compiled frontend files end up
  publish = "apps/web/dist"
  
  # Tell Netlify where to run the build command from
  base = "/"

[[redirects]]
  # This ensures React Router handles all page refreshing correctly
  from = "/*"
  to = "/index.html"
  status = 200
```

Commit and push this file to your repository.

---

## Step 3: Connect to Netlify
1. Log into your [Netlify Dashboard](https://app.netlify.com/).
2. Click **"Add new site"** -> **"Import an existing project"**.
3. Select GitHub and choose your `bin-tracker` repository.
4. Netlify will auto-detect your `netlify.toml` settings. 
   - *Base directory:* `/`
   - *Build command:* `npm run build --filter=@bin-tracker/web...`
   - *Publish directory:* `apps/web/dist`

**Do not click Deploy yet! You must add Environment Variables first.**

---

## Step 4: Add Environment Variables
On the Netlify deployment setup page, click **"Add environment variables"**.

You must add the following variables exactly as they appear in your local `.env` file. These are essential for the frontend (`apps/web`) to connect to Supabase.

1. `VITE_SUPABASE_URL` 
   * Value: `https://saqkyiilublutwuswulk.supabase.co`
2. `VITE_SUPABASE_ANON_KEY`
   * Value: `eyJhbGci...<YOUR_FULL_KEY>...cbjPcvbtOU`

*(Note: Do NOT add `DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` to Netlify. Netlify is only hosting your frontend web app, so it should only have access to the public `VITE_` variables. The backend API requires its own hosting).*

---

## Step 5: Deploy
1. Click **Deploy site**.
2. Netlify will begin building the application. This might take 1-2 minutes the first time.
3. Once finished, you will be given a live URL (e.g., `https://bin-tracker-123.netlify.app`).

Your frontend is now live!

## Important Note on the Backend (`apps/api`)
Netlify is a static site and CDN host perfectly suited for your Vite React frontend (`apps/web`). 

However, your project also has a Node.js Express/tRPC backend (`apps/api`) that needs to run continuously. 
* Netlify **cannot** host a long-running Express server.
* We will deploy the `apps/api` folder to **Render**, which is free and natively supports Turborepos.

---

# Part 2: Deploying the Backend to Render

Render is the best platform for hosting Node.js APIs for free. Because you are using a Turborepo, the config requires a specific build strategy.

## Step 1: Connect your account
1. Go to [Render.com](https://render.com/) and sign up.
2. In the Render Dashboard, click **New** -> **Web Service**.
3. Choose **Build and deploy from a Git repository** and authorize your GitHub account to let Render see your `bin-tracker` repository.

## Step 2: Configure the Web Service
When configuring the service, set the exact values below. These are critical for making Turborepo compile your API correctly.

* **Name:** `bin-tracker-api` (or whatever you prefer)
* **Region:** Choose whatever is geographically closest to you.
* **Branch:** `main`
* **Root Directory:** *(Leave this completely BLANK. Do not put apps/api here, because Turborepo must run from the root Folder).*
* **Environment:** `Node`
* **Build Command:** `pnpm install && pnpm db:generate && pnpm --filter=@bin-tracker/api build`
* **Start Command:** `cd apps/api && pnpm start`

*(Make sure you select the "Free" tier at the bottom of the page).*

## Step 3: Set Environment Variables
The backend API absolutely requires the database connection string and Supabase secret. Scroll down and click **Advanced**, then click **Add Environment Variable**. Add all of these:

1. `DATABASE_URL` -> *(Paste your full PostgreSQL URL starting with postgresql://...)*
2. `SUPABASE_URL` -> *(Your Supabase URL)*
3. `SUPABASE_SERVICE_ROLE_KEY` -> *(Your Supabase Service Role Key from your local .env)*
4. `SUPABASE_JWT_SECRET` -> *(Your JWT Secret from your local .env)*
5. `PORT` -> `3001`
6. `CORS_ORIGIN` -> `*` (Setting this to wildcard `*` is fine for testing, but in production, you should set this to your Netlify URL, e.g., `https://your-netlify-app.netlify.app`)

## Step 4: Deploy and Link
1. Click **Create Web Service**. 
2. Render will take a few minutes to install `pnpm`, build the backend, and start the server. 
3. When it is successful, Render will give you a live URL in the top left corner (like `https://bin-tracker-api-x9za.onrender.com`).
4. **Final Step:** Go back to your **Netlify** dashboard. Go to Environment Variables, and add `VITE_API_URL` with a value of your new Render URL (e.g., `https://bin-tracker-api-x9za.onrender.com`). Trigger a new Netlify deploy so your frontend knows where the live backend is!
