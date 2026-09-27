/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */
import React from "react";
import { act, render } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { PassbobRouteTracker } from "./PassbobRouteTracker";
import PassbobStorageService from "../../../shared/services/passbob/passbobStorageService";

const HOME = "/webAccessibleResources/quickaccess/home";
const RESOURCE_VIEW = "/webAccessibleResources/quickaccess/resources/view/8e3874ae-4b40-590b-968a-418f704b9d9a";

const renderTracker = (context, history) =>
  render(
    <Router history={history}>
      <PassbobRouteTracker context={context} history={history} location={history.location} />
    </Router>,
  );

describe("PassbobRouteTracker", () => {
  let context, history;

  beforeEach(() => {
    jest.spyOn(PassbobStorageService, "saveLastView").mockImplementation(async () => {});
    jest.spyOn(PassbobStorageService, "clearLastView").mockImplementation(async () => {});
    context = { storage: {}, search: "" };
    history = createMemoryHistory({ initialEntries: [HOME] });
  });

  afterEach(() => jest.restoreAllMocks());

  it("saves every route change with the current search", () => {
    expect.assertions(1);
    context.search = "gitlab";
    renderTracker(context, history);

    act(() => history.push(RESOURCE_VIEW));

    expect(PassbobStorageService.saveLastView).toHaveBeenCalledWith(context.storage, {
      pathname: RESOURCE_VIEW,
      search: "gitlab",
    });
  });

  it("forgets the last view when the user lands on the login page", () => {
    expect.assertions(2);
    renderTracker(context, history);

    act(() => history.push("/webAccessibleResources/quickaccess/login"));

    expect(PassbobStorageService.clearLastView).toHaveBeenCalledWith(context.storage);
    expect(PassbobStorageService.saveLastView).not.toHaveBeenCalled();
  });
});
