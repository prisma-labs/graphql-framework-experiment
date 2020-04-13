### With VS Code

We made it very simple to debug your app with VS Code.

> Note: If you used `npx nexus` to initialize your project, jump straight to step 2.

1. Create a `.vscode/launch.json` file and paste the following content

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Nexus App",
      "protocol": "inspector",
      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/nexus",
      "runtimeArgs": ["dev"],
      "sourceMaps": true,
      "console": "integratedTerminal"
    }
  ]
}
```

2. Click on the `Run` tab on the left side of VS Code

3. Make sure `Debug Nexus App` is selected in the dropdown located at the top of the panel that the `Run` tab opened

4. Set some breaking points where you want to inspect your code

5. Click the green "Start debugging" button located next to the dropdown

6. That's it. VS Code should run your code and stop wherever your set some breakpoints



