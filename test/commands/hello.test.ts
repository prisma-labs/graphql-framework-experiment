import { Hello } from "../../src/commands/hello";
import { assertCommand } from "../__helpers";

describe("hello", () => {
  it("prints hello world", async () => {
    const spy = jest.spyOn(process.stdout, "write");

    await Hello.run([]);

    expect(spy).toHaveBeenCalledWith("hello world" + "\n");
    spy.mockRestore();
  });

  it("prints hello jeff", async () => {
    const spy = jest.spyOn(process.stdout, "write");

    await Hello.run(["--name", "jeff"]);

    expect(spy).toHaveBeenCalledWith("hello jeff" + "\n");
    spy.mockRestore();
  });
});
