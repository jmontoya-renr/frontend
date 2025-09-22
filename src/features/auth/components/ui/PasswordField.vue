<script setup lang="ts">
import { ref } from 'vue'
import { EyeOffIcon, EyeIcon } from 'lucide-vue-next'
import { useField } from 'vee-validate'

import Box from '@/features/auth/components/ui/Box.vue'
import FormItem from '@/shared/components/ui/form/FormItem.vue'
import FormLabel from '@/shared/components/ui/form/FormLabel.vue'
import FormControl from '@/shared/components/ui/form/FormControl.vue'
import FormMessage from '@/shared/components/ui/form/FormMessage.vue'
import FormDescription from '@/shared/components/ui/form/FormDescription.vue'
import Input from '@/shared/components/ui/input/Input.vue'
import { t } from '@/plugins/i18n'

interface PasswordFieldProps {
  name?: string
  label?: string
  placeholder?: string | (() => string)
  description?: string
}

const props = withDefaults(defineProps<PasswordFieldProps>(), {
  name: 'password',
  placeholder: () => t('forms.enter-password'),
})

const passwordVisible = ref(false)

function resolvePlaceholder(placeholder: string | (() => string)): string {
  return typeof placeholder === 'function' ? placeholder() : placeholder
}

const { value, errorMessage, handleChange } = useField<string>(props.name)
</script>

<template>
  <FormItem>
    <FormLabel v-if="props.label">{{ props.label }}</FormLabel>
    <FormControl>
      <Box class="relative">
        <Input
          v-model="value"
          @blur="handleChange"
          :type="passwordVisible ? 'text' : 'password'"
          autocomplete="on"
          :placeholder="resolvePlaceholder(props.placeholder)"
          :class="['pr-12', errorMessage ? 'text-destructive' : '']"
        />
        <Box
          class="absolute inset-y-0 right-0 flex cursor-pointer items-center p-3 text-muted-foreground"
          @click="passwordVisible = !passwordVisible"
        >
          <component :is="passwordVisible ? EyeOffIcon : EyeIcon" class="h-4 w-4" />
        </Box>
      </Box>
    </FormControl>
    <FormMessage>{{ errorMessage }}</FormMessage>
    <FormDescription v-if="props.description">
      {{ props.description }}
    </FormDescription>
  </FormItem>
</template>
