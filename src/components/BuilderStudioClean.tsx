import BuilderStudioMulti from './BuilderStudioMulti';

/**
 * Clean Builder shell.
 * Account, reset, voice, model aliases and publish controls are rendered by
 * BuilderStudioMulti itself. No DOM mutation or overlay controls are injected.
 */
export default function BuilderStudioClean() {
  return (
    <div className="zyraxon-clean-builder" style={{ minHeight: '100vh', background: '#050505' }}>
      <BuilderStudioMulti />
    </div>
  );
}
