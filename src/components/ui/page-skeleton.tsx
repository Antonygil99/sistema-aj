// Instant placeholder shown by loading.tsx while the server renders the next screen: the layout stays, the content
// area shows the shape of what is coming. Blocks are decorative; screen readers hear a single "Cargando…".
type Kind = 'dashboard' | 'module' | 'detail';
const Block = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => <span className={`skeleton ${className}`.trim()} style={style}/>;
function Heading({ back = true }: { back?: boolean }) {
  return <div className="skeleton-heading">
    {back ? <Block className="is-line" style={{ width: 120 }}/> : null}
    <Block className="is-line" style={{ width: 140 }}/>
    <Block className="is-title" style={{ width: '42%' }}/>
    <Block className="is-line" style={{ width: '30%' }}/>
  </div>;
}
export function PageSkeleton({ kind }: { kind: Kind }) {
  return <div className="page-skeleton" role="status" aria-live="polite">
    <span className="sr-only">Cargando…</span>
    <div aria-hidden="true">
      {kind === 'dashboard' ? <>
        <Heading back={false}/>
        <div className="skeleton-row is-metrics">{[0, 1, 2, 3].map(index => <Block key={index} className="is-card"/>)}</div>
        <div className="skeleton-columns"><Block className="is-panel"/><div className="skeleton-stack"><Block className="is-panel is-short"/><Block className="is-panel is-short"/></div></div>
      </> : kind === 'module' ? <>
        <Heading/>
        <div className="skeleton-toolbar"><Block className="is-pill" style={{ width: 190 }}/><Block className="is-line" style={{ width: 90 }}/><Block className="is-pill is-end" style={{ width: 150 }}/></div>
        <Block className="is-input"/>
        <div className="skeleton-table">{[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="skeleton-table-row"><Block className="is-line" style={{ width: '28%' }}/><Block className="is-line" style={{ width: '18%' }}/><Block className="is-line" style={{ width: '14%' }}/><Block className="is-pill" style={{ width: 70 }}/></div>)}</div>
      </> : <>
        <Heading/>
        <div className="skeleton-columns"><Block className="is-panel"/><Block className="is-panel"/></div>
      </>}
    </div>
  </div>;
}
