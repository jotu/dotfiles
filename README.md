# README
Everything except sensitive information to setup a new computer and keep it in sync.

# Git

## Generate ssh keys for laptop
```bash
    # Generate
    ssh-keygen -t ed25519 -C "your-personal@email.com" -f ~/.ssh/id_ed25519_personal
    # Add to ssh agent
    eval "$(ssh-agent -s)"
    ssh-add ~/.ssh/id_ed25519_personal
    # Add to GitHub or similar
    pbcopy < ~/.ssh/id_ed25519_personal.pub
```

## Generate pgp key for laptop
```bash
    # Generate
    gpg --gen-key
    # Find new key
    gpg --list-keys
    # Get info
    gpg --armor --export <GeneratedKey>
    # Add to GitHub or similar
```

