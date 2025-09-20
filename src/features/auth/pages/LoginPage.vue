<script setup lang="ts">
import LoginForm from '@/features/auth/components/LoginForm.vue'

import LogoPi from '@/shared/assets/svg/logo_prensa_iberica_negro.svg'
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
    <div class="flex w-full max-w-sm flex-col gap-6">
      <a href="https://www.prensaiberica.es/" target="_blank" class="self-center">
        <LogoPi class="h-8" />
      </a>
      <LoginForm />
    </div>
  </div>
</template>

<style lang="css" scoped></style>
