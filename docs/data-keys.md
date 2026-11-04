# Chezmoi data keys

Machine-specific values live in `~/.config/chezmoi/chezmoi.toml` under `[data]`, outside this repository. Never commit them or any secrets. `mise run test:data-keys` fails when a template reads a key that this page does not list. Check the rendered values with `chezmoi data`.

List every key as a dotted path in code formatting. The test reads those paths.

## Identity

| Key | Required | Purpose |
| --- | --- | --- |
| `name` | yes | Git author name |
| `editor` | no | Git editor |

## Personal profile

| Key | Required | Purpose |
| --- | --- | --- |
| `personal.git.email` | yes | Git author email |
| `personal.git.signingKey` | yes | Signing key ID |
| `personal.git.username` | no | GitHub username for the personal `gh` profile |
| `personal.git.user` | no | Legacy alias for `personal.git.username` |
| `personal.git.rootDir` | no | Root directory that selects the personal Git profile |
| `personal.ssh.identityFile` | yes | SSH identity filename (not the key) |

## Work profile

| Key | Required | Purpose |
| --- | --- | --- |
| `work.enable` | yes | Turns on work-only configuration |
| `work.git.email` | with work enabled | Git author email |
| `work.git.signingKey` | with work enabled | Signing key ID |
| `work.git.username` | no | GitHub username for the work `gh` profile |
| `work.git.rootDir` | no | Root directory that selects the work Git profile |
| `work.ssh.organization.identityFile` | with work enabled | SSH identity filename for the organization |
| `work.ssh.user.identityFile` | no | SSH identity filename for the user |
| `work.ssh.user` | no | SSH user name |
| `work.employee.code` | with work enabled | Employee code for Kerberos and Keychain lookups |
| `work.domain.name` | with work enabled | Kerberos domain |
| `work.saml.auth.url` | with work enabled | SAML sign-in URL |
| `work.aws.profile` | no | AWS profile name |

## GitHub

| Key | Required | Purpose |
| --- | --- | --- |
| `github.username` | yes | Fallback GitHub username for both profiles |
| `github.personalUsername` | no | Overrides the username for the personal profile |
| `github.workUsername` | no | Overrides the username for the work profile |
| `github.host` | no | GitHub host |
| `github.configDir` | no | `gh` configuration directory |
| `github.personal.gitProtocol` | no | Git protocol for the personal profile |
| `github.work.gitProtocol` | no | Git protocol for the work profile |
