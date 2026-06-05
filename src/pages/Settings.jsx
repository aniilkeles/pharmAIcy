import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import i18n from '@/i18n'

const LANGUAGES = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
]

function Settings() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { clearChat } = useStore()
  const currentLang = i18n.language

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('pharmaicy_lang', code)
  }

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6 max-w-xl"
    >
      <div>
        <h1 className="text-lg font-semibold text-text">{t('settings.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-text">{t('settings.language')}</h2>
        <p className="text-xs text-muted -mt-2">{t('settings.language_subtitle')}</p>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                currentLang === lang.code
                  ? 'bg-accent text-black border-accent font-medium'
                  : 'border-border text-muted hover:text-text hover:border-muted'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-text">{t('settings.account')}</h2>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">{t('settings.email')}</p>
          <p className="text-sm text-text">{user?.email}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">{t('settings.user_id')}</p>
          <p className="text-xs text-muted font-mono">{user?.id}</p>
        </div>
        <button
          onClick={logout}
          className="w-fit px-4 py-2 bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg hover:bg-danger/20 transition-colors"
        >
          {t('settings.sign_out')}
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-text">{t('settings.data')}</h2>
        <button
          onClick={clearChat}
          className="w-fit px-4 py-2 border border-border text-muted text-sm rounded-lg hover:text-text hover:border-muted transition-colors"
        >
          {t('settings.clear_chat')}
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium text-text mb-3">{t('settings.about')}</h2>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('settings.version')}</span>
            <span className="text-text">2.0.0</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('settings.backend')}</span>
            <span className="text-text">FastAPI + Python</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('settings.ai_model')}</span>
            <span className="text-text">claude-sonnet-4-6</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('settings.database')}</span>
            <span className="text-text">SQLite (per-user)</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Settings
