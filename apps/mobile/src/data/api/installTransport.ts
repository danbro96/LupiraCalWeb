import { setApiTransport } from '@lupira/cal-api/transport';
import { apiFetch } from './mutator';

// A side-effect module, not a function call in index.ts: import statements are hoisted above
// statements, so a call there would run *after* locationRecorder had already been evaluated and
// registered its headless task. Import order is the only ordering guarantee available here.
setApiTransport(apiFetch);
