import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  className?: string;
};

const ChatDisclaimer: React.FC<Props> = ({ className = '' }) => {
  const { t } = useTranslation();
  return (
    <div className={`text-sm text-gray-500 ${className}`}>
      {t('chat.disclaimer')}
    </div>
  );
};

export default ChatDisclaimer;