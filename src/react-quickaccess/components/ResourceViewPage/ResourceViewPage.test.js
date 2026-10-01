/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         4.1.0
 */

import "../../../../test/mocks/mockClipboard";
import ResourceViewPagePage from "./ResourceViewPage.test.page";
import {
  defaultProps,
  deniedRbacProps,
  disabledApiFlagsProps,
  multipleUrisResourceProps,
  standaloneTotpResourceProps,
  totpResourceProps,
} from "./ResourceViewPage.test.data";
import { TotpCodeGeneratorService } from "../../../shared/services/otp/TotpCodeGeneratorService";
import { denyRbacContext } from "../../../shared/context/Rbac/RbacContext.test.data";
import { defaultTotpViewModelDto } from "../../../shared/models/entity/totp/totpDto.test.data";
import { act } from "react";
import { waitForTrue } from "../../../../test/utils/waitFor";
import MockStorage from "../../../react-extension/test/mock/MockStorage";
import { defaultAppContext } from "../../contexts/AppContext.test.data";
import { resourceWithReadPermissionDto } from "../../../shared/models/entity/resource/resourceEntity.test.data";
import UserActiveSessionEntity from "../../../shared/models/entity/session/userActiveSessionEntity";
import { offlineUserActiveSessionDto } from "../../../shared/models/entity/session/userActiveSessionEntity.test.data";

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe("ResourceViewPage", () => {
  const mockContextRequest = (context, implementation) =>
    jest.spyOn(context.port, "request").mockImplementationOnce(implementation);

  describe("As LU, I should preview the secret.", () => {
    it("As LU, I should preview the secret password of a resource ", async () => {
      expect.assertions(2);
      const props = defaultProps(); // The props to pass
      mockContextRequest(props.context, () => ({ password: "secret-decrypted", description: "description" }));
      const page = new ResourceViewPagePage(props);

      expect(page.previewPasswordButton.hasAttribute("disabled")).toBeFalsy();

      await page.click(page.previewPasswordButton);
      expect(page.passwordText).toStrictEqual("secret-decrypted");
    });

    it("As LU, I should see username, URI of a resource", async () => {
      expect.assertions(2);
      const props = defaultProps(); // The props to pass
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.username.textContent).toStrictEqual("admin@passbolt.com");
      expect(page.uri.textContent).toStrictEqual("https://passbolt.com");
    });

    it("As LU, I shouldn't be able to preview secret password of a resource if disabled by API flag", async () => {
      expect.assertions(1);
      const props = disabledApiFlagsProps();
      mockContextRequest(props.context, () => ({ password: "secret-decrypted", description: "description" }));
      const page = new ResourceViewPagePage(props);

      expect(page.previewPasswordButton).toBeNull();
    });

    it("As LU, I shouldn't be able to preview secret password of a resource if denied by RBAC.", async () => {
      expect.assertions(1);
      const props = deniedRbacProps(); // The props to pass
      mockContextRequest(props.context, () => ({ password: "secret-decrypted", description: "description" }));
      const page = new ResourceViewPagePage(props);

      expect(page.previewPasswordButton).toBeNull();
    });

    it("As LU, I should preview the secret totp of a resource ", async () => {
      expect.assertions(2);
      const props = totpResourceProps(); // The props to pass
      const totp = defaultTotpViewModelDto();
      mockContextRequest(props.context, () => ({
        password: "secret-decrypted",
        description: "description",
        totp: totp,
      }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.previewTotpButton.hasAttribute("disabled")).toBeFalsy();

      await page.click(page.previewTotpButton);
      const code = TotpCodeGeneratorService.generate(totp);
      expect(page.totpText.replace(/\s/, "")).toStrictEqual(code);
    });

    it("As LU, I should not see username and password of a resource from a standalone totp", async () => {
      expect.assertions(3);
      const props = standaloneTotpResourceProps(); // The props to pass
      const totp = defaultTotpViewModelDto();
      mockContextRequest(props.context, () => ({ totp: totp }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.username).toBeNull();
      expect(page.password).toBeNull();
      expect(page.totp).not.toBeNull();
    });

    it("As LU, I shouldn't be able to preview secret totp of a resource if disabled by API flag", async () => {
      expect.assertions(1);
      const props = disabledApiFlagsProps();
      mockContextRequest(props.context, () => ({
        password: "secret-decrypted",
        description: "description",
        totp: defaultTotpViewModelDto(),
      }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.previewTotpButton).toBeNull();
    });

    it("As LU, I shouldn't be able to preview secret totp of a resource if denied by RBAC.", async () => {
      expect.assertions(1);
      const props = deniedRbacProps(); // The props to pass
      mockContextRequest(props.context, () => ({
        password: "secret-decrypted",
        description: "description",
        totp: defaultTotpViewModelDto(),
      }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.previewTotpButton).toBeNull();
    });
  });

  describe("As LU, I should copy the secret.", () => {
    it("As LU, I should be able to copy the secret password of resource by clicking on the password", async () => {
      expect.assertions(4);
      const props = defaultProps(); // The props to pass
      mockContextRequest(props.context, () => ({ password: "secret-decrypted", description: "description" }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.passwordText).toStrictEqual("Copy to clipboard");
      expect(page.password.hasAttribute("disabled")).toBeFalsy();

      await page.click(page.password);

      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.secret.find-by-resource-id",
        props.context.storage.local.get(["resources"]).resources[0].id,
      );
      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.clipboard.copy-temporarily",
        "secret-decrypted",
      );
    });

    it("As LU, I should be able to copy the secret password of resource by clicking on the copy icon", async () => {
      expect.assertions(2);
      const props = defaultProps(); // The props to pass
      mockContextRequest(props.context, () => ({ password: "secret-decrypted", description: "description" }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      await page.click(page.copyPasswordButton);

      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.secret.find-by-resource-id",
        props.context.storage.local.get(["resources"]).resources[0].id,
      );
      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.clipboard.copy-temporarily",
        "secret-decrypted",
      );
    });

    it("As LU, I should not be able to copy the secret password of resource  if denied by RBAC.", async () => {
      expect.assertions(3);
      const props = deniedRbacProps(); // The props to pass
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.passwordText).toStrictEqual("Copy to clipboard");
      expect(page.password.hasAttribute("disabled")).toBeTruthy();
      expect(page.copyPasswordButton).toBeNull();
    });

    it("As LU, I should be able to copy the secret totp of resource by clicking on the password", async () => {
      expect.assertions(4);
      const props = totpResourceProps(); // The props to pass
      const totp = defaultTotpViewModelDto();
      mockContextRequest(props.context, () => ({
        password: "secret-decrypted",
        description: "description",
        totp: totp,
      }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.totpText).toStrictEqual("Copy TOTP to clipboard");
      expect(page.totp.hasAttribute("disabled")).toBeFalsy();

      await page.click(page.totp);
      const code = TotpCodeGeneratorService.generate(totp);

      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.secret.find-by-resource-id",
        props.context.storage.local.get(["resources"]).resources[0].id,
      );
      expect(props.context.port.request).toHaveBeenCalledWith("passbolt.clipboard.copy-temporarily", code);
    });

    it("As LU, I should be able to copy the secret totp of resource by clicking on the copy icon", async () => {
      expect.assertions(2);
      const props = totpResourceProps(); // The props to pass
      const totp = defaultTotpViewModelDto();
      mockContextRequest(props.context, () => ({
        password: "secret-decrypted",
        description: "description",
        totp: totp,
      }));
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      await page.click(page.copyTotpButton);
      const code = TotpCodeGeneratorService.generate(totp);

      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.secret.find-by-resource-id",
        props.context.storage.local.get(["resources"]).resources[0].id,
      );
      expect(props.context.port.request).toHaveBeenCalledWith("passbolt.clipboard.copy-temporarily", code);
    });

    it("As LU, I should not be able to copy the secret totp of resource  if denied by RBAC.", async () => {
      expect.assertions(3);
      const props = totpResourceProps({ rbacContext: denyRbacContext() }); // The props to pass
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      expect(page.totpText).toStrictEqual("Copy TOTP to clipboard");
      expect(page.totp.hasAttribute("disabled")).toBeTruthy();
      expect(page.copyTotpButton).toBeNull();
    });
  });

  describe("As LU, I should see additional uris.", () => {
    it("As LU, I should be able to see additional uris", async () => {
      expect.assertions(1);
      const props = multipleUrisResourceProps(); // The props to pass
      let page;
      await act(async () => {
        page = new ResourceViewPagePage(props);
      });

      await page.click(page.additionalUrisSection);

      expect(page.listUris.length).toStrictEqual(4);
    });
  });
});

describe("ResourceViewPage (Passbob) - autofill keeps the quickaccess open", () => {
  const useResourceOnCurrentTab = (props) =>
    props.context.port.addRequestListener("passbolt.quickaccess.use-resource-on-current-tab", async () => {});

  it("stays open after filling and shows the filled banner", async () => {
    expect.assertions(3);
    const props = defaultProps();
    useResourceOnCurrentTab(props);
    const page = new ResourceViewPagePage(props);
    await waitForTrue(() => page.isReady);

    expect(page.filledBanner).toBeNull();
    await page.click(page.useOnThisPageButton);

    await waitForTrue(() => page.filledBanner !== null);
    expect(page.useOnThisPageButton.textContent).toStrictEqual("Fill again");
    expect(props.context.closeWindow).not.toHaveBeenCalled();
  });

  it("closes after filling when the user asked for it", async () => {
    expect.assertions(2);
    const props = defaultProps();
    props.context.storage.local.set({ "passbob.settings": { closeAfterAutofill: true } });
    useResourceOnCurrentTab(props);
    const page = new ResourceViewPagePage(props);
    await waitForTrue(() => page.isReady);

    await page.click(page.useOnThisPageButton);

    await waitForTrue(() => props.context.closeWindow.mock.calls.length > 0);
    expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
    expect(page.filledBanner).toBeNull();
  });

  it("shows the filled banner when opened right after a fill from the home page", async () => {
    expect.assertions(1);
    const props = defaultProps();
    props.initialEntries = { pathname: props.initialEntries, state: { passbobFilled: true } };
    const page = new ResourceViewPagePage(props);
    await waitForTrue(() => page.filledBanner !== null);
    expect(page.filledBanner.textContent).toContain("Filled on this page");
  });

  it("remembers the choice to always close after filling", async () => {
    expect.assertions(2);
    const props = defaultProps();
    useResourceOnCurrentTab(props);
    const page = new ResourceViewPagePage(props);
    await waitForTrue(() => page.isReady);
    await page.click(page.useOnThisPageButton);
    await waitForTrue(() => page.filledBanner !== null);

    await page.click(page.alwaysCloseAfterFillLink);

    await waitForTrue(() => props.context.closeWindow.mock.calls.length > 0);
    expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
    expect(props.context.storage.local.get(["passbob.settings"])["passbob.settings"].closeAfterAutofill).toBe(true);
  });
});

describe("Passbob: edit the resource from the quickaccess", () => {
  it("As LU, I can open the edit form of a resource I can update", async () => {
    const props = defaultProps();
    let page;
    await act(async () => {
      page = new ResourceViewPagePage(props);
    });

    const resourceId = props.context.storage.local.get(["resources"]).resources[0].id;
    expect(page.editButton).not.toBeNull();
    expect(page.editButton.getAttribute("href")).toBe(
      `/webAccessibleResources/quickaccess/resources/edit/${resourceId}`,
    );
  });

  it("As LU, I cannot edit a resource I can only read", async () => {
    const storage = new MockStorage();
    const resource = resourceWithReadPermissionDto();
    storage.local.set({ resources: [resource] });
    const props = defaultProps({ context: defaultAppContext({ storage }), initialEntries: `/${resource.id}` });
    let page;
    await act(async () => {
      page = new ResourceViewPagePage(props);
    });

    expect(page.editButton).toBeNull();
  });

  it("As LU, I cannot edit a resource while offline", async () => {
    const props = defaultProps({ activeSession: new UserActiveSessionEntity(offlineUserActiveSessionDto()) });
    let page;
    await act(async () => {
      page = new ResourceViewPagePage(props);
    });

    expect(page.editButton).toBeNull();
  });
});
