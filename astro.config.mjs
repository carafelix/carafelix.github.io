import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@astrojs/react'

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
    },
    integrations: [react()],
    site: 'https://heroprotagonist.is-a.dev',
    compressHTML: true,

    i18n: {
        locales: ['es', 'en'],
        defaultLocale: 'en',
    },
})
