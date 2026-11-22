# AWS resources (CloudFormation)

Four templates describe the AWS side of [`docs/deployment-decision.md`](../docs/deployment-decision.md):

| Template | Region | Creates |
|---|---|---|
| `certificate.yml` | us-east-1 | The ACM certificate for `<domain>`, `www.<domain>` and `cdn.<domain>` (CloudFront only reads certificates from us-east-1) |
| `server.yml` | eu-central-1 | The Lightsail instance (daily snapshots, firewall, Docker installed on first boot), its static IP, the `api.<domain>` record (and, with `SiteOnServer=true`, the default, the `<domain>` and `www.<domain>` records), the private bucket for backups (database dumps, photos) and its IAM user |
| `mail.yml` | eu-central-1 | Amazon SES: the verified domain (DKIM, custom MAIL FROM, DMARC), its DNS records and the IAM user whose key is the SMTP login |
| `app.yml` | eu-central-1 | Two private S3 buckets (site, photos), two CloudFront distributions in front of them, the site/`www`/`cdn` records and the IAM user for photos |

The server is its own stack so that a failure or change on the CloudFront side never touches the instance
that holds the database, and so the API can go up first.

Not created on purpose: the DNS zone and, unless you pass `HostedZoneId`, the DNS records (any DNS provider
works), IAM access keys (a key made by a stack is
readable in the stack), and the app setup on the server (that is [`deploy/`](../deploy/README.md)).

Status for `lovestory.vin` (2026-11-13): `mail.yml` is deployed (SES domain verified, SMTP key on the
server, account still in the sandbox). As of 2026-11-11 all templates pass `cfn-lint`. `certificate.yml` is deployed
(stack `lovestory-cert`, certificate issued). `server.yml` is deployed (stack `lovestory-server`, bundle
`micro_3_0`, 1 GB). `app.yml` is **not** deployed: the new AWS account must be verified by AWS Support
before it may create CloudFront distributions.

2026-11-22: AWS Support refused the CloudFront verification for now (it wants a history of usage and
paid bills; ask again after the next billing cycle or two). Until then the instance serves the whole site
(`SiteOnServer=true` in `server.yml`, [`deploy/`](../deploy/README.md)), and `app.yml` waits.

Limits a new AWS account ran into here: the 2 GB Lightsail bundle `small_3_0` was refused (Support: ask
again after 2-3 billing cycles), and CloudFront needs an account verification through a Support case.

## Before you start

You need the AWS CLI configured for your account and a domain you can edit DNS for. Check the Lightsail IDs
`server.yml` defaults to (`BundleId=small_3_0`, `BlueprintId=ubuntu_24_04`) in your region:

```bash
aws lightsail get-bundles --region eu-central-1 --query "bundles[].[bundleId,price,ramSizeInGb,cpuCount,diskSizeInGb]" --output table
aws lightsail get-blueprints --region eu-central-1 --query "blueprints[?type=='os'].[blueprintId,name]" --output text
```

## 0. DNS zone (Route 53)

An apex domain (`example.com` without `www`) can only point at CloudFront through an ALIAS record or CNAME
flattening. If your DNS provider has neither, host the zone in Route 53 ($0.50 a month): create it, then
replace the name servers at the registrar with the four it returns.

```bash
aws route53 create-hosted-zone --name example.com --caller-reference "lovestory-$(date +%s)" \
  --query "{Id:HostedZone.Id,NS:DelegationSet.NameServers}"
```

Pass the zone ID (the part after `/hostedzone/`) as `HostedZoneId` in steps 1 and 2: the stacks then create
the validation records and the site, `www`, `cdn` and `api` records themselves, and step 3 is not needed.
With another DNS provider, leave `HostedZoneId` out and create the records by hand.

## 1. Certificate

```bash
aws cloudformation deploy --region us-east-1 --stack-name lovestory-cert \
  --template-file infra/certificate.yml --parameter-overrides DomainName=example.com HostedZoneId=<zone ID>
```

The command waits until the certificate is validated, which needs the registrar to point at the Route 53
name servers already. Without `HostedZoneId`: while it waits, open the certificate in the ACM console
(us-east-1) and create the DNS validation CNAME records it lists at your DNS provider. Then read the ARN:

```bash
aws cloudformation describe-stacks --region us-east-1 --stack-name lovestory-cert --query "Stacks[0].Outputs" --output table
```

## 2. The server, then the site

The server stack needs neither the certificate nor the site stack, so it can be deployed at any point:

```bash
aws cloudformation deploy --region eu-central-1 --stack-name lovestory-server \
  --template-file infra/server.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides DomainName=example.com HostedZoneId=<zone ID> SshCidr=<your IP>/32
aws cloudformation describe-stacks --region eu-central-1 --stack-name lovestory-server --query "Stacks[0].Outputs" --output table
```

Add `BundleId=micro_3_0` (1 GB, $7) if the account is refused the default 2 GB bundle. With the default
`SiteOnServer=true` the instance also serves the site and the photos, and the stack points `<domain>` and
`www.<domain>` at it: that is the whole setup while the account may not use CloudFront (skip the rest of
this step, step 6, and the photo key of step 4).

Then, once CloudFront is allowed, the site. First update the server stack with `SiteOnServer=false` (its
`<domain>`/`www` records go, and the site is down until the CloudFront ones exist), then:

```bash
aws cloudformation deploy --region eu-central-1 --stack-name lovestory \
  --template-file infra/app.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides DomainName=example.com CertificateArn=<arn from step 1> HostedZoneId=<zone ID>
aws cloudformation describe-stacks --region eu-central-1 --stack-name lovestory --query "Stacks[0].Outputs" --output table
```

Keep the site stack name `lovestory`: `deploy-client.sh` reads its outputs under that name. To look at the
changes before they are applied, add `--no-execute-changeset`. A stack that failed on its first deploy
stays in `ROLLBACK_COMPLETE` and has to be deleted before the next try (`aws cloudformation delete-stack`);
the buckets it had already created are kept and have to be removed by hand.

## 3. DNS

Skip this with `HostedZoneId`: the stacks have created the records. Otherwise the `DnsRecordsToCreate` output
of the site stack and `StaticIpAddress` of the server stack say what to create:

- `<domain>` and `www.<domain>`: ALIAS/CNAME to the site distribution (an apex domain needs a DNS provider
  that supports ALIAS or CNAME flattening, for example Route 53 or Cloudflare).
- `cdn.<domain>`: CNAME to the photo distribution.
- `api.<domain>`: A record to the static IP.

While the site is on the server (`SiteOnServer=true`, no site stack), `<domain>` and `www.<domain>` are
A records to the static IP as well.

## 4. Access keys

Create them by hand, they are shown once:

```bash
aws iam create-access-key --user-name <MediaUserName output of the site stack>
aws iam create-access-key --user-name <BackupUserName output of the server stack>
```

The first goes into `deploy/.env` (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, plus `S3_BUCKET` =
`MediaBucketName` and `S3_PUBLIC_URL=https://cdn.<domain>`). The second goes into `aws configure` on the
server, for `deploy/backup.sh` with `BACKUP_S3_URI=s3://<BackupBucketName>/lovestory` and, while the
photos are on the server, `UPLOADS_S3_URI=s3://<BackupBucketName>/uploads`.

## 5. The server

Get the regional default key once (`aws lightsail download-default-key-pair --region eu-central-1 --query
privateKeyBase64 --output text > ~/.ssh/lightsail.pem`, then `chmod 600`), log in with
`ssh -i ~/.ssh/lightsail.pem ubuntu@<static IP>` and continue with [`deploy/README.md`](../deploy/README.md) from
the clone step. Docker, git and sqlite3 are installed by the launch script on first boot; if `docker` is
missing, look at `/var/log/cloud-init-output.log`.

## 6. The site

```bash
infra/deploy-client.sh example.com        # or: npm run deploy:client -- example.com
```

Run it from your machine. It reads the bucket and the distribution from the stack outputs (set
`STACK_NAME` and `STACK_REGION` if the stack has another name or region), builds the client with
`VITE_API_BASE=https://api.<domain>/api` (the type check runs first), and refuses to publish a build that
does not contain that address. Then it uploads `assets/` with a one-year `immutable` cache header, the
other files with `no-cache`, `index.html` last, and invalidates `/` and `/index.html`.

Nothing is deleted from the bucket, so a visitor who still has the previous page open can load its files;
remove old files by hand now and then if you like. Other `VITE_*` settings, such as
`VITE_GOOGLE_MAPS_EMBED`, are read from `client/.env` as usual.

## 7. Email from the site (SES)

```bash
aws cloudformation deploy --region eu-central-1 --stack-name lovestory-mail \
  --template-file infra/mail.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides DomainName=example.com HostedZoneId=<zone ID>
```

The domain is verified once the DKIM and MAIL FROM records resolve (minutes): `aws sesv2 get-email-identity
--region eu-central-1 --email-identity example.com` shows `VerifiedForSendingStatus: true`. Without
`HostedZoneId`, create the records from the `DnsRecordsToCreate` output by hand.

SES wants an SMTP password derived from the IAM key. The helper reads the key from stdin and prints the
`SMTP_URL`; piping it straight to the server keeps it out of the terminal and the shell history:

```bash
aws iam create-access-key --user-name <SmtpUserName output> --query "AccessKey.[AccessKeyId,SecretAccessKey]" \
  --output text | python3 infra/ses-smtp-url.py eu-central-1 | ssh ubuntu@<static IP> 'read -r URL; ...'
```

On the server put the URL into `deploy/.env` as `SMTP_URL`, add `NOTIFY_FROM` and `NOTIFY_EMAIL`
(`deploy/.env.example`), then `docker compose up -d --force-recreate api`. Test with the SES mailbox
simulator (`success@simulator.amazonses.com` accepts mail in the sandbox).

A new SES account is in the sandbox: mail goes only to verified addresses (`aws sesv2
create-email-identity --email-identity <address>` sends a verification link), 200 a day. To write to
guests, request production access once the site is reachable:

```bash
aws sesv2 put-account-details --region eu-central-1 --production-access-enabled --mail-type TRANSACTIONAL \
  --website-url https://example.com --additional-contact-email-addresses owner@example.com --contact-language EN
```

AWS answers within 96 hours; the details cannot be edited while the request is under review.

## Changing things later

- Edit a template and run the same `deploy` command. Do not change these resources in the console; check
  for drift with `aws cloudformation detect-stack-drift`.
- **The instance cannot be changed in place.** The bundle, the OS image and the availability zone are not
  updatable, and a new instance name means replacement. A replaced instance starts with an empty disk, so
  the database has to be restored from a backup (see `deploy/README.md`). Changing `UserData` does nothing
  to a running instance.
- **The buckets are kept when the stack is deleted** (`DeletionPolicy: Retain`), together with the photos
  and backups in them. Delete them by hand only if you mean it.
- To adopt resources that were first created by hand, use CloudFormation's import or IaC generator; the
  certificate, the IAM access keys and DNS records are not importable.
