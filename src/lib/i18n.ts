import { getRequestConfig } from 'next-intl/server';
import tr from '../messages/tr.json';
import en from '../messages/en.json';

const messagesMap = { tr, en } as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || 'en';
  return {
    locale,
    messages: messagesMap[locale as keyof typeof messagesMap] || en,
  };
});
