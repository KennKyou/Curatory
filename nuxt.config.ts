import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { getSessionRuntimeConfig } from './server/utils/sessionSecurity'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  hooks: {
    'prepare:types'({ references }) {
      references.push({ path: fileURLToPath(new URL('./server/types/auth.d.ts', import.meta.url)) })
    },
  },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },

  modules: [
    'shadcn-nuxt',
    'nuxt-auth-utils',
    '@nuxtjs/i18n',
    'nuxt-security',
    'nuxt-gtag',
    '@nuxtjs/sitemap',
    '@pinia/nuxt',
  ],

  gtag: {
    enabled: process.env.NODE_ENV === 'production',
    id: '',
  },

  security: (() => {
    const s3Url = process.env.NUXT_S3_PUBLIC_URL || ''
    const s3Origin = s3Url ? new URL(s3Url).origin : ''
    const cspImgSrc = ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com', ...(s3Origin ? [s3Origin] : [])]
    const cspConnectSrc = ["'self'", 'https://api.iconify.design', ...(s3Origin ? [s3Origin] : [])]
    return {
    headers: {
      contentSecurityPolicy: process.env.NODE_ENV === 'development' ? false : {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'", 'https://www.googletagmanager.com', 'https://challenges.cloudflare.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': cspImgSrc,
        'font-src': ["'self'", 'https:'],
        'connect-src': [...cspConnectSrc, 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com', 'https://challenges.cloudflare.com'],
        'frame-src': ['https://challenges.cloudflare.com'],
        'frame-ancestors': ["'none'"],
      },
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
      },
    },
    nonce: true,
  }
  })(),

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'zh-TW',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'zh-TW', name: '繁體中文', file: 'zh-TW.json' },
    ],
    langDir: '../app/locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'curatory_locale',
      redirectOn: 'root',
      fallbackLocale: 'zh-TW',
    },
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        '@iconify/vue',
        'swiper/modules',
        'swiper/vue',
        'vue-sonner',
        'reka-ui',
        '@vueuse/core',
        'lucide-vue-next',
        'clsx',
        'tailwind-merge',
      ],
    },
  },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  nitro: {
    serverAssets: [
      {
        baseName: 'fonts',
        dir: './server/assets/fonts',
      },
    ],
  },

  routeRules: {
    '/api/platform/photos': {
      security: {
        requestSizeLimiter: {
          maxUploadFileRequestInBytes: 20 * 1024 * 1024, // 20 MB
          maxRequestSizeInBytes: 2_000_000,
        },
      },
    },
  },

  site: {
    name: 'Curatory',
  },

  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/platform/**'],
  },

  runtimeConfig: {
    session: getSessionRuntimeConfig(process.env.NODE_ENV),
    public: {
      gtag: {
        id: '',
      },
      turnstileSiteKey: '',
    },
    mongodbUri: '',
    mongodbDatabase: 'curatory',
    authAllowedEmails: '',
    turnstileSecretKey: '',
    s3AccessKeyId: '',
    s3SecretAccessKey: '',
    s3Bucket: '',
    s3Region: '',
    s3Endpoint: '',
    s3PublicUrl: '',
  },
})
