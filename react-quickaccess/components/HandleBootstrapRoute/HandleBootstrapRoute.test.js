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
 * @since         6.0.0
 */

/**
 * Unit tests on SessionExpired in regard of specifications
 */
import { defaultProps, propsWithOfflineModeCapability } from "./HandleBootstrapRoute.test.data";
import HandleBootstrapRoutePage from "./HandleBootstrapRoute.test.page";
import UserActiveSessionEntity, {
  USER_ACTIVE_SESSION_OFFLINE,
} from "../../../shared/models/entity/session/userActiveSessionEntity";
import { defaultUserActiveSessionDto } from "../../../shared/models/entity/session/userActiveSessionEntity.test.data";
import { BOOTSTRAP_FEATURE } from "../../ExtQuickAccess";

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe("HandleBootstrapRoute", () => {
  describe("As LU I should handle bootstrap route for quickaccess", () => {
    it("As LU I should be redirected to auto save page", () => {
      expect.assertions(1);
      const props = defaultProps();
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/resources/autosave");
    });

    it("As LU I should be redirected to login page", () => {
      expect.assertions(1);
      const props = defaultProps({
        activeSession: new UserActiveSessionEntity(defaultUserActiveSessionDto({ is_authenticated: false })),
      });
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/login");
    });

    it("As LU with an authenticated online session that lost the network I should be redirected to the server not reachable page", () => {
      expect.assertions(1);
      const props = defaultProps({
        activeSession: new UserActiveSessionEntity(defaultUserActiveSessionDto({ is_server_reachable: false })),
      });
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/server-not-reachable");
    });

    it("As Anonymous user with no session and an unreachable server I should be redirected to the server not reachable page", () => {
      expect.assertions(1);
      const props = defaultProps({
        activeSession: new UserActiveSessionEntity(
          defaultUserActiveSessionDto({ is_authenticated: false, is_server_reachable: false }),
        ),
      });
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/server-not-reachable");
    });

    it("As a signed-out user who cannot use the offline mode with an unreachable server I should be redirected to the server not reachable page", () => {
      expect.assertions(1);
      const props = propsWithOfflineModeCapability(
        defaultUserActiveSessionDto({ is_authenticated: false, is_server_reachable: false }),
        false,
      );
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/server-not-reachable");
    });

    it("As a signed-out user who can use the offline mode with a reachable server I should be redirected to the online login page", () => {
      expect.assertions(1);
      const props = propsWithOfflineModeCapability(
        defaultUserActiveSessionDto({ is_authenticated: false, is_server_reachable: true }),
        true,
      );
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/login");
    });

    it("As LU with an authenticated online session that lost the network and who can use the offline mode I should be redirected to the server not reachable page", () => {
      expect.assertions(1);
      const props = propsWithOfflineModeCapability(defaultUserActiveSessionDto({ is_server_reachable: false }), true);
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/server-not-reachable");
    });

    it("As LU with an authenticated offline session and an unreachable server I should stay signed in even if the offline mode capability is not resolved yet", () => {
      expect.assertions(1);
      const props = propsWithOfflineModeCapability(
        defaultUserActiveSessionDto({ type: USER_ACTIVE_SESSION_OFFLINE, is_server_reachable: false }),
        null,
      );
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/home");
    });

    it("As LU with an authenticated offline session and a reachable server I should stay signed in", () => {
      expect.assertions(1);
      const props = defaultProps({
        activeSession: new UserActiveSessionEntity(
          defaultUserActiveSessionDto({ type: USER_ACTIVE_SESSION_OFFLINE, is_server_reachable: true }),
        ),
        bootstrapFeature: null,
      });
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/home");
    });

    it("As LU with an authenticated offline session and an unreachable server I should stay signed in", () => {
      expect.assertions(1);
      const props = defaultProps({
        activeSession: new UserActiveSessionEntity(
          defaultUserActiveSessionDto({ type: USER_ACTIVE_SESSION_OFFLINE, is_server_reachable: false }),
        ),
        bootstrapFeature: null,
      });
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/home");
    });

    it("As LU I should be redirected to new credential page", () => {
      expect.assertions(1);
      const props = defaultProps({ bootstrapFeature: BOOTSTRAP_FEATURE.CREATE_NEW_CREDENTIALS });
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/resources/create");
    });

    it("As LU I should be redirected to new credential save page", () => {
      expect.assertions(1);
      const props = defaultProps({ bootstrapFeature: BOOTSTRAP_FEATURE.SAVE_CREDENTIALS });
      new HandleBootstrapRoutePage(props);

      expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/resources/create");
    });
  });
});

describe("HandleBootstrapRoute (Passbob) - reopen on the last view", () => {
  const RESOURCE_VIEW = "/webAccessibleResources/quickaccess/resources/view/8e3874ae-4b40-590b-968a-418f704b9d9a";
  const HOME = "/webAccessibleResources/quickaccess/home";

  const propsWithLastView = (lastView, props = {}) =>
    defaultProps({
      bootstrapFeature: null,
      lastView,
      history: { push: jest.fn(), replace: jest.fn() },
      ...props,
    });

  it("reopens on the last resource with home underneath, so going back lands on home", () => {
    expect.assertions(2);
    const props = propsWithLastView({ pathname: RESOURCE_VIEW, search: "" });
    new HandleBootstrapRoutePage(props);

    expect(props.history.replace).toHaveBeenCalledWith(HOME, { passbobRestoredSearch: "" });
    expect(props.history.push).toHaveBeenCalledWith(RESOURCE_VIEW);
  });

  it("reopens on home with the last search", () => {
    expect.assertions(2);
    const props = propsWithLastView({ pathname: HOME, search: "gitlab" });
    new HandleBootstrapRoutePage(props);

    expect(props.history.replace).toHaveBeenCalledWith(HOME, { passbobRestoredSearch: "gitlab" });
    expect(props.history.push).not.toHaveBeenCalled();
  });

  it("ignores the last view when a bootstrap feature is requested", () => {
    expect.assertions(2);
    const props = propsWithLastView(
      { pathname: RESOURCE_VIEW, search: "" },
      { bootstrapFeature: BOOTSTRAP_FEATURE.AUTOSAVE_CREDENTIALS },
    );
    new HandleBootstrapRoutePage(props);

    expect(props.history.replace).not.toHaveBeenCalled();
    expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/resources/autosave");
  });

  it("ignores the last view when the user is not authenticated", () => {
    expect.assertions(2);
    const props = propsWithLastView(
      { pathname: RESOURCE_VIEW, search: "" },
      { activeSession: new UserActiveSessionEntity(defaultUserActiveSessionDto({ is_authenticated: false })) },
    );
    new HandleBootstrapRoutePage(props);

    expect(props.history.replace).not.toHaveBeenCalled();
    expect(props.history.push).toHaveBeenCalledWith("/webAccessibleResources/quickaccess/login");
  });

  it("goes home when there is no last view", () => {
    expect.assertions(1);
    const props = propsWithLastView(null);
    new HandleBootstrapRoutePage(props);

    expect(props.history.push).toHaveBeenCalledWith(HOME);
  });
});
