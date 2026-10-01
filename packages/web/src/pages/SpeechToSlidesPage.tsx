import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiDownloadSimple, PiX } from 'react-icons/pi';
import { Model, UnrecordedMessage } from 'generative-ai-use-cases';
import Card from '../components/Card';
import Button from '../components/Button';
import ButtonCopy from '../components/ButtonCopy';
import ButtonIcon from '../components/ButtonIcon';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import ExpandableField from '../components/ExpandableField';
import MeetingMinutesFile from '../components/MeetingMinutes/MeetingMinutesFile';
import useChatApi from '../hooks/useChatApi';
import { MODELS } from '../hooks/useModel';
import {
  speechToSlidesPrompt,
  SpeechToSlidesContentType,
} from '../prompts/speechToSlides';
import {
  buildSlidesHtml,
  extractSlidesMarkup,
  resizeImageToDataUrl,
  slidesFileName,
  BuiltSlides,
} from '../utils/SpeechToSlidesUtils';

const SpeechToSlidesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { predictStream } = useChatApi();
  const { modelIds: availableModels, textModels, modelDisplayName } = MODELS;
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [transcript, setTranscript] = useState('');
  const [contentType, setContentType] =
    useState<SpeechToSlidesContentType>('speech');
  // Claude Sonnet is preferred because it can output long HTML stably
  const [modelId, setModelId] = useState(
    () =>
      availableModels.find((m) => m.includes('sonnet')) ??
      availableModels[0] ??
      ''
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [additionalInstruction, setAdditionalInstruction] = useState('');

  const [loading, setLoading] = useState(false);
  const [generatedLength, setGeneratedLength] = useState(0);
  const [markup, setMarkup] = useState('');
  const [error, setError] = useState('');

  const contentTypeOptions = useMemo(
    () => [
      { value: 'speech', label: t('speechToSlides.content_type_speech') },
      { value: 'meeting', label: t('speechToSlides.content_type_meeting') },
    ],
    [t]
  );

  // The photo is embedded when the HTML is built, so it can be changed without regeneration
  const slides: BuiltSlides | null = useMemo(() => {
    if (!markup) return null;
    return buildSlidesHtml(markup, photoDataUrl, i18n.resolvedLanguage ?? 'ja');
  }, [markup, photoDataUrl, i18n.resolvedLanguage]);

  const onChangePhoto = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setPhotoError('');
      if (!file) return;
      try {
        setPhotoDataUrl(await resizeImageToDataUrl(file));
      } catch (err) {
        console.error(err);
        setPhotoDataUrl(null);
        setPhotoError(t('speechToSlides.photo_error'));
      }
    },
    [t]
  );

  const onClickRemovePhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setPhotoError('');
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }, []);

  const disabledExec = useMemo(
    () => transcript.trim() === '' || modelId === '' || loading,
    [transcript, modelId, loading]
  );

  const onClickExec = useCallback(async () => {
    if (disabledExec) return;
    const model = textModels.find((m) => m.modelId === modelId);
    if (!model) {
      setError(t('speechToSlides.error_generate'));
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedLength(0);

    const messages: UnrecordedMessage[] = [
      {
        role: 'system',
        content: speechToSlidesPrompt({
          contentType,
          additionalInfo,
          additionalInstruction,
        }),
      },
      { role: 'user', content: transcript },
    ];

    try {
      let fullResponse = '';
      const stream = predictStream({
        model: model as Model,
        messages,
        id: `speech-to-slides-${Date.now()}`,
      });
      for await (const chunk of stream) {
        if (!chunk) continue;
        for (const c of (chunk as string).split('\n')) {
          if (!c) continue;
          try {
            const payload = JSON.parse(c) as { text: string };
            if (payload.text) {
              fullResponse += payload.text;
              setGeneratedLength(fullResponse.length);
            }
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }

      const extracted = extractSlidesMarkup(fullResponse);
      if (!/<section[\s>]/i.test(extracted)) {
        setError(t('speechToSlides.error_no_slides'));
        return;
      }
      setMarkup(extracted);
    } catch (err) {
      console.error(err);
      setError(t('speechToSlides.error_generate'));
    } finally {
      setLoading(false);
    }
  }, [
    disabledExec,
    textModels,
    modelId,
    contentType,
    additionalInfo,
    additionalInstruction,
    transcript,
    predictStream,
    t,
  ]);

  const onClickDownload = useCallback(() => {
    if (!slides) return;
    const blob = new Blob([slides.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slidesFileName(slides.title);
    a.click();
    URL.revokeObjectURL(url);
  }, [slides]);

  const onClickClear = useCallback(() => {
    setMarkup('');
    setError('');
    setGeneratedLength(0);
    setAdditionalInstruction('');
  }, []);

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('speechToSlides.title')}
      </div>

      <div className="col-span-12 col-start-1 mx-2 flex flex-col gap-4 lg:col-span-10 lg:col-start-2">
        {/* Step 1: Speech recognition */}
        <Card label={t('speechToSlides.step_transcribe')}>
          <p className="mb-2 px-2 text-sm text-gray-500">
            {t('speechToSlides.step_transcribe_description')}
          </p>
          <MeetingMinutesFile onTranscriptChange={setTranscript} />
        </Card>

        {/* Step 2: Settings */}
        <Card label={t('speechToSlides.step_settings')}>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 font-bold">
                {t('speechToSlides.content_type')}
              </div>
              <Select
                value={contentType}
                onChange={(v) => setContentType(v as SpeechToSlidesContentType)}
                options={contentTypeOptions}
                fullWidth
              />
            </div>
            <div>
              <div className="mb-2 font-bold">{t('speechToSlides.model')}</div>
              <Select
                value={modelId}
                onChange={setModelId}
                options={availableModels.map((m) => ({
                  value: m,
                  label: modelDisplayName(m),
                }))}
                fullWidth
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 font-bold">
              {t('speechToSlides.cover_photo')}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {t('speechToSlides.optional')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={onChangePhoto}
                className="border-aws-font-color/20 block h-10 w-full cursor-pointer rounded-lg border
                  text-sm text-gray-900 file:mr-4 file:cursor-pointer file:border-0 file:bg-gray-500
                  file:px-4 file:py-2.5 file:text-white focus:outline-none"
              />
              {photoDataUrl && (
                <>
                  <img
                    src={photoDataUrl}
                    alt={t('speechToSlides.cover_photo')}
                    className="h-16 rounded border"
                  />
                  <ButtonIcon
                    onClick={onClickRemovePhoto}
                    title={t('speechToSlides.remove_photo')}>
                    <PiX />
                  </ButtonIcon>
                </>
              )}
            </div>
            <p className="ml-0.5 mt-1 text-xs text-gray-500">
              {t('speechToSlides.cover_photo_help')}
            </p>
            {photoError && (
              <p className="mt-1 text-sm text-red-500">{photoError}</p>
            )}
          </div>

          <ExpandableField label={t('speechToSlides.additional_info')} optional>
            <Textarea
              placeholder={t('speechToSlides.additional_info_placeholder')}
              value={additionalInfo}
              onChange={setAdditionalInfo}
            />
          </ExpandableField>

          <ExpandableField
            label={t('speechToSlides.additional_instruction')}
            optional>
            <Textarea
              placeholder={t(
                'speechToSlides.additional_instruction_placeholder'
              )}
              value={additionalInstruction}
              onChange={setAdditionalInstruction}
            />
          </ExpandableField>

          <div className="flex items-center justify-end gap-3">
            {loading && (
              <span className="text-sm text-gray-500">
                {t('speechToSlides.generating', { count: generatedLength })}
              </span>
            )}
            <Button
              outlined
              onClick={onClickClear}
              disabled={loading || (!markup && !error)}>
              {t('common.clear')}
            </Button>
            <Button onClick={onClickExec} disabled={disabledExec}>
              {markup
                ? t('speechToSlides.regenerate')
                : t('speechToSlides.generate')}
            </Button>
          </div>
          {transcript.trim() === '' && (
            <p className="mt-2 text-right text-xs text-gray-500">
              {t('speechToSlides.need_transcript')}
            </p>
          )}
        </Card>

        {/* Step 3: Result */}
        <Card label={t('speechToSlides.step_result')}>
          {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
          {slides ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {t('speechToSlides.pages', { count: slides.pageCount })}
                </span>
                <div className="flex items-center gap-1">
                  <ButtonCopy text={slides.html} />
                  <Button onClick={onClickDownload}>
                    <PiDownloadSimple className="mr-1" />
                    {t('speechToSlides.download')}
                  </Button>
                </div>
              </div>
              {/* Generated HTML is shown in a sandbox without scripts */}
              <iframe
                title={t('speechToSlides.preview')}
                sandbox=""
                srcDoc={slides.html}
                className="aspect-video w-full rounded border border-black/30"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('speechToSlides.preview_help')}
              </p>
            </>
          ) : (
            <div className="text-gray-500">
              {loading ? (
                <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
              ) : (
                t('speechToSlides.result_placeholder')
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SpeechToSlidesPage;
