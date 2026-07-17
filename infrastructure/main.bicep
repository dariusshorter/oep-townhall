targetScope = 'resourceGroup'

@description('Short lowercase name used as a resource prefix.')
param appName string = 'oep-townhall'

@description('Azure region for resources that require a regional location.')
param location string = resourceGroup().location

@description('Microsoft Entra group object ID allowed to administer the portal.')
param adminAllowedGroupId string = ''

@description('Comma-separated admin email allowlist used when group claims are unavailable.')
param adminAllowedUsers string = ''

@description('Town hall display name.')
param townHallName string = 'OEP Strategy Town Hall'

@allowed([
  'Free'
  'Standard'
])
param staticWebAppSku string = 'Standard'

var normalized = toLower(replace(appName, '-', ''))
var storageName = take('${normalized}${uniqueString(resourceGroup().id)}', 24)
var staticWebAppName = '${appName}-web'
var tableName = 'TownHallQuestions'
var settingsTableName = 'TownHallSettings'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource questionsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: tableName
}

resource settingsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: settingsTableName
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: 'centralus'
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  properties: {
    allowConfigFileUpdates: true
    provider: 'GitHub'
    stagingEnvironmentPolicy: 'Enabled'
  }
}

resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'functionappsettings'
  properties: {
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
    AZURE_STORAGE_ACCOUNT_NAME: storage.name
    TABLE_NAME: tableName
    SETTINGS_TABLE_NAME: settingsTableName
    ADMIN_ALLOWED_GROUP_ID: adminAllowedGroupId
    ADMIN_ALLOWED_USERS: adminAllowedUsers
    TOWN_HALL_NAME: townHallName
    MAX_QUESTION_LENGTH: '2000'
    RATE_LIMIT_ENABLED: 'true'
    CAPTCHA_ENABLED: 'false'
  }
}

output storageAccountName string = storage.name
output staticWebAppName string = staticWebApp.name
output publicSubmissionUrl string = 'https://${staticWebApp.properties.defaultHostname}/'
output adminUrl string = 'https://${staticWebApp.properties.defaultHostname}/admin'
output presenterUrl string = 'https://${staticWebApp.properties.defaultHostname}/present'
output tableName string = tableName
output settingsTableName string = settingsTableName
