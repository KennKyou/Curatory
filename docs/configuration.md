# Configuration

Curatory reads runtime configuration from environment variables. Start from the example file:

```bash
cp .env.example .env
```

## Required Variables

### MongoDB

- `NUXT_MONGODB_URI`: MongoDB connection string.
- `NUXT_MONGODB_DATABASE`: database name. Defaults to `curatory`.

### Session

- `NUXT_SESSION_PASSWORD`: random session secret with at least 32 characters.

Generate one with:

```bash
openssl rand -base64 32
```

### Authentication

- `NUXT_AUTH_ALLOWED_EMAILS`: comma-separated list of emails allowed to register.

Only addresses in this list can create admin accounts. Keep the list limited to trusted operators.

### S3 / R2 Storage

- `NUXT_S3_ACCESS_KEY_ID`: storage access key.
- `NUXT_S3_SECRET_ACCESS_KEY`: storage secret key.
- `NUXT_S3_BUCKET`: bucket name.
- `NUXT_S3_REGION`: region. Use `auto` for Cloudflare R2.
- `NUXT_S3_ENDPOINT`: S3-compatible endpoint URL.
- `NUXT_S3_PUBLIC_URL`: public base URL used to serve photos and thumbnails.

Cloudflare R2 example:

```env
NUXT_S3_REGION=auto
NUXT_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
NUXT_S3_PUBLIC_URL=https://photos.example.com
```

AWS S3 example:

```env
NUXT_S3_REGION=us-east-1
NUXT_S3_ENDPOINT=
NUXT_S3_PUBLIC_URL=https://my-bucket.s3.us-east-1.amazonaws.com
```

## Optional Variables

### Cloudflare Turnstile

- `NUXT_PUBLIC_TURNSTILE_SITE_KEY`: public site key.
- `NUXT_TURNSTILE_SECRET_KEY`: private secret key.

If the secret key is configured, register and login requests require a valid Turnstile token.

### Analytics

- `NUXT_PUBLIC_GTAG_ID`: optional Google tag ID.

## Initial Admin Account

1. Add your email to `NUXT_AUTH_ALLOWED_EMAILS`.
2. Start the app.
3. Visit `/platform/register`.
4. Register with an allowed email.

After registration, use `/platform/login` to access the admin platform.
