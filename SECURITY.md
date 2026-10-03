# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue or pull request.

1. Open the repository's [Security tab](https://github.com/greenlikeorange/knayi-myscript/security) and choose **Report a vulnerability**. This uses GitHub's private vulnerability reporting: only you and the maintainers see the report.
2. If that button is not there, open an issue that says you have a security report and asks for a private contact. Leave out every detail of the problem.

Include the knayi version, where it runs (Node, Bun or a browser), and the smallest input that shows the problem, as code points or as a script that builds it. For a slow input, include how the time grows with the input's length.

## What counts as a security problem

- **Super-linear running time.** Every knayi function must run in time linear in the length of its input. An input on which any public function, or any `fontConvert.debugging` call, takes quadratic or worse time is a security bug, even when the output is right: a short input can stall a server that processes untrusted text. The same holds for memory that grows faster than the input. One such case is known and not fixed yet: a long run of dot below with virama or asat, through the final NFC of `normalize` and of conversion to Unicode ([CHANGELOG.md](CHANGELOG.md), 2.10.0, Security).
- **Loading code it should not.** knayi has no runtime dependencies. The only code it loads is the optional `myanmar-tools` package. A way to make knayi load or run other code is a security bug.
- **Anything else** that lets input to knayi harm the program that calls it.

Wrong output, such as a conversion error, is a bug but not a security problem. Report it in a normal [issue](https://github.com/greenlikeorange/knayi-myscript/issues).

## What happens next

- The maintainer confirms the problem, works on a fix in private, and agrees a disclosure date with you.
- The fix ships in a **patch release** of the latest version, labelled as a security fix in [CHANGELOG.md](CHANGELOG.md) and in the GitHub release notes.
- A GitHub security advisory describes the problem once the fix is published, and credits you if you want.

Only the latest release line gets security fixes. Upgrade to the newest patch release to get them.
