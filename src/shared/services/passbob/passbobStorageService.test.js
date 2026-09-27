/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */

import PassbobStorageService, {
  DEFAULT_PASSBOB_SETTINGS,
  LAST_VIEW_VALIDITY_IN_MS,
  PASSBOB_LAST_VIEW_STORAGE_KEY,
  PASSBOB_SETTINGS_STORAGE_KEY,
} from "./passbobStorageService";

const RESOURCE_ID = "8e3874ae-4b40-590b-968a-418f704b9d9a";

const createArea = () => {
  const data = {};
  return {
    data,
    get: jest.fn(async (keys) => keys.reduce((acc, key) => (key in data ? { ...acc, [key]: data[key] } : acc), {})),
    set: jest.fn(async (values) => Object.assign(data, values)),
    remove: jest.fn(async (key) => delete data[key]),
  };
};

const createStorage = () => ({ local: createArea(), session: createArea() });

describe("PassbobStorageService", () => {
  let storage;

  beforeEach(() => {
    storage = createStorage();
    jest.useRealTimers();
  });

  describe("::getSettings", () => {
    it("returns the defaults when nothing is stored", async () => {
      expect.assertions(1);
      await expect(PassbobStorageService.getSettings(storage)).resolves.toEqual(DEFAULT_PASSBOB_SETTINGS);
    });

    it("merges the stored settings with the defaults", async () => {
      expect.assertions(1);
      storage.local.data[PASSBOB_SETTINGS_STORAGE_KEY] = { closeAfterAutofill: true };
      await expect(PassbobStorageService.getSettings(storage)).resolves.toEqual({
        ...DEFAULT_PASSBOB_SETTINGS,
        closeAfterAutofill: true,
      });
    });

    it("returns the defaults when the storage is not available", async () => {
      expect.assertions(1);
      await expect(PassbobStorageService.getSettings(undefined)).resolves.toEqual(DEFAULT_PASSBOB_SETTINGS);
    });
  });

  describe("::updateSettings", () => {
    it("persists the changes in the local storage", async () => {
      expect.assertions(2);
      const settings = await PassbobStorageService.updateSettings(storage, { closeAfterAutofill: true });
      expect(settings.closeAfterAutofill).toBe(true);
      expect(storage.local.data[PASSBOB_SETTINGS_STORAGE_KEY].closeAfterAutofill).toBe(true);
    });
  });

  describe("::isRestorableRoute", () => {
    it.each([
      "/webAccessibleResources/quickaccess/home",
      "/webAccessibleResources/quickaccess/more-filters",
      `/webAccessibleResources/quickaccess/resources/view/${RESOURCE_ID}`,
      "/webAccessibleResources/quickaccess/resources/create",
      "/webAccessibleResources/quickaccess/resources/favorite",
      "/webAccessibleResources/quickaccess/resources/group",
      `/webAccessibleResources/quickaccess/resources/tag/${RESOURCE_ID}`,
    ])("accepts %s", (pathname) => {
      expect(PassbobStorageService.isRestorableRoute(pathname)).toBe(true);
    });

    it.each([
      "/webAccessibleResources/quickaccess.html",
      "/webAccessibleResources/quickaccess/login",
      "/webAccessibleResources/quickaccess/resources/autosave",
      "/webAccessibleResources/quickaccess/resources/confirm-create",
      "/webAccessibleResources/quickaccess/resources/generate-password",
      "/webAccessibleResources/quickaccess/resources/view/not-an-id!",
      "https://evil.test/webAccessibleResources/quickaccess/home",
      null,
    ])("rejects %s", (pathname) => {
      expect(PassbobStorageService.isRestorableRoute(pathname)).toBe(false);
    });
  });

  describe("::saveLastView / ::getLastView", () => {
    it("restores the last view with its search", async () => {
      expect.assertions(1);
      const pathname = `/webAccessibleResources/quickaccess/resources/view/${RESOURCE_ID}`;
      await PassbobStorageService.saveLastView(storage, { pathname, search: "gitlab" });
      await expect(PassbobStorageService.getLastView(storage)).resolves.toEqual({ pathname, search: "gitlab" });
    });

    it("does not save a non restorable route", async () => {
      expect.assertions(2);
      await PassbobStorageService.saveLastView(storage, { pathname: "/webAccessibleResources/quickaccess/login" });
      expect(storage.session.set).not.toHaveBeenCalled();
      await expect(PassbobStorageService.getLastView(storage)).resolves.toBeNull();
    });

    it("ignores an expired last view", async () => {
      expect.assertions(1);
      storage.session.data[PASSBOB_LAST_VIEW_STORAGE_KEY] = {
        pathname: "/webAccessibleResources/quickaccess/home",
        search: "",
        savedAt: Date.now() - LAST_VIEW_VALIDITY_IN_MS - 1,
      };
      await expect(PassbobStorageService.getLastView(storage)).resolves.toBeNull();
    });

    it("ignores a tampered last view", async () => {
      expect.assertions(1);
      storage.session.data[PASSBOB_LAST_VIEW_STORAGE_KEY] = {
        pathname: "/webAccessibleResources/quickaccess/login",
        savedAt: Date.now(),
      };
      await expect(PassbobStorageService.getLastView(storage)).resolves.toBeNull();
    });

    it("does nothing when the session storage is not available", async () => {
      expect.assertions(1);
      const localOnly = { local: createArea() };
      await PassbobStorageService.saveLastView(localOnly, { pathname: "/webAccessibleResources/quickaccess/home" });
      await expect(PassbobStorageService.getLastView(localOnly)).resolves.toBeNull();
    });

    it("clears the last view", async () => {
      expect.assertions(1);
      await PassbobStorageService.saveLastView(storage, { pathname: "/webAccessibleResources/quickaccess/home" });
      await PassbobStorageService.clearLastView(storage);
      await expect(PassbobStorageService.getLastView(storage)).resolves.toBeNull();
    });
  });
});
