import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@astrojs/react'

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
    },
    site: 'https://heroprotagonist.is-a.dev',
    integrations: [react()],
    compressHTML: true,
})
