module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr', 'id'],
    localeDetection: false,
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
}
