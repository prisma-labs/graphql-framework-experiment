import { Init } from "../../src/commands/init";

describe("hello", () => {
  it("prints todo", async () => {
    const spy = jest.spyOn(process.stdout, "write");

    await Init.run([]);

    expect(spy).toHaveBeenCalledWith("todo" + "\n");
    spy.mockRestore();
  });
});
