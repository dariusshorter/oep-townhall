# Security

## Controls

- HTTPS only
- Microsoft Entra ID authentication for `/admin`, `/present`, and protected API routes
- Server-side authorization on all administrative and presenter API endpoints
- Azure Table Storage is not directly public
- Content Security Policy and hardened HTTP headers in `staticwebapp.config.json`
- Plain-text treatment for all submitted content
- Generic browser-facing API errors
- CSV formula injection protection
- No analytics, ads, third-party trackers, or tracking cookies

## Public Submission Privacy

The public form does not ask for and does not intentionally store identity, IP address, user agent, location, referrer, device identifiers, or browser fingerprints.

## Rate Limiting

The API includes server-side throttling without persistent browser identifiers. The default in-memory limiter is intentionally simple because serverless instances can scale out. For heavy abuse, enable Azure Front Door WAF or a privacy-reviewed CAPTCHA alternative.

## Secrets

Do not commit secrets. Azure deployment stores storage access configuration in Static Web Apps app settings, never frontend code.

## Recommended Azure Hardening

- Use an Entra group for administrator access.
- Keep diagnostic log retention short.
- Enable Microsoft Defender for Cloud recommendations.
- Enable repository secret scanning and dependency scanning.
- Review Azure Static Web Apps authentication configuration after deployment.
