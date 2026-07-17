#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="${RESOURCE_GROUP:-}"
LOCATION="${LOCATION:-centralus}"
APP_NAME="${APP_NAME:-oep-townhall}"
ADMIN_ALLOWED_GROUP_ID="${ADMIN_ALLOWED_GROUP_ID:-}"
ADMIN_ALLOWED_USERS="${ADMIN_ALLOWED_USERS:-}"

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }
az account show >/dev/null

if [ -z "$SUBSCRIPTION_ID" ]; then
  read -r -p "Azure subscription ID: " SUBSCRIPTION_ID
fi
if [ -z "$RESOURCE_GROUP" ]; then
  read -r -p "Resource group name: " RESOURCE_GROUP
fi
if [ -z "$ADMIN_ALLOWED_GROUP_ID" ] && [ -z "$ADMIN_ALLOWED_USERS" ]; then
  read -r -p "Comma-separated OEP admin email addresses: " ADMIN_ALLOWED_USERS
fi

az account set --subscription "$SUBSCRIPTION_ID"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" >/dev/null

OUTPUTS="$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infrastructure/main.bicep \
  --parameters appName="$APP_NAME" location="$LOCATION" adminAllowedGroupId="$ADMIN_ALLOWED_GROUP_ID" adminAllowedUsers="$ADMIN_ALLOWED_USERS" \
  --query properties.outputs \
  --output json)"

npm install
npm run build
npm install --prefix api --omit=dev

STATIC_WEB_APP_NAME="$(node -e "console.log(JSON.parse(process.argv[1]).staticWebAppName.value)" "$OUTPUTS")"
STORAGE_ACCOUNT_NAME="$(node -e "console.log(JSON.parse(process.argv[1]).storageAccountName.value)" "$OUTPUTS")"
PUBLIC_URL="$(node -e "console.log(JSON.parse(process.argv[1]).publicSubmissionUrl.value)" "$OUTPUTS")"
ADMIN_URL="$(node -e "console.log(JSON.parse(process.argv[1]).adminUrl.value)" "$OUTPUTS")"
PRESENTER_URL="$(node -e "console.log(JSON.parse(process.argv[1]).presenterUrl.value)" "$OUTPUTS")"

STORAGE_CONNECTION_STRING="$(az storage account show-connection-string --name "$STORAGE_ACCOUNT_NAME" --resource-group "$RESOURCE_GROUP" --query connectionString --output tsv)"
az staticwebapp appsettings set \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names \
    "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION_STRING" \
    "AZURE_STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT_NAME" \
    "TABLE_NAME=TownHallQuestions" \
    "SETTINGS_TABLE_NAME=TownHallSettings" \
    "ADMIN_ALLOWED_GROUP_ID=$ADMIN_ALLOWED_GROUP_ID" \
    "ADMIN_ALLOWED_USERS=$ADMIN_ALLOWED_USERS" \
    "TOWN_HALL_NAME=OEP Strategy Town Hall" \
    "MAX_QUESTION_LENGTH=2000" \
    "RATE_LIMIT_ENABLED=true" \
    "CAPTCHA_ENABLED=false" >/dev/null

DEPLOYMENT_TOKEN="$(az staticwebapp secrets list --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.apiKey -o tsv)"
npx @azure/static-web-apps-cli deploy ./frontend/dist --api-location ./api --api-language node --api-version 20 --env production --deployment-token "$DEPLOYMENT_TOKEN"

echo
echo "Deployment complete."
echo "Public URL: $PUBLIC_URL"
echo "Admin URL: $ADMIN_URL"
echo "Presenter URL: $PRESENTER_URL"
echo "Authorize administrators by adding users to the Entra group or ADMIN_ALLOWED_USERS setting."
