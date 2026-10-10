# Alfred alternatives for macOS

## Conclusion

No free, open-source alternative currently matches Alfred's full combination of polish, mature workflows, and ecosystem. The best choice depends on which constraint matters most:

- **Closest overall experience:** Raycast. It has a polished launcher and a large extension ecosystem, but it is proprietary and has account/cloud considerations.
- **Best strict open-source choice:** Quicksilver. It is free, Apache-2.0 licensed, mature, plugin-capable, and available as a Homebrew cask. Its interface is less modern than Alfred's.
- **Most promising modern open-source option:** Caduceus. It is local-first and feature-rich, but young, uses a custom Homebrew tap, and its releases require more Gatekeeper caution.
- **Best minimal launcher:** Walter. It is a small native Swift launcher with TOML configuration, but it has no plugin API or marketplace and no stable Homebrew cask yet.

No primary-source apples-to-apples benchmark establishes which launcher performs faster. Keep Spotlight for basic app and file search when it meets your needs.

## Chezmoi fit

This repository manages macOS applications through the Mise package layer in `dot_config/mise/conf.d/00-base.toml.tmpl`. A Homebrew cask can be declared like this:

```toml
"brew-cask:quicksilver" = "latest"
```

Chezmoi can reproducibly manage installation and text-based configuration, but not macOS privacy permissions, application indexes, frecency, clipboard history, or other mutable runtime state. A moving `latest` package is also not byte-for-byte reproducible; pin a version when exact reproducibility matters.

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
