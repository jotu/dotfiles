# Alfred alternatives for macOS

## Conclusion

No free, open-source alternative currently matches Alfred's full combination of polish, mature workflows, and ecosystem. The best choice depends on which constraint matters most:

- **Closest overall experience:** Raycast. It has a polished launcher and a large extension ecosystem, but it is proprietary and has account/cloud considerations.
- **Best strict open-source choice:** Quicksilver. It is free, Apache-2.0 licensed, mature, plugin-capable, and available as a Homebrew cask. Its interface is less modern than Alfred's.
- **Most promising modern open-source option:** Caduceus. It is local-first and feature-rich, but young, uses a custom Homebrew tap, and its releases require more Gatekeeper caution.
- **Best minimal launcher:** Walter. It is a small native Swift launcher with TOML configuration, but it has no plugin API or marketplace and no stable Homebrew cask yet.
- **Strong modern candidate:** Sol. It is MIT-licensed, free, available as a first-party Homebrew cask, and includes app/file search, custom shortcuts, scripts, bookmarks, clipboard history, window management, notes, calendar, and many built-in utilities. It is not an Alfred-compatible workflow platform, and its React Native implementation and permissions should be evaluated before making it a default.

There is no primary-source apples-to-apples performance benchmark, so claims about being faster should be treated as project claims rather than established facts.

## Chezmoi fit

This repository manages macOS applications through the Mise package layer in `dot_config/mise/conf.d/00-base.toml.tmpl`. A Homebrew cask can be declared like this:

```toml
"brew-cask:quicksilver" = "latest"
```

Sol is unusually suitable for chezmoi: its source documents `~/.config/sol/config.json` for portable settings and `~/.config/sol/scripts/` for `.sh` and `.applescript` commands. Chezmoi could manage those files while leaving `state.json` (frequency, history, and runtime state) local and unmanaged. Sol requires macOS Sonoma or newer according to its Homebrew cask.

Sol can coexist with AeroSpace, but both applications provide window-management actions and Sol's default resize shortcuts overlap with several AeroSpace shortcuts. The clean boundary is to let AeroSpace own tiling, focus, workspace, and window movement; use Sol for launching, search, scripts, and utility features. Disable Sol's window-management items or remap them. Sol's launcher is implemented as a floating, all-spaces panel, so it should not be treated as a normal tiled application; add an AeroSpace floating rule only if the installed release is detected as a normal window.

Chezmoi can reproducibly manage installation and text-based configuration, but not macOS privacy permissions, application indexes, frecency, clipboard history, or other mutable runtime state. A moving `latest` package is also not byte-for-byte reproducible; pin a version when exact reproducibility matters.

Sol's source also includes production Sentry initialization. Open source does not by itself prove that the application is telemetry-free, so privacy-sensitive adoption should include checking the release configuration and network behavior.

## Sources

- [Quicksilver repository](https://github.com/quicksilver/Quicksilver)
- [Quicksilver website](https://qsapp.com/)
- [Quicksilver Homebrew cask](https://formulae.brew.sh/api/cask/quicksilver.json)
- [Caduceus repository](https://github.com/GeoWizard4645/caduceus)
- [Caduceus extensions](https://github.com/GeoWizard4645/caduceus/blob/main/EXTENSIONS.md)
- [Caduceus Homebrew tap](https://github.com/GeoWizard4645/homebrew-caduceus)
- [Walter repository](https://github.com/ekinertac/walter)
- [Walter website](https://walterlauncher.com/)
- [Raycast pricing](https://raycast.com/pricing)
- [Raycast privacy](https://raycast.com/privacy)
- [Raycast extensions](https://github.com/raycast/extensions)
- [Ueli repository](https://github.com/oliverschwendener/ueli)
- [LaunchBar website](https://www.obdev.at/products/launchbar/index.html)
- [Sol website](https://sol.ospfranco.com/)
- [Sol repository](https://github.com/ospfranco/sol)
- [Sol Homebrew cask](https://formulae.brew.sh/api/cask/sol.json)
