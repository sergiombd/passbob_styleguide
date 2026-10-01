/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */
import {
  RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
  RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
} from "../../models/entity/resourceType/resourceTypeSchemasDefinition";

/**
 * The resource type the quickaccess creates a password with, with or without an authenticator key (TOTP).
 */
class PassbobCreateResourceTypeService {
  /**
   * @param {ResourceTypesCollection} resourceTypes The resource types of the organization
   * @param {MetadataTypesSettingsEntity} metadataTypeSettings The metadata types settings
   * @param {boolean} withTotp Whether the resource has an authenticator key
   * @returns {ResourceTypeEntity|null} Null if the organization has no such resource type
   */
  static getResourceType(resourceTypes, metadataTypeSettings, withTotp) {
    let slug = null;
    if (metadataTypeSettings?.isDefaultResourceTypeV5) {
      slug = withTotp ? RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG : RESOURCE_TYPE_V5_DEFAULT_SLUG;
    } else if (metadataTypeSettings?.isDefaultResourceTypeV4) {
      slug = withTotp ? RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP_SLUG : RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG;
    }
    return (slug && resourceTypes?.getFirstBySlug(slug)) || null;
  }
}

export default PassbobCreateResourceTypeService;
