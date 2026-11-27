/**
 * Passbob: unit tests of the quickaccess readiness.
 */
import ExtQuickAccess, { BOOTSTRAP_FEATURE } from "./ExtQuickAccess";
import MockStorage from "../react-extension/test/mock/MockStorage";
import { defaultAccountDto } from "../shared/models/entity/account/accountEntity.test.data";
import AccountEntity from "../shared/models/entity/account/accountEntity";

const buildProps = (props = {}) => ({
  port: { on: jest.fn(), request: jest.fn(async () => defaultAccountDto()) },
  storage: new MockStorage(),
  ...props,
});

/**
 * Build the component as React does: the state can only be set once mounted, never from the constructor.
 * @param {object} props The props
 * @returns {ExtQuickAccess}
 */
const construct = (props) => {
  const component = new ExtQuickAccess(props);
  component.setState = jest.fn();
  return component;
};

describe("ExtQuickAccess", () => {
  it.each(Object.values(BOOTSTRAP_FEATURE))(
    "is ready without a last view when opened for the feature %s",
    (bootstrapFeature) => {
      const component = construct(buildProps({ bootstrapFeature }));
      component.state.account = new AccountEntity(defaultAccountDto());

      expect(component.state.lastView).toBeNull();
      expect(component.isReady()).toBe(true);
    },
  );

  it("waits for the last view when opened plainly", async () => {
    const component = construct(buildProps());
    component.state.account = new AccountEntity(defaultAccountDto());

    expect(component.isReady()).toBe(false);
    await component.getLastView();
    expect(component.setState).toHaveBeenCalledWith({ lastView: null });
  });
});
