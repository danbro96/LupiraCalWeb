// The crypto polyfill MUST load before any module that mints a UUID (Hermes has no global crypto).
import './src/polyfills/crypto';
// defineTask must run during bundle evaluation, not from a React effect: when the OS restarts the
// process headlessly to deliver background fixes there is no App component, and an unregistered task
// silently drops the batch.
import './src/sync/locationRecorder';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
