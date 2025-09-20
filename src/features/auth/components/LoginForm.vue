<script setup lang="ts">
import * as z from 'zod'
import { useRoute, useRouter } from 'vue-router'
import { passwordSchema } from '@/features/auth/schemas/password'

import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import PasswordField from '@/features/auth/components/ui/PasswordField.vue'
import { useAuthStore } from '@/features/auth/stores'

import LogoPI from '@/shared/assets/svg/logo_prensa_iberica_negro.svg'

const loginFormSchema = toTypedSchema(
  z.object({
    email: z.email(),
    password: passwordSchema,
  }),
)

const {
  isFieldDirty,
  handleSubmit,
  isSubmitting,
  meta: formMeta,
} = useForm({
  validationSchema: loginFormSchema,
  initialValues: {
    email: '',
    password: '',
  },
})

const auth = useAuthStore()

const router = useRouter()
const route = useRoute()

const onSubmit = handleSubmit(async (values) => {
  const ok = await auth.login({ username: values.email, password: values.password })
  if (!ok) return

  const target = (route.query.redirect as string) ?? ''
  if (target && target.startsWith('/')) {
    const r = router.resolve(target)
    if (r.matched.length) {
      await router.push(r)
      return
    }
  }

  await router.push({ name: 'app.home' })
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-xl"> {{ $t('login.title') }} </CardTitle>
        <CardDescription> {{ $t('login.description') }} </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="grid gap-6" @submit="onSubmit">
          <FormField v-slot="{ componentField }" name="email" :validate-on-blur="!isFieldDirty">
            <FormItem>
              <FormLabel> {{ $t('forms.email') }} </FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@prensaiberica.es" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="password" :validate-on-blur="!isFieldDirty">
            <PasswordField :label="$t('forms.password')" v-bind="{ componentField }" />
          </FormField>
          <Button
            type="submit"
            :onclick="onSubmit"
            class="w-full"
            :disabled="isSubmitting || !formMeta.valid"
          >
            <template v-if="isSubmitting"> {{ $t('forms.logging') }} ... </template>
            <template v-else> {{ $t('forms.login') }} </template>
          </Button>
        </form>
        <div
          class="relative my-6 text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border"
        >
          <span class="relative z-10 bg-card px-2 text-muted-foreground">
            {{ $t('login.continue-with') }}
          </span>
        </div>
        <section class="flex flex-col has-[button:disabled]:cursor-not-allowed">
          <Button variant="outline" class="w-full" disabled>
            <LogoPI class="size-22" />
          </Button>
        </section>
      </CardContent>
    </Card>
  </div>
</template>
