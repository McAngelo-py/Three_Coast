# Three_Coast

A responsive, static storefront landing page for Three Coast streetwear. It includes a video hero, a filterable Season 01 product grid, coast-themed shirt panels with image previews, and an email sign-up interaction.

## Run locally

Open `index.html` in a browser, or serve the project directory with any static web server. No build step or package installation is required.

The Google Fonts used by the page load from the internet. The page and local images/video otherwise work from the project files.

## Project files

- `index.html` — page markup and content
- `styles.css` — layout, responsive styles, loading screen, and shirt modal
- `script.js` — product filtering, loading screen dismissal, email form response, product inventory, news posts, and shirt modal behavior
- `admin.html`, `admin.css`, and `admin.js` — password-protected admin dashboard and content tools
- `api/` — Vercel serverless API for signed uploads, store data, site settings, and admin activity
- `images/` — logo, shirt images, and hero video

## Interactions

- Filter the product cards by category using the buttons in the Season 01 section.
- Hover over or focus a coast panel to reveal its shirt; select it to open a larger preview. On small screens, the shirt previews remain visible.
- Submit an email in the Drop section to see a confirmation message. This is a front-end demonstration and does not send or store email addresses.
- Use the footer’s “Back to top” link to return to the page start.

## Admin dashboard

The admin page at `/admin.html` includes:

- Overview metrics, low-stock alerts (3 units or fewer), sold-out counts, and recent admin activity.
- Product search and category filters, full product editing, image replacement, inventory updates, and hide/show controls.
- News-post creation and editing with draft/published status.
- Site image replacement and editable storefront copy for the hero, drop, story, and signup sections.

Products and posts are stored in Neon Postgres. Products use T-shirts, Hoodies, Pants, Shorts, or Headwear categories; existing Season 01 items are assigned to their matching category during the schema migration. Schema upgrades are applied safely during the first API request after deployment.

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

The upload API signs requests on the server and requires the admin password; Cloudinary secrets are never sent to the browser. Site image uploads overwrite fixed Cloudinary public IDs and request CDN invalidation; product/post images receive unique IDs. Uploads accept JPG, PNG, WebP, or AVIF images up to 10 MB.
The images API lists existing fixed site-image assets before returning their URLs. Until a site image is uploaded from the admin page, the storefront and admin preview use the bundled local image instead of requesting a missing Cloudinary asset.

Product stock is managed manually and shown on the storefront; this does not add checkout or automatically decrement stock. Published posts are shown on the storefront; drafts are admin-only. For local development with serverless API routes, use the Vercel CLI (`vercel dev`) and set the same environment variables locally.

Copy `.env.example` to `.env` for local settings, fill in `DATABASE_URL` and the Cloudinary credentials, and use your existing admin credentials. Never commit `.env`; it is ignored by Git.
