/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */

/**
 * Unit tests on ResourceEditPage in regard of specifications
 */
import { waitFor } from "@testing-library/react";
import "../../../../test/mocks/mockPortal";
import ResourceEditPagePage from "./ResourceEditPage.test.page";
import { defaultProps, readOnlyResourceDto, v5ResourceDto } from "./ResourceEditPage.test.data";
import {
  TEST_RESOURCE_TYPE_V5_DEFAULT,
  TEST_RESOURCE_TYPE_V5_DEFAULT_TOTP,
} from "../../../shared/models/entity/resourceType/resourceTypeEntity.test.data";

const STRONG_PASSWORD = "n4R#vq!8Lp$2zW@xT6&kY9";
const TOTP_KEY = "JBSWY3DPEHPK3PXP";

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Mock the background page: the secret decryption and the update.
 * @param {object} props The props
 * @param {object|Error} secret The decrypted secret, or the error thrown by the decryption
 * @returns {jest.Mock} The update mock
 */
const mockPort = (props, secret) => {
  const update = jest.fn(async (resourceDto) => resourceDto);
  jest.spyOn(props.context.port, "request").mockImplementation(async (event, ...args) => {
    if (event === "passbolt.secret.find-by-resource-id") {
      if (secret instanceof Error) {
        throw secret;
      }
      return structuredClone(secret);
    }
    if (event === "passbolt.resources.update") {
      return update(...args);
    }
    return null;
  });
  return update;
};

/**
 * Render the page and wait for the form.
 * @param {object} props The props
 * @returns {Promise<ResourceEditPagePage>}
 */
const renderForm = async (props) => {
  const page = new ResourceEditPagePage(props);
  await waitFor(() => expect(page.name).not.toBeNull());
  return page;
};

describe("ResourceEditPage", () => {
  it("As LU, I see the resource and its decrypted password in the form", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });

    const page = await renderForm(props);

    expect(page.name.value).toBe("Passbolt");
    expect(page.uri.value).toBe("https://passbolt.com");
    expect(page.username.value).toBe("admin@passbolt.com");
    expect(page.password.value).toBe(STRONG_PASSWORD);
    expect(page.totpKey.value).toBe("");
  });

  it("As LU, I can change the username without sending the secret again", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    const page = await renderForm(props);

    await page.replace(page.username, "new-user");
    await page.submit();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const [resourceDto, secretDto] = update.mock.calls[0];
    expect(resourceDto.id).toBe(resource.id);
    expect(resourceDto.metadata.username).toBe("new-user");
    expect(resourceDto.metadata.description).toBe("Description");
    expect(secretDto).toBeNull();
    expect(page.history.goBack).toHaveBeenCalled();
  });

  it("As LU, I can change the password, the other secret fields are kept", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, {
      object_type: "PASSBOLT_SECRET_DATA",
      password: "old-password-that-is-long-enough",
      description: "secret note",
    });
    const page = await renderForm(props);

    await page.replace(page.password, STRONG_PASSWORD);
    await page.submit();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const [, secretDto] = update.mock.calls[0];
    expect(secretDto.password).toBe(STRONG_PASSWORD);
    expect(secretDto.description).toBe("secret note");
  });

  it("As LU, I can add a TOTP key, the resource then gets a TOTP", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    const page = await renderForm(props);

    await page.user.type(page.totpKey, TOTP_KEY);
    await page.submit();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const [resourceDto, secretDto] = update.mock.calls[0];
    expect(resourceDto.resource_type_id).toBe(TEST_RESOURCE_TYPE_V5_DEFAULT_TOTP);
    expect(secretDto.totp.secret_key).toBe(TOTP_KEY);
    expect(secretDto.password).toBe(STRONG_PASSWORD);
  });

  it("As LU, leaving the TOTP key empty keeps the resource type", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    const page = await renderForm(props);

    await page.user.type(page.totpKey, "A");
    await page.user.clear(page.totpKey);
    await page.submit();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const [resourceDto, secretDto] = update.mock.calls[0];
    expect(resourceDto.resource_type_id).toBe(TEST_RESOURCE_TYPE_V5_DEFAULT);
    expect(secretDto).toBeNull();
  });

  it("As LU, a new weak password is only saved once I confirm it", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    const page = await renderForm(props);

    await page.replace(page.password, "abc");
    await page.submit();

    await waitFor(() => expect(page.warning).not.toBeNull());
    expect(update).not.toHaveBeenCalled();
    expect(page.submitButton.textContent).toContain("Save anyway");

    await page.submit();
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1].password).toBe("abc");
  });

  it("As LU, an empty name is saved as no name, as in the web application", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    const page = await renderForm(props);

    await page.replace(page.name, "");
    await page.submit();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0].metadata.name).toBe("no name");
  });

  it("As LU, an invalid TOTP key is not saved", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    const page = await renderForm(props);

    await page.user.type(page.totpKey, "0189");
    await page.submit();

    await waitFor(() => expect(page.totpKey.closest(".input").classList.contains("error")).toBe(true));
    expect(update).not.toHaveBeenCalled();
  });

  it("As LU, a new password moves the expiry date when passwords expire automatically", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({
      resource,
      passwordExpirySettings: { automatic_update: true, default_expiry_period: 30 },
    });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    const page = await renderForm(props);

    await page.replace(page.password, `${STRONG_PASSWORD}-new`);
    await page.submit();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const expired = new Date(update.mock.calls[0][0].expired);
    const inDays = (expired.getTime() - Date.now()) / (24 * 3600 * 1000);
    expect(Math.round(inDays)).toBe(30);
  });

  it("As LU, I see the error when the update fails", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const update = mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });
    update.mockImplementation(async () => {
      throw new Error("Server error");
    });
    const page = await renderForm(props);

    await page.replace(page.username, "new-user");
    await page.submit();

    await waitFor(() => expect(page.unexpectedError?.textContent).toBe("Server error"));
    expect(page.history.goBack).not.toHaveBeenCalled();
  });

  it("As LU, I go back when I cancel the passphrase request", async () => {
    const resource = v5ResourceDto();
    const props = defaultProps({ resource });
    const error = new Error("aborted");
    error.name = "UserAbortsOperationError";
    mockPort(props, error);

    const page = new ResourceEditPagePage(props);

    await waitFor(() => expect(page.history.goBack).toHaveBeenCalled());
    expect(page.name).toBeNull();
  });

  it("As LU, I cannot edit a resource I can only read", async () => {
    const resource = readOnlyResourceDto();
    const props = defaultProps({ resource });
    mockPort(props, { object_type: "PASSBOLT_SECRET_DATA", password: STRONG_PASSWORD, description: "" });

    const page = new ResourceEditPagePage(props);

    await waitFor(() => expect(page.history.goBack).toHaveBeenCalled());
    expect(props.context.port.request).not.toHaveBeenCalledWith("passbolt.secret.find-by-resource-id", resource.id);
  });
});
