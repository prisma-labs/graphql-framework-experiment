import { createApp, objectType } from "../lib";

const User = objectType({
  name: "User",
  definition(t) {
    t.id("id");
    t.string("name");
  }
});

objectType({
  name: "Query",
  definition(t) {
    t.field("user", { type: User });
  }
});

createApp().startServer();
