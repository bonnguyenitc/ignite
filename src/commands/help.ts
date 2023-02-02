import { GluegunToolbox } from "gluegun"
import { showGeneratorHelp } from "../tools/generators"
import { p, command, heading } from "../tools/pretty"

module.exports = {
  dashed: true,
  alias: ["h"],
  description: "Displays Ignite CLI help",
  run: async (toolbox: GluegunToolbox) => {
    const { meta, parameters } = toolbox

    p()

    // specific help -- generators
    if (
      parameters.second &&
      (parameters.second === "g" || parameters.second.startsWith("generat"))
    ) {
      return showGeneratorHelp(toolbox)
    }

    heading(`Welcome to BAP CLI ${meta.version()}!`)
    p()
    p("BAP CLI is a cli that helps you create base for new project")
    p()
    heading("Commands")
    p()
    command("new             ", "Creates a new base source", ["bap new"])
    p()
    // command("generate (g)    ", "Generates components and other app features", [
    //   "ignite generate --hello",
    //   "ignite generate component Hello",
    //   "ignite generate model User",
    //   "ignite generate screen Login",
    // ])
    // p()
    // command(
    //   "doctor          ",
    //   "Checks your environment & displays versions of installed dependencies",
    //   ["ignite doctor"],
    // )
    // p()
    // command("rename          ", "Renames your React Native project (experimental)", [
    //   "ignite rename NewName com.mycompany.newname",
    // ])
    // p()
    // command("snackify        ", "Creates a new branch which can be imported as an Expo snack", [
    //   "ignite snackify",
    // ])
    // p()
    // direction(
    //   `See the documentation: ${link("https://github.com/infinitered/ignite/tree/master/docs")}`,
    // )
    // p()
    // direction(
    //   `If you need additional help, join our Slack at ${link("http://community.infinite.red")}`,
    // )
    // p()
  },
}
