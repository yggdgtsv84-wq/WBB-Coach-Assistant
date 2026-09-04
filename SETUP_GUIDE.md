# West Belconnen Coach Assistant — Cloud setup

This version is a static website using GitHub Pages + Supabase.

## 1. Supabase
1. Create/open your Supabase project.
2. Open **SQL Editor**.
3. Open `supabase_schema.sql` from this package and run the whole file.
4. Open **Project Settings → API Keys**.
5. Copy the **Project URL** and the **Publishable key**.
6. Do **not** use a Secret key or service_role key.

## 2. Configure the website
Open `config.js` and replace only these two values:

```js
window.SUPABASE_URL = "YOUR PROJECT URL";
window.SUPABASE_PUBLISHABLE_KEY = "YOUR PUBLISHABLE KEY";
```

Do not paste your Supabase password into this file.

## 3. GitHub Pages
Replace the old website files in your GitHub repository with the files from this package.
Make sure `index.html`, `app.js`, `config.js`, `style.css`, `manifest.json` and `sw.js` are in the publishing folder.

In GitHub, use **Settings → Pages → Deploy from a branch → main → /(root)** if that is how your repository is configured.

## 4. First login
Open your published site. You should now see **SIGN IN** and **CREATE ACCOUNT** before any coaching screens.
Create one coach account and use the same account on your iPhone and iPad.

## 5. Features
- Two team records
- Custom team names
- Add/edit/remove players
- Live game scoring: 1, 2 and 3 points
- Fouls capped at 5
- Bench/on-court tracker with exactly five allowed on court
- Sub-off counter
- Opposition name and final opposition score
- Save completed games
- Team-specific game history
- Individual game player stats
- Cumulative season totals
- Custom practice drills
- Drill timer with a short sound at 1:00 remaining and at the end
- No game clock

## Important security note
The browser uses the Supabase **Publishable key**. Supabase documents this key as safe to expose in browser code when Row Level Security is correctly enabled. The Secret/service_role key must never be put in this website.


## If the old "Supabase is not configured" screen still appears
This package includes a cache-buster because the earlier website used a service worker that could cache the old placeholder `config.js`. Replace **all** files in the GitHub repository with this package, including `index.html` and `sw.js`, then reload the Pages site.


### v3 cache fix
This version removes the site's service-worker caching and automatically unregisters the previously installed service worker on page load. Keep your existing configured `config.js` when replacing the files.
