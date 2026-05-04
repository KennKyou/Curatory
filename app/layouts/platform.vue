<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import type { SiteSettingsResponse } from '~~/server/types/api'

const { t, locale, locales, setLocale } = useI18n()
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()
const availableLocales = computed(() => (locales.value as Array<{ code: 'en' | 'zh-TW'; name: string }>))

const { data: siteSettings } = await useFetch<SiteSettingsResponse | null>('/api/site-settings', { default: () => null })
useHead({
  title: () => siteSettings.value?.siteName || 'Curatory',
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  navigateTo('/')
}

// Platform navigation items
const navItems = [
  { key: 'overview', label: () => t('platform.overview'), to: '/platform', icon: 'material-symbols:dashboard-outline' },
  { key: 'photos', label: () => t('platform.photos'), to: '/platform/photos', icon: 'material-symbols:image-outline' },
  { key: 'exhibition', label: () => t('platform.exhibition'), to: '/platform/exhibition', icon: 'material-symbols:collections-bookmark-outline' },
  { key: 'settings', label: () => t('platform.settings'), to: '/platform/settings', icon: 'material-symbols:settings-outline' },
]

function activeNavKey(): string {
  const path = route.path
  if (path.startsWith('/platform/photos')) return 'photos'
  if (path.startsWith('/platform/exhibition')) return 'exhibition'
  if (path.startsWith('/platform/settings')) return 'settings'
  return 'overview'
}

// Hydration splash
const hydrated = ref(false)

// Mobile detection
const viewportWidth = ref(1536)
const isMobile = computed(() => viewportWidth.value < 768)

// Mobile hamburger menu
const mobileMenuOpen = ref(false)

// Hide avatar on scroll down, show on scroll up
const mobileAvatarVisible = ref(true)
let lastScrollY = 0

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function onScroll() {
  const y = window.scrollY
  mobileAvatarVisible.value = y <= 0 || y < lastScrollY
  lastScrollY = y
}

// Sliding pill
const navContainer = ref<HTMLElement | null>(null)
const navItemEls: Record<string, HTMLElement> = {}
const highlightStyle = ref({ left: '0px', top: '0px', width: '0px', height: '0px', opacity: '0' })

function moveHighlightTo(key: string) {
  const container = navContainer.value
  const el = navItemEls[key]
  if (!container || !el) return
  const cr = container.getBoundingClientRect()
  const ir = el.getBoundingClientRect()
  highlightStyle.value = {
    left: `${ir.left - cr.left}px`,
    top: `${ir.top - cr.top}px`,
    width: `${ir.width}px`,
    height: `${ir.height}px`,
    opacity: '1',
  }
}

function snapToActive() {
  moveHighlightTo(activeNavKey())
}

// Re-measure pill when locale changes (button text width changes)
watch(locale, () => nextTick(snapToActive))

onMounted(() => {
  viewportWidth.value = window.innerWidth
  window.addEventListener('resize', () => {
    viewportWidth.value = window.innerWidth
  })
  window.addEventListener('scroll', onScroll, { passive: true })
  nextTick(() => {
    snapToActive()
    hydrated.value = true
  })
})

watch(() => route.path, () => {
  nextTick(() => snapToActive())
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Fixed capsule header -->
    <header class="fixed top-0 inset-x-0 z-50 flex justify-center py-3 px-4 pointer-events-none">
      <div class="pointer-events-auto flex items-center gap-1 rounded-full border border-border/50 bg-background/60 backdrop-blur-xl px-2 py-1.5">
        <!-- Left: Branding -->
        <NuxtLink to="/" class="flex items-center gap-2 px-3 hover:opacity-80 transition-opacity">
          <span class="text-sm font-semibold">{{ siteSettings?.siteName || 'Curatory' }}</span>
        </NuxtLink>

        <!-- Mobile: Hamburger only -->
        <template v-if="isMobile">
          <button
            class="p-2 rounded-full hover:bg-accent focus:outline-none transition-colors"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <Icon :icon="mobileMenuOpen ? 'material-symbols:close' : 'material-symbols:menu'" class="h-5 w-5" />
          </button>
        </template>

        <!-- Desktop: Full navigation -->
        <template v-else>
        <!-- Divider -->
        <div class="w-px h-5 bg-border/50" />

        <!-- Center: Navigation with sliding pill -->
        <nav
          ref="navContainer"
          class="relative flex items-center gap-0.5 px-1"
          @mouseleave="snapToActive"
        >
          <!-- Sliding pill -->
          <div
            class="absolute rounded-full bg-accent transition-all duration-200 ease-out pointer-events-none"
            :style="highlightStyle"
          />

          <NuxtLink
            v-for="item in navItems"
            :key="item.key"
            :to="item.to"
            :ref="(el: any) => { if (el) navItemEls[item.key] = el.$el ?? el }"
            class="relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:text-foreground text-muted-foreground no-underline"
            :aria-current="activeNavKey() === item.key ? 'page' : undefined"
            @mouseenter="moveHighlightTo(item.key)"
          >
            <Icon :icon="item.icon" class="h-4 w-4" />
            {{ item.label() }}
          </NuxtLink>
        </nav>

        <!-- Divider -->
        <div class="w-px h-5 bg-border/50" />

        <!-- Right: Actions -->
        <div class="flex items-center gap-1 px-1">
          <!-- Language switcher -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button class="p-2 rounded-full hover:bg-accent focus:outline-none transition-colors">
                <Icon icon="mdi:language" class="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" :side-offset="12">
              <DropdownMenuItem
                v-for="loc in availableLocales"
                :key="loc.code"
                class="cursor-pointer flex items-center justify-between gap-4"
                @click="setLocale(loc.code)"
              >
                {{ loc.name }}
                <Icon v-if="locale === loc.code" icon="material-symbols:check" class="h-4 w-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Logged in: Avatar dropdown -->
          <DropdownMenu v-if="loggedIn">
            <DropdownMenuTrigger as-child>
              <button class="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <Avatar class="h-7 w-7">
                  <AvatarImage v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
                  <AvatarFallback class="text-xs">{{ user?.name?.charAt(0)?.toUpperCase() }}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" :side-offset="12" class="w-56">
              <DropdownMenuLabel class="font-normal">
                <div class="flex flex-col gap-1">
                  <p class="text-sm font-medium leading-none">{{ user?.name }}</p>
                  <p class="text-xs text-muted-foreground leading-none">{{ user?.email }}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="cursor-pointer text-destructive focus:text-destructive flex items-center gap-2" @click="logout">
                <Icon icon="material-symbols:logout" class="h-4 w-4" />
                {{ t('nav.logout') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Not logged in: Login icon dropdown -->
          <DropdownMenu v-else>
            <DropdownMenuTrigger as-child>
              <button class="p-2 rounded-full hover:bg-accent focus:outline-none transition-colors">
                <Icon icon="material-symbols:login" class="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" :side-offset="12" class="w-56">
              <DropdownMenuItem as-child>
                <NuxtLink to="/platform/login" class="cursor-pointer flex items-center gap-2">
                  <Icon icon="material-symbols:login" class="h-4 w-4" />
                  {{ t('nav.login') }}
                </NuxtLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </template>
      </div>

      <!-- Mobile: Avatar outside capsule -->
      <div
        v-if="isMobile"
        class="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-300"
        :class="mobileAvatarVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'"
      >
        <DropdownMenu v-if="loggedIn">
          <DropdownMenuTrigger as-child>
            <button class="rounded-full focus:outline-none">
              <Avatar class="h-7 w-7">
                <AvatarImage v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
                <AvatarFallback class="text-xs">{{ user?.name?.charAt(0)?.toUpperCase() }}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" :side-offset="12" class="w-48">
            <DropdownMenuLabel class="font-normal">
              <div class="flex flex-col gap-0.5">
                <p class="text-sm font-medium leading-none">{{ user?.name }}</p>
                <p class="text-xs text-muted-foreground leading-none">{{ user?.email }}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer text-destructive focus:text-destructive flex items-center gap-2" @click="logout">
              <Icon icon="material-symbols:logout" class="h-4 w-4" />
              {{ t('nav.logout') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <a
          v-else
          href="/platform/login"
          class="p-2 rounded-full hover:bg-accent/50 transition-colors"
        >
          <Icon icon="material-symbols:login" class="h-5 w-5 text-muted-foreground" />
        </a>
      </div>
    </header>

    <!-- Mobile menu overlay -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isMobile && mobileMenuOpen"
          class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          @click="closeMobileMenu"
        />
      </Transition>
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="isMobile && mobileMenuOpen"
          class="fixed top-16 inset-x-4 z-50 rounded-2xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden"
        >
          <div class="flex flex-col py-2">
            <!-- Nav items -->
            <div class="px-4 py-2">
              <NuxtLink
                v-for="item in navItems"
                :key="item.key"
                :to="item.to"
                class="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm no-underline transition-colors"
                :class="activeNavKey() === item.key ? 'bg-accent font-medium' : 'hover:bg-accent/50'"
                @click="closeMobileMenu"
              >
                <Icon :icon="item.icon" class="h-4 w-4" />
                {{ item.label() }}
              </NuxtLink>
            </div>

            <div class="mx-4 border-t border-border/50" />

            <!-- Language switcher -->
            <div class="px-4 py-2">
              <div class="flex items-center gap-2 px-3">
                <Icon icon="mdi:language" class="h-4 w-4 text-muted-foreground" />
                <div class="flex gap-1">
                  <button
                    v-for="loc in availableLocales"
                    :key="loc.code"
                    class="px-2.5 py-1 rounded-md text-xs transition-colors"
                    :class="locale === loc.code ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50'"
                    @click="setLocale(loc.code)"
                  >
                    {{ loc.name }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Hydration splash -->
    <Transition
      leave-active-class="transition-opacity duration-300 ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!hydrated"
        class="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-4"
      >
        <span class="text-lg font-semibold text-foreground">{{ siteSettings?.siteName || 'Curatory' }}</span>
      </div>
    </Transition>

    <main v-show="hydrated" class="flex-1 max-w-6xl mx-auto w-full px-4 pt-[4.5rem]">
      <slot />
    </main>

    <Toaster position="bottom-right" theme="dark" rich-colors />
  </div>
</template>
