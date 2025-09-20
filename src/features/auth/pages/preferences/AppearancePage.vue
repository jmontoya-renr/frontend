<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import * as z from 'zod'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { useUiStore } from '@/shared/stores/useUiStore'

const ui = useUiStore()

const ALLOWED_LANGS = ['es', 'en', 'cat']

const appearanceFormSchema = toTypedSchema(
  z.object({
    lang: z.enum(ALLOWED_LANGS),
    theme: z.enum(['light', 'dark', 'auto']),
    font: z.enum(['inter', 'manrope', 'system']),
  }),
)

const { handleSubmit } = useForm({
  validationSchema: appearanceFormSchema,
  initialValues: {
    lang: ui.lang,
    theme: ui.mode,
    font: ui.font,
  },
})

const onSubmit = handleSubmit((values) => {
  ui.changeTheme(values.theme)
  ui.setLang(values.lang as 'es' | 'en' | 'cat')
  ui.setFont(values.font)
})
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">{{ $t('preferences.appearance.title') }}</h3>
    <p class="text-sm text-muted-foreground">
      {{ $t('preferences.appearance.description') }}
    </p>
  </div>
  <Separator />
  <form class="space-y-8" @submit="onSubmit">
    <section class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <FormField v-slot="{ componentField }" name="font">
        <FormItem>
          <FormLabel>{{ $t('preferences.appearance.font.label') }}</FormLabel>

          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger disabled>
                <SelectValue class="w-48" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="inter">Inter</SelectItem>
                <SelectItem value="manrope">Manrope</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FormDescription>{{ $t('preferences.appearance.font.description') }}</FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="lang">
        <FormItem>
          <FormLabel>{{ $t('preferences.appearance.language.label') }}</FormLabel>

          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger>
                <template v-for="lang in ALLOWED_LANGS" :key="lang">
                  <span v-if="componentField.modelValue == lang" class="w-48 text-left">
                    {{ $t(`languages.${lang}`) }}
                  </span>
                </template>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="es">{{ $t('languages.es') }}</SelectItem>
                <SelectItem value="en">{{ $t('languages.en') }}</SelectItem>
                <SelectItem value="cat">{{ $t('languages.cat') }}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FormDescription>{{ $t('preferences.appearance.language.description') }}</FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>
    </section>
    <section class="mx-auto w-full max-w-5xl">
      <FormField v-slot="{ componentField }" type="radio" name="theme">
        <FormItem class="space-y-1">
          <FormLabel>{{ $t('preferences.appearance.theme.label') }}</FormLabel>
          <FormDescription> {{ $t('preferences.appearance.theme.description') }}</FormDescription>
          <FormMessage />

          <RadioGroup class="grid grid-auto-fill-170 gap-8 pt-2" v-bind="componentField">
            <FormItem>
              <FormLabel class="flex flex-col [&:has([data-state=checked])>div]:border-primary">
                <FormControl>
                  <RadioGroupItem value="light" class="sr-only" />
                </FormControl>
                <div
                  class="cursor-pointer items-center rounded-md border-2 border-muted p-1 hover:bg-accent hover:text-accent-foreground"
                >
                  <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
                    <div class="space-y-2 rounded-md bg-white p-2 shadow-sm">
                      <div class="h-2 w-20 rounded-lg bg-[#ecedef]" />
                      <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                    </div>
                    <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                      <div class="h-4 w-4 rounded-full bg-[#ecedef]" />
                      <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                    </div>
                    <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                      <div class="h-4 w-4 rounded-full bg-[#ecedef]" />
                      <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                    </div>
                  </div>
                </div>
                <span class="block w-full p-2 text-center font-normal">
                  {{ $t('themes.light') }}
                </span>
              </FormLabel>
            </FormItem>
            <FormItem>
              <FormLabel class="flex flex-col [&:has([data-state=checked])>div]:border-primary">
                <FormControl>
                  <RadioGroupItem value="dark" class="sr-only" />
                </FormControl>
                <div
                  class="cursor-pointer items-center rounded-md border-2 border-muted p-1 hover:bg-accent hover:text-accent-foreground"
                >
                  <div class="space-y-2 rounded-sm bg-slate-950 p-2">
                    <div class="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                      <div class="h-2 w-20 rounded-lg bg-slate-400" />
                      <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
                    </div>
                    <div class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                      <div class="h-4 w-4 rounded-full bg-slate-400" />
                      <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
                    </div>
                    <div class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                      <div class="h-4 w-4 rounded-full bg-slate-400" />
                      <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
                    </div>
                  </div>
                </div>
                <span class="block w-full p-2 text-center font-normal">
                  {{ $t('themes.dark') }}
                </span>
              </FormLabel>
            </FormItem>
            <FormItem>
              <FormLabel class="flex flex-col [&:has([data-state=checked])>div]:border-primary">
                <FormControl>
                  <RadioGroupItem value="auto" class="sr-only" />
                </FormControl>

                <div
                  class="relative inline-block overflow-hidden rounded-md cursor-pointer items-center border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground"
                >
                  <!-- Base: CLARO (queda arriba-izq) -->
                  <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
                    <div class="space-y-2 rounded-md bg-white p-2 shadow-sm">
                      <div class="h-2 w-20 rounded-lg bg-[#ecedef]"></div>
                      <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]"></div>
                    </div>
                    <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                      <div class="h-4 w-4 rounded-full bg-[#ecedef]"></div>
                      <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]"></div>
                    </div>
                    <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                      <div class="h-4 w-4 rounded-full bg-[#ecedef]"></div>
                      <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]"></div>
                    </div>
                  </div>

                  <!-- Overlay: OSCURO (abajo-der), recortado en diagonal BL→TR -->
                  <div
                    class="pointer-events-none absolute inset-0 [clip-path:polygon(100%_0%,100%_100%,0%_100%)]"
                  >
                    <div class="items-center rounded-md p-1">
                      <div class="space-y-2 rounded-sm bg-slate-950 p-2">
                        <div class="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                          <div class="h-2 w-20 rounded-lg bg-slate-400"></div>
                          <div class="h-2 w-[100px] rounded-lg bg-slate-400"></div>
                        </div>
                        <div
                          class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
                        >
                          <div class="h-4 w-4 rounded-full bg-slate-400"></div>
                          <div class="h-2 w-[100px] rounded-lg bg-slate-400"></div>
                        </div>
                        <div
                          class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
                        >
                          <div class="h-4 w-4 rounded-full bg-slate-400"></div>
                          <div class="h-2 w-[100px] rounded-lg bg-slate-400"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <span class="block w-full p-2 text-center font-normal">
                  {{ $t('themes.system') }}
                </span>
              </FormLabel>
            </FormItem>
          </RadioGroup>
        </FormItem>
      </FormField>
    </section>
    <div class="flex justify-start">
      <Button type="submit">{{ $t('forms.submit') }}</Button>
    </div>
  </form>
</template>
