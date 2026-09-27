/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */

export const PASSBOB_SETTINGS_STORAGE_KEY = "passbob.settings";
export const PASSBOB_LAST_VIEW_STORAGE_KEY = "passbob.lastView";

/**
 * How long the last visited quickaccess route is restored when the popup is reopened.
 */
export const LAST_VIEW_VALIDITY_IN_MS = 5 * 60 * 1000;

export const DEFAULT_PASSBOB_SETTINGS = Object.freeze({
  closeAfterAutofill: false,
});

const QUICKACCESS_ROUTE_PREFIX = "/webAccessibleResources/quickaccess/";

/**
 * Routes that can be restored when the quickaccess is reopened. Transient routes (login, confirmation, autosave,
 * password generator...) are excluded on purpose: they depend on a state that does not survive the popup closing.
 */
const RESTORABLE_ROUTES = [
  /^home$/,
  /^more-filters$/,
  /^resources\/view\/[a-f0-9-]+$/,
  /^resources\/create$/,
  /^resources\/(favorite|owned-by-me|recently-modified|shared-with-me)$/,
  /^resources\/(group|tag)(\/[a-f0-9-]+)?$/,
];

/**
 * Local (persistent) and session (memory only, cleared when the browser closes) storage used by the Passbob
 * additions of the quickaccess. Nothing secret is ever written by this service.
 */
class PassbobStorageService {
  /**
   * Get the Passbob settings merged with their defaults.
   * @param {object} storage The browser storage API (browser.storage)
   * @returns {Promise<object>}
   */
  static async getSettings(storage) {
    try {
      const data = await storage?.local?.get([PASSBOB_SETTINGS_STORAGE_KEY]);
      return { ...DEFAULT_PASSBOB_SETTINGS, ...(data?.[PASSBOB_SETTINGS_STORAGE_KEY] || {}) };
    } catch (error) {
      console.error(error);
      return { ...DEFAULT_PASSBOB_SETTINGS };
    }
  }

  /**
   * Update some of the Passbob settings.
   * @param {object} storage The browser storage API (browser.storage)
   * @param {object} changes The settings to change
   * @returns {Promise<object>} The updated settings
   */
  static async updateSettings(storage, changes) {
    const settings = { ...(await this.getSettings(storage)), ...changes };
    await storage.local.set({ [PASSBOB_SETTINGS_STORAGE_KEY]: settings });
    return settings;
  }

  /**
   * Whether a quickaccess route can be restored when the popup is reopened.
   * @param {string} pathname The route pathname
   * @returns {boolean}
   */
  static isRestorableRoute(pathname) {
    if (typeof pathname !== "string" || !pathname.startsWith(QUICKACCESS_ROUTE_PREFIX)) {
      return false;
    }
    const route = pathname.substring(QUICKACCESS_ROUTE_PREFIX.length);
    return RESTORABLE_ROUTES.some((regex) => regex.test(route));
  }

  /**
   * Remember the last visited quickaccess route. Non restorable routes are ignored.
   * @param {object} storage The browser storage API (browser.storage)
   * @param {{pathname: string, search: string}} lastView The route and the current search
   * @returns {Promise<void>}
   */
  static async saveLastView(storage, { pathname, search = "" }) {
    if (!storage?.session || !this.isRestorableRoute(pathname)) {
      return;
    }
    try {
      await storage.session.set({
        [PASSBOB_LAST_VIEW_STORAGE_KEY]: { pathname, search, savedAt: Date.now() },
      });
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Get the last visited quickaccess route if it is still valid.
   * @param {object} storage The browser storage API (browser.storage)
   * @param {number} [validityInMs] How long a saved route remains valid
   * @returns {Promise<{pathname: string, search: string}|null>}
   */
  static async getLastView(storage, validityInMs = LAST_VIEW_VALIDITY_IN_MS) {
    if (!storage?.session) {
      return null;
    }
    try {
      const data = await storage.session.get([PASSBOB_LAST_VIEW_STORAGE_KEY]);
      const lastView = data?.[PASSBOB_LAST_VIEW_STORAGE_KEY];
      if (!lastView || !this.isRestorableRoute(lastView.pathname) || Date.now() - lastView.savedAt > validityInMs) {
        return null;
      }
      return { pathname: lastView.pathname, search: lastView.search || "" };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Forget the last visited quickaccess route.
   * @param {object} storage The browser storage API (browser.storage)
   * @returns {Promise<void>}
   */
  static async clearLastView(storage) {
    try {
      await storage?.session?.remove(PASSBOB_LAST_VIEW_STORAGE_KEY);
    } catch (error) {
      console.error(error);
    }
  }
}

export default PassbobStorageService;
