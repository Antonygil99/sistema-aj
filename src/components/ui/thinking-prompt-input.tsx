'use client';
// Conversation input with visible progress ("thinking" steps), adapted from the ThinkingPromptInput component
// (shadcn/Tailwind original) to the workspace stylesheet and icons: same behaviour and motion — the question
// flies from the composer into the transcript, the "thinking" label shimmers, steps slide in, the composer grows
// with the draft and Stop replaces Send while busy — plus earlier turns (history), a custom answer renderer and a
// slot under the answer (proposals). Controlled: the caller supplies status, steps and the streamed answer.
import * as React from 'react';
import { ArrowRight2, ArrowUp, MagicStar, Stop, TickCircle } from '@/components/icons';

export type ThinkingStatus = 'idle' | 'thinking' | 'answering' | 'done';
export type ThinkingStep = { id: string; text: string; status?: 'active' | 'complete' | 'error' };
export type ThinkingSubmitOptions = { think: boolean };
export type ThinkingLabels = { thinking: string; thoughtFor: (seconds: number) => string; think: string; send: string; stop: string; conversation: string; response: string; complete: string; inProgress: string };
export type ThinkingPromptInputProps = {
  status?: ThinkingStatus; prompt?: string; steps?: ThinkingStep[]; answer?: string; elapsedSeconds?: number;
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  think?: boolean; defaultThink?: boolean; onThinkChange?: (think: boolean) => void;
  onSubmit?: (value: string, options: ThinkingSubmitOptions) => void; onStop?: () => void;
  placeholder?: string; followUpPlaceholder?: string; answerNote?: string; disabled?: boolean; className?: string;
  history?: React.ReactNode; renderAnswer?: (answer: string, streaming: boolean) => React.ReactNode; afterAnswer?: React.ReactNode;
  emptyState?: React.ReactNode; labels?: Partial<ThinkingLabels>;
};
const EMPTY_STEPS: ThinkingStep[] = [];
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const defaultLabels: ThinkingLabels = {
  thinking: 'Pensando', thoughtFor: seconds => `Pensó durante ${seconds} s`, think: 'Pensar a fondo', send: 'Enviar', stop: 'Detener',
  conversation: 'Conversación', response: 'Respuesta', complete: 'Listo', inProgress: 'En curso',
};
export function ThinkingPromptInput({
  status = 'idle', prompt = '', steps = EMPTY_STEPS, answer = '', elapsedSeconds = 0, value, defaultValue = '', onValueChange,
  think, defaultThink = true, onThinkChange, onSubmit, onStop, placeholder = 'Pregunta lo que necesites', followUpPlaceholder = 'Escribe un seguimiento',
  answerNote, disabled = false, className = '', history, renderAnswer, afterAnswer, emptyState, labels: labelOverrides,
}: ThinkingPromptInputProps) {
  const labels = { ...defaultLabels, ...labelOverrides };
  const [draft, setDraft] = React.useState(defaultValue);
  const [localThink, setLocalThink] = React.useState(defaultThink);
  const [expanded, setExpanded] = React.useState(false);
  const [reduced, setReduced] = React.useState(true);
  const transcript = React.useRef<HTMLDivElement | null>(null);
  const transcriptBody = React.useRef<HTMLDivElement | null>(null);
  const textarea = React.useRef<HTMLTextAreaElement | null>(null);
  const question = React.useRef<HTMLDivElement | null>(null);
  const shimmer = React.useRef<HTMLSpanElement | null>(null);
  const inputRect = React.useRef<DOMRect | null>(null);
  const previousTurn = React.useRef({ status, prompt });
  const regionId = React.useId();
  const inputValue = value ?? draft;
  const thinkingEnabled = think ?? localThink;
  const busy = status === 'thinking' || status === 'answering';
  const open = status === 'thinking' || expanded;
  const seconds = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.round(elapsedSeconds)) : 0;
  const inputPlaceholder = status === 'idle' && !history ? placeholder : followUpPlaceholder;
  const lastBoundary = [...answer.matchAll(/[.!?](?=\s|$)|\n/g)].at(-1);
  const completeAnswer = status === 'done' ? answer : answer.slice(0, lastBoundary?.index !== undefined ? lastBoundary.index + 1 : 0).trim();
  const showTranscript = status !== 'idle' || Boolean(history);

  function scrollToLatest() { const panel = transcript.current; if (panel) panel.scrollTop = panel.scrollHeight; }

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  // The reasoning list collapses again when a new turn starts.
  const [collapsedFor, setCollapsedFor] = React.useState(status);
  if (collapsedFor !== status) { setCollapsedFor(status); if (status === 'thinking' || status === 'idle') setExpanded(false); }

  // Capture the previous input rectangle before resizing the now-empty composer, then fly the question bubble in.
  React.useLayoutEffect(() => {
    const previous = previousTurn.current;
    previousTurn.current = { status, prompt };
    const newTurn = status !== 'idle' && (previous.status === 'idle' || previous.prompt !== prompt || (previous.status === 'done' && busy));
    const from = inputRect.current;
    const bubble = question.current;
    const panel = transcript.current;
    if (!newTurn || !from || !bubble || !panel || reduced) return;
    let disposed = false;
    let animation: Animation | null = null;
    queueMicrotask(() => {
      if (disposed || typeof bubble.animate !== 'function') return;
      const to = bubble.getBoundingClientRect();
      if (!to.width || !to.height) return;
      panel.style.overflow = 'visible';
      animation = bubble.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
        { transform: 'translate(0px, 0px) scale(1, 1)' },
      ], { duration: 560, easing: EASE });
      animation.onfinish = () => { panel.style.overflow = ''; scrollToLatest(); };
    });
    return () => { disposed = true; animation?.cancel(); panel.style.overflow = ''; };
  }, [status, prompt, busy, reduced]);

  // Only the composer grows for multiline drafts; the transcript stays above it.
  React.useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    let disposed = false;
    let animation: Animation | null = null;
    queueMicrotask(() => {
      if (disposed) return;
      const before = input.getBoundingClientRect().height;
      input.style.height = 'auto';
      const height = Math.max(64, Math.min(input.scrollHeight, 160));
      input.style.height = `${height}px`;
      if (!reduced && Math.abs(before - height) > 1 && typeof input.animate === 'function') animation = input.animate([{ height: `${before}px` }, { height: `${height}px` }], { duration: 200, easing: EASE });
      const rect = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      const left = Number.parseFloat(style.paddingLeft), top = Number.parseFloat(style.paddingTop);
      inputRect.current = new DOMRect(rect.left + left, rect.top + top, rect.width - left - Number.parseFloat(style.paddingRight), height - top - Number.parseFloat(style.paddingBottom));
    });
    return () => { disposed = true; animation?.cancel(); };
  }, [inputValue, reduced]);

  React.useLayoutEffect(() => {
    const panel = transcript.current, body = transcriptBody.current;
    if (!panel || !body) return;
    let disposed = false;
    const scrollToBottom = () => { if (!disposed) scrollToLatest(); };
    queueMicrotask(scrollToBottom);
    const observer = new ResizeObserver(scrollToBottom);
    observer.observe(body); observer.observe(panel);
    return () => { disposed = true; observer.disconnect(); };
  }, [status, prompt, steps, answer, answerNote, open, history, afterAnswer]);

  React.useEffect(() => {
    const element = shimmer.current;
    if (status !== 'thinking' || reduced || !element) return;
    let disposed = false;
    let animation: Animation | null = null;
    queueMicrotask(() => {
      if (disposed || typeof element.animate !== 'function') return;
      animation = element.animate([{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }], { duration: 1800, iterations: Infinity, easing: 'linear' });
    });
    return () => { disposed = true; animation?.cancel(); };
  }, [status, reduced]);

  React.useLayoutEffect(() => {
    const body = transcriptBody.current;
    if (!body || !open || reduced) return;
    let disposed = false;
    const animations: Animation[] = [];
    queueMicrotask(() => {
      if (disposed) return;
      body.querySelectorAll('[data-current-turn] [data-step]').forEach((row, index) => {
        if (!(row instanceof HTMLElement) || row.dataset.entered || typeof row.animate !== 'function') return;
        row.dataset.entered = 'true';
        animations.push(row.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0px)' }], { duration: 420, delay: index * 45, easing: EASE, fill: 'backwards' }));
      });
    });
    return () => { disposed = true; animations.forEach(animation => animation.cancel()); };
  }, [status, steps, open, reduced]);

  function changeValue(next: string) { if (value === undefined) setDraft(next); onValueChange?.(next); }
  function submit() {
    const message = inputValue.trim();
    if (!message || busy || disabled || !onSubmit) return;
    onSubmit(message, { think: thinkingEnabled });
    changeValue('');
  }
  const paragraphs = answer.split('\n').filter(Boolean);
  return <div className={`tpi ${className}`.trim()} data-state={status}>
    {showTranscript ? <div ref={transcript} className="tpi-transcript" role="region" aria-label={labels.conversation} tabIndex={0}>
      <div ref={transcriptBody} className="tpi-body">
        {history}
        {status !== 'idle' ? <div className="tpi-turn" data-current-turn>
          <div ref={question} className="tpi-question"><p>{prompt}</p></div>
          <div className="tpi-assistant">
            {steps.length > 0 || status === 'thinking' ? <>
              <button type="button" className={`tpi-thought${status === 'thinking' ? ' is-thinking' : ''}`} aria-expanded={open} aria-controls={regionId} disabled={status === 'thinking'} onClick={() => setExpanded(!expanded)}>
                <MagicStar aria-hidden="true"/>
                {status === 'thinking' ? <span ref={shimmer} className={reduced ? 'tpi-thinking-text' : 'tpi-shimmer'}>{labels.thinking}</span> : <span>{labels.thoughtFor(seconds)}</span>}
                {status === 'thinking' ? <span className="tpi-seconds">{seconds} s</span> : <ArrowRight2 className={`tpi-chevron${open ? ' is-open' : ''}`} aria-hidden="true"/>}
              </button>
              <div id={regionId} className="tpi-reasoning" hidden={!open}>
                <ol className="tpi-steps">{steps.map(step => <li key={step.id} data-step={step.id} className={`tpi-step is-${step.status ?? 'active'}`}>
                  <span className="tpi-step-dot">{step.status === 'complete' ? <TickCircle aria-label={labels.complete}/> : <span aria-label={labels.inProgress}/>}</span>
                  <span>{step.text}</span>
                </li>)}</ol>
              </div>
            </> : null}
            {status === 'answering' || status === 'done' ? <div className="tpi-answer" role="region" aria-label={labels.response} aria-live="off">
              {renderAnswer ? renderAnswer(answer, status === 'answering') : paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {status === 'answering' ? <span className="tpi-cursor" aria-hidden="true"/> : null}
              {answerNote && status === 'done' ? <p className="tpi-note">{answerNote}</p> : null}
            </div> : null}
            {afterAnswer}
          </div>
        </div> : null}
      </div>
    </div> : null}
    {!showTranscript ? emptyState : null}
    <form className="tpi-composer" onSubmit={event => { event.preventDefault(); submit(); }}>
      <textarea ref={textarea} aria-label={inputPlaceholder} placeholder={inputPlaceholder} value={inputValue} disabled={disabled} rows={2} className="tpi-textarea"
        onChange={event => changeValue(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}/>
      <div className="tpi-actions">
        <button type="button" className="tpi-think" aria-pressed={thinkingEnabled} disabled={disabled || busy} onClick={() => { if (think === undefined) setLocalThink(!thinkingEnabled); onThinkChange?.(!thinkingEnabled); }}>
          <MagicStar aria-hidden="true"/>{labels.think}{thinkingEnabled ? <TickCircle className="tpi-think-check" aria-hidden="true"/> : null}
        </button>
        <button type={busy ? 'button' : 'submit'} className={`tpi-send${busy ? ' is-busy' : ''}`} aria-label={busy ? labels.stop : labels.send}
          onClick={busy ? event => { event.preventDefault(); onStop?.(); } : undefined}
          disabled={disabled || (busy ? !onStop : !inputValue.trim() || !onSubmit)}>
          <span className="tpi-send-icon is-send" aria-hidden="true"><ArrowUp/></span>
          <span className="tpi-send-icon is-stop" aria-hidden="true"><Stop variant={'Bold'}/></span>
        </button>
      </div>
    </form>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status === 'thinking' ? `${labels.thinking}. ${steps.at(-1)?.text ?? ''}` : completeAnswer}</div>
  </div>;
}
