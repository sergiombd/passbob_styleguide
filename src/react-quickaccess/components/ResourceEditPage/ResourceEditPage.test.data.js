/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */
import MockStorage from "../../../react-extension/test/mock/MockStorage";
import { defaultAppContext } from "../../contexts/AppContext.test.data";
import { defaultPrepareResourceContext } from "../../contexts/PrepareResourceContext.test.data";
import { defaultPasswordPoliciesContext } from "../../../shared/context/PasswordPoliciesContext/PasswordPoliciesContext.test.data";
import { defaultPasswordPoliciesDto } from "../../../shared/models/passwordPolicies/PasswordPoliciesDto.test.data";
import { defaultPasswordExpirySettingsContext } from "../../../react-extension/contexts/PasswordExpirySettingsContext.test.data";
import ResourceTypesCollection from "../../../shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypesCollectionDto } from "../../../shared/models/entity/resourceType/resourceTypesCollection.test.data";
import {
  defaultResourceDto,
  resourceWithReadPermissionDto,
} from "../../../shared/models/entity/resource/resourceEntity.test.data";
import { defaultResourceMetadataDto } from "../../../shared/models/entity/resource/metadata/resourceMetadataEntity.test.data";
import { TEST_RESOURCE_TYPE_V5_DEFAULT } from "../../../shared/models/entity/resourceType/resourceTypeEntity.test.data";
import UserActiveSessionEntity from "../../../shared/models/entity/session/userActiveSessionEntity";
import { defaultUserActiveSessionDto } from "../../../shared/models/entity/session/userActiveSessionEntity.test.data";

/**
 * A v5 password resource owned by the user.
 * @param {object} data The data to override
 * @returns {object}
 */
export const v5ResourceDto = (data = {}) =>
  defaultResourceDto({
    resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT,
    metadata: defaultResourceMetadataDto({ resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT }),
    ...data,
  });

/**
 * A v5 password resource the user can only read.
 * @returns {object}
 */
export const readOnlyResourceDto = () =>
  resourceWithReadPermissionDto({
    resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT,
    metadata: defaultResourceMetadataDto({ resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT }),
  });

/**
 * Default props
 * @param {object} options
 * @param {object} options.resource The resource to edit
 * @param {object} [options.passwordExpirySettings] The password expiry settings
 * @param {boolean} [options.externalDictionaryCheck] Whether the pwned password check is enabled
 * @returns {object}
 */
export function defaultProps({ resource, passwordExpirySettings = null, externalDictionaryCheck = false } = {}) {
  const storage = new MockStorage();
  storage.local.set({ resources: [resource] });

  return {
    context: defaultAppContext({ storage }),
    resourceTypes: new ResourceTypesCollection(resourceTypesCollectionDto()),
    activeSession: new UserActiveSessionEntity(defaultUserActiveSessionDto()),
    prepareResourceContext: defaultPrepareResourceContext(),
    passwordExpiryContext: defaultPasswordExpirySettingsContext({
      getSettings: () => passwordExpirySettings,
    }),
    passwordPoliciesContext: defaultPasswordPoliciesContext({
      loadPolicies: jest.fn(() => defaultPasswordPoliciesDto({ external_dictionary_check: externalDictionaryCheck })),
    }),
    resourceId: resource.id,
  };
}
