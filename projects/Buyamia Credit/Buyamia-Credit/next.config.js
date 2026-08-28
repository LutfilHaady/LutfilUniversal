/** @type {import('next').NextConfig} */
const { i18n } = require('./i18n.config')

const nextConfig = {
  reactStrictMode: true,
  i18n,
  output: 'standalone', // Required for Docker optimization
}

module.exports = nextConfig

