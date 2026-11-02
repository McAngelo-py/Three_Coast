# Three_Coast

A responsive, static storefront landing page for Three Coast streetwear. It includes a video hero, a filterable Season 01 product grid, coast-themed shirt panels with image previews, and an email sign-up interaction.

## Run locally

Open `index.html` in a browser, or serve the project directory with any static web server. No build step or package installation is required.

The Google Fonts used by the page load from the internet. The page and local images/video otherwise work from the project files.

## Project files

- `index.html` — page markup and content
- `styles.css` — layout, responsive styles, loading screen, and shirt modal
- `script.js` — product filtering, loading screen dismissal, email form response, product inventory, news posts, and shirt modal behavior
- `admin.html`, `admin.css`, and `admin.js` — password-protected image, product, inventory, and news management
- `api/` — Vercel serverless API for signed uploads and database-backed products and posts
- `images/` — logo, shirt images, and hero video

## Interactions

- Filter the product cards by coast using the buttons in the Season 01 section.
- Hover over or focus a coast panel to reveal its shirt; select it to open a larger preview. On small screens, the shirt previews remain visible.
- Submit an email in the Drop section to see a confirmation message. This is a front-end demonstration and does not send or store email addresses.
- Use the footer’s “Back to top” link to return to the page start.

## Admin image management

The admin page at `/admin.html` lets an authenticated admin replace the logo and the Pacific, Atlantic, and Gulf feature images. The site continues to use the local images until Cloudinary is configured.

1. Deploy the site to Vercel.
2. In Cloudinary, create an account and note the cloud name, API key, and API secret.
3. Add these environment variables in the Vercel project settings:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `ADMIN_PASSWORD` — use a strong password of at least 12 characters
   - `ADMIN_SESSION_SECRET` — use a random secret of at least 32 characters
4. Create a Neon Postgres project and add its pooled connection string as `DATABASE_URL`. Use the connection string from Neon’s dashboard; keep it private.
5. Redeploy after adding the variables, then open `https://your-domain/admin.html`.

The upload API signs requests on the server and requires the admin password; Cloudinary secrets are never sent to the browser. Uploads overwrite fixed Cloudinary public IDs and request CDN invalidation so the changed image appears on the site. The upload form accepts JPG, PNG, WebP, or AVIF images up to 10 MB.

The admin page also creates product listings and news posts. Product stock is managed manually and shown on the storefront; this does not add checkout or automatically decrement stock. Existing Season 01 products are added to the database automatically so their stock can be set from the admin page. Database tables are initialized automatically on the first API request. For local development with serverless API routes, use the Vercel CLI (`vercel dev`) and set the same environment variables locally.

Copy `.env.example` to `.env` for local settings, fill in `DATABASE_URL` and the Cloudinary credentials, and use your existing admin credentials. Never commit `.env`; it is ignored by Git.
