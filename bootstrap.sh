#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=0
FORCE=0
[ "${BOOTSTRAP_DRY_RUN:-0}" = "1" ] && DRY_RUN=1
[ "${BOOTSTRAP_FORCE:-0}" = "1" ] && FORCE=1

run() {
    if [ "$DRY_RUN" = "1" ]; then
        printf '[dry-run] %s\n' "$*"
    else
        "$@"
    fi
}

install_from_list() {
    local list_file="$1"; shift
    local cmd=("$@")
    [ -f "$list_file" ] || return 0
    local pkgs=()
    while IFS= read -r line; do
        case "$line" in ''|\#*) continue ;; esac
        pkgs+=("$line")
    done < "$list_file"
    if [ "${#pkgs[@]}" -gt 0 ]; then
        run "${cmd[@]}" "${pkgs[@]}"
    fi
}

link_dotfile() {
    local name="$1"
    local target="$HOME/$name"
    local rel="dotfiles/dotfiles/$name"
    local abs="$REPO_DIR/dotfiles/$name"

    if [ ! -f "$abs" ]; then
        echo "warn: $abs does not exist; skipping $target"
        return 0
    fi

    if [ -L "$target" ]; then
        local existing
        existing="$(readlink "$target")"
        if [ "$existing" = "$rel" ] || [ "$existing" = "$abs" ]; then
            echo "ok: $target already linked to $existing"
            return 0
        fi
        if [ "$FORCE" = "1" ]; then
            run rm "$target"
        else
            echo "skip: $target is a symlink to $existing (BOOTSTRAP_FORCE=1 to replace)"
            return 0
        fi
    fi

    if [ -e "$target" ] && [ ! -L "$target" ]; then
        if cmp -s "$target" "$abs"; then
            run rm "$target"
        elif [ "$FORCE" = "1" ]; then
            run rm "$target"
        else
            echo "skip: $target exists and differs from $abs (BOOTSTRAP_FORCE=1 to replace)"
            return 0
        fi
    fi

    run ln -s "$rel" "$target"
    echo "linked: $target -> $rel"
}

run sudo dnf upgrade -y
install_from_list "$REPO_DIR/packages/dnf" sudo dnf install -y
install_from_list "$REPO_DIR/packages/npm-global" sudo npm install -g
link_dotfile .bashrc
link_dotfile .gitconfig
