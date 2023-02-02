import { GluegunToolbox } from "../types"
import { pullBoilerplate } from "../tools/react-native"
import { packager, PackagerName } from "../tools/packager"
import {
  p,
  startSpinner,
  stopSpinner,
  clearSpinners,
  ascii,
  em,
  prefix,
  prettyPrompt,
  pkgColor,
  hr,
} from "../tools/pretty"
import type { ValidationsExports } from "../tools/validations"
import { boolFlag } from "../tools/flag"
import { FRAMEWORKS, FRAMEWORKS_TYPES, REACT_NATIVE_BUNDLE_ID } from "../tools/framework"

export interface Options {
  /**
   * Log raw parameters for debugging, run formatting script not quietly
   *
   * Input Source: `parameter.option`
   * @default false
   */
  debug?: boolean
  /**
   * Create new git repository and create an initial commit with boilerplate changes
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default true
   */
  git?: boolean
  /**
   * Whether or not to run packager install script after project is created
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default true
   */
  installDeps?: boolean
  /**
   * Input Source: `parameter.option`
   * @deprecated this option is deprecated. Ignite sets you up to run native or Expo
   * @default undefined
   */
  packager?: "npm" | "yarn" | "pnpm"
  /**
   * The target directory where the project will be created.
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default `${cwd}/${projectName}`
   */
  targetPath?: string
  /**
   * alias for `yes`
   *
   * Whether or not to accept the default options for all prompts
   *
   * Input Source: `parameter.option`
   * @default false
   */
  y?: boolean
  /**
   * Whether or not to accept the default options for all prompts
   * Input Source: `parameter.option`
   * @default false
   */
  yes?: boolean
}

export default {
  run: async (toolbox: GluegunToolbox) => {
    // #region Toolbox
    const { print, filesystem, system, meta, parameters, prompt } = toolbox
    const { exists, path, removeAsync, copy, homedir } = filesystem
    const { info, colors, warning } = print
    const { gray, yellow, underline, white } = colors
    const options: Options = parameters.options

    const yname = boolFlag(options.y) || boolFlag(options.yes)

    const useDefault = (option: unknown) => yname && option === undefined

    const CMD_INDENT = "  "
    const command = (cmd: string) => p2(white(CMD_INDENT + cmd))

    // #endregion

    // debug?
    const debug = boolFlag(options.debug)
    const log = <T = unknown>(m: T): T => {
      debug && info(` ${m}`)
      return m
    }

    // log raw parameters for debugging
    log(`ignite command: ${parameters.argv.join(" ")}`)
    // #endregion

    // #region Framework
    let framework = "ts-react"
    const respBase = await prompt.ask<{ baseName: FRAMEWORKS_TYPES }>(() => ({
      type: "select",
      name: "baseName",
      message: "Which base do you want to use?",
      choices: FRAMEWORKS,
      framework,
      prefix,
    }))
    framework = respBase.baseName
    // #endregion Framework

    const isRN = framework === "ts-react-native"

    // GIT path
    let boilerplateGitPath = ""

    if (framework === "ts-react") {
      boilerplateGitPath = "https://gitlab-new.bap.jp/hue-project-base/base-react-typescript.git"
    }
    if (framework === "ts-react-native") {
      boilerplateGitPath =
        "https://gitlab-new.bap.jp/hue-project-base/react-native-base/react-native-typescript.git"
    }
    if (framework === "php-laravel") {
      boilerplateGitPath =
        "https://gitlab-new.bap.jp/hue-project-base/php-base-projects/laravel_api.git"
    }
    if (framework === "java-spring") {
      boilerplateGitPath =
        "https://gitlab-new.bap.jp/hue-project-base/php-base-projects/laravel_api.git"
    }

    // #region Project Name
    // retrieve project name from toolbox
    p()
    const { validateProjectName } = require("../tools/validations") as ValidationsExports
    const projectName = await validateProjectName(toolbox)
    // #endregion

    // #region Project Path
    const defaultTargetPath = path(projectName)
    let targetPath = useDefault(options.targetPath) ? defaultTargetPath : options.targetPath
    if (targetPath === undefined) {
      const targetPathResponse = await prompt.ask(() => ({
        type: "input",
        name: "targetPath",
        message: "Where do you want to start your project?",
        initial: defaultTargetPath,
        prefix,
      }))

      targetPath = targetPathResponse.targetPath
    }

    const handleHomePrefix = (p: string | undefined) =>
      p?.startsWith("~") ? p.replace("~", homedir()) : p
    targetPath = path(handleHomePrefix(targetPath))

    // #endregion

    if (exists(targetPath)) {
      const alreadyExists = `Error: There's already a folder at ${targetPath}.`
      p()
      p(yellow(alreadyExists))
      process.exit(1)
    }
    // #endregion

    // #region Prompt Git Option
    const defaultGit = undefined
    // let git = useDefault(options.git) ? defaultGit : boolFlag(options.git)
    let git = defaultGit

    if (git === undefined) {
      const gitResponse = await prompt.ask<{ git: boolean }>(() => ({
        type: "confirm",
        name: "git",
        message: "Do you want to initialize a git repository?",
        initial: defaultGit,
        format: prettyPrompt.format.boolean,
        prefix,
      }))
      git = gitResponse.git
    }
    // #endregion

    // #region Packager for framework ts
    // check if a packager is provided, or detect one
    // we pass in expo because we can't use pnpm if we're using expo

    const availablePackagers = packager.availablePackagers()
    const defaultPackagerName = availablePackagers.includes("yarn") ? "yarn" : "npm"
    let packagerName = useDefault(options.packager) ? defaultPackagerName : options.packager

    const validatePackagerName = (input: unknown): input is PackagerName =>
      typeof input === "string" && ["npm", "yarn", "pnpm"].includes(input)

    if (packagerName !== undefined && validatePackagerName(packagerName) === false) {
      p()
      p(yellow(`Error: Invalid packager: "${packagerName}". Valid packagers are npm, yarn, pnpm.`))
      process.exit(1)
    }

    if (packagerName !== undefined && availablePackagers.includes(packagerName) === false) {
      p()
      p(yellow(`Error: selected "${packagerName}" but packager was not available on system`))
      process.exit(1)
    }

    if (
      packagerName === undefined &&
      (framework === "ts-react" || framework === "ts-react-native")
    ) {
      const initial = availablePackagers.findIndex((p) => p === defaultPackagerName)
      const NOT_FOUND = -1

      if (initial === NOT_FOUND) {
        p()
        p(yellow(`Error: Default packager "${defaultPackagerName}" was not available on system`))
        process.exit(1)
      }

      const packagerNameResponse = await prompt.ask<{ packagerName: PackagerName }>(() => ({
        type: "select",
        name: "packagerName",
        message: "Which package manager do you want to use?",
        choices: availablePackagers,
        initial,
        prefix,
      }))
      packagerName = packagerNameResponse.packagerName
    }

    const packagerOptions = { packagerName }

    const ignitePath = path(`${meta.src}`, "..")
    const boilerplatePath = path(ignitePath, "boilerplate")
    const boilerplate = (...pathParts: string[]) => path(boilerplatePath, ...pathParts)
    log(`ignitePath: ${ignitePath}`)
    log(`boilerplatePath: ${boilerplatePath}`)

    const defaultInstallDeps = true
    let installDeps = useDefault(options.installDeps)
      ? defaultInstallDeps
      : boolFlag(options.installDeps)
    if (
      installDeps === undefined &&
      (framework === "ts-react" || framework === "ts-react-native")
    ) {
      const installDepsResponse = await prompt.ask<{ installDeps: boolean }>(() => ({
        type: "confirm",
        name: "installDeps",
        message: "Do you want to install dependencies?",
        initial: defaultInstallDeps,
        format: prettyPrompt.format.boolean,
        prefix,
      }))
      installDeps = installDepsResponse.installDeps
    }
    // #endregion

    // #region Debug
    // start tracking performance
    const perfStart = new Date().getTime()

    // #region Print Welcome
    // welcome everybody!
    const terminalWidth = process.stdout.columns ?? 80
    const logo =
      terminalWidth > 80 ? () => ascii("logo.ascii.txt") : () => ascii("logo-sm.ascii.txt")
    p()
    p()
    p()
    p()
    logo()
    p()
    p()

    if (isRN) {
      const pkg = pkgColor(packagerName)
      p(` █ Creating ${em(projectName)} using ${em(`BapHueCLi ${meta.version()}`)}`)
      p(` █ Package Manager: ${pkg(print.colors.bold(packagerName))}`)
      p(` █ Bundle identifier: ${em(REACT_NATIVE_BUNDLE_ID)}`)
      p(` █ Path: ${underline(targetPath)}`)
    } else {
      p(` █ Creating ${em(projectName)} using ${em(`Ignite ${meta.version()}`)}`)
      p(` █ Path: ${underline(targetPath)}`)
    }
    hr()
    p()

    // #endregion

    // #region Local build folder clean
    // Remove some folders that we don't want to copy over
    // This mostly only applies when you're developing locally
    await Promise.all([
      removeAsync(path(boilerplatePath, "node_modules")),
      removeAsync(path(boilerplatePath, "ios", "Pods")),
      removeAsync(path(boilerplatePath, "ios", "build")),
      removeAsync(path(boilerplatePath, "android", ".idea")),
      removeAsync(path(boilerplatePath, "android", ".gradle")),
      removeAsync(path(boilerplatePath, "android", "build")),
    ])
    // #endregion

    // #region Copy Boilerplate Files
    startSpinner(`Pulling from ${boilerplateGitPath}`)
    p()
    await pullBoilerplate(toolbox, {
      boilerplateGitPath,
      targetPath,
    })
    stopSpinner(`Pulling from ${boilerplateGitPath}`, "🖨")
    // copy the .gitignore if it wasn't copied over
    // Release Ignite installs have the boilerplate's .gitignore in .gitignore.template
    // (see https://github.com/npm/npm/issues/3763); development Ignite still
    // has it in .gitignore. Copy it from one or the other.
    const boilerplateIgnorePath = exists(boilerplate(".gitignore.template"))
      ? boilerplate(".gitignore.template")
      : boilerplate(".gitignore")
    const targetIgnorePath = log(path(targetPath, ".gitignore"))
    copy(log(boilerplateIgnorePath), targetIgnorePath, { overwrite: true })

    if (exists(targetIgnorePath) === false) {
      warning(`  Unable to copy ${boilerplateIgnorePath} to ${targetIgnorePath}`)
    }

    // note the original directory
    const cwd = log(process.cwd())

    // jump into the project to do additional tasks
    process.chdir(targetPath)
    // #endregion

    // #region Run Format
    // we can't run this option if we didn't install deps
    if (installDeps === true) {
      // Make sure all our modifications are formatted nicely
      await packager.run("format", { ...packagerOptions, silent: !debug })
    }
    // #endregion

    // #region Create Git Repository and Initial Commit
    // commit any changes
    if (git === true) {
      startSpinner(" Backing everything up in source control")
      try {
        const isWindows = process.platform === "win32"

        // The separate commands works on Windows, but not Mac OS
        if (isWindows) {
          await system.run(log("git init"))
          await system.run(log("git add -A"))
          await system.run(log(`git commit -m "New Ignite ${meta.version()} app`))
        } else {
          await system.run(
            log(`
              \\rm -rf ./.git
              git init;
              git add -A;
              git commit -m "New Ignite ${meta.version()} app";
            `),
          )
        }
      } catch (e) {
        p(yellow("Unable to commit the initial changes. Please check your git username and email."))
      }
      stopSpinner(" Backing everything up in source control", "🗄")
    }

    // back to the original directory
    process.chdir(log(cwd))
    // #endregion

    // #region Print Finish
    // clean up any spinners we forgot to clear
    p()
    hr()
    p()
    clearSpinners()

    // we're done! round performance stats to .xx digits
    const perfDuration = Math.round((new Date().getTime() - perfStart) / 10) / 100

    /** Add just a _little_ more spacing to match with spinners and heading */
    const p2 = (m = "") => p(` ${m}`)

    p2(`Ignited ${em(`${projectName}`)} in ${gray(`${perfDuration}s`)}  🚀 `)
    p2()

    hr()
    p2()
    p2("Now get cooking! 🍽")
    if (framework === "ts-react" || framework === "ts-react-native") {
      command(`cd ${projectName}`)
      if (!installDeps) command(packager.installCmd({ packagerName }))
      command(`${packagerName} start`)
    }
    p2()
    p2()
    p2()
    // #endregion

    // this is a hack to prevent the process from hanging
    // if there are any tasks left in the event loop
    // like I/O operations to process.stdout and process.stderr
    // see https://github.com/infinitered/ignite/issues/2084
    process.exit(0)
  },
}
