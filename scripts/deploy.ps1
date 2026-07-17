param(
  [string]$SubscriptionId,
  [string]$ResourceGroupName,
  [string]$Location = "centralus",
  [string]$AppName = "oep-townhall",
  [string]$AdminAllowedGroupId = "",
  [string]$AdminAllowedUsers = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI is required. Install it from https://learn.microsoft.com/cli/azure/install-azure-cli"
}

az account show 1>$null

if (-not $SubscriptionId) {
  $SubscriptionId = Read-Host "Azure subscription ID"
}
if (-not $ResourceGroupName) {
  $ResourceGroupName = Read-Host "Resource group name"
}
if (-not $AdminAllowedGroupId -and -not $AdminAllowedUsers) {
  $AdminAllowedUsers = Read-Host "Comma-separated OEP admin email addresses"
}

az account set --subscription $SubscriptionId
az group create --name $ResourceGroupName --location $Location 1>$null

$deployment = az deployment group create `
  --resource-group $ResourceGroupName `
  --template-file infrastructure/main.bicep `
  --parameters appName=$AppName location=$Location adminAllowedGroupId=$AdminAllowedGroupId adminAllowedUsers=$AdminAllowedUsers `
  --query properties.outputs `
  --output json | ConvertFrom-Json

npm.cmd install
npm.cmd run build
npm.cmd install --prefix api --omit=dev

$staticWebAppName = $deployment.staticWebAppName.value
$storageAccountName = $deployment.storageAccountName.value
$storageConnectionString = az storage account show-connection-string `
  --name $storageAccountName `
  --resource-group $ResourceGroupName `
  --query connectionString `
  --output tsv

az staticwebapp appsettings set `
  --name $staticWebAppName `
  --resource-group $ResourceGroupName `
  --setting-names `
    "AZURE_STORAGE_CONNECTION_STRING=$storageConnectionString" `
    "AZURE_STORAGE_ACCOUNT_NAME=$storageAccountName" `
    "TABLE_NAME=TownHallQuestions" `
    "SETTINGS_TABLE_NAME=TownHallSettings" `
    "ADMIN_ALLOWED_GROUP_ID=$AdminAllowedGroupId" `
    "ADMIN_ALLOWED_USERS=$AdminAllowedUsers" `
    "TOWN_HALL_NAME=OEP Strategy Town Hall" `
    "MAX_QUESTION_LENGTH=2000" `
    "RATE_LIMIT_ENABLED=true" `
    "CAPTCHA_ENABLED=false" | Out-Null

$deploymentToken = az staticwebapp secrets list --name $staticWebAppName --resource-group $ResourceGroupName --query properties.apiKey -o tsv

npx.cmd @azure/static-web-apps-cli deploy ./frontend/dist `
  --api-location ./api `
  --api-language node `
  --api-version 20 `
  --env production `
  --deployment-token $deploymentToken

if ($LASTEXITCODE -ne 0) {
  throw "Static Web Apps content deployment failed. The Azure resources may exist, but the site files were not uploaded."
}

Write-Host ""
Write-Host "Deployment complete."
Write-Host "Public URL: $($deployment.publicSubmissionUrl.value)"
Write-Host "Admin URL: $($deployment.adminUrl.value)"
Write-Host "Presenter URL: $($deployment.presenterUrl.value)"
Write-Host "Authorize administrators by adding users to the Entra group or ADMIN_ALLOWED_USERS setting."
