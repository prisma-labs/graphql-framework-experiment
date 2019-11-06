import { Generate } from "../../src/commands/generate";

describe("hello", () => {
  it("prints todo", async () => {
    const spy = jest.spyOn(process.stdout, "write");

    await Generate.run([]);

    expect(spy).toHaveBeenCalledWith("todo" + "\n");
    spy.mockRestore();
  });
});
