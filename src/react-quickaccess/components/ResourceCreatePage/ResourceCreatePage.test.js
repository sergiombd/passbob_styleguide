/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.2.0
 */

import { cleanup, screen } from "@testing-library/react";
import "../../../shared/lib/Secret/SecretComplexity";
import "../../../react-extension/test/lib/crypto/cryptoGetRandomvalues";
import { defaultProps } from "./ResourceCreatePage.test.data";
import { ConfirmCreatePageRuleVariations } from "../ConfirmCreatePage/ConfirmCreatePage";
import {
  TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
  TEST_RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP,
  TEST_RESOURCE_TYPE_V5_DEFAULT,
  TEST_RESOURCE_TYPE_V5_DEFAULT_TOTP,
} from "../../../shared/models/entity/resourceType/resourceTypeEntity.test.data";
import ResourceCreatePagePage from "./ResourceCreatePage.test.page";
import { waitForTrue } from "../../../../test/utils/waitFor";
import { defaultResourceDto } from "../../../shared/models/entity/resource/resourceEntity.test.data";
import { DateTime } from "luxon";
import { createMemoryHistory } from "history";
import { defaultPasswordExpirySettingsContext } from "../../../react-extension/contexts/PasswordExpirySettingsContext.test.data";
import MetadataTypesSettingsEntity from "../../../shared/models/entity/metadata/metadataTypesSettingsEntity";
import { defaultMetadataTypesSettingsV6Dto } from "../../../shared/models/entity/metadata/metadataTypesSettingsEntity.test.data";
import { SECRET_DATA_OBJECT_TYPE } from "../../../shared/models/entity/secretData/secretDataEntity";
import { act } from "react";
import ResourceTypesCollection from "../../../shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypesCollectionWithoutTOTP } from "../../../shared/models/entity/resourceType/resourceTypesCollection.test.data";
import PassbobQrScanService from "../../../shared/services/passbob/passbobQrScanService";

// Reset the modules before each test.
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
});

// Cleanup after each test.
afterEach(() => {
  cleanup();
  delete window.passbolt;
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("ResourceCreatePage", () => {
  describe("Form initialization", () => {
    it("should intialize the name and uri input fields with the active tab metadata", async () => {
      expect.assertions(4);

      const expectedData = {
        name: "Passbolt Browser Extension Test",
        uris: ["https://passbolt-browser-extension/test"],
        secret_clear: "AAAAAAAAAAAAAAAAAA",
      };

      const props = defaultProps();
      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => expectedData);

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(expectedData.name);

      // Assert the form.
      expect(page.name.value).toStrictEqual(expectedData.name);
      expect(page.uri.value).toStrictEqual(expectedData.uris[0]);
      expect(page.username.value).toStrictEqual(props.context.userSettings.username);
      expect(page.password.value).toStrictEqual(expectedData.secret_clear);
    });

    it("should not initialize with chrome new tab metadata", async () => {
      expect.assertions(2);

      const expectedData = {
        name: "newtab",
        uris: ["chrome://newtab/"],
      };

      const props = defaultProps();
      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", async () => expectedData);
      const page = new ResourceCreatePagePage(props);
      await waitForTrue(() => page.name.value === "");

      // Assert the form.
      expect(page.name.value).toStrictEqual("");
      expect(page.uri.value).toStrictEqual("");
    });

    it("should not initialize with firefox new tab metadata", async () => {
      const expectedData = {
        name: "",
        uris: ["about:newtab"],
      };

      const props = defaultProps();
      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", async () => expectedData);
      const page = new ResourceCreatePagePage(props);
      await waitForTrue(() => page.name.value === "");

      // Assert the form.
      expect(page.name.value).toStrictEqual("");
      expect(page.uri.value).toStrictEqual("");
    });
  });

  describe("Form submission", () => {
    it("should create a new password v4 on submit", async () => {
      expect.assertions(2);

      const fakeNow = DateTime.fromISO("2023-11-24T00:00:00.000Z");
      jest.setSystemTime(fakeNow.toMillis());

      const expectedResourceDto = {
        resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
        folder_parent_id: null,
        metadata: {
          resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
          name: "Passbolt Browser Extension Test",
          uris: ["https://passbolt-browser-extension/test"],
          username: "test@passbolt.com",
        },
        expired: fakeNow.plus({ days: 30 }).plus({ milliseconds: 150 }).toJSDate().toISOString(), // Passbob: +50ms, one more polling round for the draft lookup
      };

      const expectedSecretDto = {
        password: "P4ssb0ltP4ssb0lt",
        description: "",
        resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
      };

      const props = defaultProps({}, true);

      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => ({
        name: expectedResourceDto.metadata.name,
        uris: expectedResourceDto.metadata.uris,
      }));

      props.context.port.addRequestListener("passbolt.secrets.powned-password", () => 0);

      let resourceCreated, secretCreated;
      props.context.port.addRequestListener("passbolt.resources.create", (resourceDto, secretDto) => {
        resourceCreated = resourceDto;
        secretCreated = secretDto;
        return defaultResourceDto();
      });

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(expectedResourceDto.metadata.name);

      // Fill the form empty fields"
      await page.setFormWith({
        username: "test@passbolt.com",
        password: "P4ssb0ltP4ssb0lt",
      });

      // Submit the form.
      await page.submitForm();

      expect(resourceCreated).toStrictEqual(expectedResourceDto);
      expect(secretCreated).toStrictEqual(expectedSecretDto);
    });

    it("should create a new password v5 on submit", async () => {
      expect.assertions(2);

      const fakeNow = DateTime.fromISO("2023-11-24T00:00:00.000Z");
      jest.setSystemTime(fakeNow.toMillis());

      const expectedResourceDto = {
        resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT,
        folder_parent_id: null,
        metadata: {
          object_type: "PASSBOLT_RESOURCE_METADATA",
          resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT,
          name: "Passbolt Browser Extension Test",
          uris: ["https://passbolt-browser-extension/test"],
          username: "test@passbolt.com",
        },
        expired: fakeNow.plus({ days: 30 }).plus({ milliseconds: 150 }).toJSDate().toISOString(), // Passbob: +50ms, one more polling round for the draft lookup
      };

      const expectedSecretDto = {
        password: "P4ssb0ltP4ssb0lt",
        description: "",
        resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT,
        object_type: SECRET_DATA_OBJECT_TYPE,
      };
      const metadataTypeSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
      const props = defaultProps({ metadataTypeSettings }, true);

      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => ({
        name: expectedResourceDto.metadata.name,
        uris: expectedResourceDto.metadata.uris,
      }));

      props.context.port.addRequestListener("passbolt.secrets.powned-password", () => 0);

      let resourceCreated = false;
      props.context.port.addRequestListener("passbolt.resources.create", (resourceDto, secretDto) => {
        expect(resourceDto).toStrictEqual(expectedResourceDto);
        expect(secretDto).toStrictEqual(expectedSecretDto);
        resourceCreated = true;
        return defaultResourceDto();
      });

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(expectedResourceDto.metadata.name);

      // Fill the form empty fields"
      await page.setFormWith({
        username: "test@passbolt.com",
        password: "P4ssb0ltP4ssb0lt",
      });

      // Submit the form.
      await page.submitForm();
      await waitForTrue(() => resourceCreated);
    });

    it("should ask for password creation confirmation if the entropy is too low", async () => {
      expect.assertions(4);

      const props = defaultProps({ history: createMemoryHistory() }, true);

      const preparedResource = {
        name: "Passbolt Browser Extension Test",
        uris: ["https://passbolt-browser-extension/test"],
      };

      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", async () => preparedResource);
      props.context.port.addRequestListener("passbolt.secrets.powned-password", async () => 0);

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(preparedResource.name);

      expect(page.complexityText).toBe("Quality Entropy: 0.0 bits");

      await page.setFormWith({
        password: "test",
        username: "test@passbolt.com",
      });

      expect(page.complexityText).toBe("Very weak Entropy: 18.8 bits");

      await page.submitForm();

      await waitForTrue(() => props.history.location.pathname.toString() !== "/");

      const expectedPageProps = {
        resourceName: "Passbolt Browser Extension Test",
        rule: ConfirmCreatePageRuleVariations.MINIMUM_ENTROPY,
      };
      expect(props.history.location.pathname.toString()).toStrictEqual(
        "/webAccessibleResources/quickaccess/resources/confirm-create",
      );
      expect(props.history.location.state).toStrictEqual(expectedPageProps);
    });

    it("should ask for password creation confirmation if the passphrase is found in a data breach", async () => {
      expect.assertions(4);

      const props = defaultProps({ history: createMemoryHistory() }, true);

      const preparedResource = {
        name: "Passbolt Browser Extension Test",
        uris: ["https://passbolt-browser-extension/test"],
      };

      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", async () => preparedResource);
      props.context.port.addRequestListener("passbolt.secrets.powned-password", async () => 3);

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(preparedResource.name);

      expect(page.complexityText).toBe("Quality Entropy: 0.0 bits");

      await page.setFormWith({
        password: "hello-world/hello-world",
        username: "test@passbolt.com",
      });

      expect(page.complexityText).toBe("Strong Entropy: 112.9 bits");

      await page.submitForm();

      await waitForTrue(() => props.history.location.pathname.toString() !== "/");

      const expectedPageProps = {
        resourceName: "Passbolt Browser Extension Test",
        rule: ConfirmCreatePageRuleVariations.IN_DICTIONARY,
      };
      expect(props.history.location.pathname.toString()).toStrictEqual(
        "/webAccessibleResources/quickaccess/resources/confirm-create",
      );
      expect(props.history.location.state).toStrictEqual(expectedPageProps);
    });

    it("should create a new password on submit when the dictionary service is unreachable", async () => {
      expect.assertions(3);

      const fakeNow = DateTime.fromISO("2023-11-24T00:00:00.000Z");
      jest.setSystemTime(fakeNow.toMillis());

      // Assert the request to create a password has been called and contain the expected parameters.
      const expectedResourceDto = {
        resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
        folder_parent_id: null,
        metadata: {
          resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
          name: "Passbolt Browser Extension Test",
          uris: ["https://passbolt-browser-extension/test"],
          username: "test@passbolt.com",
        },
        expired: fakeNow.plus({ days: 30 }).plus({ milliseconds: 150 }).toJSDate().toISOString(), // Passbob: +50ms, one more polling round for the draft lookup
      };

      const expectedSecretDto = {
        password: "P4ssb0ltP4ssb0lt",
        description: "",
        resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
      };

      const props = defaultProps({}, true);

      let isPreparedResourceSet = false;
      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", async () => {
        isPreparedResourceSet = true;
        return {
          name: expectedResourceDto.metadata.name,
          uris: expectedResourceDto.metadata.uris,
        };
      });

      props.context.port.addRequestListener("passbolt.secrets.powned-password", async (password) => {
        expect(password).toStrictEqual(expectedSecretDto.password);
        throw new Error();
      });

      props.context.port.addRequestListener("passbolt.resources.create", async (resourceDto, secretDto) => {
        expect(secretDto).toStrictEqual(expectedSecretDto);
        expect(resourceDto).toStrictEqual(expectedResourceDto);
        return defaultResourceDto();
      });

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(expectedResourceDto.metadata.name);
      await waitForTrue(() => page.name.value === expectedResourceDto.metadata.name);

      await waitForTrue(() => isPreparedResourceSet);

      // Fill the form empty fields
      await page.setFormWith({
        username: "test@passbolt.com",
        password: "P4ssb0ltP4ssb0lt",
      });

      // Submit the form.
      await page.submitForm();
    });
  });

  describe("Form validation", () => {
    it("should not submit the form if there is an error", async () => {
      expect.assertions(2);

      const resourceData = {
        name: "",
        uri: 42,
        username: 42,
      };

      const props = defaultProps({
        passwordExpiryContext: defaultPasswordExpirySettingsContext({ automatic_update: false }),
      });
      props.prepareResourceContext.consumePreparedResource.mockImplementation(() => resourceData);

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findAllByDisplayValue(42);

      // Fill the form empty fields
      await page.setFormWith({
        password: "",
      });

      await page.submitForm();

      expect(page.nameError.textContent).toStrictEqual("A name is required.");
      expect(page.passwordError.textContent).toStrictEqual("A password is required.");
    });

    it("should display the error from the API", async () => {
      expect.assertions(4);

      const apiError = new Error();
      apiError.name = "PassboltApiFetchError";
      apiError.data = {
        code: 400,
        body: {
          name: ["The name is invalid"],
          uri: ["The uri is invalid", "The uri contains a forbidden scheme"],
          username: ["The username is invalid"],
          password: ["The password is too weak"],
        },
      };

      const props = defaultProps(
        {
          passwordExpiryContext: defaultPasswordExpirySettingsContext({ automatic_update: false }),
        },
        false,
      );
      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => null);
      props.context.port.addRequestListener("passbolt.resources.create", () => {
        throw apiError;
      });
      props.prepareResourceContext.consumePreparedResource.mockImplementation(() => ({
        name: "Resource name",
        uri: "resource uri",
        username: "resource username",
      }));

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue("Resource name");

      // Fill the form empty fields
      await page.setFormWith({
        password: "Here's a password!",
      });

      await page.submitForm();

      // Wait until the text is found (This will ensure the state has been updated)
      await screen.findByText("The name is invalid");

      expect(page.nameError.textContent).toStrictEqual("The name is invalid");
      expect(page.uriError.textContent).toStrictEqual("The uri is invalid, The uri contains a forbidden scheme");
      expect(page.usernameError.textContent).toStrictEqual("The username is invalid");
      expect(page.passwordError.textContent).toStrictEqual("The password is too weak");
    });

    it("should do nothing if user aborted the operation", async () => {
      expect.assertions(5);

      const error = new Error();
      error.name = "UserAbortsOperationError";

      const props = defaultProps(
        {
          passwordExpiryContext: defaultPasswordExpirySettingsContext({ automatic_update: false }),
        },
        false,
      );
      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => null);

      let promiseRejecter;
      props.context.port.addRequestListener("passbolt.resources.create", () => {
        return new Promise((_resolve, reject) => {
          promiseRejecter = reject;
        });
      });

      const expectedValues = {
        name: "Resource name",
        uri: "resource uri",
        username: "resource username",
        password: "Here's a password!",
      };
      props.prepareResourceContext.consumePreparedResource.mockImplementation(() => expectedValues);
      props.prepareResourceContext.lastGeneratedPassword = expectedValues.password;

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(expectedValues.name);

      await page.submitForm();

      expect(page.isSubmitting).toStrictEqual(true);

      await act(() => promiseRejecter(error));
      await waitForTrue(() => !page.isSubmitting);

      expect(page.name.value).toStrictEqual(expectedValues.name);
      expect(page.uri.value).toStrictEqual(expectedValues.uri);
      expect(page.username.value).toStrictEqual(expectedValues.username);
      expect(page.password.value).toStrictEqual(expectedValues.password);
    });

    it("should display the unexpected error after submitting", async () => {
      expect.assertions(6);

      const errorMessage = "This is an unexpected error";
      const error = new Error(errorMessage);
      error.name = "UnexpectedError";

      const props = defaultProps(
        {
          passwordExpiryContext: defaultPasswordExpirySettingsContext({ automatic_update: false }),
        },
        false,
      );
      props.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => null);

      let promiseRejecter;
      props.context.port.addRequestListener("passbolt.resources.create", () => {
        return new Promise((_resolve, reject) => {
          promiseRejecter = reject;
        });
      });

      const expectedValues = {
        name: "Resource name",
        uri: "resource uri",
        username: "resource username",
        password: "Here's a password!",
      };
      props.prepareResourceContext.consumePreparedResource.mockImplementation(() => expectedValues);
      props.prepareResourceContext.lastGeneratedPassword = expectedValues.password;

      const page = new ResourceCreatePagePage(props);
      // Wait until the input value is found (This will ensure the state has been updated)
      await screen.findByDisplayValue(expectedValues.name);

      await page.submitForm();

      expect(page.isSubmitting).toStrictEqual(true);

      await act(() => promiseRejecter(error));

      await waitForTrue(() => !page.isSubmitting);

      expect(page.name.value).toStrictEqual(expectedValues.name);
      expect(page.uri.value).toStrictEqual(expectedValues.uri);
      expect(page.username.value).toStrictEqual(expectedValues.username);
      expect(page.password.value).toStrictEqual(expectedValues.password);
      expect(page.unexpectedError).toStrictEqual(errorMessage);
    });
  });

  describe("As LU I can navigate from the 'Resource Create' page", () => {
    it("should allow to go back on the previous page", async () => {
      expect.assertions(1);

      const props = defaultProps();
      props.history = createMemoryHistory({
        initialEntries: ["/home", "/test"],
        initialIndex: 1,
      });

      const initialPath = props.history.location.pathname.toString();
      props.history.goBack();

      const page = new ResourceCreatePagePage(props);

      await page.clickOnBackButton();
      await waitForTrue(() => props.history.location.pathname !== initialPath);

      expect(props.history.location.pathname).toStrictEqual("/home");
    });
  });
});

describe("ResourceCreatePage (Passbob) - drafts", () => {
  const CREATE_ROUTE = "/webAccessibleResources/quickaccess/resources/create";
  const tabInfo = { name: "From the tab", uris: ["https://tab.example.com"] };
  const storedDraft = {
    pathname: CREATE_ROUTE,
    fields: { name: "GitLab · vor", uri: "https://vor.hexaglobe.net", username: "smoubayed" },
    secrets: { password: "draft-password-123" },
  };

  const propsWithDraft = (draft, props = {}) => {
    const p = defaultProps(props);
    p.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => tabInfo);
    p.context.port.addRequestListener("passbob.draft.get", () => draft);
    p.draftSaved = [];
    p.draftCleared = 0;
    p.context.port.addRequestListener("passbob.draft.save", (d) => p.draftSaved.push(d));
    p.context.port.addRequestListener("passbob.draft.clear", () => p.draftCleared++);
    return p;
  };

  const draftBanner = () => document.querySelector(".passbob-draft-banner");

  it("restores an unsaved draft, password included, and says so", async () => {
    expect.assertions(4);
    const props = propsWithDraft(storedDraft);
    const page = new ResourceCreatePagePage(props);

    await screen.findByDisplayValue(storedDraft.fields.name);
    expect(page.uri.value).toStrictEqual(storedDraft.fields.uri);
    expect(page.username.value).toStrictEqual(storedDraft.fields.username);
    expect(page.password.value).toStrictEqual(storedDraft.secrets.password);
    expect(draftBanner()).not.toBeNull();
  });

  it("fills the form from the tab when there is no draft", async () => {
    expect.assertions(1);
    const props = propsWithDraft(null);
    new ResourceCreatePagePage(props);

    await screen.findByDisplayValue(tabInfo.name);
    expect(draftBanner()).toBeNull();
  });

  it("never restores a draft for a creation requested by a web page", async () => {
    expect.assertions(1);
    const props = propsWithDraft(storedDraft);
    props.context.bootstrapFeature = "create-new-credentials";
    new ResourceCreatePagePage(props);

    await screen.findByDisplayValue(tabInfo.name);
    expect(draftBanner()).toBeNull();
  });

  it("saves a draft after the user types, not after the automatic prefill", async () => {
    expect.assertions(3);
    const props = propsWithDraft(null);
    const page = new ResourceCreatePagePage(props);
    await screen.findByDisplayValue(tabInfo.name);

    await act(async () => jest.advanceTimersByTime(1000));
    expect(props.draftSaved).toHaveLength(0);

    await page.setFormWith({ username: "smoubayed", password: "typed-password" });
    await act(async () => jest.advanceTimersByTime(300));

    const lastDraft = props.draftSaved[props.draftSaved.length - 1];
    expect(lastDraft.fields).toStrictEqual({ name: tabInfo.name, uri: tabInfo.uris[0], username: "smoubayed" });
    expect(lastDraft.secrets).toStrictEqual({ password: "typed-password" });
  });

  it("discards the draft and starts again from the tab", async () => {
    expect.assertions(3);
    const props = propsWithDraft(storedDraft);
    const page = new ResourceCreatePagePage(props);
    await screen.findByDisplayValue(storedDraft.fields.name);

    await page.user.click(document.querySelector(".passbob-draft-banner-action"));

    await screen.findByDisplayValue(tabInfo.name);
    expect(props.draftCleared).toBeGreaterThan(0);
    expect(draftBanner()).toBeNull();
    expect(page.password.value).not.toStrictEqual(storedDraft.secrets.password);
  });

  it("forgets the draft when going back", async () => {
    expect.assertions(1);
    const props = propsWithDraft(storedDraft);
    const page = new ResourceCreatePagePage(props);
    await screen.findByDisplayValue(storedDraft.fields.name);

    await page.clickOnBackButton();

    expect(props.draftCleared).toBeGreaterThan(0);
  });
});

describe("ResourceCreatePage (Passbob) - authenticator key", () => {
  const tabInfo = { name: "AWS console", uris: ["https://console.aws.amazon.com"] };
  const TOTP_KEY = "JBSWY3DPEHPK3PXP";
  const scannedTotp = { secret_key: TOTP_KEY, algorithm: "SHA256", digits: 8, period: 60 };

  /**
   * Props with a tab to prefill from and a resources.create listener keeping what is created.
   * @param {object} props The props to override
   * @returns {object}
   */
  const createProps = (props = {}) => {
    const p = defaultProps(props);
    p.context.port.addRequestListener("passbolt.quickaccess.prepare-resource", () => tabInfo);
    p.created = [];
    p.context.port.addRequestListener("passbolt.resources.create", (resourceDto, secretDto) => {
      p.created.push({ resourceDto, secretDto });
      return defaultResourceDto();
    });
    p.draftSaved = [];
    p.context.port.addRequestListener("passbob.draft.save", (d) => p.draftSaved.push(d));
    return p;
  };

  const renderForm = async (props) => {
    const page = new ResourceCreatePagePage(props);
    await screen.findByDisplayValue(tabInfo.name);
    await page.setFormWith({ username: "smoubayed", password: "P4ssb0ltP4ssb0lt-Str0ng" });
    return page;
  };

  it("creates a password with TOTP when an authenticator key is given (v4)", async () => {
    expect.assertions(4);
    const props = createProps();
    const page = await renderForm(props);

    await page.setFormWith({ totp: TOTP_KEY });
    await page.submitForm();

    await waitForTrue(() => props.created.length === 1);
    const { resourceDto, secretDto } = props.created[0];
    expect(resourceDto.resource_type_id).toStrictEqual(TEST_RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP);
    expect(resourceDto.metadata.username).toStrictEqual("smoubayed");
    expect(secretDto.password).toStrictEqual("P4ssb0ltP4ssb0lt-Str0ng");
    expect(secretDto.totp).toStrictEqual({ secret_key: TOTP_KEY, algorithm: "SHA1", digits: 6, period: 30 });
  });

  it("creates a v5 password with TOTP from the QR code on the page", async () => {
    expect.assertions(6);
    const metadataTypeSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const props = createProps({ metadataTypeSettings });
    props.context.openerTabId = 42;
    const scan = jest.spyOn(PassbobQrScanService, "scanPage").mockImplementation(async () => scannedTotp);
    const page = await renderForm(props);

    await page.user.click(page.scanButton);
    await act(async () => {});
    expect(page.totp.value).toStrictEqual(TOTP_KEY);
    expect(scan).toHaveBeenCalledWith(props.context.port, 42);
    expect(page.scanResult.classList.contains("success")).toBe(true);

    await page.submitForm();

    await waitForTrue(() => props.created.length === 1);
    const { resourceDto, secretDto } = props.created[0];
    expect(resourceDto.resource_type_id).toStrictEqual(TEST_RESOURCE_TYPE_V5_DEFAULT_TOTP);
    expect(secretDto.totp).toStrictEqual(scannedTotp);
    expect(secretDto.object_type).toStrictEqual(SECRET_DATA_OBJECT_TYPE);
  });

  it("creates a password without TOTP when the key is left empty", async () => {
    expect.assertions(2);
    const props = createProps();
    const page = await renderForm(props);

    await page.submitForm();

    await waitForTrue(() => props.created.length === 1);
    expect(props.created[0].resourceDto.resource_type_id).toStrictEqual(TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION);
    expect(props.created[0].secretDto.totp).toBeUndefined();
  });

  it("does not create the password when the key is not valid", async () => {
    expect.assertions(2);
    const props = createProps();
    const page = await renderForm(props);

    await page.setFormWith({ totp: "0189" });
    await page.submitForm();

    await waitForTrue(() => page.totp.closest(".input").classList.contains("error"));
    expect(page.totp.closest(".input").classList.contains("error")).toBe(true);
    expect(props.created).toHaveLength(0);
  });

  it("hides the field when the organization has no TOTP resource type", async () => {
    expect.assertions(1);
    const props = createProps({ resourceTypes: new ResourceTypesCollection(resourceTypesCollectionWithoutTOTP()) });
    const page = new ResourceCreatePagePage(props);
    await screen.findByDisplayValue(tabInfo.name);

    expect(page.totp).toBeNull();
  });

  it("keeps the key, encrypted, in the draft", async () => {
    expect.assertions(1);
    const props = createProps();
    const page = await renderForm(props);

    await page.setFormWith({ totp: TOTP_KEY });
    await act(async () => jest.advanceTimersByTime(300));

    const lastDraft = props.draftSaved[props.draftSaved.length - 1];
    expect(JSON.parse(lastDraft.secrets.totp).secret_key).toStrictEqual(TOTP_KEY);
  });

  it("restores the key from the draft", async () => {
    expect.assertions(1);
    const props = createProps();
    props.context.port.addRequestListener("passbob.draft.get", () => ({
      pathname: "/webAccessibleResources/quickaccess/resources/create",
      fields: { name: "AWS", uri: "", username: "" },
      secrets: { password: "draft-password", totp: JSON.stringify(scannedTotp) },
    }));
    const page = new ResourceCreatePagePage(props);

    await screen.findByDisplayValue("AWS");
    expect(page.totp.value).toStrictEqual(TOTP_KEY);
  });

  it("keeps the key when going to the password generator", async () => {
    expect.assertions(1);
    const props = createProps();
    const page = await renderForm(props);

    await page.setFormWith({ totp: TOTP_KEY });
    await page.user.click(document.querySelector(".password-generator"));

    expect(props.prepareResourceContext.onPrepareResource).toHaveBeenCalledWith(
      expect.objectContaining({ totp: expect.objectContaining({ secret_key: TOTP_KEY }) }),
    );
  });
});
