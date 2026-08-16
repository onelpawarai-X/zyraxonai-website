import BuilderStudioNext from './BuilderStudio.next';
import BuilderMicEnhancer from './BuilderMicEnhancer';
import BuilderRuntimeFixes from './BuilderRuntimeFixes';

export default function BuilderStudio() {
  return (
    <>
      <BuilderStudioNext />
      <BuilderMicEnhancer />
      <BuilderRuntimeFixes />
    </>
  );
}
