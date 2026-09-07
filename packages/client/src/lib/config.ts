// The client no longer shares an origin with the server — there's no Vite
// dev-server proxy to a local Express process anymore, since the backend is
// Lambda behind API Gateway. Both URLs point at a deployed API Gateway stage
// (wired up in the deploy pipeline, roadmap step 7); empty defaults keep
// local builds from crashing before that exists, at the cost of API calls
// failing until VITE_API_URL/VITE_WS_URL are set.
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''
export const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? ''
