import { defineConfig, minimal2023Preset, type Preset } from '@vite-pwa/assets-generator/config'

const appBackground = '#090b0f'

const preset: Preset = {
  ...minimal2023Preset,
  transparent: {
    ...minimal2023Preset.transparent,
    padding: 0,
  },
  maskable: {
    ...minimal2023Preset.maskable,
    padding: 0.1,
    resizeOptions: {
      background: appBackground,
      fit: 'contain',
    },
  },
  apple: {
    ...minimal2023Preset.apple,
    padding: 0,
    resizeOptions: {
      background: appBackground,
      fit: 'contain',
    },
  },
}

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  images: ['public/pwa-source.svg'],
  preset,
})
