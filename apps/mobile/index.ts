// The crypto polyfill MUST load before any module that mints a UUID (Hermes has no global crypto).
import './src/polyfills/crypto';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
