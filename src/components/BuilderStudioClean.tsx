import BuilderStudioV3 from './BuilderStudioV3'

/**
 * Single source of truth for the public Builder UI.
 * Intentionally contains no DOM observers, global click handlers, CSS injection,
 * synthetic input events, or page-wide runtime patches.
 */
export default function BuilderStudioClean() {
  return <BuilderStudioV3 />
}
