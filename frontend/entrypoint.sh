#!/bin/sh
# entrypoint.sh
# Replaces build-time placeholders with runtime environment variables.

replace_in_next() {
  local placeholder=$1
  local value=$2

  if [ "$value" = "__UNSET__" ]; then
    echo "Warning: ${placeholder} has no value, skipping..."
    return
  fi

  echo "Replacing ${placeholder} with ${value}..."

  # Replace in all text files under .next (js, css, html, json, rsc)
  find /app/.next -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.json" -o -name "*.rsc" \) \
    -exec sed -i "s|${placeholder}|${value}|g" {} +
}

echo "Replacing runtime environment variables..."
echo "Running as user: $(id)"
# --- Non NEXT_PUBLIC vars (explicit placeholders) ---
replace_in_next "DOMAIN_NAME_PLACEHOLDER" "${DOMAIN_NAME:-__UNSET__}"
replace_in_next "ADMIN_URL_PLACEHOLDER" "${ADMIN_URL:-__UNSET__}"
replace_in_next "INTERNAL_API_URL_PLACEHOLDER" "${INTERNAL_API_URL:-__UNSET__}"
replace_in_next "HEALTH_USERNAME_PLACEHOLDER" "${HEALTH_USERNAME:-__UNSET__}"
replace_in_next "HEALTH_PASSWORD_PLACEHOLDER" "${HEALTH_PASSWORD:-__UNSET__}"

# --- basePath: placeholder carries the leading slash (Next requires it at build), so swap it whole ---
# Empty NEXT_PUBLIC_BASE_PATH = app served at root.
# The middleware matcher manifests hold it regex-escaped inside JSON ("^\\/NEXT_..."); swap that
# form first with the same escaping, or an empty base path leaves a stray backslash in the regex.
if [ "${NEXT_PUBLIC_BASE_PATH-__UNSET__}" != "__UNSET__" ]; then
  base_path_regex_json=$(printf '%s' "$NEXT_PUBLIC_BASE_PATH" | sed 's|/|\\\\\\\\/|g')
  find /app/.next -type f -name "*.json" \
    -exec sed -i 's|\\\\/NEXT_PUBLIC_BASE_PATH_PLACEHOLDER|'"$base_path_regex_json"'|g' {} +
fi
replace_in_next "/NEXT_PUBLIC_BASE_PATH_PLACEHOLDER" "${NEXT_PUBLIC_BASE_PATH-__UNSET__}"

# --- All NEXT_PUBLIC_* vars (automatic) ---
echo "Replacing NEXT_PUBLIC_* placeholders..."
env | grep '^NEXT_PUBLIC_' | while IFS='=' read -r name value; do
  replace_in_next "${name}_PLACEHOLDER" "$value"
done

# --- Replace placeholders in server.js ---
# sed -i can't write temp files in /app, so process via /tmp and copy back
echo "Preparing server.js..."
cp /app/server.js /tmp/server.js
sed -i "s|DOMAIN_NAME_PLACEHOLDER|${DOMAIN_NAME}|g" /tmp/server.js
sed -i "s|INTERNAL_API_URL_PLACEHOLDER|${INTERNAL_API_URL}|g" /tmp/server.js
sed -i "s|/NEXT_PUBLIC_BASE_PATH_PLACEHOLDER|${NEXT_PUBLIC_BASE_PATH}|g" /tmp/server.js
env | grep '^NEXT_PUBLIC_' | while IFS='=' read -r name value; do
  sed -i "s|${name}_PLACEHOLDER|${value}|g" /tmp/server.js
done
cp /tmp/server.js /app/server.js

echo "Starting Next.js..."
exec node /app/server.js
