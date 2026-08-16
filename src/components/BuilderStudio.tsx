import BuilderStudioMulti from './BuilderStudioMulti';
import BuilderMicEnhancer from './BuilderMicEnhancer';
import BuilderRuntimeFixes from './BuilderRuntimeFixes';

export default function BuilderStudio() {
  return (
    <>
      <BuilderStudioMulti />
      <BuilderMicEnhancer />
      <BuilderRuntimeFixes />
    </>
  );
}
