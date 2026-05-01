import React, { useCallback, useEffect } from 'react';
import InputChatContent from '../components/InputChatContent';
import { create } from 'zustand';
import useChat from '../hooks/useChat';
import useRag from '../hooks/useRag';
import { useLocation, Link } from 'react-router-dom';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import { RagPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import queryString from 'query-string';
import { useTranslation } from 'react-i18next';
import Alert from '../components/Alert';
import ChatDisclaimer from '../components/ChatDisclaimer';

type StateType = {
  content: string;
  setContent: (c: string) => void;
};

const useRagPageState = create<StateType>((set) => {
  return {
    content: '',
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
  };
});

const RagPage: React.FC = () => {
  const { t } = useTranslation();
  const { content, setContent } = useRagPageState();
  const { pathname, search } = useLocation();
  const { getModelId, setModelId, forceToStop } = useChat(pathname);
  const { postMessage, clear, loading, writing, messages, isEmpty } =
    useRag(pathname);
  const { scrollableContainer, setFollowing } = useFollow();
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    if (search !== '') {
      const params = queryString.parse(search) as RagPageQueryParams;
      setContent(params.content ?? '');
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels, modelId, search, setContent]);

  const onSend = useCallback(() => {
    setFollowing(true);
    postMessage(content);
    setContent('');
  }, [content, postMessage, setContent, setFollowing]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
  }, [clear, setContent]);

  const onStop = useCallback(() => {
    forceToStop();
  }, [forceToStop]);

  return (
    <>
      <div className={`${!isEmpty ? 'screen:pb-48' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {t('rag.title')}
        </div>

        <div className="mt-2 flex w-full items-end justify-center lg:mt-0">
          <Select
            value={modelId}
            onChange={setModelId}
            options={availableModels.map((m) => {
              return { value: m, label: modelDisplayName(m) };
            })}
          />
        </div>

        {isEmpty && (
          <div
            className={`absolute inset-x-0 top-28 m-auto flex justify-center`}>
            <div>
              <Alert severity="info">
                <div>
                  <h2 className="mb-2">{t('rag.modelselect')}</h2>
                  <p>{t('rag.modelselectcan')}</p>

                  <section className="mt-3">
                    <h3 className="font-medium">{t('rag.recmodel')}</h3>
                    <ul className="mt-2 list-disc pl-5">
                      <li>
                        <strong>{t('rag.strong')}：</strong>
                        <span>Claude Sonnet 4.6</span>
                      </li>
                      <li>
                        <strong>{t('rag.speed')}：</strong>
                        <span>Claude Haiku 4.5</span>
                      </li>
                    </ul>
                  </section>
                </div>
                <footer className="mt-4 text-sm text-gray-600">
                  <p>{t('rag.tr')}</p>
                </footer>
              </Alert>
              <Alert severity="info">
                <div>{t('rag.ragcan')}</div>
                <div>{t('rag.kendrasearch')}</div>
                <div className="font-bold">
                  {t('rag.kendraonly')}
                  <Link
                    className="text-aws-smile"
                    to="/rag?mode=search-only"
                    target="_blank"
                    rel="noopener noreferrer">
                    {t('rag.here')}
                  </Link>
                  {t('rag.please_refer')}
                </div>
              </Alert>
            </div>
          </div>
        )}

        <div ref={scrollableContainer}>
          {messages.map((chat, idx) => (
            <div key={idx}>
              <ChatMessage
                idx={idx}
                chatContent={chat}
                loading={loading && idx === messages.length - 1}
              />
              <div className="w-full border-b border-gray-300"></div>
            </div>
          ))}
        </div>

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
          <InputChatContent
            content={content}
            disabled={loading && !writing}
            onChangeContent={setContent}
            onSend={() => {
              if (!loading) {
                onSend();
              } else {
                onStop();
              }
            }}
            onReset={onReset}
            canStop={writing}
          />
          <ChatDisclaimer className="mb-1" />
        </div>
      </div>
    </>
  );
};

export default RagPage;
