import { unboundPortStandIn } from './unbound-port-stand-in.js';

interface ExamplePort {
  doThing(): Promise<string>;
}

describe('unboundPortStandIn', () => {
  it('throws a clear, named error when any method is called', async () => {
    const standIn = unboundPortStandIn<ExamplePort>('EXAMPLE_PORT');

    await expect(standIn.doThing()).rejects.toThrow(/EXAMPLE_PORT/);
  });

  it('does not throw merely by being constructed', () => {
    expect(() => unboundPortStandIn<ExamplePort>('EXAMPLE_PORT')).not.toThrow();
  });
});
