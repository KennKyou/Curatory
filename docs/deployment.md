# Deployment

Curatory builds as a Nuxt/Nitro node server.

## Build

```bash
npm install
npm run build
node .output/server/index.mjs
```

Use your hosting platform's normal Node.js process manager, container runner, or platform adapter around the generated `.output/server/index.mjs` entrypoint.

## Production Checklist

- Set `NUXT_SESSION_PASSWORD` to a strong random value with at least 32 characters.
- Set `NUXT_AUTH_ALLOWED_EMAILS` to trusted admin email addresses only.
- Configure MongoDB with a production database name, usually `curatory`.
- Configure S3/R2 credentials with the least permissions needed for uploads, reads, deletes, and thumbnail writes.
- Set `NUXT_S3_PUBLIC_URL` to the public image host.
- Configure CORS on the storage bucket or public image domain.
- Use HTTPS in production.
- Configure site URL, default SEO title, default SEO description, and social links in the platform admin.
- Enable Turnstile for public deployments when possible.

## Object Storage CORS

For browser image loading, lightbox original fetches, and metadata headers, configure CORS for your public image origin.

Typical Cloudflare R2 / S3-compatible CORS:

```json
[
  {
    "AllowedOrigins": [
      "https://your-domain.example"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Type",
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

For local development, also add:

```json
"http://localhost:3000"
```

## SEO and Open Graph

Curatory uses exhibition settings first, then falls back to site defaults:

- exhibition title overrides the default SEO title when set;
- exhibition description overrides the default SEO description when set;
- exhibition cover is preferred for site Open Graph imagery;
- individual photo pages generate their own Open Graph images.

Use these endpoints to verify generated images locally:

```bash
curl http://localhost:3000/api/og/site
curl http://localhost:3000/api/og/photos/<photo-slug>
```
