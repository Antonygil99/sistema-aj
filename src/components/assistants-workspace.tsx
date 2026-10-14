'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Add, Chart, ClipboardText, Copy, Health, Messages2, Refresh2, TaskSquare, Teacher, VideoPlay, type Icon } from '@/components/icons';
import { agents, type AgentId } from '@/agents/catalog';
import { parseAnswer, type Inline } from '@/agents/format';
import type { AgentEvent } from '@/agents/loop';
import type { ComposerRequest } from './email-composer';
import { ThinkingPromptInput, type ThinkingStatus, type ThinkingStep } from './ui/thinking-prompt-input';
import { apiFetch, messageFor } from './ui/client-api';
import { useToast } from './ui/toast';
const EmailComposer = dynamic(() => import('./email-composer').then(module => module.EmailComposer), { ssr: false });
const icons: Record<string, Icon> = { Messages2, ClipboardText, TaskSquare, Refresh2, Health, VideoPlay, Chart, Teacher };
type ProposalView = { id: string; tool: string; input: unknown; title: string; details: [string, string][]; state: 'pending' | 'running' | 'done' | 'cancelled' | 'error'; result?: string; url?: string };
type Turn = { id: string; prompt: string; status: ThinkingStatus; steps: ThinkingStep[]; answer: string; proposals: ProposalView[]; elapsed: number; notice?: string; error?: string };
type ComposePayload = { clientId: string; clientName: string; kind: ComposerRequest['kind']; subject: string; message: string; noticeId?: string };
const proposalStates: Record<ProposalView['state'], string> = { pending: '', running: 'Aplicando…', done: 'Hecho', cancelled: 'Descartada', error: 'No se pudo aplicar' };
function InlineText({ parts }: { parts: Inline[] }) {
  return <>{parts.map((part, index) => part.t === 'bold' ? <strong key={index}>{part.v}</strong> : part.t === 'code' ? <code key={index}>{part.v}</code> : part.t === 'link' ? <Link key={index} href={part.href}>{part.v}</Link> : <span key={index}>{part.v}</span>)}</>;
}
// Light Markdown: paragraphs, lists, quotes and copyable blocks (WhatsApp drafts). No HTML, internal links only.
function AnswerBlocks({ text }: { text: string }) {
  const toast = useToast();
  return <>{parseAnswer(text).map((block, index) => {
    if (block.type === 'code') return <div key={index} className="assistant-draft"><pre>{block.text}</pre><button type="button" className="text-button" onClick={() => { void navigator.clipboard.writeText(block.text).then(() => toast({ kind: 'success', title: 'Texto copiado' })); }}><Copy aria-hidden="true"/>Copiar</button></div>;
    if (block.type === 'list') { const List = block.ordered ? 'ol' : 'ul'; return <List key={index}>{block.items.map((item, position) => <li key={position}><InlineText parts={item}/></li>)}</List>; }
    if (block.type === 'quote') return <blockquote key={index}><InlineText parts={block.inline}/></blockquote>;
    if (block.type === 'heading') return <p key={index} className="assistant-heading"><InlineText parts={block.inline}/></p>;
    return <p key={index}><InlineText parts={block.inline}/></p>;
  })}</>;
}
// The assistants of the Ruta AJ inside the CRM. Each one reads the CRM through its tools and only proposes changes:
// a person confirms each proposal here, and emails still go through the composer.
export function AssistantsWorkspace({ initialAgent, configured, canAct, isSuperadmin, modelLabel, senderName }: { initialAgent: AgentId; configured: boolean; canAct: boolean; isSuperadmin: boolean; modelLabel: string; senderName: string }) {
  const toast = useToast();
  const [agentId, setAgentId] = useState<AgentId>(initialAgent);
  const [conversations, setConversations] = useState<Record<string, Turn[]>>({});
  const [think, setThink] = useState(true);
  const [composer, setComposer] = useState<(ComposerRequest & { proposalId: string; agentId: string }) | null>(null);
  const [composerUsed, setComposerUsed] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLElement>(null);
  const agent = agents.find(item => item.id === agentId)!;
  const turns = conversations[agentId] ?? [];
  const current = turns.at(-1);
  const busy = current?.status === 'thinking' || current?.status === 'answering';
  const AgentIcon = icons[agent.icon] ?? Messages2;
  const updateTurn = useCallback((agent: string, id: string, change: (turn: Turn) => Turn) => setConversations(all => ({ ...all, [agent]: (all[agent] ?? []).map(turn => turn.id === id ? change(turn) : turn) })), []);
  // A second counter while the assistant thinks.
  useEffect(() => {
    if (current?.status !== 'thinking') return;
    const timer = window.setInterval(() => updateTurn(agentId, current.id, turn => ({ ...turn, elapsed: turn.elapsed + 1 })), 1000);
    return () => window.clearInterval(timer);
  }, [agentId, current?.id, current?.status, updateTurn]);
  // On phones the assistant list scrolls sideways: keep the chosen one in view (without moving the page).
  useEffect(() => {
    const nav = list.current, button = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (nav && button && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: Math.max(0, button.offsetLeft - nav.offsetLeft - 8), behavior: 'smooth' });
  }, [agentId]);
  // Leaving the page stops a running answer.
  useEffect(() => { const controller = abort; return () => controller.current?.abort(); }, []);
  function choose(id: AgentId) {
    if (busy) abort.current?.abort();
    setAgentId(id);
    window.history.replaceState(null, '', `/asistentes?agente=${id}`);
  }
  function apply(agent: string, id: string, event: AgentEvent) {
    updateTurn(agent, id, turn => {
      if (event.type === 'step') {
        const steps = turn.steps.some(step => step.id === event.id) ? turn.steps.map(step => step.id === event.id ? { ...step, status: event.status } : step) : [...turn.steps, { id: event.id, text: event.text, status: event.status }];
        return { ...turn, steps };
      }
      if (event.type === 'text') return { ...turn, status: 'answering', answer: turn.answer + event.delta, steps: turn.steps.map(step => ({ ...step, status: step.status === 'active' ? 'complete' : step.status })) };
      if (event.type === 'proposal') return { ...turn, proposals: [...turn.proposals, { id: event.id, tool: event.tool, input: event.input, title: event.title, details: event.details, state: 'pending' }] };
      if (event.type === 'notice') return { ...turn, notice: event.text };
      if (event.type === 'error') return { ...turn, status: 'done', error: messageFor(event.code) };
      if (event.type === 'done') return { ...turn, status: 'done', steps: turn.steps.map(step => ({ ...step, status: step.status === 'active' ? 'complete' : step.status })) };
      return turn;
    });
  }
  async function send(prompt: string, options: { think: boolean }) {
    if (busy) return;
    const id = crypto.randomUUID();
    const owner = agentId;
    // Earlier turns travel as plain text; proposals are summarized so the assistant knows what was decided.
    const history = turns.filter(turn => turn.status === 'done').flatMap(turn => [
      { role: 'user' as const, text: turn.prompt },
      { role: 'assistant' as const, text: [turn.answer, ...turn.proposals.map(proposal => `[Propuesta «${proposal.title}»: ${proposal.state === 'done' ? `confirmada${proposal.result ? ` — ${proposal.result}` : ''}` : proposal.state === 'cancelled' ? 'descartada' : 'sin confirmar'}]`)].filter(Boolean).join('\n').slice(0, 8000) || '(sin respuesta)' },
    ]).slice(-20);
    setConversations(all => ({ ...all, [owner]: [...(all[owner] ?? []), { id, prompt, status: 'thinking', steps: [], answer: '', proposals: [], elapsed: 0 }] }));
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: owner, message: prompt, think: options.think, history }), signal: controller.signal });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        apply(owner, id, { type: 'error', code: body.error ?? 'AI_UNAVAILABLE', text: '' });
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) if (line.trim()) { try { apply(owner, id, JSON.parse(line) as AgentEvent); } catch { /* ignore a malformed line */ } }
      }
      updateTurn(owner, id, turn => turn.status === 'done' ? turn : { ...turn, status: 'done' });
    } catch {
      if (controller.signal.aborted) updateTurn(owner, id, turn => ({ ...turn, status: 'done', notice: 'Detuviste la respuesta.' }));
      else apply(owner, id, { type: 'error', code: 'NETWORK', text: '' });
    }
  }
  async function confirm(turnId: string, proposal: ProposalView) {
    const owner = agentId;
    const setState = (state: ProposalView['state'], extra: Partial<ProposalView> = {}) => updateTurn(owner, turnId, turn => ({ ...turn, proposals: turn.proposals.map(item => item.id === proposal.id ? { ...item, state, ...extra } : item) }));
    setState('running');
    try {
      const { data } = await apiFetch<{ data: { message: string; url?: string; compose?: ComposePayload } }>('/api/assistant/actions', { method: 'POST', json: { tool: proposal.tool, input: proposal.input } });
      if (data.compose) {
        // Emails still go through the composer: recipients, attachments and the final click are the person's.
        setState('pending');
        setComposerUsed(true);
        setComposer({ kind: data.compose.kind, clientId: data.compose.clientId, clientName: data.compose.clientName, noticeId: data.compose.noticeId, draft: { subject: data.compose.subject, message: data.compose.message }, proposalId: proposal.id, agentId: owner });
        return;
      }
      setState('done', { result: data.message, url: data.url });
      toast({ kind: 'success', title: data.message });
      window.dispatchEvent(new CustomEvent('aj:remote-change'));
    } catch (error) {
      setState('error', { result: error instanceof Error ? error.message : undefined });
    }
  }
  const proposalCards = (turn: Turn, live: boolean): ReactNode => turn.proposals.length || turn.notice || turn.error ? <div className="assistant-extras">
    {turn.proposals.map(proposal => <div key={proposal.id} className={`assistant-proposal is-${proposal.state}`}>
      <div className="assistant-proposal-head"><strong>{proposal.title}</strong>{proposal.state !== 'pending' ? <span className="status-pill tone-neutral">{proposalStates[proposal.state]}</span> : <span className="status-pill tone-blue">Por confirmar</span>}</div>
      <dl>{proposal.details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {proposal.result ? <p className="assistant-proposal-result">{proposal.result}{proposal.url ? <> · <Link href={proposal.url}>Abrir</Link></> : null}</p> : null}
      {proposal.state === 'pending' && live && canAct ? <div className="assistant-proposal-actions">
        <button type="button" className="button" onClick={() => void confirm(turn.id, proposal)}>{proposal.tool === 'preparar_correo' ? 'Revisar y enviar' : 'Confirmar'}</button>
        <button type="button" className="text-button" onClick={() => updateTurn(agentId, turn.id, item => ({ ...item, proposals: item.proposals.map(entry => entry.id === proposal.id ? { ...entry, state: 'cancelled' } : entry) }))}>Descartar</button>
      </div> : null}
      {proposal.state === 'pending' && !canAct ? <p className="assistant-proposal-result">Solo un administrador puede confirmarla.</p> : null}
    </div>)}
    {turn.notice ? <p className="assistant-notice">{turn.notice}</p> : null}
    {turn.error ? <p className="assistant-error" role="alert">{turn.error}</p> : null}
  </div> : null;
  const history = turns.length > 1 ? <>{turns.slice(0, -1).map(turn => <div key={turn.id} className="tpi-turn is-past">
    <div className="tpi-question"><p>{turn.prompt}</p></div>
    <div className="tpi-assistant">{turn.steps.length ? <p className="tpi-past-steps">Consultó: {turn.steps.map(step => step.text).join(' · ')}</p> : null}<div className="tpi-answer"><AnswerBlocks text={turn.answer}/></div>{proposalCards(turn, true)}</div>
  </div>)}</> : undefined;
  return <div className="assistants">
    <nav ref={list} className="assistant-list" aria-label="Asistentes">{agents.map(item => { const ItemIcon = icons[item.icon] ?? Messages2; return <button key={item.id} type="button" aria-current={item.id === agentId ? 'true' : undefined} onClick={() => choose(item.id)}>
      <span className="assistant-icon"><ItemIcon aria-hidden="true"/></span><span><strong>{item.name}</strong><small>{item.short}</small></span>
    </button>; })}</nav>
    <section className="assistant-chat" aria-labelledby="asistente-titulo">
      <div className="assistant-head">
        <span className="assistant-icon is-large"><AgentIcon aria-hidden="true"/></span>
        <div><h2 id="asistente-titulo">{agent.name}</h2><p>{agent.purpose}</p></div>
        <div className="assistant-head-actions"><span className="subtle-pill" title="Se cambia en Preferencias">{modelLabel}</span>{turns.length ? <button type="button" className="text-button" onClick={() => { abort.current?.abort(); setConversations(all => ({ ...all, [agentId]: [] })); }}><Add aria-hidden="true"/>Nueva conversación</button> : null}</div>
      </div>
      {!configured ? <p className="notice" role="alert">{isSuperadmin ? 'Falta configurar en el servidor la llave de Anthropic (ANTHROPIC_API_KEY) u OpenAI (OPENAI_API_KEY) para que los asistentes respondan.' : 'Los asistentes aún no están configurados. Avisa al administrador.'}</p> : null}
      <ThinkingPromptInput
        key={agentId}
        className="assistant-thread"
        status={current?.status ?? 'idle'} prompt={current?.prompt} steps={current?.steps} answer={current?.answer} elapsedSeconds={current?.elapsed}
        think={think} onThinkChange={setThink} onSubmit={(value, options) => void send(value, options)} onStop={() => abort.current?.abort()}
        disabled={!configured}
        placeholder={`Pregúntale a ${agent.name.toLowerCase()}`}
        history={history}
        renderAnswer={text => <AnswerBlocks text={text}/>}
        afterAnswer={current ? proposalCards(current, true) : null}
        emptyState={<div className="assistant-empty"><p>Prueba con:</p><div className="assistant-suggestions">{agent.suggestions.map(suggestion => <button key={suggestion} type="button" className="filter-chip" disabled={!configured} onClick={() => void send(suggestion, { think })}>{suggestion}</button>)}</div><small>Consulta la cartera con tus permisos. Lo que cambie algo te lo propone para que lo confirmes; los correos los revisas y envías tú.</small></div>}
      />
    </section>
    {composerUsed ? <EmailComposer request={composer} senderName={senderName} onClose={() => setComposer(null)} onSent={() => {
      if (!composer) return;
      updateTurn(composer.agentId, conversations[composer.agentId]?.find(turn => turn.proposals.some(item => item.id === composer.proposalId))?.id ?? '', turn => ({ ...turn, proposals: turn.proposals.map(item => item.id === composer.proposalId ? { ...item, state: 'done', result: 'Correo enviado' } : item) }));
    }}/> : null}
  </div>;
}
