import BuilderStudioMulti from './BuilderStudioMulti';
import BuilderMicEnhancer from './BuilderMicEnhancer';
import BuilderRuntimeFixes from './BuilderRuntimeFixes';
import BuilderMarketplace from './BuilderMarketplace';

export default function BuilderStudio() {
  return (
    <>
      <BuilderStudioMulti />
      <BuilderMicEnhancer />
      <BuilderRuntimeFixes />
      <BuilderMarketplace />
    </>
  );
}
