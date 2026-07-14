# Next Phase BioSolutions — Marketing Website

The operating system for zero waste meat processing. A single page marketing
site built with Next.js, Tailwind CSS, and Framer Motion, with animated,
simulated facility dashboards as the primary visuals.

## Stack

- **Next.js 14** (App Router, static export to `out/`)
- **Tailwind CSS** for styling, with the brand tokens baked into `tailwind.config.ts`
- **Framer Motion** for all animation (reduced motion is respected throughout)
- Fonts: Archivo (display), Inter (body), IBM Plex Mono (data and labels), loaded via `next/font`

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

## Production build

```bash
npm run build    # outputs a static site to ./out
```

You can preview the static build with any static server, for example:

```bash
npx serve out
```

## Deploy to Netlify

The project is configured for Netlify in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `out`

### Option A — connect the repo (recommended)

1. Push this `site/` directory to a Git repository.
2. In Netlify, choose **Add new site → Import an existing project** and select the repo.
3. Netlify reads `netlify.toml` automatically. Deploy.

### Option B — drag and drop or CLI

```bash
npm run build
npx netlify deploy --prod --dir=out
```

## Contact form

The "Book a walkthrough" form uses **Netlify Forms**. It is named `walkthrough`
and is detected at deploy time via the static `public/__forms.html` file, which
is required for a statically exported Next.js site.

After your first successful deploy:

1. Open your site in the Netlify dashboard.
2. Go to **Forms → walkthrough**. You should see the form registered.
3. Go to **Forms → Settings and notifications → Form notifications** and add an
   **email notification** to `info@nextphasebiosolutions.com`.
4. Submit a test message from the live site to confirm delivery.

The form includes a hidden honeypot field (`company-website`) for spam
protection.

## Brand colors

| Token        | Hex       | Use                              |
| ------------ | --------- | -------------------------------- |
| `olive-deep` | `#3A3F2A` | Dark sections, headings          |
| `olive`      | `#6B7350` | Main brand color                 |
| `rust`       | `#A8442A` | Single accent: buttons, highlights |
| `bone`       | `#DDD3C0` | Warm surfaces                    |
| `bone-light` | `#F0EBDF` | Warm surfaces                    |
| `canvas`     | `#FAF8F3` | Background                       |
| `edge`       | `#C2B9A3` | Borders and dividers             |
| `muted`      | `#7A7259` | Secondary text                   |
| `ink`        | `#2C2A24` | Body text                        |

## Content and assets

- All section copy lives in `data/pillars.ts` and `data/content.ts`.
- Logo files are in `public/`:
  - `NPB-Logo.png` — full color, for light backgrounds (nav).
  - `NPB-Logo-light.png` — bone and rust recolor, for dark backgrounds (footer).
- Every visual is a coded, live looking simulated dashboard. Drop in real video
  or product screenshots later by replacing the relevant screen components in
  `components/dashboard/`.

## Editing guide

- **Pillars** (the centerpiece): edit `data/pillars.ts`. Each pillar's live
  screen is a component in `components/dashboard/PillarScreens.tsx`.
- **How it works** steps: `data/content.ts` (`steps`), visuals in `components/HowItWorks.tsx`.
- **Hero dashboard**: `components/dashboard/HeroDashboard.tsx`.

A writing rule for this brand: do not use hyphens or dashes as punctuation
anywhere in the copy (write "byproduct", "audit ready", "tamper proof").
