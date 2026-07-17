# Rollback

## Frontend Or API Rollback

Use GitHub Actions to redeploy the previous known-good commit.

## Configuration Rollback

If an administrator changes wording or closes submissions accidentally, reopen `/admin` and restore the prior values.

## Data Rollback

Azure Table Storage does not provide application-level undo. Export CSV files before bulk cleanup or event reset. Restore from Azure backup or retained export if OEP has configured that process.

## Emergency Disable

Set submissions to `Closed` in `/admin`. If the admin portal is unavailable, disable the Static Web App in the Azure Portal or restrict access at the Azure edge.
