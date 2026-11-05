# Sourced by deploy.sh and with-env.sh after the environment's file: what every Kamal
# command needs and can work out for itself.
#
#   KAMAL_REGISTRY_PASSWORD  gh's token
#   REGISTRY_OWNER           namespace of the images: the owner of the `origin` remote
#                            (an account or an organization), lowercase
#   REGISTRY_USER            who logs in to the registry: the account gh is logged in as
#   SSH_KEY_FILE             no default: the private key of the deploy user (set it in
#                            ~/.config/tangostack/<environment>.env)
#
# Any of them can be set in that file to override.
export KAMAL_REGISTRY_PASSWORD="${KAMAL_REGISTRY_PASSWORD:-$(gh auth token)}"
if [ -z "${REGISTRY_OWNER:-}" ]; then
  REGISTRY_OWNER=$(git remote get-url origin | sed -E 's|.*[:/]([^/]+)/[^/]+$|\1|' | tr '[:upper:]' '[:lower:]')
fi
export REGISTRY_OWNER
export REGISTRY_USER="${REGISTRY_USER:-$(gh api user --jq .login)}"
: "${SSH_KEY_FILE:?set SSH_KEY_FILE (private key of the deploy user) in ~/.config/tangostack/<environment>.env}"
export SSH_KEY_FILE
