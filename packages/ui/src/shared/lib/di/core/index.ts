/**
 * UI DI Core Module
 *
 * Exports core DI functionality for the UI package.
 */

export { UI_CORE_TYPES } from './types';
export type { UIPlatformType, UIContainerConfig } from './types';

export {
  UIContainerFactory,
  createUIContainer,
  getUIContainer,
} from './UIContainerFactory';
