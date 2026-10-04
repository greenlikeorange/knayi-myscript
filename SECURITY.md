# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue or pull request.

1. Open the repository's [Security tab](https://github.com/greenlikeorange/knayi-myscript/security) and choose **Report a vulnerability**. This uses GitHub's private vulnerability reporting: only you and the maintainers see the report.
2. If that button is not there, open an issue that says you have a security report and asks for a private contact. Leave out every detail of the problem.

Include the knayi version, where it runs (Node, Bun or a browser), and the smallest input that shows the problem, as code points or as a script that builds it. For a slow input, include how the time grows with the input's length.

## What counts as a security problem

- **Super-linear running time.** Every knayi function must run in time linear in the length of its input. An input on which any public function, or any `fontConvert.debugging` call, takes quadratic or worse time is a security bug, even when the output is right: a short input can stall a server that processes untrusted text. The same holds for memory that grows faster than the input. It holds for the time knayi spends in the runtime's own functions, too: `String.prototype.normalize` puts a long run of combining marks in order in quadratic time, so knayi puts such runs in order itself before it calls it (`library/nfc.js`).
- **Loading code it should not.** knayi has no runtime dependencies. The only code it loads is the optional `myanmar-tools` package, and only when a call asks for the `myanmartools` adapter and passes no detector of its own as `zawgyiDetector`. Only `main.js`, which `require` and `import` load in Node and Bun, loads it: with `require`, from knayi's own folder, as Node and Bun resolve any dependency. The builds in `dist/`, among them the ES module build that bundlers load, and knayi bundled into an app load nothing by name, from the working directory or anywhere else. To load nothing at all, make a `ZawgyiDetector` from the copy of `myanmar-tools` you trust and pass it as `zawgyiDetector` (README, "The myanmar-tools detector"). Up to 2.10.0 the builds looked for the package too: the ES module build under Node from the `package.json` of the working directory, so the working directory's `node_modules` decided which code ran, and the builds from their own file where they had a `__filename` (under Bun, or loaded with `require`), where Bun's auto-install could fetch the package from npm. Upgrade, or pass a `zawgyiDetector`. A way to make knayi load or run other code is a security bug.
- **Anything else** that lets input to knayi harm the program that calls it.

Wrong output, such as a conversion error, is a bug but not a security problem. Report it in a normal [issue](https://github.com/greenlikeorange/knayi-myscript/issues).

## What happens next

- The maintainer confirms the problem, works on a fix in private, and agrees a disclosure date with you.
- The fix ships in a **patch release** of the latest version, labelled as a security fix in [CHANGELOG.md](CHANGELOG.md) and in the GitHub release notes.
- A GitHub security advisory describes the problem once the fix is published, and credits you if you want.

Only the latest release line gets security fixes. Upgrade to the newest patch release to get them.
