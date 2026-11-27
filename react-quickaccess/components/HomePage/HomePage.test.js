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
 * @since         4.1.0
 */
import { waitForTrue } from "../../../../test/utils/waitFor";
import {
  defaultResourceDto,
  resourceStandaloneTotpDto,
  resourceWithReadPermissionDto,
} from "../../../shared/models/entity/resource/resourceEntity.test.data";
import { defaultAppContext } from "../../contexts/AppContext.test.data";
import { defaultProps, denyUiActionProps } from "./HomePage.test.data";
import HomePagePage from "./HomePage.test.page";
import { fireEvent } from "@testing-library/react";
import { createMemoryHistory } from "history";
import { defaultResourceMetadataDto } from "../../../shared/models/entity/resource/metadata/resourceMetadataEntity.test.data";
import MetadataTypesSettingsEntity from "../../../shared/models/entity/metadata/metadataTypesSettingsEntity";
import {
  defaultMetadataTypesSettingsV50FreshDto,
  defaultMetadataTypesSettingsV6Dto,
} from "../../../shared/models/entity/metadata/metadataTypesSettingsEntity.test.data";
import ResourceTypesCollection from "../../../shared/models/entity/resourceType/resourceTypesCollection";
import {
  resourceTypesV4CollectionDto,
  resourceTypesV5CollectionDto,
} from "../../../shared/models/entity/resourceType/resourceTypesCollection.test.data";
import { defaultUserDto } from "../../../shared/models/entity/user/userEntity.test.data";
import { v4 as uuidv4 } from "uuid";
import MetadataKeysSettingsEntity from "../../../shared/models/entity/metadata/metadataKeysSettingsEntity";
import { defaultMetadataKeysSettingsDto } from "../../../shared/models/entity/metadata/metadataKeysSettingsEntity.test.data";
import UserActiveSessionEntity from "../../../shared/models/entity/session/userActiveSessionEntity";
import { offlineUserActiveSessionDto } from "../../../shared/models/entity/session/userActiveSessionEntity.test.data";

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * The visible content of a resource row.
 * @param {HTMLElement} row The row
 * @returns {{name: string, subtitle: string, canFill: boolean}}
 */
const rowText = (row) => ({
  name: row.querySelector(".passbob-row-name")?.textContent,
  subtitle: row.querySelector(".passbob-row-subtitle")?.textContent,
  canFill: Boolean(row.querySelector(".passbob-fill-button")),
});

describe("HomePage", () => {
  describe("As LU I can see an updated version of the resources", () => {
    /**
     * This test should be executed first as it's changing a static props we don't have control on
     */
    it("should ask for resource initialisation only once", async () => {
      expect.assertions(3);
      const props = defaultProps();
      expect(props.resourcesLocalStorageContext.updateLocalStorage).toHaveBeenCalledTimes(0);

      new HomePagePage(props);
      expect(props.resourcesLocalStorageContext.updateLocalStorage).toHaveBeenCalledTimes(1);

      new HomePagePage(props);
      expect(props.resourcesLocalStorageContext.updateLocalStorage).toHaveBeenCalledTimes(1);
    });
  });

  describe("As LU I can see the quickaccess homepage sections", () => {
    it("As LU I can see the quickaccess filters and groups sections", () => {
      expect.assertions(3);
      const page = new HomePagePage(defaultProps());

      expect(page.getChip("more-filters")?.textContent).toStrictEqual("More");
      expect(page.groupsFilterEntry?.textContent).toStrictEqual("Groups");
      expect(page.getChip("resources/favorite")?.textContent).toStrictEqual("Favorites");
    });

    it("As LU I cannot see the quickaccess groups section if the session is offline", () => {
      expect.assertions(2);
      const props = defaultProps({
        activeSession: new UserActiveSessionEntity(offlineUserActiveSessionDto()),
      });
      const page = new HomePagePage(props);

      expect(page.getChip("more-filters")?.textContent).toStrictEqual("More");
      expect(page.groupsFilterEntry).toBeNull();
    });

    it("As LU I can see the quickaccess tag section if enabled by API flags", () => {
      expect.assertions(3);
      const page = new HomePagePage(defaultProps());

      expect(page.chips.length).toBeGreaterThan(0);
      expect(page.hasTagFilterEntry).toBeTruthy();
      expect(page.getChip("resources/tag")?.textContent).toStrictEqual("Tags");
    });

    it("As LU I cannot see the quickaccess tag section if disabled by API flags", () => {
      expect.assertions(2);
      const data = {
        siteSettings: {
          getServerTimezone: () => "",
          canIUse: () => false,
        },
      };
      const context = defaultAppContext(data);
      const page = new HomePagePage(defaultProps({ context }));

      expect(page.chips.length).toBeGreaterThan(0);
      expect(page.hasTagFilterEntry).toBeFalsy();
    });

    it("As LU I cannot see the quickaccess tag section if I am not allowed to", () => {
      expect.assertions(2);
      const page = new HomePagePage(denyUiActionProps());

      expect(page.chips.length).toBeGreaterThan(0);
      expect(page.hasTagFilterEntry).toBeFalsy();
    });
  });

  describe("As LU I can see filtered resources on the quickaccess homepage", () => {
    it("it should show suggested resources for the currently active URL", async () => {
      expect.assertions(2);
      const props = defaultProps({
        resources: [
          defaultResourceDto({
            metadata: defaultResourceMetadataDto({
              name: "apache",
              uris: ["http://www.passbolt.com", "http://www.apache.org"],
            }),
          }),
          defaultResourceDto(),
        ],
      });
      props.context.openerTabId = 1;
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "http://www.apache.org/");
      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 0);

      const suggestedResource = props.resources[0];

      expect(page.suggestedResourcesEntries.length).toStrictEqual(1);
      expect(rowText(page.getSuggestedResourceItem(0))).toStrictEqual({
        name: suggestedResource.metadata.name,
        subtitle: `${suggestedResource.metadata.username} · passbolt.com`,
        canFill: true,
      });
    });

    it("it should show suggested OTP resources for the currently active URL", async () => {
      expect.assertions(2);
      const props = defaultProps({
        resources: [
          resourceStandaloneTotpDto({
            metadata: defaultResourceMetadataDto({
              name: "apache totp",
              username: null,
              uris: ["http://www.apache.org"],
              resource_type_id: undefined,
            }),
          }),
          defaultResourceDto(),
        ],
      });
      props.context.openerTabId = 1;
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "http://www.apache.org/");
      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 0);

      const suggestedResource = props.resources[0];

      expect(page.suggestedResourcesEntries.length).toStrictEqual(1);
      expect(rowText(page.getSuggestedResourceItem(0))).toStrictEqual({
        name: suggestedResource.metadata.name,
        subtitle: "apache.org",
        canFill: true,
      });
    });

    it("it should show both password and OTP suggested resources for the currently active URL", async () => {
      expect.assertions(1);
      const props = defaultProps({
        resources: [
          defaultResourceDto({
            metadata: defaultResourceMetadataDto({
              name: "apache password",
              uris: ["http://www.apache.org"],
            }),
          }),
          resourceStandaloneTotpDto({
            metadata: defaultResourceMetadataDto({
              name: "apache totp",
              uris: ["http://www.apache.org"],
              resource_type_id: undefined,
            }),
          }),
          defaultResourceDto(),
        ],
      });
      props.context.openerTabId = 1;
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "http://www.apache.org/");
      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 1);

      expect(page.suggestedResourcesEntries.length).toStrictEqual(2);
    });

    it("it should sort the suggested resources by their uri matching score, the strongest match first", async () => {
      expect.assertions(5);

      const activeTabUrl = "https://www.example.com/app/login";
      // Provided in ascending-score order; the sort must reverse them.
      const sameDomain = defaultResourceDto({
        metadata: defaultResourceMetadataDto({ name: "same-domain-match", uris: ["https://example.com"] }),
      });
      const sameFqdn = defaultResourceDto({
        metadata: defaultResourceMetadataDto({ name: "same-fqdn-match", uris: ["https://www.example.com/pricing"] }),
      });
      const subPage = defaultResourceDto({
        metadata: defaultResourceMetadataDto({ name: "sub-page-match", uris: ["https://www.example.com/app"] }),
      });
      const exact = defaultResourceDto({
        metadata: defaultResourceMetadataDto({ name: "exact-match", uris: ["https://www.example.com/app/login"] }),
      });

      const props = defaultProps({ resources: [sameDomain, sameFqdn, subPage, exact] });
      props.context.openerTabId = 1;
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => activeTabUrl);
      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 3);

      expect(page.suggestedResourcesEntries.length).toStrictEqual(4);
      expect(page.getSuggestedResourceItem(0).textContent).toContain("exact-match");
      expect(page.getSuggestedResourceItem(1).textContent).toContain("sub-page-match");
      expect(page.getSuggestedResourceItem(2).textContent).toContain("same-fqdn-match");
      expect(page.getSuggestedResourceItem(3).textContent).toContain("same-domain-match");
    });

    it("it should show a message telling there is no suggested resources for the currently active URL", async () => {
      expect.assertions(2);
      const props = defaultProps({
        resources: [defaultResourceDto(), defaultResourceDto()],
      });
      props.context.openerTabId = 1;
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "about:blank");
      const page = new HomePagePage(props);

      expect(page.suggestedResourcesEntries.length).toStrictEqual(0);
      expect(page.suggestedResourcesContent.querySelector(".passbob-empty").textContent).toStrictEqual(
        "Nothing saved for this page. Search, or create it.",
      );
    });

    it("it should filter resources by the search search", async () => {
      expect.assertions(2);
      const props = defaultProps({
        resources: [
          defaultResourceDto({ metadata: defaultResourceMetadataDto({ name: "test" }) }),
          defaultResourceDto({ metadata: defaultResourceMetadataDto({ name: "other" }) }),
        ],
      });
      props.context.openerTabId = 1;
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "about:blank");

      //triggers a search on the available resources
      props.context.search = "test";

      const page = new HomePagePage(props);

      const expectedResource = props.resources[0];

      expect(page.browsedResources.length).toStrictEqual(1);
      expect(rowText(page.browsedResources[0])).toStrictEqual({
        name: expectedResource.metadata.name,
        subtitle: `${expectedResource.metadata.username} · passbolt.com`,
        canFill: false,
      });
    });

    it("it should show a message if the search does not give any results", () => {
      expect.assertions(2);
      const props = defaultProps({
        resources: [defaultResourceDto(), defaultResourceDto()],
      });
      props.context.openerTabId = 1;
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "about:blank");

      //triggers a search on the available resources
      props.context.search = "test";

      const page = new HomePagePage(props);

      expect(page.browsedResources.length).toStrictEqual(0);
      expect(page.browsedResourcesContent.querySelector(".passbob-empty").textContent).toStrictEqual(
        "No result match your search. Try with another search term.",
      );
    });
  });

  describe("As LU I can use resource to auto-fill the current page", () => {
    it("I can click on a suggested resource to use it on the current tab then the quickaccess stays open on it", async () => {
      expect.assertions(5);

      const expectedOpenerTabId = 1;
      const suggestedResource = defaultResourceDto({ metadata: { name: "apache", uris: ["http://www.apache.org"] } });

      const props = defaultProps({ resources: [suggestedResource] });
      props.context.openerTabId = expectedOpenerTabId;
      props.history = createMemoryHistory();
      props.context.port.addRequestListener(
        "passbolt.active-tab.get-url",
        async () => suggestedResource.metadata.uris[0],
      );
      props.context.port.addRequestListener(
        "passbolt.quickaccess.use-resource-on-current-tab",
        async (resourceId, openerTabId) => {
          expect(resourceId).toStrictEqual(suggestedResource.id);
          expect(openerTabId).toStrictEqual(expectedOpenerTabId);
        },
      );

      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 0);

      await page.clickOnSuggestedResource(0);
      await waitForTrue(() => props.history.location.pathname.includes(suggestedResource.id));
      expect(props.history.location.pathname).toStrictEqual(
        `/webAccessibleResources/quickaccess/resources/view/${suggestedResource.id}`,
      );
      expect(props.history.location.state).toStrictEqual({ passbobFilled: true });
      expect(props.context.closeWindow).not.toHaveBeenCalled();
    });

    it("I can click on a suggested resource to use it on the current tab then the quickaccess closes if I asked for it", async () => {
      expect.assertions(1);

      const suggestedResource = defaultResourceDto({ metadata: { name: "apache", uris: ["http://www.apache.org"] } });

      const props = defaultProps({ resources: [suggestedResource] });
      props.context.openerTabId = 1;
      props.context.storage.local.set({ "passbob.settings": { closeAfterAutofill: true } });
      props.context.port.addRequestListener(
        "passbolt.active-tab.get-url",
        async () => suggestedResource.metadata.uris[0],
      );
      props.context.port.addRequestListener("passbolt.quickaccess.use-resource-on-current-tab", async () => {});

      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 0);

      await page.clickOnSuggestedResource(0);
      await waitForTrue(() => props.context.closeWindow.mock.calls.length > 0);
      expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
    });

    it("I can click on a searched resource to open it", async () => {
      expect.assertions(1);

      const expectedOpenerTabId = 1;
      const searchedResource = defaultResourceDto({ metadata: { name: "apache", uris: ["http://www.apache.org"] } });

      const props = defaultProps({ resources: [searchedResource] });
      props.context.openerTabId = expectedOpenerTabId;
      props.context.search = "apache";
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "about:blank");
      props.history = createMemoryHistory();
      const initialPath = props.history.location.pathname;

      const page = new HomePagePage(props);
      await waitForTrue(() => page.browsedResources.length > 0);

      fireEvent.click(page.browsedResources[0].querySelector(".passbob-row-main"), { button: 0 });
      await waitForTrue(() => props.history.location.pathname !== initialPath);

      expect(props.history.location.pathname).toStrictEqual(
        `/webAccessibleResources/quickaccess/resources/view/${searchedResource.id}`,
      );
    });

    it("If I cannot use a resource on the current tab, I should see an error message and the quickaccess should not close", async () => {
      expect.assertions(2);
      const originalWindowClose = window.close;
      window.close = jest.fn();

      const expectedOpenerTabId = 1;
      const suggestedResource = defaultResourceDto({ metadata: { name: "apache", uris: ["http://www.apache.org"] } });

      const props = defaultProps({ resources: [suggestedResource] });
      props.context.openerTabId = expectedOpenerTabId;
      props.context.port.addRequestListener(
        "passbolt.active-tab.get-url",
        async () => suggestedResource.metadata.uris[0],
      );
      props.context.port.addRequestListener("passbolt.quickaccess.use-resource-on-current-tab", async () => {
        throw new Error();
      });

      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 0);

      await page.clickOnSuggestedResource(0);
      await waitForTrue(() => page.useOnThisTabError);

      expect(page.useOnThisTabError.textContent).toStrictEqual(
        "Unable to use the password on this page. Copy and paste the information instead.",
      );
      expect(window.close).not.toHaveBeenCalled();

      window.close = originalWindowClose;
    });

    it("should not close the quickacess and not show the error message if the user aborted the operation", async () => {
      expect.assertions(2);
      const originalWindowClose = window.close;
      window.close = jest.fn();

      const expectedOpenerTabId = 1;
      const suggestedResource = defaultResourceDto({ metadata: { name: "apache", uris: ["http://www.apache.org"] } });

      const expectedError = new Error();
      expectedError.name = "UserAbortsOperationError";

      const props = defaultProps({ resources: [suggestedResource] });
      props.context.openerTabId = expectedOpenerTabId;
      props.context.port.addRequestListener(
        "passbolt.active-tab.get-url",
        async () => suggestedResource.metadata.uris[0],
      );

      let requestDone = false;
      props.context.port.addRequestListener("passbolt.quickaccess.use-resource-on-current-tab", async () => {
        requestDone = true;
        throw expectedError;
      });

      const page = new HomePagePage(props);

      await waitForTrue(() => page.suggestedResourcesEntries?.length > 0);

      await page.clickOnSuggestedResource(0);
      await waitForTrue(() => requestDone);

      expect(page.useOnThisTabError).toBeNull();
      expect(window.close).not.toHaveBeenCalled();

      window.close = originalWindowClose;
    });
  });

  describe("As LU I can create resource from the button", () => {
    it("should display the button if metadata type settings and resource types are loaded", () => {
      const props = defaultProps();
      const page = new HomePagePage(props);
      expect(page.createButton).toBeDefined();
    });

    it("should display the button if metadata type settings and resource types are loaded for v5", () => {
      const metadataTypeSettingEntity = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
      const props = defaultProps({ metadataTypeSettings: metadataTypeSettingEntity });
      const page = new HomePagePage(props);
      expect(page.createButton).toBeDefined();
    });

    it("should display action aborted missing metadata keys if share metadata key is enforced and user has missing keys", async () => {
      expect.assertions(2);

      const props = defaultProps({
        context: defaultAppContext({
          loggedInUser: defaultUserDto({ missing_metadata_key_ids: [uuidv4()] }, { withRole: true }),
        }),
        metadataTypeSettings: new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV50FreshDto()),
        metadataKeysSettings: new MetadataKeysSettingsEntity(
          defaultMetadataKeysSettingsDto({ allow_usage_of_personal_keys: false }),
        ),
      });
      props.history = createMemoryHistory();

      const initialPath = props.history.location.pathname;
      const page = new HomePagePage(props);

      expect(page.createButton).toBeDefined();

      await page.clickOnCreateButton();
      await waitForTrue(() => props.history.location.pathname !== initialPath);

      expect(props.history.location.pathname).toStrictEqual(
        `/webAccessibleResources/quickaccess/resources/action-aborted-missing-metadata-keys`,
      );
    });

    it("should not display the button if metadata type settings are not loaded", () => {
      const props = defaultProps({ metadataTypeSettings: null });
      const page = new HomePagePage(props);
      expect(page.createButton).toBeNull();
    });

    it("should not display the button if resource types are not loaded", () => {
      const props = defaultProps({ resourceTypes: null });
      const page = new HomePagePage(props);
      expect(page.createButton).toBeNull();
    });

    it("should not display the button if metadata type settings default is v5 and only v4 resource types is available", () => {
      const metadataTypeSettingEntity = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV50FreshDto());
      const resourceTypesCollection = new ResourceTypesCollection(resourceTypesV4CollectionDto());
      const props = defaultProps({
        metadataTypeSettings: metadataTypeSettingEntity,
        resourceTypes: resourceTypesCollection,
      });
      const page = new HomePagePage(props);
      expect(page.createButton).toBeNull();
    });

    it("should not display the button if metadata type settings default is v4 and only v5 resource types is available", () => {
      const resourceTypesCollection = new ResourceTypesCollection(resourceTypesV5CollectionDto());
      const props = defaultProps({ resourceTypes: resourceTypesCollection });
      const page = new HomePagePage(props);
      expect(page.createButton).toBeNull();
    });

    it("should not display the create button if the session is offline", () => {
      expect.assertions(1);
      const props = defaultProps({
        activeSession: new UserActiveSessionEntity(offlineUserActiveSessionDto()),
      });
      const page = new HomePagePage(props);
      expect(page.createButton).toBeNull();
    });
  });

  describe("Passbob: copy, edit and keyboard from the home", () => {
    const TOTP = { secret_key: "JBSWY3DPEHPK3PXP", algorithm: "SHA1", digits: 6, period: 30 };

    /**
     * Props with one resource matching the page, and a spy on the background requests.
     * @param {object} options
     * @param {Array} [options.resources] The resources, the first one matches the page
     * @returns {object}
     */
    const pageProps = ({ resources } = {}) => {
      const matching = defaultResourceDto({
        metadata: defaultResourceMetadataDto({ name: "apache", username: "admin", uris: ["https://www.apache.org"] }),
      });
      const props = defaultProps({ resources: resources || [matching, defaultResourceDto()] });
      props.history = createMemoryHistory();
      props.context.port.addRequestListener("passbolt.active-tab.get-url", async () => "https://www.apache.org/");
      props.context.port.addRequestListener("passbolt.secret.find-by-resource-id", async () => ({
        password: "s3cret-password",
        totp: TOTP,
      }));
      props.context.port.addRequestListener("passbolt.clipboard.copy", async () => {});
      props.context.port.addRequestListener("passbolt.clipboard.copy-temporarily", async () => {});
      props.context.port.addRequestListener("passbolt.quickaccess.use-resource-on-current-tab", async () => {});
      jest.spyOn(props.context.port, "request");
      return props;
    };

    const renderHome = async (props) => {
      const page = new HomePagePage(props);
      await waitForTrue(() => page.suggestedResourcesEntries?.length > 0);
      return page;
    };

    const clickAction = async (row, label) => {
      fireEvent.click(row.querySelector(`[aria-label="${label}"]`), { button: 0 });
      await waitForTrue(() => row.querySelector(".passbob-row-actions svg") !== null);
    };

    it("copies the username as is", async () => {
      const props = pageProps();
      const page = await renderHome(props);

      await clickAction(page.getSuggestedResourceItem(0), "Copy username");

      await waitForTrue(() =>
        props.context.port.request.mock.calls.some(([event]) => event === "passbolt.clipboard.copy"),
      );
      expect(props.context.port.request).toHaveBeenCalledWith("passbolt.clipboard.copy", "admin");
      expect(props.context.port.request).not.toHaveBeenCalledWith(
        "passbolt.secret.find-by-resource-id",
        expect.anything(),
      );
    });

    it("decrypts and copies the password, cleared from the clipboard later", async () => {
      const props = pageProps();
      const page = await renderHome(props);

      await clickAction(page.getSuggestedResourceItem(0), "Copy password");

      await waitForTrue(() =>
        props.context.port.request.mock.calls.some(([event]) => event === "passbolt.clipboard.copy-temporarily"),
      );
      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.secret.find-by-resource-id",
        props.resources[0].id,
      );
      expect(props.context.port.request).toHaveBeenCalledWith("passbolt.clipboard.copy-temporarily", "s3cret-password");
      await waitForTrue(() => props.context.storage.local.get(["passbob.recent"])["passbob.recent"]?.length > 0);
      expect(props.context.storage.local.get(["passbob.recent"])["passbob.recent"]).toStrictEqual([
        props.resources[0].id,
      ]);
    });

    it("does not offer to copy secrets when RBAC denies it", async () => {
      const props = pageProps();
      props.rbacContext = denyUiActionProps().rbacContext;
      const page = await renderHome(props);

      const row = page.getSuggestedResourceItem(0);
      expect(row.querySelector('[aria-label="Copy password"]')).toBeNull();
      expect(row.querySelector('[aria-label="Copy username"]')).not.toBeNull();
    });

    it("offers to edit a resource the user can update, not one they can only read", async () => {
      const readOnly = resourceWithReadPermissionDto({
        metadata: defaultResourceMetadataDto({ name: "read only", uris: ["https://www.apache.org/docs"] }),
      });
      const props = pageProps();
      props.resources = [props.resources[0], readOnly];
      const page = await renderHome(props);
      await waitForTrue(() => page.suggestedResourcesEntries.length === 2);

      const rows = [...page.suggestedResourcesEntries];
      const byName = (name) => rows.find((row) => row.querySelector(".passbob-row-name").textContent === name);
      expect(byName("apache").querySelector('[aria-label="Edit"]').getAttribute("href")).toStrictEqual(
        `/webAccessibleResources/quickaccess/resources/edit/${props.resources[0].id}`,
      );
      expect(byName("read only").querySelector('[aria-label="Edit"]')).toBeNull();
    });

    it("shows the recently used resources below the page's ones", async () => {
      const other = defaultResourceDto({ metadata: defaultResourceMetadataDto({ name: "grafana", uris: [] }) });
      const props = pageProps();
      props.resources = [props.resources[0], other];
      props.context.storage.local.set({ "passbob.recent": [other.id, props.resources[0].id] });
      const page = await renderHome(props);

      await waitForTrue(() => page.sections.length === 2);
      const recentRows = page.sections[1].querySelectorAll(".passbob-row");
      // The page's resource is not repeated in the recently used ones.
      expect(recentRows).toHaveLength(1);
      expect(rowText(recentRows[0])).toStrictEqual({ name: "grafana", subtitle: "admin@passbolt.com", canFill: false });
    });

    it("fills the selected resource with Enter", async () => {
      const props = pageProps();
      const page = await renderHome(props);

      expect(page.getSuggestedResourceItem(0).classList.contains("selected")).toBe(true);
      fireEvent.keyDown(document.body, { key: "Enter" });

      await waitForTrue(() => props.history.location.pathname.includes(props.resources[0].id));
      expect(props.context.port.request).toHaveBeenCalledWith(
        "passbolt.quickaccess.use-resource-on-current-tab",
        props.resources[0].id,
        props.context.openerTabId,
      );
    });

    it("moves the selection with the arrows and opens a resource that does not match the page", async () => {
      const other = defaultResourceDto({ metadata: defaultResourceMetadataDto({ name: "grafana", uris: [] }) });
      const props = pageProps();
      props.resources = [props.resources[0], other];
      props.context.storage.local.set({ "passbob.recent": [other.id] });
      const page = await renderHome(props);
      await waitForTrue(() => page.sections.length === 2);

      fireEvent.keyDown(document.body, { key: "ArrowDown" });
      await waitForTrue(() => page.sections[1].querySelector(".passbob-row.selected") !== null);
      fireEvent.keyDown(document.body, { key: "Enter" });

      await waitForTrue(() => props.history.location.pathname.includes(other.id));
      expect(props.history.location.pathname).toStrictEqual(
        `/webAccessibleResources/quickaccess/resources/view/${other.id}`,
      );
    });

    it("copies the password with C and the one-time code with T", async () => {
      const props = pageProps();
      await renderHome(props);

      fireEvent.keyDown(document.body, { key: "c" });
      await waitForTrue(() =>
        props.context.port.request.mock.calls.some(
          ([event, value]) => event === "passbolt.clipboard.copy-temporarily" && value === "s3cret-password",
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 1600));

      fireEvent.keyDown(document.body, { key: "t" });
      await waitForTrue(() =>
        props.context.port.request.mock.calls.some(
          ([event, value]) => event === "passbolt.clipboard.copy-temporarily" && /^\d{6}$/.test(value),
        ),
      );
      expect(true).toBe(true);
    });

    it("leaves the letters to the search field", async () => {
      const props = pageProps();
      await renderHome(props);
      const input = document.createElement("input");
      document.body.appendChild(input);

      fireEvent.keyDown(input, { key: "c" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(props.context.port.request).not.toHaveBeenCalledWith(
        "passbolt.secret.find-by-resource-id",
        expect.anything(),
      );
      input.remove();
    });
  });
});
