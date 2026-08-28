'use client'

import { useTranslation as useReactTranslation } from 'react-i18next'

export const useTranslation = () => {
  const { t, i18n } = useReactTranslation('common')
  
  return {
    t,
    changeLanguage: i18n.changeLanguage,
    currentLanguage: i18n.language,
    availableLanguages: ['en', 'es', 'fr', 'id'],
  }
}

export default useTranslation
