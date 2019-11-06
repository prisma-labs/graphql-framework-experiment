import Command from "@oclif/command";

export async function assertCommand(
  command: typeof Command,
  argv: string,
  expectedOutput: string
) {
  const spy = jest.spyOn(process.stdout, "write");

  try {
    await (command as any).run(argv.split(" "));
  } catch (e) {
    console.log("ERROR", e.stack);
  }

  expect(spy).toHaveBeenCalledWith(expectedOutput + "\n");
  spy.mockRestore();
}
