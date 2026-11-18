import React from 'react';
import { X, CreditCard } from 'lucide-react';
import type { IntegrationStatus, Lang, User } from '../types/lms.ts';
import { t } from '../i18n/translations.ts';
import { CardTransferCheckout } from './CardTransferCheckout.tsx';

export function SubscriptionModal({
  user,
  integrations,
  lang,
  onClose,
  onActivated,
}: {
  user: User;
  integrations: IntegrationStatus;
  lang: Lang;
  onClose: () => void;
  onActivated: (updatedUser: User) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
              {t(lang, 'subModalTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label={t(lang, 'close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">
          <CardTransferCheckout
            user={user}
            integrations={integrations}
            lang={lang}
            onActivated={onActivated}
            onDoneButtonClick={onClose}
          />
        </div>
      </div>
    </div>
  );
}
