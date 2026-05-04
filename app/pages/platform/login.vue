<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { fetch: refreshSession } = useUserSession()
const email = ref('')
const password = ref('')
const turnstileToken = ref('')
const turnstile = ref<{ reset: () => void } | null>(null)
const loading = ref(false)
const error = ref('')
const config = useRuntimeConfig()
const turnstileEnabled = computed(() => Boolean(config.public.turnstileSiteKey))

async function submit() {
  error.value = ''
  if (turnstileEnabled.value && !turnstileToken.value) {
    error.value = '請先完成驗證'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        turnstileToken: turnstileToken.value,
      },
    })
    await refreshSession()
    await navigateTo('/platform')
  } catch (err: any) {
    error.value = err?.data?.message || '登入失敗'
    turnstile.value?.reset()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-md items-center px-4 py-10">
    <form class="w-full rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur" @submit.prevent="submit">
      <div class="mb-6 space-y-1">
        <p class="text-sm text-muted-foreground">Curatory</p>
        <h1 class="text-2xl font-semibold tracking-tight">登入管理後台</h1>
      </div>

      <div class="space-y-4">
        <label class="block space-y-2">
          <span class="text-sm font-medium">Email</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            required
          />
        </label>

        <label class="block space-y-2">
          <span class="text-sm font-medium">密碼</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            required
          />
        </label>

        <TurnstileWidget ref="turnstile" v-model="turnstileToken" />

        <p v-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ error }}
        </p>

        <Button type="submit" class="w-full" :disabled="loading">
          {{ loading ? '登入中...' : '登入' }}
        </Button>
      </div>

      <p class="mt-5 text-center text-sm text-muted-foreground">
        還沒有帳號？
        <NuxtLink to="/platform/register" class="font-medium text-foreground underline-offset-4 hover:underline">建立帳號</NuxtLink>
      </p>
    </form>
  </div>
</template>
