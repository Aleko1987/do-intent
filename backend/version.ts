/**
 * Build and runtime version information
 * 
 * GIT_SHA: The git commit SHA of the deployed version
 * BUILD_TIME: ISO timestamp when the build was created (runtime)
 */

// Determine GIT_SHA from environment variables (Render provides RENDER_GIT_COMMIT)
// Fallback chain: RENDER_GIT_COMMIT -> GIT_COMMIT -> "unknown"
export const GIT_SHA: string =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_COMMIT ||
  "unknown";

// BUILD_TIME is generated at runtime (when this module is loaded)
// This ensures each deployment has a unique timestamp
export const BUILD_TIME: string = new Date().toISOString();

