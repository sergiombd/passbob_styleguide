/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */
import React from "react";
import { render } from "@testing-library/react";
import { Route, Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import userEvent from "@testing-library/user-event";
import MockTranslationProvider from "../../../react-extension/test/mock/components/Internationalisation/MockTranslationProvider";
import ResourceEditPage from "./ResourceEditPage";

export default class ResourceEditPagePage {
  /**
   * @param {object} props The props of the page, with the resourceId to edit
   */
  constructor(props) {
    this.history = createMemoryHistory({
      initialEntries: [`/view/${props.resourceId}`, `/edit/${props.resourceId}`],
      initialIndex: 1,
    });
    jest.spyOn(this.history, "goBack");
    this._page = render(
      <MockTranslationProvider>
        <Router history={this.history}>
          <Route path="/edit/:id" render={() => <ResourceEditPage {...props} />} />
        </Router>
      </MockTranslationProvider>,
    );
    this.user = userEvent.setup();
  }

  field(name) {
    return this._page.container.querySelector(`[name="${name}"]`);
  }

  get name() {
    return this.field("metadata.name");
  }

  get uri() {
    return this.field("metadata.uris.0");
  }

  get username() {
    return this.field("metadata.username");
  }

  get password() {
    return this.field("secret.password");
  }

  get totpKey() {
    return this.field("secret.totp.secret_key");
  }

  get scanButton() {
    return this._page.container.querySelector(".passbob-scan-qr");
  }

  get scanResult() {
    return this._page.container.querySelector(".passbob-scan-result");
  }

  get submitButton() {
    return this._page.container.querySelector('button[type="submit"]');
  }

  get warning() {
    return this._page.container.querySelector(".passbob-edit-warning");
  }

  get unexpectedError() {
    return this._page.container.querySelector(".submit-wrapper .error-message");
  }

  async replace(element, value) {
    await this.user.clear(element);
    if (value) {
      await this.user.type(element, value);
    }
  }

  async submit() {
    await this.user.click(this.submitButton);
  }
}
