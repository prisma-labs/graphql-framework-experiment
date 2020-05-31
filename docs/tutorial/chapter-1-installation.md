In this first chapter we're just going to get the bare minimum of a Nexus project setup. You'll learn about:

- The `nexus` package
- The Nexus CLI
- Laying out and running a Nexus project

For the purpose of this tutorial, we'll start a Nexus project from scratch.

Normally you would run `nexus` (or the scaffolder directly `nexus create app`) to scaffold a new project. But for learning purposes, we suggest not using it yet.

Also, throughout this journey, we'll be making a few minor assumptions about your toolchain to keep the content flowing:

- Using `npm` as the package manager.
- Using a \*nix OS
- Using VSCode

If you're using another set of tools, like Yarn on Windows with Sublime Text, that's totally fine and welcome! But at certain points in this tutorial you'll need to adapt the content to your situation. For example how to check the static type of an identifier in your IDE, or create folders/files from your terminal.

Let's start by creating an empty folder and initializing our `package.json`:

```bash
mkdir nexus-tutorial && cd nexus-tutorial && npm init -y
```

Then, let's add `nexus` as dependency. This might take a couple of seconds.

```bash
npm install nexus
```

Nexus comes out of the box with a CLI. You'll use it often while working on your app. While you can access the CLI of your local nexus via `yarn` or npm scripts or `npx` there's an even easier way. Install `nexus` globally. Then you can access the CLI from anywhere. Nexus is smart enough to delegate all invocations to the _local_ nexus. This is the idiomatic way to work with Nexus, but you aren't forced to do this.

```markdown
npm install --global nexus
```

There are just two CLI commands you need to know about right now:

- `nexus dev` : This command starts a development server in watch mode. Every time you change a file, your app will be restarted.
- `nexus build` : This command builds a "production-ready" server, ready to be deployed.

To easily use the CLI, add the following scripts to your `package.json` file which we'll use as shorthands later.

```json
"scripts": {
  "dev": "nexus dev",
  "build": "nexus build"
}
```

Finally, let's create an `api/` folder and create an empty `api/app.ts` module inside it:

```bash
mkdir api && touch api/app.ts
```

You're almost ready, let's just run our dev server thanks to the scripts we've just created

```bash
npm run dev
```

Woops. If everything went well so far, you should have the following warning

```bash
▲ nexus:schema Your GraphQL schema is empty. [...]
```

This is all fine, you indeed did not add any types to your GraphQL schema yet. Don't worry, we'll get to that very quickly.

More importantly, you should also have a log telling you that your server is up and running.

```bash
● nexus:server listening  --  url: 'http://localhost:4000/'
```

That's it! In the next chapter you'll begin working on your app's schema.
