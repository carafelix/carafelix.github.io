import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
    },
    site: 'https://heroprotagonist.is-a.dev',
    compressHTML: true,

    i18n: {
        locales: ['es', 'en'],
        defaultLocale: 'en',
    },
})
