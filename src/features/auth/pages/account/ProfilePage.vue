<script setup lang="ts">
import * as z from 'zod'
import { passwordSchema } from '@/features/auth/schemas/password'

import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import PasswordField from '@/features/auth/components/ui/PasswordField.vue'

import { FormField } from '@/shared/components/ui/form'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'

import { useAuthStore } from '@/features/auth/stores'

const passwordChangeFormSchema = toTypedSchema(
  z
    .object({
      currentPassword: passwordSchema,
      newPassword: passwordSchema,
      confirmNewPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: 'Passwords do not match.',
      path: ['confirmNewPassword'],
    }),
)

const {
  isFieldDirty,
  handleSubmit,
  meta: formMeta,
} = useForm({
  validationSchema: passwordChangeFormSchema,
  initialValues: {
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  },
})

const onSubmit = handleSubmit((values) => {
  console.log(values)
})

const auth = useAuthStore()
</script>

<template>
  <header>
    <h3 class="text-lg font-medium">{{ $t('account.profile.info.title') }}</h3>
    <p class="text-sm text-muted-foreground">{{ $t('account.profile.info.description') }}</p>
  </header>

  <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <article class="grid w-full max-w-sm items-center gap-1.5">
      <Label>{{ $t('forms.name') }}</Label>
      <span
        class="text-muted-foreground dark:bg-input/30 border-input flex flex-col justify-center h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm"
        >{{ auth.user.nombre }}</span
      >
    </article>
    <article class="grid w-full max-w-sm items-center gap-1.5">
      <Label>{{ $t('forms.username') }}</Label>
      <span
        class="text-muted-foreground dark:bg-input/30 border-input flex flex-col justify-center h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm"
        >{{ auth.user.nick }}</span
      >
    </article>
    <article class="grid w-full max-w-sm items-center gap-1.5">
      <Label>{{ $t('forms.email') }}</Label>
      <span
        class="text-muted-foreground dark:bg-input/30 border-input flex flex-col justify-center h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm"
        >{{ auth.user.email ?? '-' }}</span
      >
    </article>
    <article class="grid w-full max-w-sm items-center gap-1.5">
      <Label>{{ $t('forms.dni') }}</Label>
      <span
        class="text-muted-foreground dark:bg-input/30 border-input flex flex-col justify-center h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm"
        >{{ auth.user.nif ?? '-' }}</span
      >
    </article>
  </section>
  <article class="grid w-full items-center gap-1.5" v-if="auth.grupo.nombre && auth.grupo.codigo">
    <Label>{{ $t('forms.usergroup') }}</Label>
    <span
      class="text-muted-foreground dark:bg-input/30 border-input flex flex-col justify-center min-h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm"
      >{{ auth.grupo.nombre }} ({{ auth.grupo.codigo }})</span
    >
  </article>
  <Separator />
  <form class="space-y-8" @submit="onSubmit">
    <header>
      <h3 class="text-lg font-medium">{{ $t('account.profile.password.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ $t('account.profile.password.description') }}</p>
    </header>
    <section class="grid grid-cols-1 max-w-sm gap-6">
      <FormField
        v-slot="{ componentField }"
        name="currentPassword"
        :validate-on-blur="!isFieldDirty"
      >
        <PasswordField :label="$t('forms.current-password')" v-bind="componentField" />
      </FormField>
      <FormField v-slot="{ componentField }" name="newPassword" :validate-on-blur="!isFieldDirty">
        <PasswordField :label="$t('forms.new-password')" v-bind="componentField" />
      </FormField>
      <FormField
        v-slot="{ componentField }"
        name="confirmNewPassword"
        :validate-on-blur="!isFieldDirty"
      >
        <PasswordField :label="$t('forms.confirm-new-password')" v-bind="componentField" />
      </FormField>
    </section>
    <div class="flex justify-start">
      <Button type="submit" :disabled="!formMeta.valid"> {{ $t('forms.submit') }} </Button>
    </div>
  </form>
</template>
